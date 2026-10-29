import { useCallback, useEffect, useRef, useState } from 'react';
import { listarRegistros } from '../services/registrosService';

/*
 * Lista de registros (1 consulta ao abrir a página e a cada alteração).
 *
 * "loading" só fica true na PRIMEIRA carga. Nas atualizações seguintes
 * (salvar, excluir...) a lista atual continua na tela até a nova chegar,
 * então cards e tabela só trocam os valores, sem sumir e voltar.
 */
export function useRegistros() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const jaCarregou = useRef(false);

  const recarregar = useCallback(async () => {
    if (!jaCarregou.current) setLoading(true);
    setErro('');
    try {
      setRegistros(await listarRegistros());
      jaCarregou.current = true;
    } catch (error) {
      console.error(error);
      setErro('Não foi possível carregar os registros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { registros, loading, erro, recarregar };
}
