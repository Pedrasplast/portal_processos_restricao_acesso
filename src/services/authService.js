import { supabase } from '../lib/supabase';

export async function loginComSenha(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  });

  if (error) throw error;
  return data.user;
}

export async function sair() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function obterPerfil(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, regra')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function cadastrarConta({
  nome,
  email,
  senha,
}) {
  const { data, error } =
    await supabase.auth.signUp({
      email: email.trim().toLowerCase(),

      password: senha,

      options: {
        data: {
          nome: nome.trim(),
        },
      },
    });

  if (error) {
    throw error;
  }

  return {
    user: data.user,
    session: data.session,
  };
}
