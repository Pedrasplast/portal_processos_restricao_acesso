import { useCallback, useState } from 'react';

import AppLayout from '../../components/layout/AppLayout';
import { useDocumentos } from '../../hooks/useDocumentos';
import { useMensagem } from '../../hooks/useMensagem';
import { usePolling } from '../../hooks/usePolling';
import { contarPendentes } from '../../services/solicitacoesService';
import AccessRequestsPanel from './components/AccessRequestsPanel';
import AdminTabs from './components/AdminTabs';
import DocumentsPanel from './components/DocumentsPanel';
import UsersPanel from './components/UsersPanel';
import './Admin.css';

/*
 * Uma única verificação periódica no painel: a contagem de pendentes
 * (resposta de 1 número). A lista de solicitações só é recarregada
 * quando essa contagem muda ou quando o admin clica em "Atualizar".
 */
const INTERVALO_PENDENTES = 10000;

function Admin() {
  const [tab, setTab] = useState('documentos');
  const [pendentes, setPendentes] = useState(0);
  const { documentos, loading, erro, recarregar } = useDocumentos();
  const { mensagem, mostrarMensagem } = useMensagem();

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

      {mensagem.texto && <div className={`alert ${mensagem.tipo}`}>{mensagem.texto}</div>}

      {tab === 'documentos' && (
        <DocumentsPanel
          documentos={documentos}
          loading={loading}
          erro={erro}
          onReload={recarregar}
          notify={mostrarMensagem}
        />
      )}

      {tab === 'usuarios' && <UsersPanel notify={mostrarMensagem} onChanged={atualizarPendentes} />}

      {tab === 'solicitacoes' && (
        <AccessRequestsPanel
          notify={mostrarMensagem}
          pendingCount={pendentes}
          onChanged={atualizarPendentes}
        />
      )}
    </AppLayout>
  );
}

export default Admin;
