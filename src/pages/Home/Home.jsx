import { useMemo, useState } from 'react';
import { FiDownload, FiEye, FiSearch } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';

import AppLayout, { useLayout } from '../../components/layout/AppLayout';
import { TIPOS_DOCUMENTO } from '../../config/documentos';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentos } from '../../hooks/useDocumentos';
import { useFeedback } from '../../hooks/useFeedback';
import { useSetores } from '../../hooks/useSetores';
import { baixarDocumento, visualizarDocumento } from '../../utils/arquivos';
import { agruparDocumentos } from '../../utils/documentos';
import { nomeExibicao, nomePorEmail } from '../../utils/texto';
import './Home.css';

const POR_COLUNA = 5;

const COR_TIPO = {
  POP: 'var(--tipo-pop)',
  FLUXOGRAMA: 'var(--tipo-fluxograma)',
  MANUAL: 'var(--tipo-manual)',
};

const PLURAL_TIPO = {
  POP: 'POPs',
  FLUXOGRAMA: 'Fluxogramas',
  MANUAL: 'Manuais',
};

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/* "hoje", "ontem", "há 3 dias" ou a data. */
function quando(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';

  const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicioDoDia(new Date()) - inicioDoDia(data)) / 86400000);

  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(data).replace('.', '');
}

function Inicio() {
  const navigate = useNavigate();
  const { notificar } = useFeedback();
  const { user, profile, isAdmin } = useAuth();
  const { pendentes } = useLayout();
  const { documentos, loading, erro, recarregar } = useDocumentos();
  const { ativos: setoresAtivos } = useSetores();
  const [termo, setTermo] = useState('');

  const grupos = useMemo(() => agruparDocumentos(documentos), [documentos]);

  const setoresComDocs = useMemo(
    () => [...new Set(grupos.map((g) => g.setor))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [grupos],
  );

  /* Mais recentes de cada tipo. Os arquivos agrupados já trazem a
     descrição única do processo e o código. */
  const colunas = useMemo(() => {
    const arquivos = grupos.flatMap((grupo) => Object.values(grupo.arquivos));

    return TIPOS_DOCUMENTO.map((tipo) => {
      const doTipo = arquivos.filter((arquivo) => arquivo.tipo === tipo.valor);
      return {
        ...tipo,
        total: doTipo.length,
        itens: [...doTipo]
          .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
          .slice(0, POR_COLUNA),
      };
    });
  }, [grupos]);

  const completos = grupos.filter((g) => Object.keys(g.arquivos).length === TIPOS_DOCUMENTO.length).length;
  const percentualCompletos = grupos.length ? Math.round((completos / grupos.length) * 100) : 0;
  const nome = (profile?.nome ? nomeExibicao(profile.nome) : nomePorEmail(user?.email || '')).split(' ')[0];

  function buscar(event) {
    event.preventDefault();
    const busca = termo.trim();
    navigate(busca ? `/pops?busca=${encodeURIComponent(busca)}` : '/pops');
  }

  async function ver(documento) {
    try {
      await visualizarDocumento(documento);
    } catch (error) {
      notificar('erro', error.message);
    }
  }

  async function baixar(documento) {
    try {
      await baixarDocumento(documento);
    } catch (error) {
      notificar('erro', error.message);
    }
  }

  return (
    <>
      <section className="inicio-hero">
        <h1>{saudacao()}{nome ? `, ${nome}` : ''}</h1>
        <p>Qual procedimento você precisa consultar?</p>

        <form className="inicio-busca" onSubmit={buscar} role="search">
          <FiSearch aria-hidden="true" />
          <label htmlFor="inicio-busca" className="sr-only">Buscar processo</label>
          <input
            id="inicio-busca"
            type="search"
            value={termo}
            onChange={(event) => setTermo(event.target.value)}
            placeholder="Digite o nome do processo, o setor ou o número"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-success">Buscar</button>
        </form>

        {setoresComDocs.length > 0 && (
          <nav className="inicio-setores" aria-label="Abrir setor no repositório">
            <span>Setores:</span>
            {setoresComDocs.map((setor) => (
              <Link key={setor} to={`/pops?setor=${encodeURIComponent(setor)}`}>{setor}</Link>
            ))}
          </nav>
        )}
      </section>

      {erro && (
        <div className="estado-erro" role="alert">
          <span>{erro}</span>
          <button type="button" className="btn btn-secondary" onClick={recarregar}>Tentar novamente</button>
        </div>
      )}

      <div className="inicio-secao">
        <h2>Publicados recentemente</h2>
        <span>Os documentos mais novos de cada tipo</span>
      </div>

      <div className="inicio-colunas">
        {colunas.map((coluna) => (
          <section
            key={coluna.valor}
            className="painel inicio-coluna"
            style={{ '--cor-coluna': COR_TIPO[coluna.valor] }}
            aria-labelledby={`coluna-${coluna.valor}`}
          >
            <div className="inicio-coluna__cab">
              <h3 id={`coluna-${coluna.valor}`}>{coluna.nome}</h3>
              <span>
                <b className="numero">{loading ? '–' : coluna.total}</b> {coluna.total === 1 ? 'publicado' : 'publicados'}
              </span>
            </div>

            {loading ? (
              <p className="inicio-coluna__vazio">Carregando...</p>
            ) : coluna.itens.length === 0 ? (
              <p className="inicio-coluna__vazio">Nenhum {coluna.nome} publicado ainda.</p>
            ) : (
              <ul>
                {coluna.itens.map((doc) => (
                  <li key={doc.id}>
                    <span className="inicio-coluna__cod numero">{doc.codigo}</span>
                    <span className="inicio-coluna__texto">
                      <strong title={doc.descricao}>{doc.descricao}</strong>
                      <small>{doc.setor}, {quando(doc.criado_em)}</small>
                    </span>
                    <span className="inicio-coluna__acoes">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => ver(doc)}
                        aria-label={`Visualizar ${coluna.nome} ${doc.codigo} - ${doc.descricao}`}
                        title="Visualizar"
                      >
                        <FiEye />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => baixar(doc)}
                        aria-label={`Baixar ${coluna.nome} ${doc.codigo} - ${doc.descricao}`}
                        title="Baixar PDF"
                      >
                        <FiDownload />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link className="inicio-coluna__rodape" to={`/pops?tipo=${encodeURIComponent(coluna.valor)}`}>
              Ver todos os {PLURAL_TIPO[coluna.valor]}
            </Link>
          </section>
        ))}
      </div>

      <section className="painel inicio-resumo" aria-label="Resumo do repositório">
        <span>
          <b className="numero">{loading ? '–' : `${completos} de ${grupos.length}`}</b> processos com POP, Fluxograma e Manual
        </span>
        <span className="inicio-resumo__barra" aria-hidden="true">
          <span style={{ width: `${percentualCompletos}%` }} />
        </span>
        <span className="inicio-resumo__sep" aria-hidden="true" />
        <span>
          <b className="numero">{loading ? '–' : `${setoresComDocs.length} de ${setoresAtivos.length || '–'}`}</b> setores com documentos
        </span>
        {isAdmin && pendentes > 0 && (
          <>
            <span className="inicio-resumo__sep" aria-hidden="true" />
            <Link className="inicio-resumo__alerta" to="/admin/usuarios">
              <b className="numero">{pendentes}</b> {pendentes === 1 ? 'pedido de acesso aguardando' : 'pedidos de acesso aguardando'}
            </Link>
          </>
        )}
      </section>
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
