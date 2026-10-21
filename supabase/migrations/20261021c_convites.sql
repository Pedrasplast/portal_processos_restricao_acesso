-- =====================================================================
-- PORTAL DE PROCESSOS — CONVITES POR LINK
-- Projeto Supabase: "Gestão de Processos"
-- Requer: 20261021_seguranca_acesso.sql e 20261021b_aprovacao_unica.sql
--
-- O admin gera um link (/cadastro?convite=TOKEN) e envia ao usuário.
-- Quem se cadastra por um link válido já entra LIBERADO.
--
--   * Uso único; expira (1 a 30 dias); pode ser vinculado a um e-mail.
--   * Tabela "convites" sem acesso direto pelo site: só via funções.
--   * O token é aleatório (2 x UUID v4 = 244 bits), impossível de adivinhar.
--
-- Compatível com a versão do site já publicada. Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------

create table if not exists public.convites (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  email        text,
  criado_por   uuid references auth.users (id) on delete set null,
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null,
  usado_por    uuid references auth.users (id) on delete set null,
  usado_em     timestamptz,
  cancelado_em timestamptz
);

create index if not exists idx_convites_criado_por on public.convites (criado_por);
create index if not exists idx_convites_usado_por  on public.convites (usado_por);
create index if not exists idx_convites_abertos
  on public.convites (expira_em)
  where usado_em is null and cancelado_em is null;

alter table public.convites enable row level security;
revoke all on public.convites from anon, authenticated;
-- (sem políticas: ninguém lê/grava direto; só pelas funções abaixo)

-- ---------------------------------------------------------------------
-- 2. Funções do admin
-- ---------------------------------------------------------------------

create or replace function public.criar_convite(p_email text default null, p_dias integer default 7)
returns table (id uuid, token text, email text, expira_em timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 30 then
    raise exception 'A validade deve ser entre 1 e 30 dias.' using errcode = '22023';
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;

  return query
  insert into public.convites as c (token, email, criado_por, expira_em)
  values (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    v_email,
    auth.uid(),
    now() + make_interval(days => p_dias)
  )
  returning c.id, c.token, c.email, c.expira_em;
end;
$$;

-- Convites em aberto + os usados/cancelados nos últimos 30 dias.
create or replace function public.listar_convites()
returns table (
  id          uuid,
  token       text,
  email       text,
  criado_em   timestamptz,
  expira_em   timestamptz,
  usado_em    timestamptz,
  usado_email text,
  situacao    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.token,
         c.email,
         c.criado_em,
         c.expira_em,
         c.usado_em,
         u.email::text,
         case
           when c.usado_em is not null     then 'USADO'
           when c.cancelado_em is not null then 'CANCELADO'
           when c.expira_em <= now()       then 'EXPIRADO'
           else 'ABERTO'
         end
    from public.convites c
    left join auth.users u on u.id = c.usado_por
   where (c.usado_em is null and c.cancelado_em is null and c.expira_em > now())
      or greatest(c.usado_em, c.cancelado_em, c.expira_em) > now() - interval '30 days'
   order by (c.usado_em is null and c.cancelado_em is null and c.expira_em > now()) desc,
            c.criado_em desc
   limit 100;
end;
$$;

create or replace function public.cancelar_convite(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  update public.convites
     set cancelado_em = now()
   where id = p_id
     and usado_em is null
     and cancelado_em is null;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Validação pública (tela de cadastro, antes de ter login)
--    Só responde se o token é válido e, se houver, o e-mail vinculado.
-- ---------------------------------------------------------------------

create or replace function public.validar_convite(p_token text)
returns table (valido boolean, email text, expira_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select true, c.email, c.expira_em
    from public.convites c
   where c.token = p_token
     and length(p_token) = 64
     and c.usado_em is null
     and c.cancelado_em is null
     and c.expira_em > now()
  union all
  select false, null, null
   where not exists (
     select 1 from public.convites c
      where c.token = p_token
        and c.usado_em is null
        and c.cancelado_em is null
        and c.expira_em > now()
   )
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 4. Cadastro: cria o perfil e, se veio por convite válido, já libera.
--    Erro no convite nunca impede o cadastro.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token   text := nullif(trim(new.raw_user_meta_data ->> 'convite'), '');
  v_criador uuid;
begin
  insert into public.profiles (id, email, nome, regra)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), 'usuario')
  on conflict (id) do nothing;

  if v_token is not null then
    begin
      update public.convites c
         set usado_por = new.id,
             usado_em  = now()
       where c.token = v_token
         and c.usado_em is null
         and c.cancelado_em is null
         and c.expira_em > now()
         and (c.email is null or c.email = lower(new.email))
      returning c.criado_por into v_criador;

      if found then
        update public.profiles
           set acesso_liberado = true,
               bloqueado       = false,
               liberado_em     = now(),
               liberado_por    = v_criador
         where id = new.id;
      end if;
    exception when others then
      raise warning 'Convite não aplicado para %: %', new.email, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Permissões
-- ---------------------------------------------------------------------

revoke all on function public.criar_convite(text, integer) from public, anon, authenticated;
revoke all on function public.listar_convites()            from public, anon, authenticated;
revoke all on function public.cancelar_convite(uuid)       from public, anon, authenticated;
revoke all on function public.validar_convite(text)        from public, anon, authenticated;
revoke all on function public.handle_new_user()            from public, anon, authenticated;

grant execute on function public.criar_convite(text, integer) to authenticated;
grant execute on function public.listar_convites()            to authenticated;
grant execute on function public.cancelar_convite(uuid)       to authenticated;
grant execute on function public.validar_convite(text)        to anon, authenticated;
