import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { usePolling } from '../../hooks/usePolling';
import { contarPendentes } from '../../services/solicitacoesService';
import Navbar from './Navbar';
import Rodape from './Rodape';
import Sidebar from './Sidebar';
import './Layout.css';

/*
 * Contador de pedidos de acesso pendentes, visível para o admin na
 * sidebar e usado pela página de usuários. Uma única consulta leve
 * (1 número) a cada 15 s, só com a aba visível e só para admin.
 */
const INTERVALO_PENDENTES = 15000;

const LayoutContext = createContext({ pendentes: 0, atualizarPendentes: async () => {} });

export function useLayout() {
  return useContext(LayoutContext);
}

function AppLayout({ children, titulo }) {
  const { isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendentes, setPendentes] = useState(0);

  const atualizarPendentes = useCallback(async () => {
    try {
      setPendentes(await contarPendentes());
    } catch (error) {
      console.error(error);
    }
  }, []);

  usePolling(atualizarPendentes, INTERVALO_PENDENTES, { ativo: isAdmin });

  const contexto = useMemo(() => ({ pendentes, atualizarPendentes }), [pendentes, atualizarPendentes]);

  return (
    <LayoutContext.Provider value={contexto}>
      <div className="app-shell">
        <a className="pular-conteudo" href="#conteudo">Ir para o conteúdo</a>

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} pendentes={pendentes} />

        <div className="app-shell__main">
          <Navbar onMenu={() => setSidebarOpen(true)} titulo={titulo} />
          <main id="conteudo" className="app-content">
            {children}
          </main>
          <Rodape />
        </div>
      </div>
    </LayoutContext.Provider>
  );
}

export default AppLayout;
