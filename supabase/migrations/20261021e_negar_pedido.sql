-- =====================================================================
-- PORTAL DE PROCESSOS — NEGAR PEDIDO PELA ABA USUÁRIOS
-- Projeto Supabase: "Gestão de Processos"
-- Requer as migrações anteriores.
--
-- A aba "Solicitações de Acesso" sai do painel: os pedidos passam a ser
-- aprovados/negados direto na aba Usuários. Esta migração acrescenta a
-- ação NEGAR em definir_acesso_usuario (recusa o pedido pendente sem
-- bloquear; a pessoa pode pedir de novo no próximo login).
--
-- Idempotente. Compatível com o site já publicado.
-- =====================================================================

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

    when 'NEGAR' then
      update public.solicitacoes_acesso
         set status = 'NEGADO', decidido_em = now(), decidido_por = auth.uid()
       where user_id = p_user_id and status = 'PENDENTE';

      if not found then
        raise exception 'Este usuário não tem pedido pendente.' using errcode = 'P0002';
      end if;

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

revoke all on function public.definir_acesso_usuario(uuid, text) from public, anon, authenticated;
grant execute on function public.definir_acesso_usuario(uuid, text) to authenticated;
