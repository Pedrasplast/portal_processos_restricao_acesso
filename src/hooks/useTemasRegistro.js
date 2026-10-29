import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarTemas } from '../services/temasRegistroService';

/* Temas dos registros (todos e só os ativos). */
export function useTemasRegistro() {
  const [temas, setTemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      setTemas(await listarTemas());
    } catch (error) {
      console.error(error);
      setErro('Não foi possível carregar os temas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const ativos = useMemo(() => temas.filter((t) => t.ativo), [temas]);

  return { temas, ativos, loading, erro, recarregar };
}
