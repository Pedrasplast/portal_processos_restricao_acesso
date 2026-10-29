-- =====================================================================
-- PORTAL DE PROCESSOS — SETORES: VÍNCULOS COM DOCUMENTOS E REGISTROS
-- Projeto Supabase: "Gestão de Processos"
-- Requer 20261029b_registros.sql. Idempotente.
--
--   listar_setores_admin()  passa a devolver também "registros"
--   excluir_setor()         mensagem única dizendo onde estão os vínculos
-- =====================================================================

drop function if exists public.listar_setores_admin();

create function public.listar_setores_admin()
returns table (
  id         uuid,
  nome       text,
  ativo      boolean,
  criado_em  timestamptz,
  processos  integer,
  documentos integer,
  registros  integer
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
         count(p.id)::int,
         (select count(*) from public.registros_setores rs where rs.setor_id = s.id)::int
    from public.setores s
    left join public.pops p on upper(trim(p.setor)) = upper(trim(s.nome))
   group by s.id
   order by s.ativo desc, s.nome;
end;
$$;

revoke all on function public.listar_setores_admin() from public, anon, authenticated;
grant execute on function public.listar_setores_admin() to authenticated;

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
  v_vinculos  text[] := '{}';
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  select nome into v_nome from public.setores where id = p_id;
  if v_nome is null then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;

  select count(*) into v_docs      from public.pops where upper(trim(setor)) = upper(trim(v_nome));
  select count(*) into v_registros from public.registros_setores where setor_id = p_id;

  if v_docs > 0 then
    v_vinculos := v_vinculos || format('%s documento(s) em Documentos', v_docs);
  end if;
  if v_registros > 0 then
    v_vinculos := v_vinculos || format('%s registro(s) em Registros', v_registros);
  end if;

  if cardinality(v_vinculos) > 0 then
    raise exception 'O setor "%" não pode ser excluído porque tem %. Desative-o para ocultá-lo sem apagar nada.',
      v_nome, array_to_string(v_vinculos, ' e ')
      using errcode = '23503';
  end if;

  delete from public.setores where id = p_id;
end;
$$;

revoke all on function public.excluir_setor(uuid) from public, anon, authenticated;
grant execute on function public.excluir_setor(uuid) to authenticated;
