-- =====================================================================
-- PORTAL DE PROCESSOS — EDITAR O NOME DE UM PROCESSO
-- Projeto Supabase: "Gestão de Processos"
-- Requer as migrações anteriores.
--
-- Botão "Editar" em Gerenciar documentos: troca a descrição do processo
-- (a parte depois de "01 - ") em todos os documentos da linha (POP,
-- Fluxograma e Manual) de uma vez. O número e o setor não mudam.
--
-- Idempotente. Compatível com o site já publicado.
-- =====================================================================

drop function if exists public.renomear_processo(uuid[], integer, text);

create or replace function public.renomear_processo(
  p_ids       bigint[],
  p_numero    integer,
  p_descricao text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_descricao text := upper(regexp_replace(trim(coalesce(p_descricao, '')), '\s+', ' ', 'g'));
  v_titulo    text;
  v_setores   integer;
  v_qtd       integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem editar processos.';
  end if;

  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Nenhum documento informado.';
  end if;

  if p_numero is null or p_numero <= 0 then
    raise exception 'Número do processo inválido.';
  end if;

  if length(v_descricao) < 3 then
    raise exception 'Informe uma descrição com pelo menos 3 caracteres.';
  end if;

  if length(v_descricao) > 140 then
    raise exception 'A descrição pode ter no máximo 140 caracteres.';
  end if;

  select count(*), count(distinct upper(trim(p.setor)))
    into v_qtd, v_setores
    from public.pops p
   where p.id = any (p_ids);

  if v_qtd <> cardinality(p_ids) then
    raise exception 'Documento não encontrado. Atualize a página.';
  end if;

  if v_setores <> 1 then
    raise exception 'Os documentos precisam ser do mesmo setor.';
  end if;

  v_titulo := lpad(p_numero::text, greatest(2, length(p_numero::text)), '0') || ' - ' || v_descricao;

  update public.pops
     set titulo = v_titulo
   where id = any (p_ids);

  return v_titulo;
end;
$$;

revoke all on function public.renomear_processo(bigint[], integer, text) from public, anon, authenticated;
grant execute on function public.renomear_processo(bigint[], integer, text) to authenticated;
