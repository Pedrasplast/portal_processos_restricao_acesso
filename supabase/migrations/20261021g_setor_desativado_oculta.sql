-- =====================================================================
-- PORTAL DE PROCESSOS — SETOR DESATIVADO OCULTA SEUS DOCUMENTOS
-- Projeto Supabase: "Gestão de Processos"
-- Requer as migrações anteriores (inclusive 20261021f_setores.sql).
--
-- Quando um setor é desativado, os documentos dele deixam de ser
-- retornados para usuários comuns (tabela pops e PDFs no Storage).
-- Nada é apagado: ao reativar o setor, tudo volta a aparecer.
-- Administradores continuam vendo tudo (para gerenciar).
--
-- Idempotente.
-- =====================================================================

create index if not exists idx_pops_storage_path on public.pops (storage_path);

-- Setor ativo? (comparação sem diferenciar maiúsculas/espaços)
create or replace function public.setor_ativo(p_setor text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.setores s
     where s.ativo
       and upper(trim(s.nome)) = upper(trim(p_setor))
  );
$$;

revoke all on function public.setor_ativo(text) from public, anon, authenticated;
grant execute on function public.setor_ativo(text) to authenticated;

-- Documentos: quem tem acesso vê só setores ativos; admin vê tudo.
drop policy if exists pops_select_com_acesso on public.pops;
create policy pops_select_com_acesso on public.pops
  for select to authenticated
  using (
    (select public.is_admin())
    or ((select public.tem_acesso()) and public.setor_ativo(setor))
  );

-- PDFs: mesma regra, pelo documento dono do arquivo.
drop policy if exists pops_storage_select_com_acesso on storage.objects;
create policy pops_storage_select_com_acesso on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pops'
    and (
      (select public.is_admin())
      or (
        (select public.tem_acesso())
        and exists (
          select 1
            from public.pops p
           where p.storage_path = storage.objects.name
             and public.setor_ativo(p.setor)
        )
      )
    )
  );

-- Lista de setores: usuários veem só os ativos; admin vê todos.
drop policy if exists setores_select_com_acesso on public.setores;
create policy setores_select_com_acesso on public.setores
  for select to authenticated
  using (
    (select public.is_admin())
    or ((select public.tem_acesso()) and ativo)
  );
