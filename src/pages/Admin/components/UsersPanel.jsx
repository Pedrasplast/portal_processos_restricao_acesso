import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiCopy, FiLink, FiTrash2, FiUnlock, FiX } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import { useLayout } from '../../../components/layout/AppLayout';
import { useFeedback } from '../../../hooks/useFeedback';
import {
  cancelarConvite,
  criarConvite,
  listarConvites,
  montarLinkConvite,
} from '../../../services/convitesService';
import {
  ACOES_ACESSO,
  definirAcessoUsuario,
  excluirUsuario,
  listarUsuarios,
} from '../../../services/solicitacoesService';
import { nomeExibicao } from '../../../utils/texto';

/* ---------------------------------------------------------------
   Apoio
---------------------------------------------------------------- */

const ABAS = [
  { id: 'todos', nome: 'Todos' },
  { id: 'admin', nome: 'Administradores' },
  { id: 'aguardando', nome: 'Aguardando' },
  { id: 'com-acesso', nome: 'Com acesso' },
  { id: 'sem-acesso', nome: 'Sem acesso' },
  { id: 'convites', nome: 'Convites' },
];

const OPCOES_VALIDADE = [
  { dias: 1, nome: '1 dia' },
  { dias: 7, nome: '7 dias' },
  { dias: 30, nome: '30 dias' },
];

const SITUACAO_CONVITE = {
  ABERTO: { nome: 'Aberto', classe: 'pendente' },
  USADO: { nome: 'Usado', classe: 'aprovado' },
  CANCELADO: { nome: 'Cancelado', classe: 'cancelado' },
  EXPIRADO: { nome: 'Expirado', classe: 'negado' },
};

/* Grupo do usuário: decide a aba e o selo. */
function grupo(usuario) {
  if (usuario.regra === 'admin') return 'admin';
  if (usuario.bloqueado) return 'bloqueado';
  if (usuario.acesso_ativo) return 'com-acesso';
  if (usuario.pedido_pendente) return 'aguardando';
  return 'sem-acesso';
}

const SELO = {
  admin: { nome: 'Administrador', classe: 'admin' },
  bloqueado: { nome: 'Bloqueado', classe: 'negado' },
  'com-acesso': { nome: 'Com acesso', classe: 'aprovado' },
  aguardando: { nome: 'Aguardando aprovação', classe: 'pendente' },
  'sem-acesso': { nome: 'Sem acesso', classe: 'cancelado' },
};

const ORDEM = { aguardando: 0, 'com-acesso': 1, 'sem-acesso': 2, bloqueado: 3, admin: 4 };

const nomeDe = (u) => (u.nome ? nomeExibicao(u.nome) : u.email);

function iniciais(usuario) {
  const base = usuario.nome ? nomeExibicao(usuario.nome) : usuario.email.split('@')[0].replace(/[._-]+/g, ' ');
  const partes = base.split(/\s+/).filter((p) => p.length > 2);
  const letras = (partes.length ? partes : base.split(/\s+/)).slice(0, 2).map((p) => p[0]);
  return letras.join('').toLocaleUpperCase('pt-BR') || '?';
}

/* "hoje, 08:12", "ontem, 16:33" ou "19/10/26, 10:05". */
function quando(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;

  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data);
  const inicio = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(new Date()) - inicio(data)) / 86400000);

  if (dias === 0) return `hoje, ${hora}`;
  if (dias === 1) return `ontem, ${hora}`;
  const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(data);
  return `${dia}, ${hora}`;
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand('copy');
    campo.remove();
    return ok;
  }
}

