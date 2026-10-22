import { useMemo, useState } from 'react';
import { FiDownload, FiEye, FiFolder, FiSearch, FiX } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import AppLayout from '../../components/layout/AppLayout';
import { TIPOS_DOCUMENTO } from '../../config/documentos';
import { useDocumentosPublicos } from '../../hooks/useDocumentosPublicos';
import { useFeedback } from '../../hooks/useFeedback';
import { baixarDocumento, visualizarDocumento } from '../../utils/arquivos';
import { agruparDocumentos } from '../../utils/documentos';
import { normalizarChave } from '../../utils/texto';

import './Repository.css';

const TODOS = 'TODOS';

const COR_TIPO = {
  POP: 'var(--tipo-pop)',
  FLUXOGRAMA: 'var(--tipo-fluxograma)',
  MANUAL: 'var(--tipo-manual)',
};

/*
 * Repositório em formato de explorador: setores à esquerda (como pastas)
 * e, à direita, os processos do setor escolhido com os três documentos
 * lado a lado. Setor, busca e tipo ficam na URL (?setor= ?busca= ?tipo=),
 * então os links do Início e o botão "voltar" funcionam.
 */
function Repository() {
  const { notificar } = useFeedback();
  const { documentos, loading, erro, recarregar } = useDocumentosPublicos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState(() => searchParams.get('busca') || '');
  const [baixandoId, setBaixandoId] = useState(null);

  const setorSelecionado = searchParams.get('setor') || TODOS;
  const tipoSelecionado = TIPOS_DOCUMENTO.find((t) => t.valor === searchParams.get('tipo')) || null;

  function atualizarParametro(nome, valor) {
    const params = new URLSearchParams(searchParams);
    if (valor) params.set(nome, valor);
    else params.delete(nome);
    setSearchParams(params, { replace: true });
  }

  const grupos = useMemo(() => agruparDocumentos(documentos), [documentos]);

  /* Setores que têm processos, com a contagem (ordem alfabética). */
  const setores = useMemo(() => {
    const mapa = new Map();
    grupos.forEach((g) => mapa.set(g.setor, (mapa.get(g.setor) || 0) + 1));
    return [...mapa.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [grupos]);

  const setorAtual = setores.find((s) => normalizarChave(s.nome) === normalizarChave(setorSelecionado));
  const mostrandoTodos = !setorAtual;
  const termo = normalizarChave(busca.trim());

  /* Com busca, procura em todos os setores; sem busca, no setor escolhido. */
  const processos = useMemo(
    () =>
      grupos.filter((grupo) => {
        if (!termo && setorAtual && normalizarChave(grupo.setor) !== normalizarChave(setorAtual.nome)) return false;
        if (tipoSelecionado && !grupo.arquivos[tipoSelecionado.valor]) return false;
        if (!termo) return true;
        return normalizarChave(`${grupo.codigo} ${grupo.descricao} ${grupo.setor}`).includes(termo);
      }),
    [grupos, setorAtual, tipoSelecionado, termo],
  );

  const totalDocumentos = processos.reduce((soma, g) => soma + Object.keys(g.arquivos).length, 0);
  const possiveis = processos.length * TIPOS_DOCUMENTO.length;

  let titulo = setorAtual ? setorAtual.nome : 'Todos os setores';
  if (termo) titulo = `Resultados para "${busca.trim()}"`;

  async function handleVisualizar(arquivo) {
    try {
      await visualizarDocumento(arquivo);
    } catch (error) {
      notificar('erro', error.message);
    }
  }

  async function handleDownload(arquivo) {
    if (!arquivo || baixandoId) return;
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
    <AppLayout titulo="Repositório">
      <header className="page-header">
        <div>
          <h1>Repositório de processos</h1>
          <p>Escolha um setor para ver os processos e abrir os documentos.</p>
        </div>
      </header>

      <div className="explorador">
        {/* ---------------- setores ---------------- */}
        <section className="painel explorador__setores" aria-labelledby="explorador-setores-titulo">
          <div className="painel__cabecalho">
            <h2 id="explorador-setores-titulo">Setores</h2>
          </div>

          <div className="explorador__busca">
            <label className="campo-busca">
              <FiSearch aria-hidden="true" />
              <span className="sr-only">Buscar em todos os setores</span>
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar em todos os setores"
              />
            </label>
          </div>

          <nav aria-label="Setores">
            <ul className="explorador__lista">
              <li>
                <button
                  type="button"
                  className={`explorador__setor${mostrandoTodos && !termo ? ' ativo' : ''}`}
                  onClick={() => {
                    setBusca('');
                    atualizarParametro('setor', null);
                  }}
                  aria-current={mostrandoTodos && !termo ? 'true' : undefined}
                >
                  <FiFolder aria-hidden="true" />
                  <span>Todos os setores</span>
                  <b className="numero">{grupos.length}</b>
                </button>
              </li>
              {setores.map((setor) => {
                const ativo = !termo && setorAtual?.nome === setor.nome;
                return (
                  <li key={setor.nome}>
                    <button
                      type="button"
                      className={`explorador__setor${ativo ? ' ativo' : ''}`}
                      onClick={() => {
                        setBusca('');
                        atualizarParametro('setor', setor.nome);
                      }}
                      aria-current={ativo ? 'true' : undefined}
                    >
                      <FiFolder aria-hidden="true" />
                      <span>{setor.nome}</span>
                      <b className="numero">{setor.total}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </section>

        {/* ---------------- processos ---------------- */}
        <section className="painel explorador__conteudo" aria-labelledby="explorador-titulo" aria-live="polite">
          <div className="painel__cabecalho explorador__cab">
            <h2 id="explorador-titulo">
              {titulo}
              <span className="explorador__qtd numero">
                {processos.length} {processos.length === 1 ? 'processo' : 'processos'}
              </span>
            </h2>

            {!loading && possiveis > 0 && (
              <div className="explorador__cobertura">
                <span className="numero">{totalDocumentos} de {possiveis} documentos</span>
                <span className="explorador__trilho" aria-hidden="true">
                  <span style={{ width: `${(totalDocumentos / possiveis) * 100}%` }} />
                </span>
              </div>
            )}
          </div>

          {tipoSelecionado && (
            <div className="explorador__filtro-tipo">
              <span>Mostrando processos com</span>
              <button
                type="button"
                className="explorador__chip"
                style={{ '--cor-tipo': COR_TIPO[tipoSelecionado.valor] }}
                onClick={() => atualizarParametro('tipo', null)}
              >
                <span className="tipo-tag">{tipoSelecionado.nome}</span>
                <FiX aria-label="Remover filtro de tipo" />
              </button>
            </div>
          )}

          {erro && (
            <div className="estado-erro explorador__erro" role="alert">
              <span>{erro}</span>
              <button type="button" className="btn btn-secondary" onClick={recarregar}>Tentar novamente</button>
            </div>
          )}

          <div className="explorador__colunas" aria-hidden="true">
            <span>Processo</span>
            {TIPOS_DOCUMENTO.map((tipo) => <span key={tipo.valor}>{tipo.nome}</span>)}
          </div>

          {loading ? (
            <p className="explorador__vazio">Carregando documentos...</p>
          ) : processos.length === 0 ? (
            <p className="explorador__vazio">
              {grupos.length === 0
                ? 'Ainda não há documentos publicados.'
                : termo
                  ? 'Nenhum processo encontrado. Tente outra palavra ou o número do processo.'
                  : 'Nenhum processo neste filtro.'}
            </p>
          ) : (
            <ul className="explorador__processos">
              {processos.map((grupo) => (
                <li key={grupo.id} className="explorador__processo">
                  <div className="explorador__titulo">
                    <span className="explorador__cod numero">{grupo.codigo}</span>
                    <span>
                      <strong>{grupo.descricao}</strong>
                      {(mostrandoTodos || termo) && <small>{grupo.setor}</small>}
                    </span>
                  </div>

                  {TIPOS_DOCUMENTO.map((tipo) => {
                    const arquivo = grupo.arquivos[tipo.valor];

                    if (!arquivo) {
                      return (
                        <div key={tipo.valor} className="explorador__doc vazio">
                          <span>Sem {tipo.nome}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={tipo.valor}
                        className="explorador__doc"
                        style={{ '--cor-tipo': COR_TIPO[tipo.valor] }}
                      >
                        <span className="explorador__doc-tipo">{tipo.nome}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icone explorador__ver"
                          onClick={() => handleVisualizar(arquivo)}
                          aria-label={`Visualizar ${tipo.nome} de ${grupo.titulo}`}
                          title="Visualizar"
                        >
                          <FiEye />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icone"
                          onClick={() => handleDownload(arquivo)}
                          disabled={baixandoId === arquivo.id}
                          aria-label={`Baixar ${tipo.nome} de ${grupo.titulo}`}
                          title="Baixar PDF"
                        >
                          <FiDownload />
                        </button>
                      </div>
                    );
                  })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

export default Repository;
