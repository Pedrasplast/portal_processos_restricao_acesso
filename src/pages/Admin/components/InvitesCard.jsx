import { useCallback, useEffect, useState } from 'react';
import { FiCopy, FiLink, FiX } from 'react-icons/fi';

import { useFeedback } from '../../../hooks/useFeedback';
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

const NOME_SITUACAO = {
  ABERTO: 'Aberto',
  USADO: 'Usado',
  CANCELADO: 'Cancelado',
  EXPIRADO: 'Expirado',
};

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
function InvitesCard() {
  const { notificar: notify, confirmar } = useFeedback();
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
    notify(
      ok ? 'sucesso' : 'aviso',
      ok
        ? 'Link copiado para a área de transferência. Agora é só enviar ao usuário.'
        : 'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.',
      { titulo: ok ? 'Link copiado' : 'Copie manualmente' },
    );
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
    const confirmado = await confirmar({
      titulo: 'Cancelar convite',
      mensagem: convite.email
        ? `O convite para ${convite.email} deixará de funcionar.`
        : 'Este link de convite deixará de funcionar.',
      detalhe: 'Se precisar, você pode gerar um novo link depois.',
      textoConfirmar: 'Cancelar convite',
      textoCancelar: 'Voltar',
      perigo: true,
    });
    if (!confirmado) return;
    try {
      await cancelarConvite(convite.id);
      if (ultimoLink.endsWith(convite.token)) setUltimoLink('');
      notify('sucesso', 'Convite cancelado.');
      await carregar();
    } catch (error) {
      notify('erro', `Erro ao cancelar convite: ${error.message || 'erro desconhecido'}`);
    }
  }

  const abertos = convites.filter((c) => c.situacao === 'ABERTO');
  const encerrados = convites.filter((c) => c.situacao !== 'ABERTO');

  return (
    <section className="painel convites" aria-labelledby="convites-titulo">
      <div className="painel__cabecalho">
        <div>
          <h2 id="convites-titulo">
            <FiLink aria-hidden="true" /> Convidar usuário
          </h2>
          <p>Quem se cadastrar pelo link já entra liberado. Cada link vale para um cadastro.</p>
        </div>
      </div>

      <form className="painel__corpo convites__form" onSubmit={gerar}>
        <div className="form-group">
          <label htmlFor="invite-email">E-mail da pessoa (opcional)</label>
          <input
            id="invite-email"
            className="form-control"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nome@empresa.com.br"
            disabled={gerando}
          />
          <p className="form-ajuda">Com e-mail, só essa pessoa consegue usar o link.</p>
        </div>

        <div className="convites__linha">
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

          <button type="submit" className="btn btn-primary" disabled={gerando}>
            <FiLink /> {gerando ? 'Gerando...' : 'Gerar link'}
          </button>
        </div>

        {ultimoLink && (
          <div className="convites__gerado">
            <span>Link gerado e copiado</span>
            <div>
              <input
                className="form-control"
                type="text"
                value={ultimoLink}
                readOnly
                onFocus={(event) => event.target.select()}
                aria-label="Link de convite gerado"
              />
              <button type="button" className="btn btn-secondary" onClick={() => copiar(ultimoLink)} aria-label="Copiar link">
                <FiCopy />
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="convites__lista">
        <h3>Convites em aberto</h3>

        {loading && convites.length === 0 ? (
          <p className="convites__vazio">Carregando convites...</p>
        ) : abertos.length === 0 ? (
          <p className="convites__vazio">Nenhum convite em aberto.</p>
        ) : (
          <ul>
            {abertos.map((convite) => (
              <li key={convite.id} className="convite">
                <div className="convite__info">
                  <strong>{convite.email || 'Qualquer e-mail'}</strong>
                  <small>Expira em {formatarData(convite.expira_em)}</small>
                </div>
                <div className="convite__acoes">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => copiar(montarLinkConvite(convite.token))}
                    aria-label={`Copiar link do convite ${convite.email || ''}`}
                    title="Copiar link"
                  >
                    <FiCopy />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm convite__cancelar"
                    onClick={() => cancelar(convite)}
                    aria-label={`Cancelar convite ${convite.email || ''}`}
                    title="Cancelar convite"
                  >
                    <FiX />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {encerrados.length > 0 && (
          <details className="convites__historico">
            <summary>Últimos 30 dias ({encerrados.length})</summary>
            <ul>
              {encerrados.map((convite) => (
                <li key={convite.id} className="convite">
                  <div className="convite__info">
                    <strong>{convite.usado_email || convite.email || 'Qualquer e-mail'}</strong>
                    <small>
                      {convite.situacao === 'USADO'
                        ? `Usado em ${formatarData(convite.usado_em)}`
                        : convite.situacao === 'CANCELADO'
                          ? 'Cancelado'
                          : `Expirou em ${formatarData(convite.expira_em)}`}
                    </small>
                  </div>
                  <span className={`status-badge status-badge--${CLASSE_SITUACAO[convite.situacao] || 'cancelado'}`}>
                    {NOME_SITUACAO[convite.situacao] || convite.situacao}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

export default InvitesCard;
