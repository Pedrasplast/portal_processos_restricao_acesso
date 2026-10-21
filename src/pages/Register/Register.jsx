import { useEffect, useState } from 'react';
import {
    FiArrowLeft,
    FiCheckCircle,
    FiAlertTriangle,
    FiLink,
    FiUserPlus,
} from 'react-icons/fi';

import { Link, useSearchParams } from 'react-router-dom';

import {
    cadastrarConta,
    sair,
} from '../../services/authService';
import { validarConvite } from '../../services/convitesService';

import './Register.css';

function Register() {
    const [form, setForm] = useState({
        nome: '',
        email: '',
        senha: '',
        confirmarSenha: '',
    });

    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');

    /*
     * Link de convite (/cadastro?convite=TOKEN): quem se cadastra por um
     * convite válido já entra liberado, sem aprovação do administrador.
     */
    const [searchParams] = useSearchParams();
    const tokenConvite = searchParams.get('convite') || '';
    const [convite, setConvite] = useState({
        situacao: tokenConvite ? 'verificando' : 'sem',
        email: null,
    });

    useEffect(() => {
        if (!tokenConvite) return undefined;
        let ativo = true;

        validarConvite(tokenConvite)
            .then((resultado) => {
                if (!ativo) return;
                setConvite({
                    situacao: resultado.valido ? 'valido' : 'invalido',
                    email: resultado.email || null,
                });
                if (resultado.valido && resultado.email) {
                    setForm((anterior) => ({ ...anterior, email: resultado.email }));
                }
            })
            .catch(() => {
                if (ativo) setConvite({ situacao: 'invalido', email: null });
            });

        return () => {
            ativo = false;
        };
    }, [tokenConvite]);

    const conviteValido = convite.situacao === 'valido';

    function atualizarCampo(campo, valor) {
        setForm((anterior) => ({
            ...anterior,
            [campo]: valor,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        setErro('');
        setSucesso('');

        const nome = form.nome.trim();

        const email = form.email
            .trim()
            .toLowerCase();

        if (nome.length < 3) {
            setErro(
                'Informe o nome completo do usuário.',
            );

            return;
        }

        if (form.senha.length < 6) {
            setErro(
                'A senha deve possuir pelo menos 6 caracteres.',
            );

            return;
        }

        if (
            form.senha !==
            form.confirmarSenha
        ) {
            setErro(
                'As senhas informadas não são iguais.',
            );

            return;
        }

        setLoading(true);

        try {
            const resultado =
                await cadastrarConta({
                    nome,
                    email,
                    senha: form.senha,
                    convite: conviteValido ? tokenConvite : null,
                });

            /*
             * Quando a confirmação de e-mail
             * está desativada, o Supabase pode
             * criar uma sessão imediatamente.
             *
             * Encerramos essa sessão para
             * garantir que o próximo passo seja
             * sempre o login normal + aprovação
             * do administrador.
             */
            if (resultado.session) {
                await sair();
            }

            const precisaConfirmar = resultado.user && !resultado.session;
            const proximoPasso = conviteValido
                ? 'Seu acesso já está liberado pelo convite.'
                : 'No primeiro login, sua solicitação será enviada ao administrador.';

            setSucesso(
                precisaConfirmar
                    ? `Cadastro realizado com sucesso. Verifique seu e-mail para confirmar a conta e depois faça o login. ${proximoPasso}`
                    : `Cadastro realizado com sucesso. Agora faça o login. ${proximoPasso}`,
            );

            if (conviteValido) setConvite({ situacao: 'usado', email: null });

            setForm({
                nome: '',
                email: '',
                senha: '',
                confirmarSenha: '',
            });
        } catch (error) {
            const mensagem = String(
                error?.message || '',
            ).toLowerCase();

            if (
                mensagem.includes(
                    'already registered',
                ) ||
                mensagem.includes(
                    'already been registered',
                )
            ) {
                setErro(
                    'Este e-mail já possui cadastro. Volte para a tela de login.',
                );
            } else if (
                mensagem.includes('password')
            ) {
                setErro(
                    'A senha informada não atende aos requisitos do Supabase.',
                );
            } else {
                setErro(
                    error?.message ||
                    'Não foi possível criar o usuário.',
                );
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="register-page">
            <form
                className="register-card"
                onSubmit={handleSubmit}
            >
                <img
                    src="/Logo_Pedrasplast.png"
                    alt="Pedrasplast"
                    className="register-logo"
                />

                <div className="register-heading-icon">
                    <FiUserPlus />
                </div>

                <h1>Criar Conta</h1>

                <p>
                    {conviteValido
                        ? 'Você recebeu um convite para o Portal de Processos. Preencha seus dados para criar a conta.'
                        : 'Cadastre seu acesso ao Portal. A criação da conta não libera os documentos automaticamente: no primeiro login, o administrador precisa aprovar sua entrada.'}
                </p>

                {conviteValido && (
                    <div className="register-message register-message--success">
                        <FiLink />
                        <span>
                            Convite válido: ao criar a conta, seu acesso já estará liberado.
                            {convite.email && ' Use o e-mail indicado no convite.'}
                        </span>
                    </div>
                )}

                {convite.situacao === 'invalido' && (
                    <div className="register-message register-message--error">
                        <FiAlertTriangle />
                        <span>
                            Este link de convite é inválido, já foi usado ou expirou.
                            Você pode criar a conta mesmo assim, mas o administrador
                            precisará aprovar seu acesso.
                        </span>
                    </div>
                )}

                {erro && (
                    <div className="register-message register-message--error">
                        {erro}
                    </div>
                )}

                {sucesso && (
                    <div className="register-message register-message--success">
                        <FiCheckCircle />

                        <span>
                            {sucesso}
                        </span>
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="register-name">
                        Nome completo
                    </label>

                    <input
                        id="register-name"
                        className="form-control"
                        type="text"
                        value={form.nome}
                        onChange={(event) =>
                            atualizarCampo(
                                'nome',
                                event.target.value,
                            )
                        }
                        placeholder="Ex.: João da Silva"
                        autoComplete="name"
                        disabled={loading}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="register-email">
                        E-mail
                    </label>

                    <input
                        id="register-email"
                        className="form-control"
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                            atualizarCampo(
                                'email',
                                event.target.value,
                            )
                        }
                        placeholder="seu-email@dominio.com"
                        autoComplete="email"
                        disabled={loading}
                        readOnly={conviteValido && Boolean(convite.email)}
                        required
                    />
                </div>

                <div className="register-password-grid">
                    <div className="form-group">
                        <label htmlFor="register-password">
                            Senha
                        </label>

                        <input
                            id="register-password"
                            className="form-control"
                            type="password"
                            value={form.senha}
                            onChange={(event) =>
                                atualizarCampo(
                                    'senha',
                                    event.target.value,
                                )
                            }
                            placeholder="Mínimo 6 caracteres"
                            autoComplete="new-password"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="register-password-confirm">
                            Confirmar senha
                        </label>

                        <input
                            id="register-password-confirm"
                            className="form-control"
                            type="password"
                            value={form.confirmarSenha}
                            onChange={(event) =>
                                atualizarCampo(
                                    'confirmarSenha',
                                    event.target.value,
                                )
                            }
                            placeholder="Repita sua senha"
                            autoComplete="new-password"
                            disabled={loading}
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary register-full"
                    disabled={loading}
                >
                    <FiUserPlus />

                    {loading
                        ? 'Criando conta...'
                        : 'Criar minha conta'}
                </button>

                <Link
                    to="/login"
                    className="btn btn-secondary register-full register-back"
                >
                    <FiArrowLeft />
                    Voltar para o login
                </Link>
            </form>
        </div>
    );
}

export default Register;