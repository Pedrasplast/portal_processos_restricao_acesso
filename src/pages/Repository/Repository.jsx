import {
  useMemo,
  useState,
} from 'react';
import {
  FiFileText,
} from 'react-icons/fi';

import AppLayout from '../../components/layout/AppLayout';
import {
  SETORES,
  TIPOS_DOCUMENTO,
} from '../../config/documentos';
import { useDocumentos } from '../../hooks/useDocumentos';
import { baixarDocumento } from '../../utils/arquivos';
import { agruparDocumentos } from '../../utils/documentos';
import { normalizarChave } from '../../utils/texto';
import './Repository.css';

function Repository() {
  const {
    documentos,
    loading,
    erro,
    recarregar,
  } = useDocumentos();

  const [
    setorSelecionado,
    setSetorSelecionado,
  ] = useState('TODOS');

  const [
    baixandoId,
    setBaixandoId,
  ] = useState(null);

  const grupos = useMemo(
    () => agruparDocumentos(documentos),
    [documentos],
  );

  const gruposFiltrados = useMemo(() => {
    if (setorSelecionado === 'TODOS') {
      return grupos;
    }

    const setor = normalizarChave(
      setorSelecionado,
    );

    return grupos.filter(
      (grupo) =>
        normalizarChave(grupo.setor) === setor,
    );
  }, [grupos, setorSelecionado]);

  async function handleDownload(arquivo) {
    if (!arquivo || baixandoId) return;

    setBaixandoId(arquivo.id);

    try {
      await baixarDocumento(arquivo);
    } finally {
      setBaixandoId(null);
    }
  }

  return (
    <AppLayout>
      <header className="page-header">
        <h2>
          Repositório de Processos Organizacionais
        </h2>

        <p>
          Consulte e baixe os documentos
          operacionais padronizados por setor.
        </p>
      </header>

      <div className="repository-filters card">
        {['TODOS', ...SETORES].map((setor) => (
          <button
            key={setor}
            type="button"
            className={
              `repository-chip${
                setorSelecionado === setor
                  ? ' active'
                  : ''
              }`
            }
            onClick={() =>
              setSetorSelecionado(setor)
            }
          >
            {setor}
          </button>
        ))}
      </div>

      {erro && (
        <div className="repository-error">
          <span>{erro}</span>

          <button
            type="button"
            onClick={recarregar}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="repository-table-wrapper">
        <table className="repository-table">
          <thead>
            <tr>
              <th className="repository-col-description">
                Descrição do documento
              </th>

              <th className="repository-col-sector">
                Setor
              </th>

              <th
                className="repository-col-download"
                colSpan={
                  TIPOS_DOCUMENTO.length
                }
              >
                Download
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  className="repository-empty"
                  colSpan={
                    2 +
                    TIPOS_DOCUMENTO.length
                  }
                >
                  Carregando documentos...
                </td>
              </tr>
            )}

            {!loading &&
              gruposFiltrados.length === 0 && (
                <tr>
                  <td
                    className="repository-empty"
                    colSpan={
                      2 +
                      TIPOS_DOCUMENTO.length
                    }
                  >
                    Nenhum documento encontrado.
                  </td>
                </tr>
              )}

            {!loading &&
              gruposFiltrados.map((grupo) => (
                <tr key={grupo.id}>
                  <td>
                    <div className="repository-description">
                      <FiFileText className="repository-icon" />

                      <span>
                        {grupo.titulo}
                      </span>
                    </div>
                  </td>

                  <td className="repository-sector">
                    {grupo.setor}
                  </td>

                  {TIPOS_DOCUMENTO.map(
                    (tipo) => {
                      const arquivo =
                        grupo.arquivos[
                          tipo.valor
                        ];

                      return (
                        <td
                          className="repository-download"
                          key={tipo.valor}
                          data-label={tipo.nome}
                        >
                          {arquivo ? (
                            <button
                              type="button"
                              className="repository-download-button"
                              disabled={
                                baixandoId ===
                                arquivo.id
                              }
                              onClick={() =>
                                handleDownload(
                                  arquivo,
                                )
                              }
                            >
                              {baixandoId ===
                              arquivo.id
                                ? 'Baixando...'
                                : tipo.nome}
                            </button>
                          ) : (
                            <span className="repository-missing">
                              —
                            </span>
                          )}
                        </td>
                      );
                    },
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

export default Repository;
