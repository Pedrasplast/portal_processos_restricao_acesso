import { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw, FiTrash2, FiUsers } from 'react-icons/fi';

import { listarUsuarios, revogarAcessoUsuario } from '../../../services/solicitacoesService';

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data);
}

/*
 * Lista todos os usuários cadastrados (1 chamada RPC, sem polling).
 * "Acesso ativo" = tem uma sessão de login aprovada e ainda aberta.
 */
function UsersPanel({ notify }) {
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

  async function revogar(usuario) {
    const nome = usuario.nome || usuario.email;
    if (!window.confirm(`Deseja realmente revogar o acesso de ${nome}?`)) return;

    setProcessandoId(usuario.id);
    try {
      await revogarAcessoUsuario(usuario.id);
      notify('sucesso', `Acesso de ${nome} revogado.`);
      await carregar();
    } catch (error) {
      notify('erro', `Erro ao revogar acesso: ${error.message || 'erro desconhecido'}`);
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="admin-stack">
      <section className="admin-card">
        <div className="admin-card__header admin-card__header--actions">
          <div>
            <h3>
              <FiUsers /> Usuários
            </h3>
            <p>Usuários cadastrados no portal e situação do acesso no login atual.</p>
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
                <th>Última aprovação</th>
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
                  const admin = usuario.regra === 'admin';
                  const processando = processandoId === usuario.id;

                  return (
                    <tr key={usuario.id}>
                      <td>
                        <strong>{usuario.nome || '—'}</strong>
                        <small className="request-description">{usuario.email}</small>
                      </td>
                      <td>{admin ? 'Administrador' : 'Usuário'}</td>
                      <td>{formatarData(usuario.ultimo_login)}</td>
                      <td>
                        {formatarData(usuario.ultima_aprovacao)}
                        {usuario.acessos_aprovados > 0 && (
                          <small className="request-description">
                            {usuario.acessos_aprovados} aprovação(ões)
                          </small>
                        )}
                      </td>
                      <td>
                        {admin ? (
                          <span className="status-badge status-badge--aprovado">SEMPRE</span>
                        ) : usuario.acesso_ativo ? (
                          <span className="status-badge status-badge--aprovado">ATIVO</span>
                        ) : (
                          <span className="status-badge status-badge--cancelado">SEM ACESSO</span>
                        )}
                      </td>
                      <td>
                        {!admin && usuario.acesso_ativo ? (
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={processando}
                            onClick={() => revogar(usuario)}
                          >
                            <FiTrash2 />
                            {processando ? 'Revogando...' : 'Revogar acesso'}
                          </button>
                        ) : (
                          <span className="request-finished">—</span>
                        )}
                      </td>
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
