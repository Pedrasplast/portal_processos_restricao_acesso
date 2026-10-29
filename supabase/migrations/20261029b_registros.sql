-- =====================================================================
-- PORTAL DE PROCESSOS — REGISTROS DE REUNIÕES (somente admin)
-- Projeto Supabase: "Gestão de Processos"
-- Requer as migrações anteriores. Idempotente.
--
--   temas_registro      temas cadastráveis (Reunião, Treinamento, Diagnóstico...)
--   registros           data, tema, pauta (opcional), participantes (texto livre)
--   registros_setores   um ou mais setores por registro
--   registros_arquivos  vários arquivos por registro (bucket privado "registros")
--   salvar_registro()   grava registro + setores de uma vez
--   excluir_setor()     passa a bloquear setor que tenha registros
-- =====================================================================

-- 1. TABELAS -----------------------------------------------------------

create table if not exists public.temas_registro (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) between 2 and 40),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create unique index if not exists temas_registro_nome_unico
  on public.temas_registro (upper(trim(nome)));

insert into public.temas_registro (nome)
values ('REUNIÃO'), ('TREINAMENTO'), ('DIAGNÓSTICO')
on conflict (upper(trim(nome))) do nothing;

create table if not exists public.registros (
  id             uuid primary key default gen_random_uuid(),
  tema_id        uuid not null references public.temas_registro (id) on delete restrict,
  data           date not null,
  pauta          text check (pauta is null or length(pauta) <= 4000),
  participantes  text check (participantes is null or length(participantes) <= 2000),
  criado_em      timestamptz not null default now(),
  criado_por     uuid references auth.users (id) on delete set null,
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_registros_data       on public.registros (data desc);
create index if not exists idx_registros_tema       on public.registros (tema_id);
create index if not exists idx_registros_criado_por on public.registros (criado_por);

create table if not exists public.registros_setores (
  registro_id uuid not null references public.registros (id) on delete cascade,
  setor_id    uuid not null references public.setores (id) on delete restrict,
  primary key (registro_id, setor_id)
);

create index if not exists idx_registros_setores_setor on public.registros_setores (setor_id);

create table if not exists public.registros_arquivos (
  id            uuid primary key default gen_random_uuid(),
  registro_id   uuid not null references public.registros (id) on delete cascade,
  storage_path  text not null unique check (storage_path like 'registros/%'),
  nome          text not null check (length(nome) between 1 and 255),
  tipo          text,
  tamanho       bigint check (tamanho is null or tamanho >= 0),
  criado_em     timestamptz not null default now(),
  criado_por    uuid references auth.users (id) on delete set null
);

create index if not exists idx_registros_arquivos_registro   on public.registros_arquivos (registro_id);
create index if not exists idx_registros_arquivos_criado_por on public.registros_arquivos (criado_por);

-- 2. PERMISSÕES + RLS (tudo somente admin) -------------------------------

revoke all on public.temas_registro     from anon, authenticated;
revoke all on public.registros          from anon, authenticated;
revoke all on public.registros_setores  from anon, authenticated;
revoke all on public.registros_arquivos from anon, authenticated;

grant select, insert, delete on public.temas_registro to authenticated;
grant update (nome, ativo)   on public.temas_registro to authenticated;
grant select, delete         on public.registros to authenticated;            -- gravação via salvar_registro
grant select                 on public.registros_setores to authenticated;    -- gravação via salvar_registro
grant select, insert, delete on public.registros_arquivos to authenticated;

alter table public.temas_registro     enable row level security;
alter table public.registros          enable row level security;
alter table public.registros_setores  enable row level security;
alter table public.registros_arquivos enable row level security;

drop policy if exists temas_registro_admin     on public.temas_registro;
drop policy if exists registros_admin          on public.registros;
drop policy if exists registros_setores_admin  on public.registros_setores;
drop policy if exists registros_arquivos_admin on public.registros_arquivos;

create policy temas_registro_admin on public.temas_registro
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy registros_admin on public.registros
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy registros_setores_admin on public.registros_setores
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy registros_arquivos_admin on public.registros_arquivos
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 3. STORAGE: bucket privado "registros", até 50 MB por arquivo ------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'registros', 'registros', false, 50 * 1024 * 1024,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic'
  ]
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists registros_storage_select_admin on storage.objects;
drop policy if exists registros_storage_insert_admin on storage.objects;
drop policy if exists registros_storage_delete_admin on storage.objects;

create policy registros_storage_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'registros' and (select public.is_admin()));

create policy registros_storage_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'registros' and (select public.is_admin()));

