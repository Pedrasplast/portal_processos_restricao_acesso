import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiRefreshCw, FiSlash, FiUnlock, FiUserX, FiUsers } from 'react-icons/fi';

import {
  ACOES_ACESSO,
  definirAcessoUsuario,
  listarUsuarios,
} from '../../../services/solicitacoesService';

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
  if (usuario.pedido_pendente) return { rotulo: 'PEDIDO PENDENTE', classe: 'pendente' };
  return { rotulo: 'SEM ACESSO', classe: 'cancelado' };
}

const CONFIRMACOES = {
  [ACOES_ACESSO.LIBERAR]: (nome) => `Liberar o acesso de ${nome}? Ele poderá entrar sem nova aprovação.`,
  [ACOES_ACESSO.REVOGAR]: (nome) => `Revogar o acesso de ${nome}? Ele perde o acesso na hora e terá que pedir de novo.`,
  [ACOES_ACESSO.BLOQUEAR]: (nome) => `Bloquear ${nome}? Ele perde o acesso e não conseguirá nem pedir aprovação.`,
  [ACOES_ACESSO.DESBLOQUEAR]: (nome) => `Desbloquear ${nome}? Ele poderá voltar a pedir acesso.`,
};

const SUCESSO = {
  [ACOES_ACESSO.LIBERAR]: 'liberado',
  [ACOES_ACESSO.REVOGAR]: 'revogado',
  [ACOES_ACESSO.BLOQUEAR]: 'bloqueado',
  [ACOES_ACESSO.DESBLOQUEAR]: 'desbloqueado',
};

/*
 * Aprovação única: o admin libera uma vez e o usuário entra em qualquer
 * login até ser revogado ou bloqueado. 1 chamada para listar, sem polling.
 */
function UsersPanel({ notify, onChanged }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setUsuarios(await listarUsuarios());
    } catch (error) {
      notify('erro', `Erro ao carregar usuários: ${error.message || 'erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function executar(usuario, acao) {
    const nome = usuario.nome || usuario.email;
    if (!window.confirm(CONFIRMACOES[acao](nome))) return;

    setProcessandoId(usuario.id);
    try {
      await definirAcessoUsuario(usuario.id, acao);
      notify('sucesso', `${nome}: acesso ${SUCESSO[acao]}.`);
      await Promise.all([carregar(), onChanged?.()]);
    } catch (error) {
      notify('erro', `Erro ao alterar acesso: ${error.message || 'erro desconhecido'}`);
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

    if (usuario.bloqueado) {
      return (
        <div className="request-actions">
          {botao(ACOES_ACESSO.DESBLOQUEAR, 'Desbloquear', FiUnlock, 'btn-secondary')}
        </div>
      );
    }

    return (
      <div className="request-actions">
        {usuario.acesso_ativo
          ? botao(ACOES_ACESSO.REVOGAR, 'Revogar', FiUserX, 'btn-secondary')
          : botao(ACOES_ACESSO.LIBERAR, 'Liberar', FiCheck, 'btn-success')}
        {botao(ACOES_ACESSO.BLOQUEAR, 'Bloquear', FiSlash, 'btn-danger')}
      </div>
    );
  }

  return (
    <div className="admin-stack">
      <section className="admin-card">
        <div className="admin-card__header admin-card__header--actions">
          <div>
            <h3>
              <FiUsers /> Usuários
            </h3>
            <p>
              Liberado entra sem nova aprovação. Revogar tira o acesso (pode pedir de novo).
              Bloquear impede até de pedir.
            </p>
          </div>

          <button type="button" className="btn btn-secondary" onClick={() => carregar()} disabled={loading}>
            <FiRefreshCw /> Atualizar
          </button>
        </div>

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
                usuarios.map((usuario) => {
                  const { rotulo, classe } = situacao(usuario);

                  return (
                    <tr key={usuario.id}>
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
