import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarSetores } from '../services/setoresService';

/* Lista de setores do banco (1 consulta por página). */
export function useSetores() {
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      setSetores(await listarSetores());
    } catch (error) {
      console.error(error);
      setErro('Não foi possível carregar os setores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const ativos = useMemo(() => setores.filter((s) => s.ativo).map((s) => s.nome), [setores]);

  return { setores, ativos, loading, erro, recarregar };
}
