import { useMemo } from 'react';

import { normalizarChave } from '../utils/texto';
import { useDocumentos } from './useDocumentos';
import { useSetores } from './useSetores';

/*
 * Documentos que aparecem nas telas de consulta (Início e Repositório):
 * só os de setores ativos. Para usuários comuns o banco já não devolve
 * os demais; aqui a mesma regra vale também para o administrador.
 */
export function useDocumentosPublicos() {
  const { documentos, loading: carregandoDocs, erro, recarregar: recarregarDocs } = useDocumentos();
  const { setores, ativos, loading: carregandoSetores, recarregar: recarregarSetores } = useSetores();

  const visiveis = useMemo(() => {
    if (setores.length === 0) return documentos;
    const chavesAtivas = new Set(ativos.map(normalizarChave));
    return documentos.filter((documento) => chavesAtivas.has(normalizarChave(documento.setor)));
  }, [documentos, setores, ativos]);

  return {
    documentos: visiveis,
    setoresAtivos: ativos,
    loading: carregandoDocs || carregandoSetores,
    erro,
    recarregar: async () => {
      await Promise.all([recarregarDocs(), recarregarSetores()]);
    },
  };
}
