-- =====================================================================
-- PORTAL DE PROCESSOS — APROVAÇÃO ÚNICA + BLOQUEIO
-- Projeto Supabase: "Gestão de Processos"
-- Requer: 20261021_seguranca_acesso.sql já aplicada.
--
-- Antes: cada login (sessão) precisava de uma nova aprovação.
-- Agora: o admin libera o usuário UMA VEZ; ele entra em qualquer login
--        ou dispositivo até um admin revogar ou bloquear.
--
--   * profiles.acesso_liberado  -> liberado pelo admin
--   * profiles.bloqueado        -> não consegue nem pedir acesso
--   * definir_acesso_usuario(user_id, acao)
--       acao = LIBERAR | REVOGAR | BLOQUEAR | DESBLOQUEAR
--
-- Compatível com a versão do site já publicada (pode rodar antes do
-- deploy). Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------

alter table public.profiles add column if not exists acesso_liberado boolean not null default false;
alter table public.profiles add column if not exists bloqueado       boolean not null default false;
alter table public.profiles add column if not exists liberado_em     timestamptz;
alter table public.profiles
  add column if not exists liberado_por uuid references auth.users (id) on delete set null;

create index if not exists idx_profiles_liberado_por on public.profiles (liberado_por);
create index if not exists idx_solicitacoes_decidido_por on public.solicitacoes_acesso (decidido_por);

-- Uma solicitação pendente por USUÁRIO (antes era por sessão).
update public.solicitacoes_acesso s
   set status = 'CANCELADO', decidido_em = now()
 where s.status = 'PENDENTE'
   and exists (
     select 1 from public.solicitacoes_acesso o
      where o.user_id = s.user_id and o.status = 'PENDENTE' and o.criado_em > s.criado_em
   );

drop index if exists public.solicitacoes_uma_pendente_por_sessao;
create unique index if not exists solicitacoes_uma_pendente_por_usuario
  on public.solicitacoes_acesso (user_id)
  where status = 'PENDENTE';

-- Quem já está com uma sessão aprovada e aberta passa a ficar liberado.
update public.profiles p
   set acesso_liberado = true,
       liberado_em = coalesce(p.liberado_em, now())
 where p.regra = 'usuario'
   and not p.acesso_liberado
   and exists (
     select 1
       from public.solicitacoes_acesso s
       join auth.sessions se on se.id = s.session_id
      where s.user_id = p.id and s.status = 'APROVADO'
   );

-- ---------------------------------------------------------------------
-- 2. Regras de acesso
-- ---------------------------------------------------------------------

create or replace function public.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and (p.regra = 'admin' or (p.acesso_liberado and not p.bloqueado))
  );
$$;

-- 'ADMIN' | 'APROVADO' | 'BLOQUEADO' | 'PENDENTE' | 'NEGADO' | 'CANCELADO' | null
create or replace function public.status_acesso()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    when p.regra = 'admin' then 'ADMIN'
    when p.bloqueado then 'BLOQUEADO'
    when p.acesso_liberado then 'APROVADO'
    else (
      -- Liberação fica no perfil; pedidos só informam PENDENTE ou a
      -- recusa/cancelamento ocorrido neste mesmo login.
      select s.status
        from public.solicitacoes_acesso s
       where s.user_id = p.id
         and (
           s.status = 'PENDENTE'
           or (s.session_id = public.sessao_atual() and s.status in ('NEGADO', 'CANCELADO'))
         )
       order by (s.status = 'PENDENTE') desc, s.criado_em desc
       limit 1
    )
  end
  from (select auth.uid() as uid) x
  left join public.profiles p on p.id = x.uid;
$$;

create or replace function public.solicitar_acesso()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_sessao uuid := public.sessao_atual();
  v_perfil public.profiles%rowtype;
  v_email  text;
begin
  if v_uid is null then
    raise exception 'Sessão inválida. Faça login novamente.' using errcode = '28000';
  end if;

  select * into v_perfil from public.profiles where id = v_uid;

  if v_perfil.regra = 'admin' then return 'ADMIN'; end if;
  if v_perfil.bloqueado       then return 'BLOQUEADO'; end if;
  if v_perfil.acesso_liberado then return 'APROVADO'; end if;

  -- Já tem pedido pendente: só atualiza a sessão de origem.
  update public.solicitacoes_acesso
     set session_id = coalesce(v_sessao, session_id)
   where user_id = v_uid and status = 'PENDENTE';

  if found then return 'PENDENTE'; end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  insert into public.solicitacoes_acesso (user_id, session_id, email, nome, status)
  values (
    v_uid, v_sessao, coalesce(v_email, ''),
    coalesce(v_perfil.nome, (select nullif(trim(u.raw_user_meta_data ->> 'nome'), '') from auth.users u where u.id = v_uid)),
    'PENDENTE'
  );

  return 'PENDENTE';
end;
$$;

create or replace function public.cancelar_minha_solicitacao()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.solicitacoes_acesso
     set status = 'CANCELADO', decidido_em = now()
   where user_id = auth.uid()
     and status = 'PENDENTE';
$$;

