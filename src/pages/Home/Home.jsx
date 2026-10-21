import { useEffect, useMemo, useState } from 'react';
import { FiClock, FiFolder, FiLink, FiUsers } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';

import AppLayout, { useLayout } from '../../components/layout/AppLayout';
import { SETORES, TIPOS_DOCUMENTO } from '../../config/documentos';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentos } from '../../hooks/useDocumentos';
import { listarConvites } from '../../services/convitesService';
import { listarUsuarios } from '../../services/solicitacoesService';
import { agruparDocumentos, normalizarDocumentos } from '../../utils/documentos';
import { nomePorEmail, normalizarChave } from '../../utils/texto';
import './Home.css';

const classeTipo = (valor) => `tipo--${String(valor).toLowerCase().split(' ')[0]}`;

function primeiroNome(nome = '') {
  const primeiro = nome.trim().split(/\s+/)[0] || '';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarData(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(data).replace('.', '');
}

/* Pendências do administrador: pedidos, convites e contas liberadas. */
function PainelAdmin() {
  const { pendentes } = useLayout();
  const [dados, setDados] = useState({ liberados: null, convites: null });

  useEffect(() => {
    let ativo = true;

    Promise.all([listarUsuarios(), listarConvites()])
      .then(([usuarios, convites]) => {
        if (!ativo) return;
        setDados({
          liberados: usuarios.filter((u) => u.regra !== 'admin' && u.acesso_ativo).length,
          convites: convites.filter((c) => c.situacao === 'ABERTO').length,
        });
      })
      .catch((error) => console.error(error));

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <section className="painel inicio-admin" aria-labelledby="inicio-admin-titulo">
      <div className="painel__cabecalho">
        <h2 id="inicio-admin-titulo">Administração</h2>
      </div>

      <ul className="inicio-admin__lista">
        <li className={pendentes > 0 ? 'destaque' : undefined}>
          <FiClock aria-hidden="true" />
          <span>
            <strong className="numero">{pendentes}</strong>{' '}
            {pendentes === 1 ? 'pedido aguardando aprovação' : 'pedidos aguardando aprovação'}
          </span>
        </li>
        <li>
          <FiUsers aria-hidden="true" />
          <span>
            <strong className="numero">{dados.liberados ?? '–'}</strong>{' '}
            {dados.liberados === 1 ? 'usuário com acesso liberado' : 'usuários com acesso liberado'}
          </span>
        </li>
        <li>
          <FiLink aria-hidden="true" />
          <span>
            <strong className="numero">{dados.convites ?? '–'}</strong>{' '}
            {dados.convites === 1 ? 'convite em aberto' : 'convites em aberto'}
          </span>
        </li>
      </ul>

      <div className="inicio-admin__acoes">
        <Link className="btn btn-secondary btn-sm" to="/admin/usuarios">Gerenciar usuários</Link>
        <Link className="btn btn-secondary btn-sm" to="/admin/documentos">Gerenciar documentos</Link>
      </div>
    </section>
  );
}

function Inicio() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const { documentos, loading, erro, recarregar } = useDocumentos();

  const grupos = useMemo(() => agruparDocumentos(documentos), [documentos]);

  /* Setores do cadastro + qualquer setor antigo que ainda tenha documentos. */
  const setores = useMemo(() => {
    const porSetor = new Map();
    SETORES.forEach((setor) => porSetor.set(normalizarChave(setor), { nome: setor, processos: [] }));

    grupos.forEach((grupo) => {
      const chave = normalizarChave(grupo.setor);
      if (!porSetor.has(chave)) porSetor.set(chave, { nome: grupo.setor, processos: [] });
      porSetor.get(chave).processos.push(grupo);
    });

    return Array.from(porSetor.values()).sort((a, b) => {
      if ((a.processos.length > 0) !== (b.processos.length > 0)) return a.processos.length > 0 ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [grupos]);

  const resumo = useMemo(() => {
    const porTipo = Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t.valor, 0]));
    grupos.forEach((g) => Object.keys(g.arquivos).forEach((tipo) => { porTipo[tipo] = (porTipo[tipo] || 0) + 1; }));

    return {
      processos: grupos.length,
      arquivos: Object.values(porTipo).reduce((soma, n) => soma + n, 0),
      porTipo,
      completos: grupos.filter((g) => Object.keys(g.arquivos).length === TIPOS_DOCUMENTO.length).length,
      setoresComDocs: setores.filter((s) => s.processos.length > 0).length,
      setoresTotal: setores.length,
    };
  }, [grupos, setores]);

  const recentes = useMemo(
    () =>
      normalizarDocumentos(documentos)
        .filter((d) => d.criado_em)
        .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
        .slice(0, 6),
    [documentos],
  );

  const nome = primeiroNome(profile?.nome || nomePorEmail(user?.email || ''));
  const percentualCompletos = resumo.processos ? Math.round((resumo.completos / resumo.processos) * 100) : 0;

  return (
    <>
      <header className="page-header inicio-cabecalho">
        <div>
          <h1>{saudacao()}{nome ? `, ${nome}` : ''}</h1>
          <p>Este é o retrato da documentação de processos da Pedrasplast hoje.</p>
        </div>
        <Link className="btn btn-primary" to="/pops">
          <FiFolder /> Abrir repositório
        </Link>
      </header>

      {erro && (
        <div className="estado-erro" role="alert">
          <span>{erro}</span>
          <button type="button" className="btn btn-secondary" onClick={recarregar}>Tentar novamente</button>
        </div>
      )}

      <section className="painel inicio-numeros" aria-label="Resumo">
        <div className="inicio-numero">
          <strong className="numero">{loading ? '–' : resumo.processos}</strong>
          <span>processos documentados</span>
        </div>

        <div className="inicio-numero">
          <strong className="numero">{loading ? '–' : resumo.arquivos}</strong>
          <span>arquivos publicados</span>
          <div className="inicio-tipos">
            {TIPOS_DOCUMENTO.map((tipo) => (
              <span key={tipo.valor} className={`tipo-tag ${classeTipo(tipo.valor)}`}>
                {tipo.nome} <b className="numero">{loading ? '–' : resumo.porTipo[tipo.valor] || 0}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="inicio-numero">
          <strong className="numero">
            {loading ? '–' : resumo.setoresComDocs}
            <small> de {resumo.setoresTotal}</small>
          </strong>
          <span>setores com documentos</span>
        </div>

        <div className="inicio-numero">
          <strong className="numero">{loading ? '–' : `${percentualCompletos}%`}</strong>
          <span>
            dos processos com POP, Fluxograma e Manual
            {!loading && resumo.processos > 0 && ` (${resumo.completos} de ${resumo.processos})`}
          </span>
        </div>
      </section>

      <div className="inicio-grade">
        <section className="painel mapa" aria-labelledby="mapa-titulo">
          <div className="painel__cabecalho">
            <div>
              <h2 id="mapa-titulo">Mapa de documentação</h2>
              <p>Cada bloco é um processo; as faixas mostram quais documentos ele já tem.</p>
            </div>
            <div className="mapa__legenda" aria-hidden="true">
              {TIPOS_DOCUMENTO.map((tipo) => (
                <span key={tipo.valor} className={`tipo-tag ${classeTipo(tipo.valor)}`}>{tipo.nome}</span>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="mapa__vazio">Carregando documentos...</p>
          ) : (
            <ul className="mapa__setores">
              {setores.filter((setor) => setor.processos.length > 0).map((setor) => (
                <li key={setor.nome} className={`mapa__setor${setor.processos.length === 0 ? ' vazio' : ''}`}>
                  <button
                    type="button"
                    className="mapa__nome"
                    onClick={() => navigate(`/pops?setor=${encodeURIComponent(setor.nome)}`)}
                    disabled={setor.processos.length === 0}
                  >
                    <strong>{setor.nome}</strong>
                    <small className="numero">
                      {setor.processos.length === 0
                        ? 'Sem documentos'
                        : `${setor.processos.length} ${setor.processos.length === 1 ? 'processo' : 'processos'}`}
                    </small>
                  </button>

                  <div className="mapa__processos">
                    {setor.processos.map((processo) => {
                      const tipos = TIPOS_DOCUMENTO.filter((t) => processo.arquivos[t.valor]).map((t) => t.nome);
                      return (
                        <Link
                          key={processo.id}
                          className="mapa__processo"
                          to={`/pops?setor=${encodeURIComponent(setor.nome)}`}
                          title={`${processo.titulo}\n${tipos.length ? tipos.join(', ') : 'Sem arquivos'}`}
                        >
                          <span className="numero">{processo.codigo}</span>
                          <span className="cobertura" aria-label={`${processo.titulo}: ${tipos.join(', ')}`}>
                            {TIPOS_DOCUMENTO.map((tipo) => (
                              <span
                                key={tipo.valor}
                                className={`cobertura__parte ${classeTipo(tipo.valor)}${processo.arquivos[tipo.valor] ? ' cheia' : ''}`}
                              />
                            ))}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}

              {setores.some((setor) => setor.processos.length === 0) && (
                <li className="mapa__sem-docs">
                  <span>Setores ainda sem documentos</span>
                  <div>
                    {setores
                      .filter((setor) => setor.processos.length === 0)
                      .map((setor) => (
                        <span key={setor.nome} className="mapa__setor-vazio">{setor.nome}</span>
                      ))}
                  </div>
                </li>
              )}
            </ul>
          )}
        </section>

        <div className="inicio-lateral">
          {isAdmin && <PainelAdmin />}

          <section className="painel recentes" aria-labelledby="recentes-titulo">
            <div className="painel__cabecalho">
              <h2 id="recentes-titulo">Publicados recentemente</h2>
            </div>

            {loading ? (
              <p className="recentes__vazio">Carregando...</p>
            ) : recentes.length === 0 ? (
              <p className="recentes__vazio">Nenhum documento publicado ainda.</p>
            ) : (
              <ul className="recentes__lista">
                {recentes.map((doc) => (
                  <li key={doc.id}>
                    <Link to={`/pops?setor=${encodeURIComponent(doc.setor)}`}>
                      <span className={`tipo-tag ${classeTipo(doc.tipo)}`}>
                        {TIPOS_DOCUMENTO.find((t) => t.valor === doc.tipo)?.nome || doc.tipo}
                      </span>
                      <strong>{doc.codigo} - {doc.descricao}</strong>
                      <small>
                        {doc.setor}, {formatarData(doc.criado_em)}
                      </small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Home() {
  return (
    <AppLayout titulo="Início">
      <Inicio />
    </AppLayout>
  );
}

export default Home;
