import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiFilePlus,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
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

  const classeTipo = (valor) => `tipo--${String(valor).toLowerCase().split(' ')[0]}`;

  return (
    <div className="docs-layout">
      {/* ---------------- lista ---------------- */}
      <section className="painel docs-lista" aria-labelledby="docs-lista-titulo">
        <div className="painel__cabecalho">
          <div>
            <h2 id="docs-lista-titulo">Documentos cadastrados</h2>
            <p>
              {grupos.length} {grupos.length === 1 ? 'processo' : 'processos'} e {documentos.length}{' '}
              {documentos.length === 1 ? 'arquivo' : 'arquivos'} no repositório.
            </p>
          </div>
        </div>

        <div className="docs-filtros">
          <label className="campo-busca">
            <FiSearch aria-hidden="true" />
            <span className="sr-only">Buscar documentos</span>
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar processo"
            />
          </label>

          <select
            className="form-control docs-filtros__setor"
            value={setorFiltro}
            onChange={(event) => setSetorFiltro(event.target.value)}
            aria-label="Filtrar por setor"
          >
            <option value={TODOS_SETORES}>Todos os setores</option>
            {setoresComDocumentos.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            className="form-control docs-filtros__pagina"
            value={itensPorPagina}
            onChange={(event) => setItensPorPagina(Number(event.target.value))}
            aria-label="Itens por página"
          >
            {OPCOES_POR_PAGINA.map((quantidade) => (
              <option key={quantidade} value={quantidade}>{quantidade} por página</option>
            ))}
          </select>
        </div>

        {erro && (
          <div className="estado-erro" role="alert">
            <span>{erro}</span>
            <button type="button" className="btn btn-secondary" onClick={onReload}>
              Tentar novamente
            </button>
          </div>
        )}

        <ul className="docs-linhas">
          {loading ? (
            <li className="docs-vazio">Carregando documentos...</li>
          ) : gruposFiltrados.length === 0 ? (
            <li className="docs-vazio">
              {grupos.length === 0
                ? 'Nenhum documento cadastrado ainda. Use o formulário ao lado para adicionar o primeiro.'
                : 'Nenhum documento corresponde aos filtros.'}
            </li>
          ) : (
            gruposDaPagina.map((grupo) => {
              const expandido = grupoExpandido === grupo.id;

              return (
                <li key={grupo.id} className={`docs-linha${expandido ? ' aberta' : ''}`}>
                  <button
                    type="button"
                    className="docs-linha__resumo"
                    onClick={() => alternarGrupo(grupo.id)}
                    aria-expanded={expandido}
                  >
                    <span className="docs-linha__codigo numero">{grupo.codigo}</span>

                    <span className="docs-linha__texto">
                      <strong>{grupo.descricao}</strong>
                      <small>{grupo.setor}</small>
                    </span>

                    <span className="cobertura" aria-label={`${Object.keys(grupo.arquivos).length} de ${TIPOS_DOCUMENTO.length} documentos`}>
                      {TIPOS_DOCUMENTO.map((tipo) => (
                        <span
                          key={tipo.valor}
                          className={`cobertura__parte ${classeTipo(tipo.valor)}${grupo.arquivos[tipo.valor] ? ' cheia' : ''}`}
                          title={`${tipo.nome}: ${grupo.arquivos[tipo.valor] ? 'cadastrado' : 'pendente'}`}
                        />
                      ))}
                    </span>

                    <FiChevronDown className="docs-linha__seta" aria-hidden="true" />
                  </button>

                  {expandido && (
                    <div className="docs-linha__arquivos">
                      {TIPOS_DOCUMENTO.map((tipo) => {
                        const documento = grupo.arquivos[tipo.valor];

                        return (
                          <div key={tipo.valor} className={`docs-arquivo${documento ? '' : ' vazio'}`}>
                            <span className={`tipo-tag ${classeTipo(tipo.valor)}`}>{tipo.nome}</span>

                            {documento ? (
                              <div className="docs-arquivo__acoes">
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirDocumento(documento)}>
                                  <FiEye /> Visualizar
                                </button>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => excluir(documento)}>
                                  <FiTrash2 /> Excluir
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => prepararNovoDocumentoNoGrupo(grupo, tipo)}
                              >
                                <FiPlus /> Adicionar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>

        {!loading && gruposFiltrados.length > 0 && (
          <div className="docs-paginacao">
            <span className="numero">
              {primeiroItem}–{ultimoItem} de {gruposFiltrados.length}
            </span>

            <div className="docs-paginacao__botoes">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPaginaAtual((atual) => Math.max(1, atual - 1))}
                disabled={paginaAtual === 1}
                aria-label="Página anterior"
              >
                <FiChevronLeft />
              </button>
              <span className="numero">{paginaAtual} / {totalPaginas}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPaginaAtual((atual) => Math.min(totalPaginas, atual + 1))}
                disabled={paginaAtual === totalPaginas}
                aria-label="Próxima página"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- formulário ---------------- */}
      <aside className="docs-form-coluna">
        <form ref={formRef} className="painel docs-form" onSubmit={handleSubmit} aria-labelledby="docs-form-titulo">
          <div className="painel__cabecalho">
            <div>
              <h2 id="docs-form-titulo">
                <FiFilePlus aria-hidden="true" /> Adicionar documento
              </h2>
              <p>Cada processo reúne até um POP, um Fluxograma e um Manual.</p>
            </div>
          </div>

          <ol className="passos">
            <li className="passo">
              <label htmlFor="document-sector">Setor</label>
              <select
                id="document-sector"
                className="form-control"
                value={setor}
                onChange={(event) => {
                  setSetor(event.target.value);
                  setProcessoSelecionado(NOVA_LINHA);
                  setTipoDocumento('');
                  setDescricao('');
                  limparArquivo();
                }}
                disabled={salvando}
                required
              >
                <option value="" disabled>Selecione o setor</option>
                {SETORES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </li>

            <li className="passo">
              <label htmlFor="document-process">Processo</label>
              <select
                id="document-process"
                className="form-control"
                value={processoSelecionado}
                onChange={(event) => {
                  setProcessoSelecionado(event.target.value);
                  setTipoDocumento('');
                  setDescricao('');
                  limparArquivo();
                }}
                disabled={salvando || !setor}
                required
              >
                <option value={NOVA_LINHA}>Novo processo ({numeracao.proximoCodigo})</option>
                {numeracao.processosExistentes.map((grupo) => (
                  <option key={grupo.id} value={grupo.codigo}>
                    {grupo.codigo} - {grupo.descricao}
                  </option>
                ))}
              </select>

              <div className="campo-descricao">
                <span className="campo-descricao__codigo numero" aria-label="Número automático">
                  {setor ? codigoAtual : '--'}
                </span>
                <input
                  id="document-title"
                  className="form-control"
                  type="text"
                  value={descricaoAtual}
                  onChange={(event) => setDescricao(event.target.value.toLocaleUpperCase('pt-BR'))}
                  disabled={salvando || !setor || Boolean(processoAtual)}
                  placeholder="Descrição do processo"
                  maxLength={140}
                  required={!processoAtual}
                  aria-label="Descrição do processo"
                />
              </div>
              <p className="form-ajuda">
                {!setor
                  ? 'Escolha o setor para ver os processos e a numeração.'
                  : processoAtual
                    ? 'Processo existente: escolha apenas o tipo que falta.'
                    : `Será cadastrado como ${tituloPreview}.`}
              </p>
            </li>

            <li className="passo">
              <span className="passo__rotulo" id="document-type-label">Tipo de documento</span>
              <div className="tipo-escolha" role="radiogroup" aria-labelledby="document-type-label">
                {TIPOS_DOCUMENTO.map((tipo) => {
                  const disponivel = tiposDisponiveis.some((item) => item.valor === tipo.valor);
                  return (
                    <label
                      key={tipo.valor}
                      className={`tipo-escolha__opcao ${classeTipo(tipo.valor)}${tipoDocumento === tipo.valor ? ' marcada' : ''}${!disponivel ? ' indisponivel' : ''}`}
                    >
                      <input
                        type="radio"
                        name="document-type"
                        value={tipo.valor}
                        checked={tipoDocumento === tipo.valor}
                        onChange={(event) => setTipoDocumento(event.target.value)}
                        disabled={salvando || !setor || !disponivel}
                        required
                      />
                      <span>{tipo.nome}</span>
                      {!disponivel && setor && <small>já cadastrado</small>}
                    </label>
                  );
                })}
              </div>
            </li>

            <li className="passo">
              <span className="passo__rotulo">Arquivo PDF</span>
              <label className={`upload${arquivo ? ' com-arquivo' : ''}${!setor || tiposDisponiveis.length === 0 ? ' desativado' : ''}`}>
                <FiUploadCloud aria-hidden="true" />
                <span>
                  {arquivo ? <strong>{arquivo.name}</strong> : <strong>Selecionar PDF</strong>}
                  <small>{arquivo ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB` : 'Até 20 MB'}</small>
                </span>
                <input
                  ref={inputFileRef}
                  id="document-file"
                  className="sr-only"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setArquivo(event.target.files?.[0] || null)}
                  disabled={salvando || !setor || tiposDisponiveis.length === 0}
                  required
                />
              </label>
            </li>
          </ol>

          <div className="docs-form__rodape">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={salvando || !setor || tiposDisponiveis.length === 0}
            >
              <FiUploadCloud />
              {salvando ? 'Publicando...' : 'Publicar documento'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export default DocumentsPanel;
