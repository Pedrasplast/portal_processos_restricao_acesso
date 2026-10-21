-- =====================================================================
-- PORTAL DE PROCESSOS — SEGURANÇA E CHAMADAS
-- Projeto Supabase: "Gestão de Processos"
--
-- O que esta migração faz:
--   1. Bloqueia o papel anon (visitante sem login) em todas as tabelas.
--   2. Impede que usuário comum se torne admin (profiles).
--   3. Vincula cada aprovação à SESSÃO de login (claim session_id do JWT).
--      Logout ou novo login = nova aprovação. Não dá para reaproveitar
--      uma solicitação antiga.
--   4. Documentos (tabela pops e PDFs) só podem ser lidos por quem tem
--      acesso aprovado na sessão atual; só admin grava/exclui.
--   5. Bucket "pops" passa a ser PRIVADO (o front usa links assinados).
--   6. Toda escrita em solicitacoes_acesso passa por funções (RPC).
--   7. Limpeza automática diária (pg_cron) para a tabela não crescer.
--
-- Rode inteira de uma vez. Ela é idempotente (pode rodar de novo).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Ajustes de dados
-- ---------------------------------------------------------------------

-- O front passou a usar MANUAL no lugar de MAPA VISUAL.
update public.pops
   set tipo_documento = 'MANUAL'
 where tipo_documento = 'MAPA VISUAL';

-- Perfis faltando para usuários já cadastrados (entram como 'usuario').
insert into public.profiles (id, email, nome, regra)
select u.id, u.email, nullif(trim(u.raw_user_meta_data ->> 'nome'), ''), 'usuario'
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- Nome vazio no perfil: preenche com o nome informado no cadastro.
update public.profiles p
   set nome = nullif(trim(u.raw_user_meta_data ->> 'nome'), '')
  from auth.users u
 where u.id = p.id
   and p.nome is null
   and nullif(trim(u.raw_user_meta_data ->> 'nome'), '') is not null;

-- ---------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------

-- profiles ------------------------------------------------------------
update public.profiles set regra = 'usuario' where regra is null;
alter table public.profiles alter column regra set not null;
alter table public.profiles drop constraint if exists profiles_regra_check;
alter table public.profiles
  add constraint profiles_regra_check check (regra in ('usuario', 'admin'));

-- pops ----------------------------------------------------------------
-- Com o bucket privado, a URL pública deixa de ser usada.
alter table public.pops alter column arquivo_url drop not null;
update public.pops set setor = 'GERAL' where setor is null;
alter table public.pops alter column setor set not null;
alter table public.pops alter column tipo_documento set not null;
alter table public.pops drop constraint if exists pops_tipo_documento_check;
alter table public.pops
  add constraint pops_tipo_documento_check
  check (tipo_documento in ('POP', 'FLUXOGRAMA', 'MANUAL'));

-- Impede dois arquivos do mesmo tipo na mesma linha (setor + número),
-- inclusive quando dois admins publicam ao mesmo tempo.
create unique index if not exists pops_setor_numero_tipo_unique
  on public.pops (setor, ((substring(titulo from '^\d+'))::int), tipo_documento)
  where titulo ~ '^\d+';

-- solicitacoes_acesso -------------------------------------------------
alter table public.solicitacoes_acesso add column if not exists nome text;
alter table public.solicitacoes_acesso add column if not exists decidido_em timestamptz;
alter table public.solicitacoes_acesso
  add column if not exists decidido_por uuid references auth.users (id) on delete set null;

-- CANCELADO faltava na regra do banco (o botão "Cancelar" falhava).
alter table public.solicitacoes_acesso drop constraint if exists solicitacoes_acesso_status_check;
alter table public.solicitacoes_acesso
  add constraint solicitacoes_acesso_status_check
  check (status in ('PENDENTE', 'APROVADO', 'NEGADO', 'CANCELADO'));

