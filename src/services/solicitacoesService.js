import { supabase } from '../lib/supabase';

/*
 * Toda escrita em solicitacoes_acesso passa por funções do banco (RPC).
 * O banco identifica o usuário e a sessão de login pelo token, então o
 * front não envia (nem guarda) IDs de solicitação.
 */

export const STATUS_ACESSO = {
  ADMIN: 'ADMIN',
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  NEGADO: 'NEGADO',
  CANCELADO: 'CANCELADO',
};

async function rpc(nome, parametros) {
  const { data, error } = await supabase.rpc(nome, parametros);
  if (error) throw error;
  return data;
}

/* ---------- usuário ---------- */

/** Status da sessão atual: ADMIN | APROVADO | PENDENTE | NEGADO | CANCELADO | null */
export function obterStatusAcesso() {
  return rpc('status_acesso');
}

/** Cria (ou reaproveita) a solicitação desta sessão. Retorna o status. */
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

export function revogarAcessoUsuario(userId) {
  return rpc('revogar_acesso_usuario', { p_user_id: userId });
}
