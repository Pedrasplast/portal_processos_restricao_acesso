import { Navigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import PageLoader from '../feedback/PageLoader';

/*
 * O status de acesso vem do AuthContext (1 consulta por login), não de
 * uma nova consulta a cada troca de página. A proteção real dos dados
 * está no banco (RLS): mesmo burlando esta tela, nada é retornado.
 */
function AccessRoute({ children }) {
  const { user, acessoLiberado, loading } = useAuth();

  if (loading) return <PageLoader texto="Verificando autorização..." />;
  if (!user || !acessoLiberado) return <Navigate to="/login" replace />;

  return children;
}

export default AccessRoute;
