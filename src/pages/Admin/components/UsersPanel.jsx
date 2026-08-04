import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FiRefreshCw,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi';

import {
  atualizarStatus,
  listarSolicitacoes,
  STATUS_ACESSO,
} from '../../../services/solicitacoesService';

/*
 * Formata a data de aprovação para exibição.
 */
function formatarData(valor) {
  if (!valor) {
    return '—';
  }

  const data = new Date(valor);

  if (
    Number.isNaN(
      data.getTime(),
    )
  ) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(data);
}

function UsersPanel({
  notify,
}) {
  const [
    solicitacoes,
    setSolicitacoes,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    processandoId,
    setProcessandoId,
  ] = useState(null);

  /*
   * Carrega as solicitações de acesso.
   */
  const carregarUsuarios =
    useCallback(
      async (
        silencioso = false,
      ) => {
        if (!silencioso) {
          setLoading(true);
        }

        try {
          const dados =
            await listarSolicitacoes();

          setSolicitacoes(
            dados,
          );
        } catch (error) {
          if (!silencioso) {
            notify(
              'erro',
              `Erro ao carregar usuários autorizados: ${
                error.message ||
                'erro desconhecido'
              }`,
            );
          }
        } finally {
          if (!silencioso) {
            setLoading(false);
          }
        }
      },
      [notify],
    );

  useEffect(() => {
    void carregarUsuarios();

    /*
     * Atualiza automaticamente a lista
     * a cada 10 segundos.
     */
    const intervalo =
      setInterval(() => {
        void carregarUsuarios(
          true,
        );
      }, 10000);

    return () => {
      clearInterval(
        intervalo,
      );
    };
  }, [carregarUsuarios]);

  /*
   * Um mesmo usuário pode possuir várias
   * solicitações aprovadas, pois o sistema
   * cria uma solicitação a cada login.
   *
   * Aqui agrupamos todas as solicitações
   * aprovadas pelo usuário ou pelo e-mail.
   */
  const usuariosAutorizados =
    useMemo(() => {
      const mapa = new Map();

      solicitacoes
        .filter(
          (solicitacao) =>
            solicitacao.status ===
            STATUS_ACESSO.APROVADO,
        )
        .forEach(
          (solicitacao) => {
            const email =
              String(
                solicitacao.email ||
                  '',
              )
                .trim()
                .toLowerCase();

            const chave =
              solicitacao.user_id ||
              email;

            if (!chave) {
              return;
            }

            const dataAprovacao =
              solicitacao.aprovado_em ||
              solicitacao.criado_em ||
              null;

            const existente =
              mapa.get(chave);

            if (!existente) {
              mapa.set(
                chave,
                {
                  id: chave,

                  userId:
                    solicitacao.user_id,

                  email:
                    email ||
                    'E-mail não informado',

                  ultimaAprovacao:
                    dataAprovacao,

                  solicitacaoIds: [
                    solicitacao.id,
                  ],
                },
              );

              return;
            }

            existente.solicitacaoIds.push(
              solicitacao.id,
            );

            const dataExistente =
              new Date(
                existente.ultimaAprovacao ||
                  0,
              );

            const novaData =
              new Date(
                dataAprovacao ||
                  0,
              );

            if (
              novaData >
              dataExistente
            ) {
              existente.ultimaAprovacao =
                dataAprovacao;
            }
          },
        );

      return Array.from(
        mapa.values(),
      ).sort(
        (a, b) =>
          String(
            a.email,
          ).localeCompare(
            String(
              b.email,
            ),
            'pt-BR',
          ),
      );
    }, [solicitacoes]);

  /*
   * Revoga todas as solicitações aprovadas
   * daquele usuário.
   */
  async function revogarAcesso(
    usuario,
  ) {
    const confirmar =
      window.confirm(
        `Deseja realmente revogar o acesso de ${usuario.email}?`,
      );

    if (!confirmar) {
      return;
    }

    setProcessandoId(
      usuario.id,
    );

    try {
      /*
       * Pode existir mais de uma solicitação
       * aprovada para o mesmo usuário.
       */
      await Promise.all(
        usuario.solicitacaoIds.map(
          (solicitacaoId) =>
            atualizarStatus(
              solicitacaoId,
              STATUS_ACESSO.CANCELADO,
            ),
        ),
      );

      notify(
        'sucesso',
        `Acesso de ${usuario.email} revogado com sucesso.`,
      );

      await carregarUsuarios(
        true,
      );
    } catch (error) {
      notify(
        'erro',
        `Erro ao revogar acesso: ${
          error.message ||
          'erro desconhecido'
        }`,
      );
    } finally {
      setProcessandoId(
        null,
      );
    }
  }

  return (
    <div className="admin-stack">
      <section className="admin-card">
        <div className="admin-card__header admin-card__header--actions">
          <div>
            <h3>
              <FiUsers />

              Usuários Autorizados
            </h3>

            <p>
              Usuários que possuem uma
              solicitação de acesso aprovada.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              carregarUsuarios()
            }
            disabled={loading}
          >
            <FiRefreshCw />

            Atualizar
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>E-mail</th>

                <th>
                  Última aprovação
                </th>

                <th>
                  Acessos aprovados
                </th>

                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="4"
                    className="empty-state"
                  >
                    Carregando usuários
                    autorizados...
                  </td>
                </tr>
              ) : usuariosAutorizados.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="empty-state"
                  >
                    Nenhum usuário possui
                    acesso aprovado.
                  </td>
                </tr>
              ) : (
                usuariosAutorizados.map(
                  (usuario) => {
                    const processando =
                      processandoId ===
                      usuario.id;

                    return (
                      <tr
                        key={
                          usuario.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              usuario.email
                            }
                          </strong>
                        </td>

                        <td>
                          {formatarData(
                            usuario.ultimaAprovacao,
                          )}
                        </td>

                        <td>
                          {
                            usuario
                              .solicitacaoIds
                              .length
                          }
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={
                              processando
                            }
                            onClick={() =>
                              revogarAcesso(
                                usuario,
                              )
                            }
                          >
                            <FiTrash2 />

                            {processando
                              ? 'Revogando...'
                              : 'Revogar acesso'}
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default UsersPanel;