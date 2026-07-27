import { useCallback, useEffect, useState } from 'react';
import { listarDocumentos } from '../services/documentosService';

export function useDocumentos({ admin = false } = {}) {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro('');

    try {
      const data = await listarDocumentos({ admin });
      setDocumentos(data);
    } catch (error) {
      console.error(error);
      setErro('Não foi possível carregar os documentos.');
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { documentos, loading, erro, recarregar };
}