create policy registros_storage_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'registros' and (select public.is_admin()));

-- 4. FUNÇÕES ---------------------------------------------------------------

-- Nome do tema sempre em maiúsculas, sem espaços sobrando
create or replace function public.normalizar_tema_registro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nome := upper(regexp_replace(trim(new.nome), '\s+', ' ', 'g'));
  return new;
end;
$$;

revoke all on function public.normalizar_tema_registro() from public, anon, authenticated;

drop trigger if exists temas_registro_normalizar on public.temas_registro;
create trigger temas_registro_normalizar
  before insert or update of nome on public.temas_registro
  for each row execute function public.normalizar_tema_registro();

-- Salvar registro (novo ou edição) + setores, tudo de uma vez
create or replace function public.salvar_registro(
  p_id            uuid,
  p_tema_id       uuid,
  p_data          date,
  p_pauta         text,
  p_participantes text,
  p_setor_ids     uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id            uuid := p_id;
  v_setores       uuid[];
  v_qtd           integer;
  v_tema_ativo    boolean;
  v_tema_atual    uuid;
  v_pauta         text := nullif(trim(coalesce(p_pauta, '')), '');
  v_participantes text := nullif(trim(coalesce(p_participantes, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct s), '{}') into v_setores
    from unnest(coalesce(p_setor_ids, '{}')) as s
   where s is not null;

  if cardinality(v_setores) = 0 then
    raise exception 'Escolha pelo menos um setor.';
  end if;

  select count(*) into v_qtd from public.setores where id = any (v_setores);
  if v_qtd <> cardinality(v_setores) then
    raise exception 'Setor não encontrado. Atualize a página.';
  end if;

  if p_data is null then
    raise exception 'Informe a data.';
  end if;
  if p_data < date '2000-01-01' or p_data > current_date + interval '5 years' then
    raise exception 'Data fora do intervalo permitido.';
  end if;

  if v_pauta is not null and length(v_pauta) > 4000 then
    raise exception 'A pauta pode ter no máximo 4000 caracteres.';
  end if;
  if v_participantes is not null and length(v_participantes) > 2000 then
    raise exception 'Participantes pode ter no máximo 2000 caracteres.';
  end if;

  select ativo into v_tema_ativo from public.temas_registro where id = p_tema_id;
  if v_tema_ativo is null then
    raise exception 'Escolha o tema.';
  end if;

  if v_id is not null then
    select tema_id into v_tema_atual from public.registros where id = v_id for update;
    if not found then
      raise exception 'Registro não encontrado. Atualize a página.';
    end if;
  end if;

  if not v_tema_ativo and (v_id is null or v_tema_atual is distinct from p_tema_id) then
    raise exception 'Este tema está desativado.';
  end if;

  if exists (
    select 1
      from public.setores s
     where s.id = any (v_setores)
       and not s.ativo
       and not exists (
         select 1 from public.registros_setores rs
          where rs.registro_id = v_id and rs.setor_id = s.id
       )
  ) then
    raise exception 'Há setor desativado na seleção. Reative-o em Setores ou remova da lista.';
  end if;

  if v_id is null then
    insert into public.registros (tema_id, data, pauta, participantes, criado_por)
    values (p_tema_id, p_data, v_pauta, v_participantes, auth.uid())
    returning id into v_id;
  else
    update public.registros
       set tema_id       = p_tema_id,
           data          = p_data,
           pauta         = v_pauta,
           participantes = v_participantes,
           atualizado_em = now()
     where id = v_id;
  end if;

  delete from public.registros_setores
   where registro_id = v_id
     and setor_id <> all (v_setores);

  insert into public.registros_setores (registro_id, setor_id)
  select v_id, s from unnest(v_setores) as s
  on conflict do nothing;

  return v_id;
end;
$$;

revoke all on function public.salvar_registro(uuid, uuid, date, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.salvar_registro(uuid, uuid, date, text, text, uuid[]) to authenticated;

-- Excluir setor: também não deixa excluir setor com registros
create or replace function public.excluir_setor(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome      text;
  v_docs      integer;
  v_registros integer;
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

  select count(*) into v_registros from public.registros_setores where setor_id = p_id;

  if v_registros > 0 then
    raise exception 'O setor "%" tem % registro(s) de reunião e não pode ser excluído. Desative-o para que não apareça em novos cadastros.', v_nome, v_registros
      using errcode = '23503';
  end if;

  delete from public.setores where id = p_id;
end;
$$;

revoke all on function public.excluir_setor(uuid) from public, anon, authenticated;
grant execute on function public.excluir_setor(uuid) to authenticated;