-- Pendentes = todos os pedidos em aberto (não depende mais da sessão).
create or replace function public.contar_pendentes()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  return (select count(*)::int from public.solicitacoes_acesso where status = 'PENDENTE');
end;
$$;

-- Admin: liberar / revogar / bloquear / desbloquear um usuário.
create or replace function public.definir_acesso_usuario(p_user_id uuid, p_acao text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_regra text;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  select regra into v_regra from public.profiles where id = p_user_id;

  if v_regra is null then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  if v_regra = 'admin' then
    raise exception 'Administradores não podem ser alterados por aqui.' using errcode = '22023';
  end if;

  case upper(p_acao)
    when 'LIBERAR' then
      update public.profiles
         set acesso_liberado = true, bloqueado = false,
             liberado_em = now(), liberado_por = auth.uid()
       where id = p_user_id;

      update public.solicitacoes_acesso
         set status = 'APROVADO', aprovado_em = now(),
             decidido_em = now(), decidido_por = auth.uid()
       where user_id = p_user_id and status = 'PENDENTE';

    when 'REVOGAR' then
      update public.profiles
         set acesso_liberado = false, liberado_em = null, liberado_por = null
       where id = p_user_id;

    when 'BLOQUEAR' then
      update public.profiles
         set acesso_liberado = false, bloqueado = true,
             liberado_em = null, liberado_por = auth.uid()
       where id = p_user_id;

      update public.solicitacoes_acesso
         set status = 'NEGADO', decidido_em = now(), decidido_por = auth.uid()
       where user_id = p_user_id and status = 'PENDENTE';

    when 'DESBLOQUEAR' then
      update public.profiles
         set bloqueado = false, liberado_por = null
       where id = p_user_id;

    else
      raise exception 'Ação inválida: %', p_acao using errcode = '22023';
  end case;
end;
$$;

-- Aprovar um pedido = liberar o usuário (de forma permanente).
create or replace function public.decidir_solicitacao(p_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if p_status not in ('APROVADO', 'NEGADO') then
    raise exception 'Status inválido: %', p_status using errcode = '22023';
  end if;

  update public.solicitacoes_acesso
     set status       = p_status,
         decidido_em  = now(),
         decidido_por = auth.uid(),
         aprovado_em  = case when p_status = 'APROVADO' then now() else null end
   where id = p_id
     and status = 'PENDENTE'
  returning user_id into v_user;

  if v_user is null then
    raise exception 'Solicitação não encontrada ou já decidida.' using errcode = 'P0002';
  end if;

  if p_status = 'APROVADO' then
    update public.profiles
       set acesso_liberado = true, bloqueado = false,
           liberado_em = now(), liberado_por = auth.uid()
     where id = v_user;
  end if;
end;
$$;

-- Mantida para compatibilidade com o site anterior.
create or replace function public.revogar_acesso_usuario(p_user_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.definir_acesso_usuario(p_user_id, 'REVOGAR');
  return 1;
end;
$$;

-- Lista de usuários (colunas novas no fim; as antigas mantidas).
drop function if exists public.listar_usuarios_admin();
create function public.listar_usuarios_admin()
returns table (
  id                uuid,
  nome              text,
  email             text,
  regra             text,
  cadastrado_em     timestamptz,
  ultimo_login      timestamptz,
  ultima_aprovacao  timestamptz,
  acessos_aprovados integer,
  acesso_ativo      boolean,
  bloqueado         boolean,
  liberado_em       timestamptz,
  pedido_pendente   boolean
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
  select p.id,
         coalesce(p.nome, nullif(trim(u.raw_user_meta_data ->> 'nome'), '')),
         coalesce(p.email, u.email)::text,
         p.regra,
         u.created_at,
         u.last_sign_in_at,
         coalesce(p.liberado_em, max(s.aprovado_em)),
         count(s.id) filter (where s.aprovado_em is not null)::int,
         (p.regra = 'admin' or (p.acesso_liberado and not p.bloqueado)),
         p.bloqueado,
         p.liberado_em,
         bool_or(s.status = 'PENDENTE') is true
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.solicitacoes_acesso s on s.user_id = p.id
   group by p.id, u.id
   order by p.regra, lower(coalesce(p.nome, p.email, u.email));
end;
$$;

-- Limpeza diária: pedidos ficam pendentes até o admin decidir;
-- apaga apenas pedidos finalizados com mais de 90 dias.
create or replace function public.limpar_solicitacoes_antigas()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.solicitacoes_acesso
   where status <> 'PENDENTE'
     and criado_em < now() - interval '90 days';
$$;

-- ---------------------------------------------------------------------
-- 3. Permissões
-- ---------------------------------------------------------------------

revoke all on function public.definir_acesso_usuario(uuid, text) from public, anon, authenticated;
revoke all on function public.listar_usuarios_admin()            from public, anon, authenticated;
revoke all on function public.limpar_solicitacoes_antigas()      from public, anon, authenticated;

grant execute on function public.definir_acesso_usuario(uuid, text) to authenticated;
grant execute on function public.listar_usuarios_admin()            to authenticated;
