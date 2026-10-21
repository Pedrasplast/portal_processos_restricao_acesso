import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiClock, FiRefreshCw, FiTrash2, FiUnlock, FiUserX, FiUsers, FiX } from 'react-icons/fi';

import { useLayout } from '../../../components/layout/AppLayout';
import { useFeedback } from '../../../hooks/useFeedback';
import { nomeExibicao } from '../../../utils/texto';
import {
  ACOES_ACESSO,
  definirAcessoUsuario,
  excluirUsuario,
  listarUsuarios,
} from '../../../services/solicitacoesService';
import InvitesCard from './InvitesCard';

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

/* Situação exibida na coluna "Acesso". */
function situacao(usuario) {
  if (usuario.regra === 'admin') return { rotulo: 'Administrador', classe: 'admin' };
  if (usuario.bloqueado) return { rotulo: 'Bloqueado', classe: 'negado' };
  if (usuario.acesso_ativo) return { rotulo: 'Liberado', classe: 'aprovado' };
  if (usuario.pedido_pendente) return { rotulo: 'Aguardando aprovação', classe: 'pendente' };
  return { rotulo: 'Sem acesso', classe: 'cancelado' };
}

/* Pedidos pendentes primeiro; depois usuários comuns; admins no fim. */
function ordem(usuario) {
  if (usuario.regra !== 'admin' && usuario.pedido_pendente && !usuario.acesso_ativo) return 0;
  if (usuario.regra !== 'admin') return 1;
  return 2;
}

/* Textos das confirmações e mensagens de cada ação. */
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
    detalhe: 'A pessoa poderá pedir acesso novamente no próximo login. Para impedir de vez, use "Excluir".',
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

/*
 * Aprovação única: o admin aprova/libera uma vez e o usuário entra em
 * qualquer login até ser revogado. Os pedidos de acesso aparecem aqui
 * (no topo da lista). 1 chamada para listar; recarrega quando a
 * contagem de pendentes muda.
 */