-- Índices: os antigos (status / user_id / session_id isolados) não eram
-- usados. Substituídos por índices que batem com as consultas reais.
drop index if exists public.idx_solicitacoes_acesso_status;
drop index if exists public.idx_solicitacoes_acesso_user_id;
drop index if exists public.idx_solicitacoes_acesso_session_id;

create index if not exists idx_solicitacoes_user_sessao
  on public.solicitacoes_acesso (user_id, session_id);

create index if not exists idx_solicitacoes_pendentes
  on public.solicitacoes_acesso (criado_em)
  where status = 'PENDENTE';

create index if not exists idx_solicitacoes_criado_em
  on public.solicitacoes_acesso (criado_em desc);

-- No máximo uma solicitação pendente por sessão de login.
create unique index if not exists solicitacoes_uma_pendente_por_sessao
  on public.solicitacoes_acesso (user_id, session_id)
  where status = 'PENDENTE';

-- ---------------------------------------------------------------------
-- 2. Funções auxiliares (usadas nas políticas RLS)
--    SECURITY DEFINER + search_path vazio = sem risco de sequestro.
--    As políticas chamam "(select fn())" para avaliar 1x por consulta.
-- ---------------------------------------------------------------------

create or replace function public.sessao_atual()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

create or replace function public.is_admin()
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
       and p.regra = 'admin'
  );
$$;

-- Acesso liberado = admin OU solicitação APROVADA para a sessão atual,
-- e essa sessão ainda existe (logout invalida na hora).
create or replace function public.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or exists (
        select 1
          from public.solicitacoes_acesso s
          join auth.sessions se on se.id = s.session_id
         where s.user_id = auth.uid()
           and s.session_id = public.sessao_atual()
           and s.status = 'APROVADO'
      );
$$;

-- ---------------------------------------------------------------------
-- 3. Funções chamadas pelo front (RPC)
-- ---------------------------------------------------------------------

-- Status de acesso da sessão atual. Resposta minúscula: ideal para
-- polling no plano free. Retorna 'ADMIN', 'APROVADO', 'PENDENTE',
-- 'NEGADO', 'CANCELADO' ou null (nenhuma solicitação nesta sessão).
create or replace function public.status_acesso()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    when public.is_admin() then 'ADMIN'
    else (
      select s.status
        from public.solicitacoes_acesso s
       where s.user_id = auth.uid()
         and s.session_id = public.sessao_atual()
       order by s.criado_em desc
       limit 1
    )
  end;
$$;

-- Cria (ou reaproveita) a solicitação da sessão atual.
create or replace function public.solicitar_acesso()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_sessao  uuid := public.sessao_atual();
  v_status  text;
  v_email   text;
  v_nome    text;
begin
  if v_uid is null or v_sessao is null then
    raise exception 'Sessão inválida. Faça login novamente.' using errcode = '28000';
  end if;

  if public.is_admin() then
    return 'ADMIN';
  end if;

  -- Já existe pedido pendente ou aprovado nesta sessão? Reaproveita.
  select s.status
    into v_status
    from public.solicitacoes_acesso s
   where s.user_id = v_uid
     and s.session_id = v_sessao
     and s.status in ('PENDENTE', 'APROVADO')
   order by s.criado_em desc
   limit 1;

  if v_status is not null then
    return v_status;
  end if;

  -- Pedidos pendentes de sessões antigas deixam de valer.
  update public.solicitacoes_acesso
     set status = 'CANCELADO', decidido_em = now()
   where user_id = v_uid
     and status = 'PENDENTE';

  select u.email, coalesce(p.nome, nullif(trim(u.raw_user_meta_data ->> 'nome'), ''))
    into v_email, v_nome
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = v_uid;

  insert into public.solicitacoes_acesso (user_id, session_id, email, nome, status)
  values (v_uid, v_sessao, coalesce(v_email, ''), v_nome, 'PENDENTE');

  return 'PENDENTE';
end;
$$;

-- Usuário cancela o próprio pedido pendente da sessão atual.
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
     and session_id = public.sessao_atual()
     and status = 'PENDENTE';
