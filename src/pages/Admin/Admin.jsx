import { useCallback, useState } from 'react';

import AppLayout from '../../components/layout/AppLayout';
import { useDocumentos } from '../../hooks/useDocumentos';
import { usePolling } from '../../hooks/usePolling';
import { contarPendentes } from '../../services/solicitacoesService';
import AdminTabs from './components/AdminTabs';
import DocumentsPanel from './components/DocumentsPanel';
import UsersPanel from './components/UsersPanel';
import './Admin.css';

/*
 * Uma única verificação periódica no painel: a contagem de pedidos
 * pendentes (resposta de 1 número), exibida na aba Usuários. A lista de
 * usuários só recarrega quando essa contagem muda ou no "Atualizar".
 */
const INTERVALO_PENDENTES = 10000;

function Admin() {
  const [tab, setTab] = useState('documentos');
  const [pendentes, setPendentes] = useState(0);
  const { documentos, loading, erro, recarregar } = useDocumentos();

  const atualizarPendentes = useCallback(async () => {
    try {
      setPendentes(await contarPendentes());
    } catch (error) {
      console.error(error);
    }
  }, []);

  usePolling(atualizarPendentes, INTERVALO_PENDENTES);

  return (
    <AppLayout>
      <header className="page-header">
        <h2>Painel Administrativo</h2>
        <p>Gerenciamento de documentos, usuários e liberações de acesso.</p>
      </header>

      <AdminTabs tab={tab} onChange={setTab} pendingCount={pendentes} />

      {tab === 'documentos' && (
        <DocumentsPanel documentos={documentos} loading={loading} erro={erro} onReload={recarregar} />
      )}

      {tab === 'usuarios' && <UsersPanel pendingCount={pendentes} onChanged={atualizarPendentes} />}
    </AppLayout>
  );
}

export default Admin;
