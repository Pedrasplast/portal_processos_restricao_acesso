import { supabase } from '../lib/supabase';

export async function listarUsuarios() {
  const { data, error } = await supabase
    .from('usuarios_pops')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function buscarUsuarioPorEmail(email) {
  const { data, error } = await supabase
    .from('usuarios_pops')
    .select('*')
    .ilike('email', email.trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function cadastrarUsuario({ nome, email, descricao }) {
  const { error } = await supabase.from('usuarios_pops').insert([
    {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      descricao: descricao.trim() || null,
    },
  ]);

  if (error) throw error;
}

export async function excluirUsuario(id) {
  const { error } = await supabase.from('usuarios_pops').delete().eq('id', id);
  if (error) throw error;
}
