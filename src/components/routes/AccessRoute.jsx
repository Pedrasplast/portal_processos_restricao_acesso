import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { obterSolicitacao, STATUS_ACESSO } from '../../services/solicitacoesService';
import PageLoader from '../feedback/PageLoader';

function AccessRoute({ children }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('carregando');

  useEffect(() => {
    let ativo = true;

    async function validar() {
      if (authLoading) return;
      if (ativo) setStatus('carregando');

      if (!user) {
        if (ativo) setStatus('bloqueado');
        return;
      }

      if (isAdmin) {
        if (ativo) setStatus('liberado');
        return;
      }

      const solicitacaoId = sessionStorage.getItem('solicitacaoAcessoId');
      if (!solicitacaoId) {
        if (ativo) setStatus('bloqueado');
        return;
      }

      try {
        const solicitacao = await obterSolicitacao({
          id: solicitacaoId,
          userId: user.id,
        });

        if (!ativo) return;

        setStatus(
          solicitacao?.status === STATUS_ACESSO.APROVADO ? 'liberado' : 'bloqueado',
        );
      } catch {
        if (ativo) setStatus('bloqueado');
      }
    }

    void validar();
    return () => {
      ativo = false;
    };
  }, [authLoading, user, isAdmin]);

  if (authLoading || status === 'carregando') {
    return <PageLoader texto="Verificando autorização..." />;
  }

  if (status !== 'liberado') return <Navigate to="/login" replace />;
  return children;
}

export default AccessRoute;
