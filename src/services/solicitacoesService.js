import { supabase } from '../lib/supabase';

export const STATUS_ACESSO = {
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  NEGADO: 'NEGADO',
  CANCELADO: 'CANCELADO',
};

export async function criarSolicitacao({ userId, email }) {
  const { data, error } = await supabase
    .from('solicitacoes_acesso')
    .insert([
      {
        user_id: userId,
        email,
        status: STATUS_ACESSO.PENDENTE,
      },
    ])
    .select('id, user_id, email, status, criado_em')
    .single();

  if (error) throw error;
  return data;
}

export async function obterSolicitacao({ id, userId }) {
  if (!id || !userId) return null;

  const { data, error } = await supabase
    .from('solicitacoes_acesso')
    .select('id, user_id, email, status, criado_em, aprovado_em')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listarSolicitacoes() {
  const { data, error } = await supabase
    .from('solicitacoes_acesso')
    .select('id, user_id, email, status, criado_em, aprovado_em')
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function atualizarStatus(id, status) {
  const { error } = await supabase
    .from('solicitacoes_acesso')
    .update({
      status,
      aprovado_em: status === STATUS_ACESSO.APROVADO ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function cancelarSolicitacao({ id, userId }) {
  const { error } = await supabase
    .from('solicitacoes_acesso')
    .update({ status: STATUS_ACESSO.CANCELADO })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', STATUS_ACESSO.PENDENTE);

  if (error) throw error;
}
