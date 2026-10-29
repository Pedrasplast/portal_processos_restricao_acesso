import { useCallback, useState } from 'react';

import { usePolling } from './usePolling';

/* Versão que esta aba carregou (gravada no build pelo vite.config.js). */
const VERSAO_CARREGADA = import.meta.env.VITE_VERSAO_APP;

/* De quanto em quanto tempo conferir (só com a aba visível). */
const INTERVALO = 5 * 60 * 1000;

/*
 * Confere se foi publicada uma versão nova do portal.
 * Lê /version.json (arquivo estático na Vercel: não usa o Supabase).
 * Confere ao voltar para a aba e a cada 5 minutos com a aba visível.
 * Retorna a versão nova, ou null enquanto não houver.
 */
export function useNovaVersao() {
  const [novaVersao, setNovaVersao] = useState(null);

  const verificar = useCallback(async () => {
    try {
      const resposta = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!resposta.ok) return;

      const { versao } = await resposta.json();
      if (versao && versao !== VERSAO_CARREGADA) setNovaVersao(versao);
    } catch {
      /* sem internet ou arquivo indisponível: tenta de novo na próxima */
    }
  }, []);

  usePolling(verificar, INTERVALO, {
    /* só no site publicado (no "npm run dev" não existe version.json) */
    ativo: import.meta.env.PROD && Boolean(VERSAO_CARREGADA) && !novaVersao,
    imediato: false,
  });

  return novaVersao;
}
