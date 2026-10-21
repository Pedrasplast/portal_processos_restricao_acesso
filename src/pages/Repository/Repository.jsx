import { useMemo, useState } from 'react';
import { FiDownload, FiEye, FiSearch } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import AppLayout from '../../components/layout/AppLayout';
import { SETORES, TIPOS_DOCUMENTO } from '../../config/documentos';
import { useDocumentos } from '../../hooks/useDocumentos';
import { useFeedback } from '../../hooks/useFeedback';
import { baixarDocumento, visualizarDocumento } from '../../utils/arquivos';
import { agruparDocumentos } from '../../utils/documentos';
import { normalizarChave } from '../../utils/texto';

import './Repository.css';

const TODOS = 'TODOS';
const classeTipo = (valor) => `tipo--${String(valor).toLowerCase().split(' ')[0]}`;

function Repository() {
  const { notificar } = useFeedback();
  const { documentos, loading, erro, recarregar } = useDocumentos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [baixandoId, setBaixandoId] = useState(null);

  const setorSelecionado = searchParams.get('setor') || TODOS;

  function escolherSetor(setor) {
    const params = new URLSearchParams(searchParams);
    if (setor === TODOS) params.delete('setor');
    else params.set('setor', setor);
    setSearchParams(params, { replace: true });
  }

  const grupos = useMemo(() => agruparDocumentos(documentos), [documentos]);

  /* Quantos processos cada setor tem (para os filtros). */
  const contagemPorSetor = useMemo(() => {
    const mapa = new Map();
    grupos.forEach((g) => {
      const chave = normalizarChave(g.setor);
      mapa.set(chave, (mapa.get(chave) || 0) + 1);
    });
    return mapa;
  }, [grupos]);

  const setoresFiltro = useMemo(() => {
    const extras = grupos
      .map((g) => g.setor)
      .filter((s) => !SETORES.some((c) => normalizarChave(c) === normalizarChave(s)));
    return [...SETORES, ...new Set(extras)].filter((s) => contagemPorSetor.get(normalizarChave(s)));
  }, [grupos, contagemPorSetor]);

  const gruposFiltrados = useMemo(() => {
    const termo = normalizarChave(busca.trim());
    const setor = normalizarChave(setorSelecionado);

    return grupos.filter((grupo) => {
      if (setorSelecionado !== TODOS && normalizarChave(grupo.setor) !== setor) return false;
      if (!termo) return true;
      return normalizarChave(`${grupo.codigo} ${grupo.descricao} ${grupo.setor}`).includes(termo);
    });
  }, [grupos, setorSelecionado, busca]);

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

  const colunas = 2 + TIPOS_DOCUMENTO.length;

  return (
    <AppLayout titulo="Repositório">
      <header className="page-header">
        <div>
          <h1>Repositório de processos</h1>
          <p>Consulte, visualize e baixe os POPs, Fluxogramas e Manuais de cada setor.</p>
        </div>
      </header>

      <section className="painel repo">
        <div className="repo__filtros">
          <label className="campo-busca">
            <FiSearch aria-hidden="true" />
            <span className="sr-only">Buscar processo</span>
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por número ou descrição"
            />
          </label>

          <div className="repo__setores" role="group" aria-label="Filtrar por setor">
            <button
              type="button"
              className={`repo__setor${setorSelecionado === TODOS ? ' ativo' : ''}`}
              onClick={() => escolherSetor(TODOS)}
              aria-pressed={setorSelecionado === TODOS}
            >
              Todos <span className="numero">{grupos.length}</span>
            </button>
            {setoresFiltro.map((setor) => {
              const ativo = normalizarChave(setorSelecionado) === normalizarChave(setor);
              return (
                <button
                  key={setor}
                  type="button"
                  className={`repo__setor${ativo ? ' ativo' : ''}`}
                  onClick={() => escolherSetor(setor)}
                  aria-pressed={ativo}
                >
                  {setor} <span className="numero">{contagemPorSetor.get(normalizarChave(setor))}</span>
                </button>
              );
            })}
          </div>
        </div>

        {erro && (
          <div className="estado-erro repo__erro" role="alert">
            <span>{erro}</span>
            <button type="button" className="btn btn-secondary" onClick={recarregar}>Tentar novamente</button>
          </div>
        )}

        <div className="table-wrapper">
          <table className="data-table repo__tabela">
            <thead>
              <tr>
                <th>Processo</th>
                <th>Setor</th>
                {TIPOS_DOCUMENTO.map((tipo) => (
                  <th key={tipo.valor} className="repo__col-tipo">
                    <span className={`tipo-tag ${classeTipo(tipo.valor)}`}>{tipo.nome}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={colunas} className="empty-state">Carregando documentos...</td></tr>
              ) : gruposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={colunas} className="empty-state">
                    {grupos.length === 0
                      ? 'Ainda não há documentos publicados.'
                      : 'Nenhum processo encontrado. Tente outra busca ou outro setor.'}
                  </td>
                </tr>
              ) : (
                gruposFiltrados.map((grupo) => (
                  <tr key={grupo.id}>
                    <td>
                      <div className="repo__processo">
                        <span className="repo__codigo numero">{grupo.codigo}</span>
                        <strong>{grupo.descricao}</strong>
                      </div>
                    </td>
                    <td className="repo__setor-celula">{grupo.setor}</td>

                    {TIPOS_DOCUMENTO.map((tipo) => {
                      const arquivo = grupo.arquivos[tipo.valor];
                      return (
                        <td key={tipo.valor} className="repo__col-tipo" data-label={tipo.nome}>
                          {arquivo ? (
                            <div className="repo__acoes">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleVisualizar(arquivo)}
                                aria-label={`Visualizar ${tipo.nome} de ${grupo.titulo}`}
                              >
                                <FiEye /> <span>Ver</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={baixandoId === arquivo.id}
                                onClick={() => handleDownload(arquivo)}
                                aria-label={`Baixar ${tipo.nome} de ${grupo.titulo}`}
                                title="Baixar PDF"
                              >
                                <FiDownload />
                              </button>
                            </div>
                          ) : (
                            <span className="repo__ausente" aria-label={`${tipo.nome} não disponível`}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && gruposFiltrados.length > 0 && (
          <p className="repo__rodape numero">
            {gruposFiltrados.length} {gruposFiltrados.length === 1 ? 'processo' : 'processos'}
            {setorSelecionado !== TODOS && ` em ${setorSelecionado}`}
          </p>
        )}
      </section>
    </AppLayout>
  );
}

export default Repository;
