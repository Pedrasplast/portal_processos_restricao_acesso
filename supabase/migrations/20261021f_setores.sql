-- =====================================================================
-- PORTAL DE PROCESSOS — CADASTRO DE SETORES
-- Projeto Supabase: "Gestão de Processos"
-- Requer as migrações anteriores.
--
-- Os setores saem do código e passam a ficar nesta tabela.
--   * Admin adiciona, renomeia, desativa/reativa e exclui setores.
--   * Excluir só é permitido para setor sem documentos; com documentos,
--     o caminho é desativar (some do cadastro de novos documentos, mas
--     os documentos existentes continuam no repositório).
--   * Renomear atualiza também os documentos daquele setor.
--   * Novos documentos só podem usar setor cadastrado e ativo (trigger).
--
-- Idempotente. Compatível com o site já publicado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------

create table if not exists public.setores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) between 2 and 60),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null
);

create unique index if not exists setores_nome_unico on public.setores (upper(trim(nome)));
create index if not exists idx_setores_criado_por on public.setores (criado_por);
create index if not exists idx_pops_setor_upper on public.pops (upper(trim(setor)));

-- Setores que estavam fixos no site + qualquer setor que já tenha documentos.
insert into public.setores (nome)
select s
  from unnest(array[
    'ALMOXARIFADO', 'COMPRAS', 'SETOR FISCAL', 'AUXILIAR ADM', 'FATURAMENTO',
    'COMERCIAL', 'EXPORTAÇÃO', 'FINANCEIRO', 'LOGISTICA', 'PCP', 'MOLDE',
    'CD - SP', 'PRODUÇÃO', 'SCOPI', 'QUALIDADE', 'RH', 'EXPEDIÇÃO'
  ]) as s
on conflict (upper(trim(nome))) do nothing;

insert into public.setores (nome)
select distinct upper(trim(p.setor))
  from public.pops p
 where p.setor is not null and length(trim(p.setor)) >= 2
on conflict (upper(trim(nome))) do nothing;

alter table public.setores enable row level security;
revoke all on public.setores from anon, authenticated;
grant select on public.setores to authenticated;

drop policy if exists setores_select_com_acesso on public.setores;
create policy setores_select_com_acesso on public.setores
  for select to authenticated
  using ((select public.tem_acesso()));

-- ---------------------------------------------------------------------
-- 2. Documentos só em setor cadastrado (e ativo, para novos)
-- ---------------------------------------------------------------------

create or replace function public.validar_setor_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome  text;
  v_ativo boolean;
begin
  select s.nome, s.ativo
    into v_nome, v_ativo
    from public.setores s
   where upper(trim(s.nome)) = upper(trim(new.setor));

  if v_nome is null then
    raise exception 'Setor "%" não está cadastrado.', new.setor using errcode = '23503';
  end if;

  if tg_op = 'INSERT' and not v_ativo then
    raise exception 'O setor "%" está desativado. Reative-o para publicar novos documentos.', v_nome
      using errcode = '23514';
  end if;

  new.setor := v_nome;
  return new;
end;
$$;

revoke all on function public.validar_setor_documento() from public, anon, authenticated;

drop trigger if exists pops_validar_setor on public.pops;
create trigger pops_validar_setor
  before insert or update of setor on public.pops
  for each row execute function public.validar_setor_documento();

-- ---------------------------------------------------------------------
-- 3. Funções do admin
-- ---------------------------------------------------------------------

create or replace function public.normalizar_nome_setor(p_nome text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g'));
$$;

revoke all on function public.normalizar_nome_setor(text) from public, anon, authenticated;

create or replace function public.listar_setores_admin()
returns table (
  id         uuid,
  nome       text,
  ativo      boolean,
  criado_em  timestamptz,
  processos  integer,
  documentos integer
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
  select s.id,
         s.nome,
         s.ativo,
         s.criado_em,
         count(distinct substring(p.titulo from '^\d+'))::int,
         count(p.id)::int
    from public.setores s
    left join public.pops p on upper(trim(p.setor)) = upper(trim(s.nome))
   group by s.id
   order by s.ativo desc, s.nome;
end;
$$;

create or replace function public.criar_setor(p_nome text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nome text := public.normalizar_nome_setor(p_nome);
  v_existente public.setores%rowtype;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if length(v_nome) < 2 or length(v_nome) > 60 then
    raise exception 'O nome do setor deve ter entre 2 e 60 caracteres.' using errcode = '22023';
  end if;

  select * into v_existente from public.setores where upper(trim(nome)) = v_nome;

  if found then
    if v_existente.ativo then
      raise exception 'Já existe um setor chamado "%".', v_existente.nome using errcode = '23505';
    else
      raise exception 'O setor "%" já existe e está desativado. Reative-o na lista.', v_existente.nome
        using errcode = '23505';
    end if;
  end if;

  insert into public.setores (nome, criado_por) values (v_nome, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.renomear_setor(p_id uuid, p_nome text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nome  text := public.normalizar_nome_setor(p_nome);
  v_atual text;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if length(v_nome) < 2 or length(v_nome) > 60 then
    raise exception 'O nome do setor deve ter entre 2 e 60 caracteres.' using errcode = '22023';
  end if;

  select nome into v_atual from public.setores where id = p_id;
  if v_atual is null then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;

  if v_atual = v_nome then
    return;
  end if;

  if exists (select 1 from public.setores where upper(trim(nome)) = v_nome and id <> p_id) then
    raise exception 'Já existe um setor chamado "%".', v_nome using errcode = '23505';
  end if;

  update public.setores set nome = v_nome where id = p_id;

  update public.pops
     set setor = v_nome
   where upper(trim(setor)) = upper(trim(v_atual));
end;
$$;

create or replace function public.definir_setor_ativo(p_id uuid, p_ativo boolean)
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

  update public.setores set ativo = coalesce(p_ativo, true) where id = p_id;

  if not found then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.excluir_setor(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nome text;
  v_docs integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  select nome into v_nome from public.setores where id = p_id;
  if v_nome is null then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;

  select count(*) into v_docs from public.pops where upper(trim(setor)) = upper(trim(v_nome));

  if v_docs > 0 then
    raise exception 'O setor "%" tem % documento(s) e não pode ser excluído. Desative-o para que não apareça em novos cadastros.', v_nome, v_docs
      using errcode = '23503';
  end if;

  delete from public.setores where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------------

revoke all on function public.listar_setores_admin()            from public, anon, authenticated;
revoke all on function public.criar_setor(text)                 from public, anon, authenticated;
revoke all on function public.renomear_setor(uuid, text)        from public, anon, authenticated;
revoke all on function public.definir_setor_ativo(uuid, boolean) from public, anon, authenticated;
revoke all on function public.excluir_setor(uuid)               from public, anon, authenticated;

grant execute on function public.listar_setores_admin()            to authenticated;
grant execute on function public.criar_setor(text)                 to authenticated;
grant execute on function public.renomear_setor(uuid, text)        to authenticated;
grant execute on function public.definir_setor_ativo(uuid, boolean) to authenticated;
grant execute on function public.excluir_setor(uuid)               to authenticated;
