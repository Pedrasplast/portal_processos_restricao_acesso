import { supabase } from '../lib/supabase';

/*
 * Convites por link: o admin gera um link de uso único e envia ao
 * usuário. Quem se cadastra por ele já entra liberado.
 * A tabela "convites" não é acessível direto; tudo passa por RPC.
 */

async function rpc(nome, parametros) {
  const { data, error } = await supabase.rpc(nome, parametros);
  if (error) throw error;
  return data;
}

export function montarLinkConvite(token) {
  return `${window.location.origin}/cadastro?convite=${encodeURIComponent(token)}`;
}

/** Admin: cria um convite. Retorna { id, token, email, expira_em }. */
export async function criarConvite({ email = '', dias = 7 } = {}) {
  const linhas = await rpc('criar_convite', {
    p_email: email.trim() || null,
    p_dias: dias,
  });
  return linhas?.[0] || null;
}

export async function listarConvites() {
  return (await rpc('listar_convites')) || [];
}

export function cancelarConvite(id) {
  return rpc('cancelar_convite', { p_id: id });
}

/** Público (tela de cadastro): { valido, email, expira_em }. */
export async function validarConvite(token) {
  const linhas = await rpc('validar_convite', { p_token: token });
  return linhas?.[0] || { valido: false, email: null, expira_em: null };
}
