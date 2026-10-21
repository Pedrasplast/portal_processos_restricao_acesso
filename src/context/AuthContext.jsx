import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import { obterPerfil, sair as sairService } from '../services/authService';
import { obterStatusAcesso, STATUS_ACESSO } from '../services/solicitacoesService';

export const AuthContext = createContext(null);

/* Lê o session_id do token (cada login gera um novo). */
function sessaoDoToken(session) {
  try {
    const payload = session?.access_token?.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).session_id || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [statusAcesso, setStatusAcesso] = useState(null);
  const [loading, setLoading] = useState(true);

  /* Chave "usuário + login". Evita recarregar perfil/status a cada
     renovação de token ou troca de aba (economia de chamadas). */
  const chaveCarregadaRef = useRef(null);

  const carregarDados = useCallback(async (novaSessao) => {
    const user = novaSessao?.user;

    if (!user) {
      chaveCarregadaRef.current = null;
      setProfile(null);
      setStatusAcesso(null);
      setLoading(false);
      return;
    }

    const chave = `${user.id}:${sessaoDoToken(novaSessao)}`;
    if (chaveCarregadaRef.current === chave) return;
    chaveCarregadaRef.current = chave;

    setLoading(true);

    try {
      const [perfil, status] = await Promise.all([
        obterPerfil(user.id),
        obterStatusAcesso(),
      ]);

      setProfile(perfil);
      setStatusAcesso(status);
    } catch (error) {
      console.error('Erro ao carregar perfil/acesso:', error);
      chaveCarregadaRef.current = null;
      setProfile(null);
      setStatusAcesso(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    /*
     * onAuthStateChange já dispara INITIAL_SESSION ao montar, então não
     * é preciso chamar getSession() separadamente (era chamada dupla).
     * A chamada ao Supabase é adiada com setTimeout porque fazer await
     * dentro deste callback pode travar o cliente (recomendação oficial).
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao || null);
      setTimeout(() => void carregarDados(novaSessao), 0);
    });

    return () => subscription?.unsubscribe();
  }, [carregarDados]);

  /* Consulta novamente o status (usado na tela de espera). */
  const atualizarAcesso = useCallback(async () => {
    const status = await obterStatusAcesso();
    setStatusAcesso(status);
    return status;
  }, []);

  const logout = useCallback(async () => {
    await sairService();
  }, []);

  const value = useMemo(() => {
    const isAdmin = profile?.regra === 'admin';

    return {
      session,
      user: session?.user || null,
      profile,
      isAdmin,
      statusAcesso,
      acessoLiberado:
        isAdmin ||
        statusAcesso === STATUS_ACESSO.ADMIN ||
        statusAcesso === STATUS_ACESSO.APROVADO,
      loading,
      atualizarAcesso,
      setStatusAcesso,
      logout,
    };
  }, [session, profile, statusAcesso, loading, atualizarAcesso, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