/* Textos das confirmações de cada ação. */
const ACOES = {
  [ACOES_ACESSO.LIBERAR]: {
    titulo: (u) => (u.pedido_pendente ? 'Aprovar acesso' : 'Liberar acesso'),
    mensagem: (nome) => `${nome} passará a acessar o portal sem precisar de nova aprovação.`,
    detalhe: 'Você pode revogar o acesso a qualquer momento.',
    textoConfirmar: (u) => (u.pedido_pendente ? 'Aprovar' : 'Liberar'),
    sucesso: (nome) => `Acesso de ${nome} liberado.`,
  },
  [ACOES_ACESSO.NEGAR]: {
    titulo: () => 'Negar pedido de acesso',
    mensagem: (nome) => `O pedido de ${nome} será recusado.`,
    detalhe: 'A pessoa poderá pedir acesso novamente no próximo login. Para impedir de vez, exclua o usuário.',
    textoConfirmar: () => 'Negar pedido',
    perigo: true,
    sucesso: (nome) => `Pedido de ${nome} negado.`,
  },
  [ACOES_ACESSO.REVOGAR]: {
    titulo: () => 'Revogar acesso',
    mensagem: (nome) => `${nome} perde o acesso aos documentos imediatamente.`,
    detalhe: 'Para voltar a acessar, a pessoa precisará de nova aprovação.',
    textoConfirmar: () => 'Revogar acesso',
    perigo: true,
    sucesso: (nome) => `Acesso de ${nome} revogado.`,
  },
  [ACOES_ACESSO.DESBLOQUEAR]: {
    titulo: () => 'Desbloquear usuário',
    mensagem: (nome) => `${nome} poderá voltar a pedir acesso ao portal.`,
    detalhe: 'O desbloqueio não libera o acesso automaticamente.',
    textoConfirmar: () => 'Desbloquear',
    sucesso: (nome) => `${nome} desbloqueado.`,
  },
};

/* ---------------------------------------------------------------
   Janela "Gerar link de convite"
---------------------------------------------------------------- */

