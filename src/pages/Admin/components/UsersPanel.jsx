import { useCallback, useEffect, useState } from 'react';
import { FiTrash2, FiUserPlus } from 'react-icons/fi';

import {
  cadastrarUsuario,
  excluirUsuario,
  listarUsuarios,
} from '../../../services/usuariosService';

function UsersPanel({ notify }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', descricao: '' });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setUsuarios(await listarUsuarios());
    } catch (error) {
      notify('erro', `Erro ao carregar usuários: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSalvando(true);

    try {
      await cadastrarUsuario(form);
      notify('sucesso', 'Usuário autorizado com sucesso.');
      setForm({ nome: '', email: '', descricao: '' });
      await carregar();
    } catch (error) {
      notify('erro', `Erro ao cadastrar usuário: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function handleDelete(id) {
    try {
      await excluirUsuario(id);
      notify('sucesso', 'Acesso do usuário removido.');
      await carregar();
    } catch (error) {
      notify('erro', `Erro ao remover usuário: ${error.message}`);
    }
  }

  return (
    <div className="admin-stack">
      <form className="admin-card" onSubmit={handleSubmit}>
        <div className="admin-card__header">
          <div>
            <h3><FiUserPlus /> Cadastrar Usuário com Acesso</h3>
            <p>Cadastre quem poderá solicitar entrada no Portal.</p>
          </div>
        </div>

        <div className="admin-form-grid">
          <div className="form-group">
            <label htmlFor="user-name">Nome do Colaborador</label>
            <input
              id="user-name"
              className="form-control"
              value={form.nome}
              onChange={(event) => setForm((old) => ({ ...old, nome: event.target.value }))}
              placeholder="Ex.: João Silva"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="user-email">E-mail de Acesso</label>
            <input
              id="user-email"
              className="form-control"
              type="email"
              value={form.email}
              onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))}
              placeholder="joao@empresa.com"
              required
            />
          </div>

          <div className="form-group admin-form-grid__wide">
            <label htmlFor="user-description">Descrição (opcional)</label>
            <input
              id="user-description"
              className="form-control"
              value={form.descricao}
              onChange={(event) => setForm((old) => ({ ...old, descricao: event.target.value }))}
              placeholder="Cargo, área ou observação"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={salvando}>
          <FiUserPlus /> {salvando ? 'Salvando...' : 'Liberar Cadastro'}
        </button>
      </form>

      <section className="admin-card">
        <div className="admin-card__header">
          <div>
            <h3>Usuários Autorizados</h3>
            <p>O setor foi removido deste cadastro.</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Descrição</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="empty-state">Carregando usuários...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="4" className="empty-state">Nenhum usuário cadastrado.</td></tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td><strong>{usuario.nome}</strong></td>
                    <td>{usuario.email}</td>
                    <td>{usuario.descricao || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(usuario.id)}>
                        <FiTrash2 /> Revogar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default UsersPanel;
