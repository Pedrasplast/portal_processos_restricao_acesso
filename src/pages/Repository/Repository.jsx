import {
  useMemo,
  useState,
} from 'react';

import {
  FiDownload,
  FiEye,
  FiFileText,
} from 'react-icons/fi';

import AppLayout from '../../components/layout/AppLayout';

import {
  SETORES,
  TIPOS_DOCUMENTO,
} from '../../config/documentos';

import {
  useDocumentos,
} from '../../hooks/useDocumentos';

import {
  baixarDocumento,
  visualizarDocumento,
} from '../../utils/arquivos';

import {
  agruparDocumentos,
} from '../../utils/documentos';

import {
  normalizarChave,
} from '../../utils/texto';

import { useFeedback } from '../../hooks/useFeedback';

import './Repository.css';

function Repository() {
  const { notificar } = useFeedback();

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
        normalizarChave(grupo.setor) ===
        setor,
    );
  }, [grupos, setorSelecionado]);

  async function handleVisualizar(arquivo) {
    try {
      await visualizarDocumento(arquivo);
    } catch (error) {
      notificar('erro', error.message);
    }
  }

  async function handleDownload(arquivo) {
    if (!arquivo || baixandoId) {
      return;
    }

    setBaixandoId(arquivo.id);

    try {
      await baixarDocumento(arquivo);
    } catch (error) {
      notificar('erro', error.message);
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
          Consulte, visualize e baixe os documentos
          operacionais padronizados por setor.
        </p>
      </header>

      <div className="repository-filters card">
        {['TODOS', ...SETORES].map(
          (setor) => (
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
          ),
        )}
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
                className="repository-col-actions"
                colSpan={
                  TIPOS_DOCUMENTO.length
                }
              >
                Visualizar / Download
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
              gruposFiltrados.map(
                (grupo) => (
                  <tr key={grupo.id}>
                    <td>
                      <div className="repository-description">
                        <FiFileText
                          className="repository-icon"
                        />

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
                            className="repository-actions-cell"
                            key={tipo.valor}
                            data-label={tipo.nome}
                          >
                            {arquivo ? (
                              <div className="repository-file-actions">
                                <span className="repository-file-type">
                                  {tipo.nome}
                                </span>

                                <div className="repository-action-buttons">
                                  <button
                                    type="button"
                                    className="repository-action-button repository-view-button"
                                    onClick={() =>
                                      handleVisualizar(
                                        arquivo,
                                      )
                                    }
                                    aria-label={
                                      `Visualizar ${tipo.nome}`
                                    }
                                  >
                                    <FiEye />
                                    <span>
                                      Visualizar
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    className="repository-action-button repository-download-button"
                                    disabled={
                                      baixandoId ===
                                      arquivo.id
                                    }
                                    onClick={() =>
                                      handleDownload(
                                        arquivo,
                                      )
                                    }
                                    aria-label={
                                      `Baixar ${tipo.nome}`
                                    }
                                  >
                                    <FiDownload />

                                    <span>
                                      {baixandoId ===
                                      arquivo.id
                                        ? 'Baixando...'
                                        : 'Download'}
                                    </span>
                                  </button>
                                </div>
                              </div>
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
                ),
              )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

export default Repository;