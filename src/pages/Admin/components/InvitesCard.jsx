import { useCallback, useEffect, useState } from 'react';
import { FiCopy, FiLink, FiX } from 'react-icons/fi';

import {
  cancelarConvite,
  criarConvite,
  listarConvites,
  montarLinkConvite,
} from '../../../services/convitesService';

const OPCOES_VALIDADE = [
  { dias: 1, nome: '1 dia' },
  { dias: 7, nome: '7 dias' },
  { dias: 30, nome: '30 dias' },
];

const CLASSE_SITUACAO = {
  ABERTO: 'pendente',
  USADO: 'aprovado',
  CANCELADO: 'cancelado',
  EXPIRADO: 'negado',
};

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    /* Navegadores sem permissão de área de transferência. */
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

/*
 * Gera links de convite de uso único. Quem se cadastra pelo link já
 * entra liberado (sem aprovação). Carrega a lista 1x, sem polling.
 */
function InvitesCard({ notify }) {
  const [email, setEmail] = useState('');
  const [dias, setDias] = useState(7);
  const [gerando, setGerando] = useState(false);
  const [ultimoLink, setUltimoLink] = useState('');
  const [convites, setConvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setConvites(await listarConvites());
    } catch (error) {
      notify('erro', `Erro ao carregar convites: ${error.message || 'erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function copiar(link) {
    const ok = await copiarTexto(link);
    notify(ok ? 'sucesso' : 'erro', ok ? 'Link copiado. Agora é só enviar ao usuário.' : 'Não foi possível copiar. Selecione o link e copie manualmente.');
  }

  async function gerar(event) {
    event.preventDefault();
    setGerando(true);
    try {
      const convite = await criarConvite({ email, dias });
      const link = montarLinkConvite(convite.token);
      setUltimoLink(link);
      setEmail('');
      await copiar(link);
      await carregar();
    } catch (error) {
      notify('erro', `Erro ao gerar convite: ${error.message || 'erro desconhecido'}`);
    } finally {
      setGerando(false);
    }
  }

  async function cancelar(convite) {
    if (!window.confirm('Cancelar este convite? O link deixará de funcionar.')) return;
    try {
      await cancelarConvite(convite.id);
      if (ultimoLink.endsWith(convite.token)) setUltimoLink('');
      notify('sucesso', 'Convite cancelado.');
      await carregar();
    } catch (error) {
      notify('erro', `Erro ao cancelar convite: ${error.message || 'erro desconhecido'}`);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card__header">
        <div>
          <h3>
            <FiLink /> Convidar usuário
          </h3>
          <p>
            Gere um link e envie para a pessoa. Quem se cadastrar por ele já entra liberado.
            Cada link vale para um único cadastro.
          </p>
        </div>
      </div>

      <form className="admin-form-grid invites-form" onSubmit={gerar}>
        <div className="form-group admin-form-grid__double">
          <label htmlFor="invite-email">E-mail da pessoa (opcional)</label>
          <input
            id="invite-email"
            className="form-control"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Se informar, só este e-mail poderá usar o link"
            disabled={gerando}
          />
        </div>

        <div className="form-group">
          <label htmlFor="invite-days">Validade</label>
          <select
            id="invite-days"
            className="form-control"
            value={dias}
            onChange={(event) => setDias(Number(event.target.value))}
            disabled={gerando}
          >
            {OPCOES_VALIDADE.map((opcao) => (
              <option key={opcao.dias} value={opcao.dias}>{opcao.nome}</option>
            ))}
          </select>
        </div>

        <div className="admin-form-grid__wide">
          <button type="submit" className="btn btn-primary" disabled={gerando}>
            <FiLink /> {gerando ? 'Gerando...' : 'Gerar link de convite'}
          </button>
        </div>
      </form>

      {ultimoLink && (
        <div className="invite-link-box">
          <input
            className="form-control"
            type="text"
            value={ultimoLink}
            readOnly
            onFocus={(event) => event.target.select()}
            aria-label="Link de convite gerado"
          />
          <button type="button" className="btn btn-secondary" onClick={() => copiar(ultimoLink)}>
            <FiCopy /> Copiar
          </button>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Para</th>
              <th>Criado em</th>
              <th>Expira em</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && convites.length === 0 ? (
              <tr><td colSpan="5" className="empty-state">Carregando convites...</td></tr>
            ) : convites.length === 0 ? (
              <tr><td colSpan="5" className="empty-state">Nenhum convite gerado.</td></tr>
            ) : (
              convites.map((convite) => {
                const aberto = convite.situacao === 'ABERTO';
                return (
                  <tr key={convite.id}>
                    <td>
                      <strong>{convite.email || 'Qualquer e-mail'}</strong>
                      {convite.usado_email && (
                        <small className="request-description">Usado por {convite.usado_email}</small>
                      )}
                    </td>
                    <td>{formatarData(convite.criado_em)}</td>
                    <td>{formatarData(convite.expira_em)}</td>
                    <td>
                      <span className={`status-badge status-badge--${CLASSE_SITUACAO[convite.situacao] || 'cancelado'}`}>
                        {convite.situacao}
                      </span>
                    </td>
                    <td>
                      {aberto ? (
                        <div className="request-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => copiar(montarLinkConvite(convite.token))}
                          >
                            <FiCopy /> Copiar link
                          </button>
                          <button type="button" className="btn btn-danger" onClick={() => cancelar(convite)}>
                            <FiX /> Cancelar
                          </button>
                        </div>
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
  );
}

export default InvitesCard;
