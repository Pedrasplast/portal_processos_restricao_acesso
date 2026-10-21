import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX, FiXCircle } from 'react-icons/fi';

import '../styles/feedback.css';

/*
 * Mensagens e confirmações do sistema, no lugar de window.alert/confirm.
 *
 *   const { notificar, confirmar } = useFeedback();
 *   notificar('sucesso' | 'erro' | 'aviso' | 'info', 'Texto');
 *   if (await confirmar({ titulo, mensagem, textoConfirmar, perigo })) { ... }
 */

export const FeedbackContext = createContext(null);

const DURACAO_PADRAO = {
  sucesso: 4000,
  info: 4500,
  aviso: 6000,
  erro: 7000,
};

const ICONES = {
  sucesso: FiCheckCircle,
  erro: FiXCircle,
  aviso: FiAlertTriangle,
  info: FiInfo,
};

const TITULOS = {
  sucesso: 'Tudo certo',
  erro: 'Algo deu errado',
  aviso: 'Atenção',
  info: 'Informação',
};

let proximoId = 1;

function Toast({ toast, onFechar }) {
  const Icone = ICONES[toast.tipo] || FiInfo;

  useEffect(() => {
    const timer = setTimeout(() => onFechar(toast.id), toast.duracao);
    return () => clearTimeout(timer);
  }, [toast, onFechar]);

  return (
    <div
      className={`toast toast--${toast.tipo}`}
      role={toast.tipo === 'erro' ? 'alert' : 'status'}
      style={{ '--toast-duracao': `${toast.duracao}ms` }}
    >
      <span className="toast__icone" aria-hidden="true">
        <Icone />
      </span>
      <div className="toast__corpo">
        <strong>{toast.titulo || TITULOS[toast.tipo]}</strong>
        <p>{toast.texto}</p>
      </div>
      <button type="button" className="toast__fechar" onClick={() => onFechar(toast.id)} aria-label="Fechar">
        <FiX />
      </button>
      <span className="toast__progresso" aria-hidden="true" />
    </div>
  );
}

function DialogoConfirmacao({ dialogo, onResponder }) {
  const botaoCancelarRef = useRef(null);
  const botaoConfirmarRef = useRef(null);

  useEffect(() => {
    /* Em ações perigosas o foco começa em "Cancelar" (evita Enter acidental). */
    const alvo = dialogo.perigo ? botaoCancelarRef.current : botaoConfirmarRef.current;
    alvo?.focus();

    function aoTeclar(event) {
      if (event.key === 'Escape') onResponder(false);
    }

    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [dialogo, onResponder]);

  const Icone = dialogo.perigo ? FiAlertTriangle : FiInfo;

  return (
    <div className="dialogo-fundo" onMouseDown={(event) => event.target === event.currentTarget && onResponder(false)}>
      <div
        className={`dialogo${dialogo.perigo ? ' dialogo--perigo' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        aria-describedby="dialogo-mensagem"
      >
        <div className="dialogo__cabecalho">
          <span className="dialogo__icone" aria-hidden="true">
            <Icone />
          </span>
          <h2 id="dialogo-titulo">{dialogo.titulo}</h2>
        </div>

        <div id="dialogo-mensagem" className="dialogo__mensagem">
          {dialogo.mensagem && <p>{dialogo.mensagem}</p>}
          {dialogo.detalhe && <p className="dialogo__detalhe">{dialogo.detalhe}</p>}
        </div>

        <div className="dialogo__acoes">
          <button ref={botaoCancelarRef} type="button" className="btn btn-secondary" onClick={() => onResponder(false)}>
            {dialogo.textoCancelar}
          </button>
          <button
            ref={botaoConfirmarRef}
            type="button"
            className={`btn ${dialogo.perigo ? 'btn-perigo-solido' : 'btn-primary'}`}
            onClick={() => onResponder(true)}
          >
            {dialogo.textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const resolverRef = useRef(null);

  const fecharToast = useCallback((id) => {
    setToasts((atuais) => atuais.filter((toast) => toast.id !== id));
  }, []);

  const notificar = useCallback((tipo, texto, opcoes = {}) => {
    const id = proximoId++;
    const tipoValido = ICONES[tipo] ? tipo : 'info';
    setToasts((atuais) => [
      ...atuais.slice(-3),
      {
        id,
        tipo: tipoValido,
        texto,
        titulo: opcoes.titulo,
        duracao: opcoes.duracao || DURACAO_PADRAO[tipoValido],
      },
    ]);
    return id;
  }, []);

  const confirmar = useCallback(
    ({ titulo, mensagem, detalhe, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', perigo = false }) =>
      new Promise((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setDialogo({ titulo, mensagem, detalhe, textoConfirmar, textoCancelar, perigo });
      }),
    [],
  );

  const responder = useCallback((resposta) => {
    resolverRef.current?.(resposta);
    resolverRef.current = null;
    setDialogo(null);
  }, []);

  const value = useMemo(() => ({ notificar, confirmar }), [notificar, confirmar]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="toast-area" aria-live="polite">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onFechar={fecharToast} />
        ))}
      </div>

      {dialogo && <DialogoConfirmacao dialogo={dialogo} onResponder={responder} />}
    </FeedbackContext.Provider>
  );
}