function NovoConvite({ onFechar, onGerado, copiar }) {
  const { notificar } = useFeedback();
  const [email, setEmail] = useState('');
  const [dias, setDias] = useState(7);
  const [gerando, setGerando] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && !gerando && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, gerando]);

  async function gerar(event) {
    event.preventDefault();
    setGerando(true);
    try {
      const convite = await criarConvite({ email, dias });
      const novo = montarLinkConvite(convite.token);
      setLink(novo);
      await copiar(novo);
      await onGerado();
    } catch (error) {
      notificar('erro', `Não foi possível gerar o convite. ${error.message || ''}`.trim());
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="dialogo-fundo" onMouseDown={(e) => e.target === e.currentTarget && !gerando && onFechar()}>
      <form className="dialogo us-convite" role="dialog" aria-modal="true" aria-labelledby="us-convite-titulo" onSubmit={gerar}>
        <div className="us-convite__cab">
          <h2 id="us-convite-titulo">Gerar link de convite</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icone" onClick={onFechar} aria-label="Fechar" disabled={gerando}>
            <FiX />
          </button>
        </div>

        <div className="us-convite__corpo">
          {link ? (
            <>
              <div className="us-convite__pronto">Link gerado e copiado. Agora é só enviar para a pessoa.</div>
              <div className="us-convite__link">
                <input
                  className="form-control"
                  value={link}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  aria-label="Link de convite"
                />
                <button type="button" className="btn btn-secondary" onClick={() => copiar(link)} aria-label="Copiar link">
                  <FiCopy />
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Quem se cadastra pelo link já entra com acesso. Cada link vale para um cadastro.</p>
              <div className="form-group">
                <label htmlFor="us-convite-email">E-mail da pessoa (opcional)</label>
                <input
                  id="us-convite-email"
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com.br"
                  disabled={gerando}
                  autoFocus
                />
                <p className="form-ajuda">Com e-mail, só essa pessoa consegue usar o link.</p>
              </div>
              <div className="form-group">
                <label htmlFor="us-convite-dias">Validade</label>
                <select
                  id="us-convite-dias"
                  className="form-control"
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                  disabled={gerando}
                >
                  {OPCOES_VALIDADE.map((o) => <option key={o.dias} value={o.dias}>{o.nome}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="dialogo__acoes us-convite__rodape">
          {link ? (
            <button type="button" className="btn btn-primary" onClick={onFechar}>Concluir</button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={onFechar} disabled={gerando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={gerando}>
                <FiLink /> {gerando ? 'Gerando...' : 'Gerar link'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------
   Tela
---------------------------------------------------------------- */

function UsersPanel() {
  const { notificar, confirmar } = useFeedback();
  const { pendentes: contagemPendentes, atualizarPendentes } = useLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [usuarios, setUsuarios] = useState([]);
  const [convites, setConvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carregandoConvites, setCarregandoConvites] = useState(true);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);
  const [gerandoConvite, setGerandoConvite] = useState(false);

  const aba = ABAS.some((a) => a.id === searchParams.get('aba')) ? searchParams.get('aba') : 'todos';

  function irPara(id) {
    const params = new URLSearchParams(searchParams);
    if (id === 'todos') params.delete('aba');
    else params.set('aba', id);
    setSearchParams(params, { replace: true });
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      setUsuarios(await listarUsuarios());
    } catch (error) {
      setErro(`Não foi possível carregar os usuários. ${error.message || ''}`.trim());
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarConvites = useCallback(async () => {
    setCarregandoConvites(true);
    try {
      setConvites(await listarConvites());
    } catch (error) {
      notificar('erro', `Não foi possível carregar os convites. ${error.message || ''}`.trim());
    } finally {
      setCarregandoConvites(false);
    }
  }, [notificar]);

  /* Recarrega quando chega um pedido novo (contagem da barra lateral). */
  useEffect(() => {
    void carregar();
  }, [carregar, contagemPendentes]);

  useEffect(() => {
    void carregarConvites();
  }, [carregarConvites]);

  const ordenados = useMemo(
    () => [...usuarios].sort((a, b) => ORDEM[grupo(a)] - ORDEM[grupo(b)] || nomeDe(a).localeCompare(nomeDe(b), 'pt-BR')),
    [usuarios],
  );

  const contagem = useMemo(() => {
    const c = { todos: 0, admin: 0, aguardando: 0, 'com-acesso': 0, 'sem-acesso': 0 };
    usuarios.forEach((u) => {
      const g = grupo(u);
      if (g === 'admin') c.admin += 1;
      else {
        c.todos += 1;
        c[g === 'bloqueado' ? 'sem-acesso' : g] += 1;
      }
    });
    c.convites = convites.filter((cv) => cv.situacao === 'ABERTO').length;
    return c;
  }, [usuarios, convites]);

  const lista = useMemo(() => {
    if (aba === 'todos') return ordenados.filter((u) => grupo(u) !== 'admin');
    if (aba === 'sem-acesso') return ordenados.filter((u) => ['sem-acesso', 'bloqueado'].includes(grupo(u)));
    return ordenados.filter((u) => grupo(u) === aba);
  }, [ordenados, aba]);

  const copiar = useCallback(
    async (link) => {
      const ok = await copiarTexto(link);
      notificar(
        ok ? 'sucesso' : 'aviso',
        ok
          ? 'Link copiado para a área de transferência. Agora é só enviar ao usuário.'
          : 'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.',
        { titulo: ok ? 'Link copiado' : 'Copie manualmente' },
      );
    },
    [notificar],
  );

  async function executar(usuario, acao) {
    const nome = nomeDe(usuario);
    const textos = ACOES[acao];

    const ok = await confirmar({
      titulo: textos.titulo(usuario),
      mensagem: textos.mensagem(nome),
      detalhe: textos.detalhe,
      textoConfirmar: textos.textoConfirmar(usuario),
      perigo: Boolean(textos.perigo),
    });
    if (!ok) return;

    setProcessandoId(usuario.id);
    try {
      await definirAcessoUsuario(usuario.id, acao);
      notificar('sucesso', textos.sucesso(nome));
      await Promise.all([carregar(), atualizarPendentes?.()]);
    } catch (error) {
      notificar('erro', `Não foi possível concluir a ação. ${error.message || ''}`.trim());
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluir(usuario) {
    const nome = nomeDe(usuario);
    const ok = await confirmar({
      titulo: 'Excluir usuário',
      mensagem: `A conta de ${nome} (${usuario.email}) será excluída permanentemente.`,
      detalhe: 'Se a pessoa se cadastrar de novo, precisará de nova aprovação. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir usuário',
      perigo: true,
    });
    if (!ok) return;

    setProcessandoId(usuario.id);
    try {
      await excluirUsuario(usuario.id);
      notificar('sucesso', `Conta de ${nome} excluída.`);
      await Promise.all([carregar(), atualizarPendentes?.()]);
    } catch (error) {
      notificar('erro', `Não foi possível excluir o usuário. ${error.message || ''}`.trim());
    } finally {
      setProcessandoId(null);
    }
  }

  async function cancelar(convite) {
    const ok = await confirmar({
      titulo: 'Cancelar convite',
      mensagem: convite.email
        ? `O convite para ${convite.email} deixará de funcionar.`
        : 'Este link de convite deixará de funcionar.',
      detalhe: 'Se precisar, você pode gerar um novo link depois.',
      textoConfirmar: 'Cancelar convite',
      textoCancelar: 'Voltar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await cancelarConvite(convite.id);
      notificar('sucesso', 'Convite cancelado.');
      await carregarConvites();
    } catch (error) {
      notificar('erro', `Não foi possível cancelar o convite. ${error.message || ''}`.trim());
    }
  }

  function acoes(usuario) {
    const g = grupo(usuario);
    if (g === 'admin') return <span className="us-acoes__info">Acesso total</span>;

    const processando = processandoId === usuario.id;
    const botao = (acao, rotulo, Icone, classe) => (
      <button type="button" className={`btn btn-sm ${classe}`} disabled={processando} onClick={() => executar(usuario, acao)}>
        {Icone && <Icone />} {rotulo}
      </button>
    );
    const lixeira = (
      <button
        type="button"
        className="btn btn-sm btn-danger btn-icone"
        disabled={processando}
        onClick={() => excluir(usuario)}
        aria-label={`Excluir ${nomeDe(usuario)}`}
        title="Excluir usuário"
      >
        <FiTrash2 />
      </button>
    );

    if (g === 'aguardando') {
      return (
        <div>
          {botao(ACOES_ACESSO.LIBERAR, 'Aprovar', FiCheck, 'btn-success')}
          {botao(ACOES_ACESSO.NEGAR, 'Negar', FiX, 'btn-secondary')}
          {lixeira}
        </div>
      );
    }
    if (g === 'com-acesso') return <div>{botao(ACOES_ACESSO.REVOGAR, 'Revogar acesso', null, 'btn-secondary')}{lixeira}</div>;
    if (g === 'bloqueado') return <div>{botao(ACOES_ACESSO.DESBLOQUEAR, 'Desbloquear', FiUnlock, 'btn-secondary')}{lixeira}</div>;
    return <div>{botao(ACOES_ACESSO.LIBERAR, 'Liberar', FiCheck, 'btn-success')}{lixeira}</div>;
  }

  const vazioPorAba = {
    todos: 'Nenhum usuário cadastrado ainda. Gere um link de convite para o primeiro acesso.',
    admin: 'Nenhum administrador encontrado.',
    aguardando: 'Nenhum pedido de acesso aguardando.',
    'com-acesso': 'Ninguém com acesso no momento.',
    'sem-acesso': 'Nenhum usuário sem acesso.',
  };

  const abertosPrimeiro = useMemo(
    () => [...convites].sort((a, b) => (a.situacao === 'ABERTO' ? 0 : 1) - (b.situacao === 'ABERTO' ? 0 : 1)),
    [convites],
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Gerenciar usuários</h1>
          <p>Aprove pedidos, convide pessoas e controle quem acessa o portal.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setGerandoConvite(true)}>
          <FiLink /> Gerar link de convite
        </button>
      </header>

      <div className="us-abas" role="tablist" aria-label="Filtrar usuários">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            className="us-aba"
            aria-selected={aba === a.id}
            onClick={() => irPara(a.id)}
          >
            {a.nome}
            <b className={`numero${a.id === 'aguardando' && contagem.aguardando > 0 ? ' alerta' : ''}`}>{contagem[a.id]}</b>
          </button>
        ))}
      </div>

      <section className="painel" role="tabpanel" aria-label={ABAS.find((a) => a.id === aba).nome}>
        {erro && (
          <div className="estado-erro us-erro" role="alert">
            <span>{erro}</span>
            <button type="button" className="btn btn-secondary" onClick={carregar}>Tentar novamente</button>
          </div>
        )}

        <div className="table-wrapper">
          {aba === 'convites' ? (
            <table className="us-tabela">
              <thead>
                <tr>
                  <th>Convite</th>
                  <th>Situação</th>
                  <th>Validade</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {carregandoConvites && convites.length === 0 ? (
                  <tr><td colSpan="4" className="us-vazio">Carregando convites...</td></tr>
                ) : convites.length === 0 ? (
                  <tr><td colSpan="4" className="us-vazio">Nenhum convite nos últimos 30 dias.</td></tr>
                ) : (
                  abertosPrimeiro.map((c) => {
                    const sit = SITUACAO_CONVITE[c.situacao] || SITUACAO_CONVITE.CANCELADO;
                    const aberto = c.situacao === 'ABERTO';
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="us-pessoa">
                            <span className="us-avatar" aria-hidden="true"><FiLink /></span>
                            <span>
                              <strong>{c.usado_email || c.email || 'Qualquer e-mail'}</strong>
                              <small>Criado {quando(c.criado_em) || '—'}</small>
                            </span>
                          </div>
                        </td>
                        <td className="us-situacao"><span className={`status-badge status-badge--${sit.classe}`}>{sit.nome}</span></td>
                        <td className="us-data">
                          {c.situacao === 'USADO'
                            ? `Usado ${quando(c.usado_em)}`
                            : c.situacao === 'CANCELADO'
                              ? '—'
                              : `${aberto ? 'Vence' : 'Venceu'} ${quando(c.expira_em)}`}
                        </td>
                        <td className="us-acoes">
                          {aberto ? (
                            <div>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(montarLinkConvite(c.token))}>
                                <FiCopy /> Copiar link
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm btn-icone"
                                onClick={() => cancelar(c)}
                                aria-label={`Cancelar convite ${c.email || ''}`}
                                title="Cancelar convite"
                              >
                                <FiX />
                              </button>
                            </div>
                          ) : (
                            <span className="us-acoes__info">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="us-tabela">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Situação</th>
                  <th>Último acesso</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {loading && usuarios.length === 0 ? (
                  <tr><td colSpan="4" className="us-vazio">Carregando usuários...</td></tr>
                ) : lista.length === 0 ? (
                  <tr><td colSpan="4" className="us-vazio">{vazioPorAba[aba]}</td></tr>
                ) : (
                  lista.map((u) => {
                    const g = grupo(u);
                    const selo = SELO[g];
                    return (
                      <tr key={u.id} className={g === 'aguardando' ? 'pendente' : undefined}>
                        <td>
                          <div className="us-pessoa">
                            <span className={`us-avatar ${g === 'admin' ? 'admin' : g === 'aguardando' ? 'pendente' : ''}`} aria-hidden="true">
                              {iniciais(u)}
                            </span>
                            <span>
                              <strong>{nomeDe(u)}</strong>
                              <small>{u.nome ? u.email : 'Nome não informado'}</small>
                            </span>
                          </div>
                        </td>
                        <td className="us-situacao"><span className={`status-badge status-badge--${selo.classe}`}>{selo.nome}</span></td>
                        <td className="us-data numero">{quando(u.ultimo_login) || 'Ainda não entrou'}</td>
                        <td className="us-acoes">{acoes(u)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {aba === 'admin' && (
        <p className="us-nota">Administradores são definidos no banco e não podem ser revogados ou excluídos por aqui.</p>
      )}
      {aba === 'convites' && (
        <p className="us-nota">Quem se cadastra por um link já entra com acesso. Cada link vale para um cadastro.</p>
      )}

      {gerandoConvite && (
        <NovoConvite onFechar={() => setGerandoConvite(false)} onGerado={carregarConvites} copiar={copiar} />
      )}
    </>
  );
}

export default UsersPanel;