$$;

-- Admin: quantidade de pedidos pendentes (para o selo da aba).
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

  return (
    select count(*)::int
      from public.solicitacoes_acesso s
      join auth.sessions se on se.id = s.session_id
     where s.status = 'PENDENTE'
  );
end;
$$;

-- Admin: aprova ou nega um pedido pendente.
create or replace function public.decidir_solicitacao(p_id uuid, p_status text)
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

  if p_status not in ('APROVADO', 'NEGADO') then
    raise exception 'Status inválido: %', p_status using errcode = '22023';
  end if;

  update public.solicitacoes_acesso
     set status       = p_status,
         decidido_em  = now(),
         decidido_por = auth.uid(),
         aprovado_em  = case when p_status = 'APROVADO' then now() else null end
   where id = p_id
     and status = 'PENDENTE';

  if not found then
    raise exception 'Solicitação não encontrada ou já decidida.' using errcode = 'P0002';
  end if;
end;
$$;

-- Admin: corta o acesso de um usuário (todas as sessões aprovadas).
create or replace function public.revogar_acesso_usuario(p_user_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  update public.solicitacoes_acesso
     set status = 'CANCELADO', decidido_em = now(), decidido_por = auth.uid()
   where user_id = p_user_id
     and status in ('APROVADO', 'PENDENTE');

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- Admin: lista de usuários cadastrados com situação de acesso.
create or replace function public.listar_usuarios_admin()
returns table (
  id               uuid,
  nome             text,
  email            text,
  regra            text,
  cadastrado_em    timestamptz,
  ultimo_login     timestamptz,
  ultima_aprovacao timestamptz,
  acessos_aprovados integer,
  acesso_ativo     boolean
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
         max(s.aprovado_em),
         count(s.id) filter (where s.aprovado_em is not null)::int,
         bool_or(s.status = 'APROVADO' and se.id is not null) is true
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.solicitacoes_acesso s on s.user_id = p.id
    left join auth.sessions se on se.id = s.session_id
   group by p.id, u.id
   order by p.regra, lower(coalesce(p.nome, p.email, u.email));
end;
$$;

-- Novo cadastro: cria o perfil (sempre como 'usuario').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nome, regra)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), 'usuario')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Permissões de execução: ninguém por padrão; só o que o front usa.
revoke all on function public.sessao_atual()                  from public, anon, authenticated;
revoke all on function public.is_admin()                      from public, anon, authenticated;
revoke all on function public.tem_acesso()                    from public, anon, authenticated;
revoke all on function public.status_acesso()                 from public, anon, authenticated;
revoke all on function public.solicitar_acesso()              from public, anon, authenticated;
revoke all on function public.cancelar_minha_solicitacao()    from public, anon, authenticated;
revoke all on function public.contar_pendentes()              from public, anon, authenticated;
revoke all on function public.decidir_solicitacao(uuid, text) from public, anon, authenticated;
revoke all on function public.revogar_acesso_usuario(uuid)    from public, anon, authenticated;
revoke all on function public.listar_usuarios_admin()         from public, anon, authenticated;
revoke all on function public.handle_new_user()               from public, anon, authenticated;

-- (as funções usadas dentro das políticas precisam de EXECUTE)
grant execute on function public.sessao_atual()                  to authenticated;
grant execute on function public.is_admin()                      to authenticated;
grant execute on function public.tem_acesso()                    to authenticated;
grant execute on function public.status_acesso()                 to authenticated;
grant execute on function public.solicitar_acesso()              to authenticated;
grant execute on function public.cancelar_minha_solicitacao()    to authenticated;
grant execute on function public.contar_pendentes()              to authenticated;
grant execute on function public.decidir_solicitacao(uuid, text) to authenticated;
grant execute on function public.revogar_acesso_usuario(uuid)    to authenticated;
grant execute on function public.listar_usuarios_admin()         to authenticated;

