import { supabase } from '../lib/supabase';

/*
 * Setores ficam na tabela "setores". Leitura direta (RLS: quem tem
 * acesso); escrita só pelo admin, via funções do banco.
 */

async function rpc(nome, parametros) {
  const { data, error } = await supabase.rpc(nome, parametros);
  if (error) throw error;
  return data;
}

export async function listarSetores() {
  const { data, error } = await supabase
    .from('setores')
    .select('id, nome, ativo')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Admin: setores com quantidade de processos e documentos. */
export async function listarSetoresAdmin() {
  return (await rpc('listar_setores_admin')) || [];
}

export function criarSetor(nome) {
  return rpc('criar_setor', { p_nome: nome });
}

export function renomearSetor(id, nome) {
  return rpc('renomear_setor', { p_id: id, p_nome: nome });
}

export function definirSetorAtivo(id, ativo) {
  return rpc('definir_setor_ativo', { p_id: id, p_ativo: ativo });
}

export function excluirSetor(id) {
  return rpc('excluir_setor', { p_id: id });
}
