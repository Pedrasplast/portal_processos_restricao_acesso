import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import AppLayout, { useLayout } from '../../components/layout/AppLayout';
import { TIPOS_DOCUMENTO } from '../../config/documentos';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentosPublicos } from '../../hooks/useDocumentosPublicos';
import { agruparDocumentos } from '../../utils/documentos';
import { nomeExibicao, nomePorEmail } from '../../utils/texto';
import './Home.css';

const POR_COLUNA = 5;

const COR_TIPO = {
  POP: 'var(--tipo-pop)',
  FLUXOGRAMA: 'var(--tipo-fluxograma)',
  MANUAL: 'var(--tipo-manual)',
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

/*
 * Início só visual: resumo do repositório e o que foi publicado por
 * último. Para abrir ou baixar documentos, o caminho é o Repositório.
 */
function Inicio() {
  const { user, profile, isAdmin } = useAuth();
  const { pendentes } = useLayout();
  const { documentos, setoresAtivos, loading, erro, recarregar } = useDocumentosPublicos();

  const grupos = useMemo(() => agruparDocumentos(documentos), [documentos]);

  const setoresComDocs = useMemo(() => new Set(grupos.map((g) => g.setor)).size, [grupos]);

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

  const totalArquivos = colunas.reduce((soma, c) => soma + c.total, 0);
  const completos = grupos.filter((g) => Object.keys(g.arquivos).length === TIPOS_DOCUMENTO.length).length;
  const percentualCompletos = grupos.length ? Math.round((completos / grupos.length) * 100) : 0;
  const nome = (profile?.nome ? nomeExibicao(profile.nome) : nomePorEmail(user?.email || '')).split(' ')[0];
  const valor = (n) => (loading ? '–' : n);

  return (
    <>
      <section className="inicio-hero">
        <div className="inicio-hero__texto">
          <h1>{saudacao()}{nome ? `, ${nome}` : ''}</h1>
          <p>Este é o panorama da documentação de processos da Pedrasplast.</p>
          {isAdmin && pendentes > 0 && (
            <Link className="inicio-hero__aviso" to="/admin/usuarios">
              {pendentes === 1 ? '1 pedido de acesso aguardando aprovação' : `${pendentes} pedidos de acesso aguardando aprovação`}
            </Link>
          )}
        </div>

        <dl className="inicio-numeros">
          <div>
            <dt>Processos</dt>
            <dd className="numero">{valor(grupos.length)}</dd>
          </div>
          <div>
            <dt>Documentos</dt>
            <dd className="numero">{valor(totalArquivos)}</dd>
          </div>
          <div>
            <dt>Setores com documentos</dt>
            <dd className="numero">
              {valor(setoresComDocs)}
              <small> de {setoresAtivos.length || '–'}</small>
            </dd>
          </div>
          <div>
            <dt>Processos completos</dt>
            <dd className="numero">{valor(`${percentualCompletos}%`)}</dd>
            <span className="inicio-numeros__barra" aria-hidden="true">
              <span style={{ width: `${percentualCompletos}%` }} />
            </span>
          </div>
        </dl>
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
                <b className="numero">{valor(coluna.total)}</b> {coluna.total === 1 ? 'publicado' : 'publicados'}
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
                      <small>{doc.setor}</small>
                    </span>
                    <span className="inicio-coluna__data">{quando(doc.criado_em)}</span>
                  </li>
                ))}
              </ul>
            )}

          </section>
        ))}
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