-- ---------------------------------------------------------------------
-- 4. Permissões de tabela (camada antes do RLS)
-- ---------------------------------------------------------------------

revoke all on public.pops                from anon, authenticated;
revoke all on public.profiles            from anon, authenticated;
revoke all on public.solicitacoes_acesso from anon, authenticated;
revoke all on public.usuarios_pops       from anon, authenticated;

grant select, insert, delete    on public.pops                to authenticated;
grant select                    on public.profiles            to authenticated;
grant select                    on public.solicitacoes_acesso to authenticated;
grant select, insert, delete    on public.usuarios_pops       to authenticated;

-- ---------------------------------------------------------------------
-- 5. RLS — remove todas as políticas antigas e recria
-- ---------------------------------------------------------------------

alter table public.pops                enable row level security;
alter table public.profiles            enable row level security;
alter table public.solicitacoes_acesso enable row level security;
alter table public.usuarios_pops       enable row level security;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where (schemaname = 'public'
            and tablename in ('pops', 'profiles', 'solicitacoes_acesso', 'usuarios_pops'))
        or (schemaname = 'storage' and tablename = 'objects'
            and (policyname ilike '%pops%' or qual ilike '%''pops''%' or with_check ilike '%''pops''%'))
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- pops
create policy pops_select_com_acesso on public.pops
  for select to authenticated
  using ((select public.tem_acesso()));

create policy pops_insert_admin on public.pops
  for insert to authenticated
  with check ((select public.is_admin()));

create policy pops_delete_admin on public.pops
  for delete to authenticated
  using ((select public.is_admin()));

-- profiles: cada um lê o seu; admin lê todos. Sem escrita pelo cliente.
create policy profiles_select_proprio_ou_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- solicitacoes_acesso: leitura própria ou admin. Escrita só via RPC.
create policy solicitacoes_select_proprio_ou_admin on public.solicitacoes_acesso
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- usuarios_pops (tabela legada, não usada pelo front): somente admin.
create policy usuarios_pops_admin_select on public.usuarios_pops
  for select to authenticated using ((select public.is_admin()));
create policy usuarios_pops_admin_insert on public.usuarios_pops
  for insert to authenticated with check ((select public.is_admin()));
create policy usuarios_pops_admin_delete on public.usuarios_pops
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 6. Storage — bucket privado, só PDF, até 20 MB
-- ---------------------------------------------------------------------

update storage.buckets
   set public = false,
       file_size_limit = 20 * 1024 * 1024,
       allowed_mime_types = array['application/pdf']
 where id = 'pops';

create policy pops_storage_select_com_acesso on storage.objects
  for select to authenticated
  using (bucket_id = 'pops' and (select public.tem_acesso()));

create policy pops_storage_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pops' and (select public.is_admin()));

create policy pops_storage_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'pops' and (select public.is_admin()));

commit;

-- ---------------------------------------------------------------------
-- 7. Limpeza automática (pg_cron) — fora da transação
--    Diariamente às 06:00 UTC (03:00 em Brasília):
--      * pedidos PENDENTES cuja sessão já acabou -> CANCELADO
--      * pedidos finalizados com mais de 90 dias -> apagados
-- ---------------------------------------------------------------------

create extension if not exists pg_cron;

create or replace function public.limpar_solicitacoes_antigas()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.solicitacoes_acesso s
     set status = 'CANCELADO', decidido_em = now()
   where s.status = 'PENDENTE'
     and not exists (select 1 from auth.sessions se where se.id = s.session_id);

  delete from public.solicitacoes_acesso s
   where s.status <> 'PENDENTE'
     and s.criado_em < now() - interval '90 days'
     and not exists (select 1 from auth.sessions se where se.id = s.session_id);
$$;

revoke all on function public.limpar_solicitacoes_antigas() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'portal_limpar_solicitacoes';
select cron.schedule(
  'portal_limpar_solicitacoes',
  '0 6 * * *',
  $$select public.limpar_solicitacoes_antigas();$$
);
