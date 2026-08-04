import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FiFileText,
  FiTrash2,
  FiUpload,
} from 'react-icons/fi';

import {
  SETORES,
  TIPOS_DOCUMENTO,
} from '../../../config/documentos';
import {
  excluirDocumento,
  publicarDocumento,
} from '../../../services/documentosService';
import {
  agruparDocumentos,
  formatarTituloProcesso,
  obterNumeracaoDocumento,
} from '../../../utils/documentos';

const NOVA_LINHA = '__NOVA_LINHA__';

function DocumentsPanel({
  documentos,
  loading,
  erro,
  onReload,
  notify,
}) {
  const [setor, setSetor] = useState('');
  const [
    processoSelecionado,
    setProcessoSelecionado,
  ] = useState(NOVA_LINHA);
  const [
    tipoDocumento,
    setTipoDocumento,
  ] = useState('');
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [
    documentoExcluir,
    setDocumentoExcluir,
  ] = useState(null);

  const inputFileRef = useRef(null);

  const grupos = useMemo(
    () => agruparDocumentos(documentos),
    [documentos],
  );

  const numeracao = useMemo(
    () =>
      obterNumeracaoDocumento(
        documentos,
        setor,
      ),
    [documentos, setor],
  );

  const processoAtual = useMemo(() => {
    if (
      !setor ||
      processoSelecionado === NOVA_LINHA
    ) {
      return null;
    }

    return numeracao.processosExistentes.find(
      (grupo) =>
        grupo.codigo === processoSelecionado,
    ) || null;
  }, [
    setor,
    processoSelecionado,
    numeracao.processosExistentes,
  ]);

  const codigoAtual =
    processoAtual?.codigo ||
    numeracao.proximoCodigo;

  const descricaoAtual =
    processoAtual?.descricao ||
    descricao;

  const tiposDisponiveis = useMemo(() => {
    const tiposJaCadastrados = new Set(
      processoAtual
        ? Object.keys(processoAtual.arquivos)
        : [],
    );

    return TIPOS_DOCUMENTO.filter(
      (tipo) =>
        !tiposJaCadastrados.has(tipo.valor),
    );
  }, [processoAtual]);

  const tituloPreview = formatarTituloProcesso(
    codigoAtual,
    descricaoAtual || 'DESCRIÇÃO DO DOCUMENTO',
  );

  useEffect(() => {
    if (!setor) {
      setProcessoSelecionado(NOVA_LINHA);
      setTipoDocumento('');
      setDescricao('');
      return;
    }

    if (
      processoSelecionado !== NOVA_LINHA &&
      !numeracao.processosExistentes.some(
        (grupo) =>
          grupo.codigo === processoSelecionado,
      )
    ) {
      setProcessoSelecionado(NOVA_LINHA);
      setTipoDocumento('');
      setDescricao('');
    }
  }, [
    setor,
    processoSelecionado,
    numeracao.processosExistentes,
  ]);

  useEffect(() => {
    if (
      tipoDocumento &&
      !tiposDisponiveis.some(
        (tipo) =>
          tipo.valor === tipoDocumento,
      )
    ) {
      setTipoDocumento('');
    }
  }, [tipoDocumento, tiposDisponiveis]);

  function limparArquivo() {
    setArquivo(null);

    if (inputFileRef.current) {
      inputFileRef.current.value = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!setor) {
      notify('erro', 'Selecione o setor.');
      return;
    }

    if (!tipoDocumento) {
      notify(
        'erro',
        'Selecione o tipo do documento.',
      );
      return;
    }

    if (
      !processoAtual &&
      descricao.trim().length < 3
    ) {
      notify(
        'erro',
        'Informe a descrição do documento.',
      );
      return;
    }

    if (!arquivo) {
      notify(
        'erro',
        'Selecione o arquivo PDF.',
      );
      return;
    }

    setSalvando(true);

    try {
      const publicacao =
        await publicarDocumento({
          setor,
          tipoDocumento,
          codigo: codigoAtual,
          descricao: descricaoAtual,
          arquivo,
        });

      notify(
        'sucesso',
        `${publicacao.tipoDocumento} adicionado em ${publicacao.titulo}.`,
      );

      limparArquivo();
      setTipoDocumento('');

      /*
       * Após criar uma linha nova, mantém essa linha
       * selecionada para facilitar o cadastro dos outros
       * tipos na mesma linha.
       */
      await onReload();

      setProcessoSelecionado(
        publicacao.codigo,
      );
      setDescricao('');
    } catch (error) {
      notify(
        'erro',
        error.message ||
          'Erro ao publicar documento.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!documentoExcluir) return;

    try {
      await excluirDocumento(
        documentoExcluir,
      );

      notify(
        'sucesso',
        `${documentoExcluir.tipo} excluído com sucesso.`,
      );

      setDocumentoExcluir(null);
      await onReload();
    } catch (error) {
      notify(
        'erro',
        error.message ||
          'Erro ao excluir documento.',
      );
    }
  }

  return (
    <div className="admin-stack">
      <form
        className="admin-card"
        onSubmit={handleSubmit}
      >
        <div className="admin-card__header">
          <div>
            <h3>Adicionar Documento</h3>

            <p>
              Crie uma descrição única com numeração
              automática e vincule POP, Fluxograma e
              Mapa Visual à mesma linha.
            </p>
          </div>
        </div>

        <div className="admin-form-grid">
          <div className="form-group">
            <label htmlFor="document-sector">
              Setor / Pasta
            </label>

            <select
              id="document-sector"
              className="form-control"
              value={setor}
              onChange={(event) => {
                setSetor(event.target.value);
                setProcessoSelecionado(
                  NOVA_LINHA,
                );
                setTipoDocumento('');
                setDescricao('');
                limparArquivo();
              }}
              disabled={salvando}
              required
            >
              <option value="" disabled>
                Selecione o setor
              </option>

              {SETORES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group admin-form-grid__double">
            <label htmlFor="document-process">
              Descrição do documento
            </label>

            <select
              id="document-process"
              className="form-control"
              value={processoSelecionado}
              onChange={(event) => {
                setProcessoSelecionado(
                  event.target.value,
                );
                setTipoDocumento('');
                setDescricao('');
                limparArquivo();
              }}
              disabled={salvando || !setor}
              required
            >
              <option value={NOVA_LINHA}>
                {numeracao.proximoCodigo}
                {' - '}
                CRIAR NOVA DESCRIÇÃO
              </option>

              {numeracao.processosExistentes.map(
                (grupo) => (
                  <option
                    key={grupo.id}
                    value={grupo.codigo}
                  >
                    {grupo.codigo}
                    {' - '}
                    {grupo.descricao}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="document-number">
              Número automático
            </label>

            <input
              id="document-number"
              className="form-control document-number-control"
              type="text"
              value={codigoAtual}
              readOnly
              disabled={!setor}
            />
          </div>

          <div className="form-group">
            <label htmlFor="document-type">
              Tipo de documento
            </label>

            <select
              id="document-type"
              className="form-control"
              value={tipoDocumento}
              onChange={(event) =>
                setTipoDocumento(
                  event.target.value,
                )
              }
              disabled={
                salvando ||
                !setor ||
                tiposDisponiveis.length === 0
              }
              required
            >
              <option value="" disabled>
                {tiposDisponiveis.length
                  ? 'Selecione o tipo'
                  : 'Todos os tipos já cadastrados'}
              </option>

              {tiposDisponiveis.map((tipo) => (
                <option
                  key={tipo.valor}
                  value={tipo.valor}
                >
                  {tipo.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group admin-form-grid__wide">
            <label htmlFor="document-title">
              Descrição única
            </label>

            <div className="document-title-control">
              <span>{codigoAtual || '__'} -</span>

              <input
                id="document-title"
                className="form-control"
                type="text"
                value={descricaoAtual}
                onChange={(event) =>
                  setDescricao(
                    event.target.value.toLocaleUpperCase(
                      'pt-BR',
                    ),
                  )
                }
                disabled={
                  salvando ||
                  !setor ||
                  Boolean(processoAtual)
                }
                placeholder="DESCRIÇÃO DO DOCUMENTO"
                maxLength={140}
                required={!processoAtual}
              />
            </div>

            <small className="document-form-help">
              {processoAtual
                ? 'Descrição já cadastrada. Selecione somente o tipo que deseja anexar.'
                : `O documento será cadastrado como: ${tituloPreview}`}
            </small>
          </div>

          <div className="form-group admin-form-grid__wide">
            <label htmlFor="document-file">
              Arquivo PDF
            </label>

            <input
              ref={inputFileRef}
              id="document-file"
              className="form-control"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) =>
                setArquivo(
                  event.target.files?.[0] ||
                    null,
                )
              }
              disabled={
                salvando ||
                !setor ||
                tiposDisponiveis.length === 0
              }
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            salvando ||
            !setor ||
            tiposDisponiveis.length === 0
          }
        >
          <FiUpload />

          {salvando
            ? 'Publicando...'
            : 'Adicionar à linha'}
        </button>
      </form>

      <section className="admin-card">
        <div className="admin-card__header">
          <div>
            <h3>Documentos Cadastrados</h3>

            <p>
              {grupos.length} linha(s) e{' '}
              {documentos.length} arquivo(s) no
              repositório.
            </p>
          </div>
        </div>

        {erro && (
          <div className="alert erro">
            {erro}
          </div>
        )}

        <div className="table-wrapper">
          <table className="data-table documents-grouped-table">
            <thead>
              <tr>
                <th>Descrição do documento</th>
                <th>Setor</th>

                {TIPOS_DOCUMENTO.map((tipo) => (
                  <th key={tipo.valor}>
                    {tipo.nome}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={
                      2 +
                      TIPOS_DOCUMENTO.length
                    }
                    className="empty-state"
                  >
                    Carregando...
                  </td>
                </tr>
              ) : grupos.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      2 +
                      TIPOS_DOCUMENTO.length
                    }
                    className="empty-state"
                  >
                    Nenhum documento cadastrado.
                  </td>
                </tr>
              ) : (
                grupos.map((grupo) => (
                  <tr key={grupo.id}>
                    <td>
                      <div className="document-cell">
                        <FiFileText />

                        <span>
                          {grupo.titulo}
                        </span>
                      </div>
                    </td>

                    <td>{grupo.setor}</td>

                    {TIPOS_DOCUMENTO.map(
                      (tipo) => {
                        const documento =
                          grupo.arquivos[
                            tipo.valor
                          ];

                        return (
                          <td
                            key={tipo.valor}
                            className="document-type-cell"
                          >
                            {documento ? (
                              <div className="document-type-actions">
                                <span className="document-type-badge">
                                  Cadastrado
                                </span>

                                <button
                                  type="button"
                                  className="btn btn-danger document-delete-button"
                                  onClick={() =>
                                    setDocumentoExcluir(
                                      documento,
                                    )
                                  }
                                >
                                  <FiTrash2 />
                                  Excluir
                                </button>
                              </div>
                            ) : (
                              <span className="document-type-missing">
                                —
                              </span>
                            )}
                          </td>
                        );
                      },
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {documentoExcluir && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Confirmar exclusão</h3>

            <p>
              Remover o arquivo{' '}
              <strong>
                {documentoExcluir.tipo}
              </strong>{' '}
              da linha{' '}
              <strong>
                {documentoExcluir.tituloProcesso ||
                  documentoExcluir.titulo}
              </strong>
              ?
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setDocumentoExcluir(null)
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmarExclusao}
              >
                <FiTrash2 />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsPanel;
