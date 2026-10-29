import { supabase } from '../lib/supabase';

/*
 * Temas dos registros (Reunião, Treinamento, Diagnóstico...).
 * Somente admin (RLS). O banco grava o nome em maiúsculas.
 */

const TABELA = 'temas_registro';

function traduzirErro(error) {
  if (error?.code === '23505') return new Error('Já existe um tema com esse nome.');
  if (error?.code === '23503') {
    return new Error('Este tema está em uso em registros e não pode ser excluído. Desative-o para não aparecer em novos registros.');
  }
  if (error?.code === '23514') return new Error('O nome do tema deve ter de 2 a 40 caracteres.');
  return error;
}

export async function listarTemas() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('id, nome, ativo')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function criarTema(nome) {
  const { error } = await supabase.from(TABELA).insert({ nome: String(nome).trim() });
  if (error) throw traduzirErro(error);
}

export async function renomearTema(id, nome) {
  const { error } = await supabase.from(TABELA).update({ nome: String(nome).trim() }).eq('id', id);
  if (error) throw traduzirErro(error);
}

export async function definirTemaAtivo(id, ativo) {
  const { error } = await supabase.from(TABELA).update({ ativo }).eq('id', id);
  if (error) throw traduzirErro(error);
}

export async function excluirTema(id) {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw traduzirErro(error);
}