function UsersPanel() {
  const { notificar, confirmar } = useFeedback();
  const { pendentes: pendingCount, atualizarPendentes: onChanged } = useLayout();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setUsuarios(await listarUsuarios());
    } catch (error) {
      notificar('erro', `Não foi possível carregar os usuários. ${error.message || ''}`.trim());
    } finally {
      setLoading(false);
    }
  }, [notificar]);

  useEffect(() => {
    void carregar();
  }, [carregar, pendingCount]);

  const ordenados = useMemo(
    () => [...usuarios].sort((a, b) => ordem(a) - ordem(b)),
    [usuarios],
  );

  const pendentes = useMemo(() => ordenados.filter((u) => ordem(u) === 0).length, [ordenados]);

  async function executar(usuario, acao) {
    const nome = usuario.nome ? nomeExibicao(usuario.nome) : usuario.email;
    const textos = ACOES[acao];

    const confirmado = await confirmar({
      titulo: textos.titulo(usuario),
      mensagem: textos.mensagem(nome),
      detalhe: textos.detalhe,
      textoConfirmar: textos.textoConfirmar(usuario),
      perigo: Boolean(textos.perigo),
    });
    if (!confirmado) return;

    setProcessandoId(usuario.id);
    try {
      await definirAcessoUsuario(usuario.id, acao);
      notificar('sucesso', textos.sucesso(nome));
      await Promise.all([carregar(), onChanged?.()]);
    } catch (error) {
      notificar('erro', `Não foi possível concluir a ação. ${error.message || ''}`.trim());
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluir(usuario) {
    const nome = usuario.nome ? nomeExibicao(usuario.nome) : usuario.email;

    const confirmado = await confirmar({
      titulo: 'Excluir usuário',
      mensagem: `A conta de ${nome} (${usuario.email}) será excluída permanentemente.`,
      detalhe: 'Se a pessoa se cadastrar de novo, precisará de nova aprovação. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir usuário',
      perigo: true,
    });
    if (!confirmado) return;

    setProcessandoId(usuario.id);
    try {
      await excluirUsuario(usuario.id);
      notificar('sucesso', `Conta de ${nome} excluída.`);
      await Promise.all([carregar(), onChanged?.()]);
    } catch (error) {
      notificar('erro', `Não foi possível excluir o usuário. ${error.message || ''}`.trim());
    } finally {
      setProcessandoId(null);
    }
  }

  function botoes(usuario) {
    if (usuario.regra === 'admin') return <span className="request-finished sem-acao">—</span>;

    const processando = processandoId === usuario.id;
    const botao = (acao, rotulo, Icone, classe) => (
      <button
        key={acao}
        type="button"
        className={`btn btn-sm ${classe}`}
        disabled={processando}
        onClick={() => executar(usuario, acao)}
      >
        <Icone /> {rotulo}
      </button>
    );

    const excluirBotao = (
      <button
        key="excluir"
        type="button"
        className="btn btn-sm btn-danger"
        disabled={processando}
        onClick={() => excluir(usuario)}
      >
        <FiTrash2 /> Excluir
      </button>
    );

    if (usuario.bloqueado) {
      return (
        <div className="request-actions">
          {botao(ACOES_ACESSO.DESBLOQUEAR, 'Desbloquear', FiUnlock, 'btn-secondary')}
          {excluirBotao}
        </div>
      );
    }

    if (usuario.acesso_ativo) {
      return (
        <div className="request-actions">
          {botao(ACOES_ACESSO.REVOGAR, 'Revogar', FiUserX, 'btn-secondary')}
          {excluirBotao}
        </div>
      );
    }

    if (usuario.pedido_pendente) {
      return (
        <div className="request-actions">
          {botao(ACOES_ACESSO.LIBERAR, 'Aprovar', FiCheck, 'btn-success')}
          {botao(ACOES_ACESSO.NEGAR, 'Negar', FiX, 'btn-secondary')}
          {excluirBotao}
        </div>
      );
    }

    return (
      <div className="request-actions">
        {botao(ACOES_ACESSO.LIBERAR, 'Liberar', FiCheck, 'btn-success')}
        {excluirBotao}
      </div>
    );
  }

  return (
    <div className="usuarios-layout">
      <section className="painel" aria-labelledby="usuarios-titulo">
        <div className="painel__cabecalho">
          <div>
            <h2 id="usuarios-titulo">
              <FiUsers aria-hidden="true" /> Usuários
            </h2>
            <p>
              {usuarios.length} {usuarios.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}.
              Quem é liberado entra sem nova aprovação.
            </p>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregar()} disabled={loading}>
            <FiRefreshCw /> Atualizar
          </button>
        </div>

        {pendentes > 0 && (
          <div className="pedidos-aviso" role="status">
            <FiClock aria-hidden="true" />
            <span>
              {pendentes === 1
                ? '1 pedido de acesso aguardando sua aprovação.'
                : `${pendentes} pedidos de acesso aguardando sua aprovação.`}
            </span>
          </div>
        )}

        <div className="table-wrapper">
          <table className="data-table tabela-usuarios">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Acesso</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>

            <tbody>
              {loading && usuarios.length === 0 ? (
                <tr><td colSpan="3" className="empty-state">Carregando usuários...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="3" className="empty-state">Nenhum usuário cadastrado. Gere um convite para o primeiro acesso.</td></tr>
              ) : (
                ordenados.map((usuario) => {
                  const { rotulo, classe } = situacao(usuario);
                  const admin = usuario.regra === 'admin';

                  return (
                    <tr key={usuario.id} className={ordem(usuario) === 0 ? 'linha-pendente' : undefined}>
                      <td data-label="Usuário">
                        <strong>{usuario.nome ? nomeExibicao(usuario.nome) : usuario.email}</strong>
                        <small className="request-description">
                          {usuario.nome ? usuario.email : 'Nome não informado'}
                        </small>
                        <small className="ultimo-login numero">
                          {usuario.ultimo_login ? `Último login em ${formatarData(usuario.ultimo_login)}` : 'Ainda não entrou'}
                        </small>
                      </td>
                      <td data-label="Acesso">
                        <span className={`status-badge status-badge--${classe}`}>{rotulo}</span>
                        {!admin && usuario.acesso_ativo && usuario.liberado_em && (
                          <small className="acesso-desde numero">desde {formatarData(usuario.liberado_em).split(',')[0]}</small>
                        )}
                      </td>
                      <td className="celula-acoes">{botoes(usuario)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="usuarios-convites">
        <InvitesCard />
      </aside>
    </div>
  );
}

export default UsersPanel;
