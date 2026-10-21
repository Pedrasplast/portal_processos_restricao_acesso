import { supabase } from '../lib/supabase';

/*
 * Toda escrita passa por funções do banco (RPC). O banco identifica o
 * usuário pelo token, então o front não envia (nem guarda) IDs.
 *
 * Aprovação única: depois de liberado pelo admin, o usuário entra em
 * qualquer login/dispositivo até ser revogado ou bloqueado.
 */

export const STATUS_ACESSO = {
  ADMIN: 'ADMIN',
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  NEGADO: 'NEGADO',
  CANCELADO: 'CANCELADO',
  BLOQUEADO: 'BLOQUEADO',
};

async function rpc(nome, parametros) {
  const { data, error } = await supabase.rpc(nome, parametros);
  if (error) throw error;
  return data;
}

/* ---------- usuário ---------- */

/** ADMIN | APROVADO | BLOQUEADO | PENDENTE | NEGADO | CANCELADO | null */
export function obterStatusAcesso() {
  return rpc('status_acesso');
}

/** Cria (ou reaproveita) o pedido de acesso. Retorna o status. */
export function solicitarAcesso() {
  return rpc('solicitar_acesso');
}

export function cancelarMinhaSolicitacao() {
  return rpc('cancelar_minha_solicitacao');
}

/* ---------- administrador ---------- */

export function contarPendentes() {
  return rpc('contar_pendentes');
}

/** Pendentes primeiro; depois as mais recentes (limitado para economizar). */
export async function listarSolicitacoes({ limite = 100 } = {}) {
  const { data, error } = await supabase
    .from('solicitacoes_acesso')
    .select('id, user_id, nome, email, status, criado_em, decidido_em')
    .order('criado_em', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data || [];
}

export function decidirSolicitacao(id, status) {
  return rpc('decidir_solicitacao', { p_id: id, p_status: status });
}

export function listarUsuarios() {
  return rpc('listar_usuarios_admin');
}

export const ACOES_ACESSO = {
  LIBERAR: 'LIBERAR',
  REVOGAR: 'REVOGAR',
  BLOQUEAR: 'BLOQUEAR',
  DESBLOQUEAR: 'DESBLOQUEAR',
};

export function definirAcessoUsuario(userId, acao) {
  return rpc('definir_acesso_usuario', { p_user_id: userId, p_acao: acao });
}

/** Apaga a conta do usuário (perfil e pedidos saem junto). Não vale para admin. */
export function excluirUsuario(userId) {
  return rpc('excluir_usuario', { p_user_id: userId });
}
