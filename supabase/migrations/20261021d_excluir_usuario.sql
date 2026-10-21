-- =====================================================================
-- PORTAL DE PROCESSOS — EXCLUIR USUÁRIO PELO PAINEL
-- Projeto Supabase: "Gestão de Processos"
-- Requer as migrações anteriores (seguranca, aprovacao_unica, convites).
--
-- excluir_usuario(user_id): apaga a conta (auth.users). Em cascata saem
-- o perfil e os pedidos de acesso; convites usados ficam no histórico.
--   * Só admin pode chamar.
--   * Não exclui administradores nem a si mesmo.
--
-- Idempotente. Compatível com o site já publicado.
-- =====================================================================

create or replace function public.excluir_usuario(p_user_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_regra text;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Você não pode excluir a própria conta.' using errcode = '22023';
  end if;

  select p.regra, u.email
    into v_regra, v_email
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = p_user_id;

  if v_email is null and v_regra is null then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  if v_regra = 'admin' then
    raise exception 'Administradores não podem ser excluídos pelo painel.' using errcode = '22023';
  end if;

  delete from auth.users where id = p_user_id;

  return v_email;
end;
$$;

revoke all on function public.excluir_usuario(uuid) from public, anon, authenticated;
grant execute on function public.excluir_usuario(uuid) to authenticated;
