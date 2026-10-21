import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiClock, FiRefreshCw, FiTrash2, FiUnlock, FiUserX, FiUsers, FiX } from 'react-icons/fi';

import { useFeedback } from '../../../hooks/useFeedback';
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
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data);
}

/* Situação exibida na coluna "Acesso". */
function situacao(usuario) {
  if (usuario.regra === 'admin') return { rotulo: 'ADMIN', classe: 'aprovado' };
  if (usuario.bloqueado) return { rotulo: 'BLOQUEADO', classe: 'negado' };
  if (usuario.acesso_ativo) return { rotulo: 'LIBERADO', classe: 'aprovado' };
  if (usuario.pedido_pendente) return { rotulo: 'AGUARDANDO APROVAÇÃO', classe: 'pendente' };
  return { rotulo: 'SEM ACESSO', classe: 'cancelado' };
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
function UsersPanel({ pendingCount, onChanged }) {
  const { notificar, confirmar } = useFeedback();
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
    const nome = usuario.nome || usuario.email;
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
    const nome = usuario.nome || usuario.email;

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
    if (usuario.regra === 'admin') return <span className="request-finished">—</span>;

    const processando = processandoId === usuario.id;
    const botao = (acao, rotulo, Icone, classe) => (
      <button
        key={acao}
        type="button"
        className={`btn ${classe}`}
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
        className="btn btn-danger"
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
    <div className="admin-stack">
      <InvitesCard />

      <section className="admin-card">
        <div className="admin-card__header admin-card__header--actions">
          <div>
            <h3>
              <FiUsers /> Usuários
            </h3>
            <p>
              Aprove os pedidos de acesso, libere, revogue ou exclua usuários.
              Quem é liberado entra sem nova aprovação.
            </p>
          </div>

          <button type="button" className="btn btn-secondary" onClick={() => carregar()} disabled={loading}>
            <FiRefreshCw /> Atualizar
          </button>
        </div>

        {pendentes > 0 && (
          <div className="pedidos-aviso" role="status">
            <FiClock />
            <span>
              {pendentes === 1
                ? '1 pedido de acesso aguardando sua aprovação.'
                : `${pendentes} pedidos de acesso aguardando sua aprovação.`}
            </span>
          </div>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Último login</th>
                <th>Liberado em</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading && usuarios.length === 0 ? (
                <tr><td colSpan="6" className="empty-state">Carregando usuários...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="6" className="empty-state">Nenhum usuário cadastrado.</td></tr>
              ) : (
                ordenados.map((usuario) => {
                  const { rotulo, classe } = situacao(usuario);

                  return (
                    <tr key={usuario.id} className={ordem(usuario) === 0 ? 'linha-pendente' : undefined}>
                      <td>
                        <strong>{usuario.nome || '—'}</strong>
                        <small className="request-description">{usuario.email}</small>
                      </td>
                      <td>{usuario.regra === 'admin' ? 'Administrador' : 'Usuário'}</td>
                      <td>{formatarData(usuario.ultimo_login)}</td>
                      <td>{usuario.regra === 'admin' ? '—' : formatarData(usuario.liberado_em)}</td>
                      <td>
                        <span className={`status-badge status-badge--${classe}`}>{rotulo}</span>
                      </td>
                      <td>{botoes(usuario)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default UsersPanel;
