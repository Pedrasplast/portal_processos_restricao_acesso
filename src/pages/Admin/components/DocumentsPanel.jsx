import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiEye,
  FiFileText,
  FiPlus,
  FiSearch,
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
  visualizarDocumento,
} from '../../../utils/arquivos';

import { useFeedback } from '../../../hooks/useFeedback';

import {
  agruparDocumentos,
  formatarTituloProcesso,
  obterNumeracaoDocumento,
} from '../../../utils/documentos';

import {
  normalizarChave,
} from '../../../utils/texto';

const NOVA_LINHA = '__NOVA_LINHA__';
const TODOS_SETORES = '__TODOS_SETORES__';

const OPCOES_POR_PAGINA = [
  10,
  20,
  50,
];

function DocumentsPanel({
  documentos,
  loading,
  erro,
  onReload,
}) {
  const { notificar: notify, confirmar } = useFeedback();

  const [setor, setSetor] = useState('');

  const [
    processoSelecionado,
    setProcessoSelecionado,
  ] = useState(NOVA_LINHA);

  const [
    tipoDocumento,
    setTipoDocumento,
  ] = useState('');

  const [
    descricao,
    setDescricao,
  ] = useState('');

  const [
    arquivo,
    setArquivo,
  ] = useState(null);

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    busca,
    setBusca,
  ] = useState('');

  const [
    setorFiltro,
    setSetorFiltro,
  ] = useState(TODOS_SETORES);

  const [
    paginaAtual,
    setPaginaAtual,
  ] = useState(1);

  const [
    itensPorPagina,
    setItensPorPagina,
  ] = useState(10);

  const [
    grupoExpandido,
    setGrupoExpandido,
  ] = useState(null);

  const inputFileRef = useRef(null);
  const formRef = useRef(null);

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
    [
      documentos,
      setor,
    ],
  );

  const processoAtual = useMemo(() => {
    if (
      !setor ||
      processoSelecionado === NOVA_LINHA
    ) {
      return null;
    }

    return (
      numeracao.processosExistentes.find(
        (grupo) =>
          grupo.codigo === processoSelecionado,
      ) || null
    );
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
        ? Object.keys(
            processoAtual.arquivos,
          )
        : [],
    );

    return TIPOS_DOCUMENTO.filter(
      (tipo) =>
        !tiposJaCadastrados.has(
          tipo.valor,
        ),
    );
  }, [processoAtual]);

  const tituloPreview =
    formatarTituloProcesso(
      codigoAtual,
      descricaoAtual ||
        'DESCRIÇÃO DO DOCUMENTO',
    );

  const setoresComDocumentos = useMemo(() => {
    return [
      ...new Set(
        grupos
          .map((grupo) => grupo.setor)
          .filter(Boolean),
      ),
    ].sort((a, b) =>
      String(a).localeCompare(
        String(b),
        'pt-BR',
      ),
    );
  }, [grupos]);

  const gruposFiltrados = useMemo(() => {
    const termo = normalizarChave(
      busca.trim(),
    );

    return grupos.filter((grupo) => {
      const correspondeSetor =
        setorFiltro === TODOS_SETORES ||
        normalizarChave(grupo.setor) ===
          normalizarChave(setorFiltro);

      if (!correspondeSetor) {
        return false;
      }

      if (!termo) {
        return true;
      }

      const textoPesquisavel =
        normalizarChave(
          [
            grupo.codigo,
            grupo.numero,
            grupo.descricao,
            grupo.titulo,
            grupo.setor,
          ]
            .filter(Boolean)
            .join(' '),
        );

      return textoPesquisavel.includes(
        termo,
      );
    });
  }, [
    grupos,
    busca,
    setorFiltro,
  ]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      gruposFiltrados.length /
        itensPorPagina,
    ),
  );

  const gruposDaPagina = useMemo(() => {
    const inicio =
      (paginaAtual - 1) *
      itensPorPagina;

    return gruposFiltrados.slice(
      inicio,
      inicio + itensPorPagina,
    );
  }, [
    gruposFiltrados,
    paginaAtual,
    itensPorPagina,
  ]);

  const primeiroItem = gruposFiltrados.length
    ? (paginaAtual - 1) *
        itensPorPagina +
      1
    : 0;

  const ultimoItem = Math.min(
    paginaAtual * itensPorPagina,
    gruposFiltrados.length,
  );

  useEffect(() => {
    if (!setor) {
      setProcessoSelecionado(
        NOVA_LINHA,
      );

      setTipoDocumento('');
      setDescricao('');

      return;
    }

    if (
      processoSelecionado !==
        NOVA_LINHA &&
      !numeracao.processosExistentes.some(
        (grupo) =>
          grupo.codigo ===
          processoSelecionado,
      )
    ) {
      setProcessoSelecionado(
        NOVA_LINHA,
      );

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
          tipo.valor ===
          tipoDocumento,
      )
    ) {
      setTipoDocumento('');
    }
  }, [
    tipoDocumento,
    tiposDisponiveis,
  ]);

  useEffect(() => {
    setPaginaAtual(1);
    setGrupoExpandido(null);
  }, [
    busca,
    setorFiltro,
    itensPorPagina,
  ]);

  useEffect(() => {
    if (
      paginaAtual >
      totalPaginas
    ) {
      setPaginaAtual(totalPaginas);
    }
  }, [
    paginaAtual,
    totalPaginas,
  ]);

  function limparArquivo() {
    setArquivo(null);

    if (inputFileRef.current) {
      inputFileRef.current.value = '';
    }
  }

  function rolarParaFormulario() {
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function prepararNovoDocumentoNoGrupo(
    grupo,
    tipo,
  ) {
    setSetor(grupo.setor);

    setProcessoSelecionado(
      grupo.codigo,
    );

    setTipoDocumento(tipo.valor);
    setDescricao('');

    limparArquivo();
    rolarParaFormulario();
  }

  function alternarGrupo(grupoId) {
    setGrupoExpandido((atual) =>
      atual === grupoId
        ? null
        : grupoId,
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!setor) {
      notify(
        'erro',
        'Selecione o setor.',
      );

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

  async function abrirDocumento(documento) {
    try {
      await visualizarDocumento(documento);
    } catch (error) {
      notify('erro', error.message);
    }
  }

  async function excluir(documento) {
    const confirmado = await confirmar({
      titulo: 'Excluir documento',
      mensagem: `O arquivo ${documento.tipo} da linha "${documento.tituloProcesso || documento.titulo}" será removido do repositório.`,
      detalhe: 'O PDF também é apagado do armazenamento. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir documento',
      perigo: true,
    });

    if (!confirmado) return;

    try {
      await excluirDocumento(documento);
      notify('sucesso', `${documento.tipo} excluído com sucesso.`);
      await onReload();
    } catch (error) {
      notify('erro', error.message || 'Erro ao excluir documento.');
    }
  }

  return (
    <div className="admin-stack">
      <form
        ref={formRef}
        className="admin-card document-form-card"
        onSubmit={handleSubmit}
      >
        <div className="admin-card__header">
          <div>
            <h3>
              Adicionar Documento
            </h3>

            <p>
              Crie uma descrição única com
              numeração automática e vincule
              POP, Fluxograma e Mapa Visual
              à mesma linha.
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
                setSetor(
                  event.target.value,
                );

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
              <option
                value=""
                disabled
              >
                Selecione o setor
              </option>

              {SETORES.map((item) => (
                <option
                  key={item}
                  value={item}
                >
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
              disabled={
                salvando ||
                !setor
              }
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
                tiposDisponiveis.length ===
                  0
              }
              required
            >
              <option
                value=""
                disabled
              >
                {tiposDisponiveis.length
                  ? 'Selecione o tipo'
                  : 'Todos os tipos já cadastrados'}
              </option>

              {tiposDisponiveis.map(
                (tipo) => (
                  <option
                    key={tipo.valor}
                    value={tipo.valor}
                  >
                    {tipo.nome}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="form-group admin-form-grid__wide">
            <label htmlFor="document-title">
              Descrição única
            </label>

            <div className="document-title-control">
              <span>
                {codigoAtual || '__'} -
              </span>

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
                  Boolean(
                    processoAtual,
                  )
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
                tiposDisponiveis.length ===
                  0
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
            tiposDisponiveis.length ===
              0
          }
        >
          <FiUpload />

          {salvando
            ? 'Publicando...'
            : 'Adicionar à linha'}
        </button>
      </form>

      <section className="admin-card documents-manager-card">
        <div className="admin-card__header documents-manager-header">
          <div>
            <h3>
              Documentos Cadastrados
            </h3>

            <p>
              {grupos.length} linha(s) e{' '}
              {documentos.length} arquivo(s)
              no repositório.
            </p>
          </div>
        </div>

        <div className="documents-toolbar">
          <div className="documents-search">
            <FiSearch
              aria-hidden="true"
            />

            <input
              type="search"
              value={busca}
              onChange={(event) =>
                setBusca(
                  event.target.value,
                )
              }
              placeholder="Buscar número, descrição ou setor..."
              aria-label="Buscar documentos"
            />
          </div>

          <div className="documents-filter-group">
            <label htmlFor="documents-sector-filter">
              Setor
            </label>

            <select
              id="documents-sector-filter"
              value={setorFiltro}
              onChange={(event) =>
                setSetorFiltro(
                  event.target.value,
                )
              }
            >
              <option value={TODOS_SETORES}>
                Todos os setores
              </option>

              {setoresComDocumentos.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="documents-filter-group documents-page-size">
            <label htmlFor="documents-page-size">
              Por página
            </label>

            <select
              id="documents-page-size"
              value={itensPorPagina}
              onChange={(event) =>
                setItensPorPagina(
                  Number(
                    event.target.value,
                  ),
                )
              }
            >
              {OPCOES_POR_PAGINA.map(
                (quantidade) => (
                  <option
                    key={quantidade}
                    value={quantidade}
                  >
                    {quantidade}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div className="documents-results-summary">
          {gruposFiltrados.length === 0
            ? 'Nenhuma linha encontrada.'
            : `Mostrando ${primeiroItem}–${ultimoItem} de ${gruposFiltrados.length} linha(s).`}
        </div>

        {erro && (
          <div className="estado-erro" role="alert">
            <span>{erro}</span>
            <button type="button" className="btn btn-secondary" onClick={onReload}>
              Tentar novamente
            </button>
          </div>
        )}

        <div className="documents-accordion-list">
          {loading ? (
            <div className="documents-empty-state">
              Carregando documentos...
            </div>
          ) : gruposFiltrados.length ===
            0 ? (
            <div className="documents-empty-state">
              Nenhum documento encontrado
              com os filtros informados.
            </div>
          ) : (
            gruposDaPagina.map((grupo) => {
              const expandido =
                grupoExpandido === grupo.id;

              const quantidadeArquivos =
                Object.keys(
                  grupo.arquivos,
                ).length;

              return (
                <article
                  key={grupo.id}
                  className={
                    `document-accordion${
                      expandido
                        ? ' expanded'
                        : ''
                    }`
                  }
                >
                  <button
                    type="button"
                    className="document-accordion-summary"
                    onClick={() =>
                      alternarGrupo(
                        grupo.id,
                      )
                    }
                    aria-expanded={
                      expandido
                    }
                  >
                    <div className="document-accordion-main">
                      <span className="document-accordion-icon">
                        <FiFileText />
                      </span>

                      <div className="document-accordion-text">
                        <strong>
                          {grupo.titulo}
                        </strong>

                        <span>
                          Setor: {grupo.setor}
                        </span>
                      </div>
                    </div>

                    <div className="document-accordion-status">
                      <span className="document-files-count">
                        {quantidadeArquivos} de{' '}
                        {TIPOS_DOCUMENTO.length}{' '}
                        arquivo(s)
                      </span>

                      <span className="document-manage-label">
                        {expandido
                          ? 'Fechar'
                          : 'Gerenciar'}
                      </span>

                      {expandido ? (
                        <FiChevronUp />
                      ) : (
                        <FiChevronDown />
                      )}
                    </div>
                  </button>

                  {expandido && (
                    <div className="document-accordion-content">
                      <div className="document-types-grid">
                        {TIPOS_DOCUMENTO.map(
                          (tipo) => {
                            const documento =
                              grupo.arquivos[
                                tipo.valor
                              ];

                            return (
                              <div
                                key={tipo.valor}
                                className={
                                  `document-type-card${
                                    documento
                                      ? ' registered'
                                      : ' missing'
                                  }`
                                }
                              >
                                <div className="document-type-card-header">
                                  <strong>
                                    {tipo.nome}
                                  </strong>

                                  {documento ? (
                                    <span className="document-type-status registered">
                                      <FiCheckCircle />
                                      Cadastrado
                                    </span>
                                  ) : (
                                    <span className="document-type-status missing">
                                      Pendente
                                    </span>
                                  )}
                                </div>

                                {documento ? (
                                  <div className="document-type-card-actions">
                                    <button
                                      type="button"
                                      className="btn document-view-button"
                                      onClick={() =>
                                        abrirDocumento(
                                          documento,
                                        )
                                      }
                                    >
                                      <FiEye />
                                      Visualizar
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-danger document-delete-button"
                                      onClick={() =>
                                        excluir(
                                          documento,
                                        )
                                      }
                                    >
                                      <FiTrash2 />
                                      Excluir
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn document-add-button"
                                    onClick={() =>
                                      prepararNovoDocumentoNoGrupo(
                                        grupo,
                                        tipo,
                                      )
                                    }
                                  >
                                    <FiPlus />
                                    Adicionar
                                  </button>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {!loading &&
          gruposFiltrados.length > 0 && (
            <div className="documents-pagination">
              <button
                type="button"
                className="documents-pagination-button"
                onClick={() =>
                  setPaginaAtual(
                    (atual) =>
                      Math.max(
                        1,
                        atual - 1,
                      ),
                  )
                }
                disabled={
                  paginaAtual === 1
                }
              >
                <FiChevronLeft />
                Anterior
              </button>

              <span className="documents-pagination-status">
                Página {paginaAtual} de{' '}
                {totalPaginas}
              </span>

              <button
                type="button"
                className="documents-pagination-button"
                onClick={() =>
                  setPaginaAtual(
                    (atual) =>
                      Math.min(
                        totalPaginas,
                        atual + 1,
                      ),
                  )
                }
                disabled={
                  paginaAtual ===
                  totalPaginas
                }
              >
                Próxima
                <FiChevronRight />
              </button>
            </div>
          )}
      </section>

    </div>
  );
}

export default DocumentsPanel;