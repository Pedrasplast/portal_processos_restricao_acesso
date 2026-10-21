import { useEffect, useRef } from 'react';

/*
 * Executa `callback` a cada `intervalo` ms, mas SOMENTE enquanto a aba
 * estiver visível. Ao voltar para a aba, executa uma vez na hora.
 *
 * Isso evita chamadas ao Supabase com a aba em segundo plano
 * (importante no plano free).
 */
export function usePolling(callback, intervalo, { ativo = true, imediato = true } = {}) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!ativo || !intervalo) return undefined;

    let timer = null;

    const executar = () => {
      void callbackRef.current?.();
    };

    const iniciar = () => {
      if (timer) return;
      timer = setInterval(executar, intervalo);
    };

    const parar = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        executar();
        iniciar();
      } else {
        parar();
      }
    };

    if (document.visibilityState === 'visible') {
      if (imediato) executar();
      iniciar();
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [ativo, intervalo, imediato]);
}
