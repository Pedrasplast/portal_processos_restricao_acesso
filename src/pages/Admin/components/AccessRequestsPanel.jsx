import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiRefreshCw, FiX } from 'react-icons/fi';

import {
  atualizarStatus,
  listarSolicitacoes,
  STATUS_ACESSO,
} from '../../../services/solicitacoesService';
import { listarUsuarios } from '../../../services/usuariosService';

const PESO_STATUS = {
  PENDENTE: 0,
  APROVADO: 1,
  NEGADO: 2,
  CANCELADO: 3,
};

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data);
}

function AccessRequestsPanel({ notify, onPendingCountChange }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);

    try {
      const [listaSolicitacoes, listaUsuarios] = await Promise.all([
        listarSolicitacoes(),
        listarUsuarios(),
      ]);

      setSolicitacoes(listaSolicitacoes);
      setUsuarios(listaUsuarios);
      onPendingCountChange(
        listaSolicitacoes.filter((item) => item.status === STATUS_ACESSO.PENDENTE).length,
      );
    } catch (error) {
      if (!silencioso) notify('erro', `Erro ao carregar solicitações: ${error.message}`);
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [notify, onPendingCountChange]);

  useEffect(() => {
    void carregar();
    const interval = setInterval(() => void carregar(true), 5000);
    return () => clearInterval(interval);
  }, [carregar]);

  const usuarioPorEmail = useMemo(() => {
    const mapa = new Map();
    usuarios.forEach((usuario) => mapa.set(String(usuario.email).trim().toLowerCase(), usuario));
    return mapa;
  }, [usuarios]);

  const ordenadas = useMemo(
    () =>
      [...solicitacoes].sort((a, b) => {
        const status = (PESO_STATUS[a.status] ?? 99) - (PESO_STATUS[b.status] ?? 99);
        if (status !== 0) return status;
        return new Date(b.criado_em || 0) - new Date(a.criado_em || 0);
      }),
    [solicitacoes],
  );

  async function decidir(id, status) {
    setProcessandoId(id);
    try {
      await atualizarStatus(id, status);
      notify(
        'sucesso',
        status === STATUS_ACESSO.APROVADO
          ? 'Acesso aprovado com sucesso.'
          : 'Solicitação negada.',
      );
      await carregar(true);
    } catch (error) {
      notify('erro', `Erro ao atualizar solicitação: ${error.message}`);
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card__header admin-card__header--actions">
        <div>
          <h3>Solicitações de Acesso</h3>
          <p>Aprove ou negue cada tentativa de entrada de usuários comuns.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => carregar()} disabled={loading}>
          <FiRefreshCw /> Atualizar
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table requests-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Solicitado em</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && solicitacoes.length === 0 ? (
              <tr><td colSpan="5" className="empty-state">Carregando solicitações...</td></tr>
            ) : ordenadas.length === 0 ? (
              <tr><td colSpan="5" className="empty-state">Nenhuma solicitação encontrada.</td></tr>
            ) : (
              ordenadas.map((solicitacao) => {
                const usuario = usuarioPorEmail.get(String(solicitacao.email).toLowerCase());
                const pendente = solicitacao.status === STATUS_ACESSO.PENDENTE;
                const processando = processandoId === solicitacao.id;

                return (
                  <tr key={solicitacao.id}>
                    <td>
                      <strong>{usuario?.nome || 'Usuário autenticado'}</strong>
                      {usuario?.descricao && <small className="request-description">{usuario.descricao}</small>}
                    </td>
                    <td>{solicitacao.email}</td>
                    <td>{formatarData(solicitacao.criado_em)}</td>
                    <td>
                      <span className={`status-badge status-badge--${String(solicitacao.status).toLowerCase()}`}>
                        {solicitacao.status}
                      </span>
                    </td>
                    <td>
                      {pendente ? (
                        <div className="request-actions">
                          <button
                            type="button"
                            className="btn btn-success"
                            disabled={processando}
                            onClick={() => decidir(solicitacao.id, STATUS_ACESSO.APROVADO)}
                          >
                            <FiCheck /> Aprovar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={processando}
                            onClick={() => decidir(solicitacao.id, STATUS_ACESSO.NEGADO)}
                          >
                            <FiX /> Negar
                          </button>
                        </div>
                      ) : (
                        <span className="request-finished">Finalizada</span>
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
  );
}

export default AccessRequestsPanel;
