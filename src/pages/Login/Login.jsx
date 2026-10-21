import { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiClock, FiLogIn, FiXCircle } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { usePolling } from '../../hooks/usePolling';
import { loginComSenha, obterPerfil, sair } from '../../services/authService';
import {
  cancelarMinhaSolicitacao,
  solicitarAcesso,
  STATUS_ACESSO,
} from '../../services/solicitacoesService';

import './Login.css';

/* Intervalo de verificação enquanto aguarda o admin (só com a aba visível). */
const INTERVALO_VERIFICACAO = 5000;

const MENSAGENS_RECUSA = {
  [STATUS_ACESSO.NEGADO]: 'O administrador negou sua solicitação de acesso.',
  [STATUS_ACESSO.CANCELADO]: 'A solicitação foi cancelada.',
  [STATUS_ACESSO.BLOQUEADO]: 'Seu acesso está bloqueado. Fale com o administrador do portal.',
};

function traduzirErro(error) {
  const mensagem = String(error?.message || '').toLowerCase();

  if (mensagem.includes('invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (mensagem.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (mensagem.includes('rate limit') || mensagem.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }

  return error?.message || 'Não foi possível entrar.';
}

function Login() {
  const navigate = useNavigate();
  const {
    user,
    isAdmin,
    statusAcesso,
    acessoLiberado,
    loading: authLoading,
    atualizarAcesso,
    setStatusAcesso,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [aguardando, setAguardando] = useState(false);

  /* Já logado: redireciona ou retoma a espera (ex.: recarregou a página). */
  useEffect(() => {
    if (authLoading || !user) return;

    if (isAdmin) {
      navigate('/admin', { replace: true });
      return;
    }

    if (acessoLiberado) {
      navigate('/', { replace: true });
      return;
    }

    if (statusAcesso === STATUS_ACESSO.PENDENTE) setAguardando(true);
  }, [authLoading, user, isAdmin, acessoLiberado, statusAcesso, navigate]);

  const verificar = useCallback(async () => {
    try {
      const status = await atualizarAcesso();

      if (status === STATUS_ACESSO.APROVADO || status === STATUS_ACESSO.ADMIN) {
        setAguardando(false);
        navigate('/', { replace: true });
        return;
      }

      if (MENSAGENS_RECUSA[status]) {
        setAguardando(false);
        await sair();
        setErro(MENSAGENS_RECUSA[status]);
      }
    } catch (error) {
      console.error('Erro ao verificar solicitação:', error);
    }
  }, [atualizarAcesso, navigate]);

  usePolling(verificar, INTERVALO_VERIFICACAO, { ativo: aguardando, imediato: false });

  async function handleLogin(event) {
    event.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const usuario = await loginComSenha(email, senha);
      const perfil = await obterPerfil(usuario.id);

      if (perfil?.regra === 'admin') {
        navigate('/admin', { replace: true });
        return;
      }

      /* Já liberado entra direto; senão, cria o pedido para o admin. */
      const status = await solicitarAcesso();
      setStatusAcesso(status);

      if (status === STATUS_ACESSO.APROVADO) {
        navigate('/', { replace: true });
        return;
      }

      if (status === STATUS_ACESSO.BLOQUEADO) {
        await sair();
        setErro(MENSAGENS_RECUSA[status]);
        return;
      }

      setAguardando(true);
    } catch (error) {
      console.error('Erro ao realizar login:', error);
      setErro(traduzirErro(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelar() {
    setAguardando(false);

    try {
      await cancelarMinhaSolicitacao();
    } catch (error) {
      console.error(error);
    } finally {
      setSenha('');
      await sair();
    }
  }

  if (aguardando) {
    return (
      <div className="login-page">
        <section className="login-card login-card--waiting">
          <img src="/Logo_Pedrasplast.png" alt="Pedrasplast" className="login-logo" />

          <div className="waiting-icon">
            <FiClock />
          </div>

          <h1>Aguardando autorização</h1>

          <p>Seu login foi validado. A entrada será liberada quando o administrador aprovar. Depois disso, você não precisará de nova aprovação.</p>

          <div className="waiting-status">
            <span className="waiting-spinner" />
            Solicitação pendente
          </div>

          <button type="button" className="btn btn-secondary login-full" onClick={handleCancelar}>
            <FiXCircle />
            Cancelar solicitação
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <img src="/Logo_Pedrasplast.png" alt="Pedrasplast" className="login-logo" />

        <div className="login-heading-icon">
          <FiLogIn />
        </div>

        <h1>Acesso ao Portal</h1>

        <p>Entre com suas credenciais. No primeiro acesso, o administrador precisa liberar sua entrada.</p>

        {erro && <div className="login-error">{erro}</div>}

        <div className="form-group">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            className="form-control"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="seu-email@dominio.com"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            className="form-control"
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary login-full" disabled={loading}>
          <FiCheckCircle />
          {loading ? 'Validando...' : 'Entrar / Solicitar acesso'}
        </button>

        <div className="login-register">
          <span>Primeiro acesso?</span>
          <Link to="/cadastro">Criar conta</Link>
        </div>
      </form>
    </div>
  );
}

export default Login;
