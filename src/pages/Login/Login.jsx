import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  FiCheckCircle,
  FiClock,
  FiLogIn,
  FiXCircle,
} from 'react-icons/fi';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

import {
  loginComSenha,
  obterPerfil,
  sair,
} from '../../services/authService';

import {
  cancelarSolicitacao,
  criarSolicitacao,
  obterSolicitacao,
  STATUS_ACESSO,
} from '../../services/solicitacoesService';

import './Login.css';

function Login() {
  const navigate = useNavigate();

  const {
    user,
    isAdmin,
    loading: authLoading,
  } = useAuth();

  const [email, setEmail] =
    useState('');

  const [senha, setSenha] =
    useState('');

  const [erro, setErro] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [
    solicitacaoId,
    setSolicitacaoId,
  ] = useState(
    sessionStorage.getItem(
      'solicitacaoAcessoId',
    ) || '',
  );

  const [aguardando, setAguardando] =
    useState(false);

  const intervaloRef = useRef(null);

  /* ================================================
     PARAR MONITORAMENTO
  ================================================= */

  const pararMonitoramento =
    useCallback(() => {
      if (intervaloRef.current) {
        clearInterval(
          intervaloRef.current,
        );

        intervaloRef.current = null;
      }
    }, []);

  /* ================================================
     VERIFICAR SOLICITAÇÃO
  ================================================= */

  const verificarSolicitacao =
    useCallback(
      async (id, usuarioId) => {
        try {
          const solicitacao =
            await obterSolicitacao({
              id,
              userId: usuarioId,
            });

          if (!solicitacao) {
            return;
          }

          /* APROVADO */

          if (
            solicitacao.status ===
            STATUS_ACESSO.APROVADO
          ) {
            pararMonitoramento();

            sessionStorage.setItem(
              'solicitacaoAcessoId',
              solicitacao.id,
            );

            navigate('/', {
              replace: true,
            });

            return;
          }

          /* NEGADO / CANCELADO */

          if (
            solicitacao.status ===
              STATUS_ACESSO.NEGADO ||
            solicitacao.status ===
              STATUS_ACESSO.CANCELADO
          ) {
            pararMonitoramento();

            sessionStorage.removeItem(
              'solicitacaoAcessoId',
            );

            setAguardando(false);
            setSolicitacaoId('');

            await sair();

            setErro(
              solicitacao.status ===
                STATUS_ACESSO.NEGADO
                ? 'O administrador negou sua solicitação de acesso.'
                : 'A solicitação foi cancelada.',
            );
          }
        } catch (error) {
          console.error(
            'Erro ao verificar solicitação:',
            error,
          );
        }
      },
      [
        navigate,
        pararMonitoramento,
      ],
    );

  /* ================================================
     MONITORAMENTO
  ================================================= */

  const iniciarMonitoramento =
    useCallback(
      (id, usuarioId) => {
        pararMonitoramento();

        void verificarSolicitacao(
          id,
          usuarioId,
        );

        intervaloRef.current =
          setInterval(() => {
            void verificarSolicitacao(
              id,
              usuarioId,
            );
          }, 3000);
      },
      [
        pararMonitoramento,
        verificarSolicitacao,
      ],
    );

  /* ================================================
     RESTAURA SOLICITAÇÃO EM ANDAMENTO
  ================================================= */

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (isAdmin) {
      navigate('/admin', {
        replace: true,
      });

      return;
    }

    if (
      user &&
      solicitacaoId
    ) {
      setAguardando(true);

      iniciarMonitoramento(
        solicitacaoId,
        user.id,
      );
    }
  }, [
    authLoading,
    user,
    isAdmin,
    solicitacaoId,
    iniciarMonitoramento,
    navigate,
  ]);

  useEffect(
    () => () =>
      pararMonitoramento(),
    [pararMonitoramento],
  );

  /* ================================================
     LOGIN
  ================================================= */

  const handleLogin = useCallback(
    async (event) => {
      event.preventDefault();

      setErro('');
      setLoading(true);

      /*
       * Toda tentativa nova deve possuir
       * uma nova solicitação.
       */
      sessionStorage.removeItem(
        'solicitacaoAcessoId',
      );

      try {
        /*
         * Login no Supabase
         */
        const usuario =
          await loginComSenha(
            email,
            senha,
          );

        /*
         * Verifica administrador
         */
        const perfil =
          await obterPerfil(
            usuario.id,
          );

        if (
          perfil?.regra === 'admin'
        ) {
          navigate('/admin', {
            replace: true,
          });

          return;
        }

        /*
         * USUÁRIO COMUM
         *
         * Não verificamos mais
         * usuarios_pops.
         *
         * Todo usuário autenticado
         * cria uma solicitação.
         */
        const solicitacao =
          await criarSolicitacao({
            userId: usuario.id,

            email:
              usuario.email ||
              email
                .trim()
                .toLowerCase(),
          });

        sessionStorage.setItem(
          'solicitacaoAcessoId',
          solicitacao.id,
        );

        setSolicitacaoId(
          solicitacao.id,
        );

        setAguardando(true);

        iniciarMonitoramento(
          solicitacao.id,
          usuario.id,
        );
      } catch (error) {
        console.error(
          'Erro ao realizar login:',
          error,
        );

        setErro(
          error?.message ||
            'E-mail ou senha inválidos.',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      email,
      senha,
      navigate,
      iniciarMonitoramento,
    ],
  );

  /* ================================================
     CANCELAR
  ================================================= */

  const handleCancelar =
    useCallback(async () => {
      pararMonitoramento();

      try {
        if (
          user &&
          solicitacaoId
        ) {
          await cancelarSolicitacao({
            id: solicitacaoId,
            userId: user.id,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        sessionStorage.removeItem(
          'solicitacaoAcessoId',
        );

        setSolicitacaoId('');
        setAguardando(false);
        setSenha('');

        await sair();
      }
    }, [
      user,
      solicitacaoId,
      pararMonitoramento,
    ]);

  /* ================================================
     AGUARDANDO ADMIN
  ================================================= */

  if (aguardando) {
    return (
      <div className="login-page">
        <section className="login-card login-card--waiting">

          <img
            src="/Logo_Pedrasplast.png"
            alt="Pedrasplast"
            className="login-logo"
          />

          <div className="waiting-icon">
            <FiClock />
          </div>

          <h1>
            Aguardando autorização
          </h1>

          <p>
            Seu login foi validado.
            A entrada será liberada
            quando o administrador
            aprovar.
          </p>

          <div className="waiting-status">

            <span className="waiting-spinner" />

            Solicitação pendente

          </div>

          <button
            type="button"
            className="btn btn-secondary login-full"
            onClick={handleCancelar}
          >
            <FiXCircle />

            Cancelar solicitação
          </button>

        </section>
      </div>
    );
  }

  /* ================================================
     LOGIN
  ================================================= */

  return (
    <div className="login-page">

      <form
        className="login-card"
        onSubmit={handleLogin}
      >

        <img
          src="/Logo_Pedrasplast.png"
          alt="Pedrasplast"
          className="login-logo"
        />

        <div className="login-heading-icon">
          <FiLogIn />
        </div>

        <h1>
          Acesso ao Portal
        </h1>

        <p>
          Entre com suas credenciais.
          Usuários comuns precisam
          de aprovação a cada login.
        </p>

        {erro && (
          <div className="login-error">
            {erro}
          </div>
        )}

        <div className="form-group">

          <label htmlFor="login-email">
            E-mail
          </label>

          <input
            id="login-email"
            className="form-control"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value,
              )
            }
            autoComplete="email"
            placeholder="seu-email@dominio.com"
            disabled={loading}
            required
          />

        </div>

        <div className="form-group">

          <label htmlFor="login-password">
            Senha
          </label>

          <input
            id="login-password"
            className="form-control"
            type="password"
            value={senha}
            onChange={(event) =>
              setSenha(
                event.target.value,
              )
            }
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={loading}
            required
          />

        </div>

        <button
          type="submit"
          className="btn btn-primary login-full"
          disabled={loading}
        >
          <FiCheckCircle />

          {loading
            ? 'Validando...'
            : 'Entrar / Solicitar acesso'}
        </button>

        <div className="login-register">

          <span>
            Primeiro acesso?
          </span>

          <Link to="/cadastro">
            Criar conta
          </Link>

        </div>

      </form>

    </div>
  );
}

export default Login;