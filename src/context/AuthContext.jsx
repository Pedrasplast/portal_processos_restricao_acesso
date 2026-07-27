import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { obterPerfil, sair as sairService } from '../services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const atualizarSessao = useCallback(async (novaSessao) => {
    setSession(novaSessao || null);

    if (!novaSessao?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const perfil = await obterPerfil(novaSessao.user.id);
      setProfile(perfil);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (ativo) void atualizarSessao(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      if (ativo) void atualizarSessao(novaSessao);
    });

    return () => {
      ativo = false;
      subscription?.unsubscribe();
    };
  }, [atualizarSessao]);

  const logout = useCallback(async () => {
    sessionStorage.removeItem('solicitacaoAcessoId');
    await sairService();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      isAdmin: profile?.regra === 'admin',
      loading,
      logout,
    }),
    [session, profile, loading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
