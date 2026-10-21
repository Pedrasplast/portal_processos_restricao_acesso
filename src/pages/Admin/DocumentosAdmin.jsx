import AppLayout from '../../components/layout/AppLayout';
import { useDocumentos } from '../../hooks/useDocumentos';
import DocumentsPanel from './components/DocumentsPanel';
import './Admin.css';

function DocumentosAdmin() {
  const { documentos, loading, erro, recarregar } = useDocumentos();

  return (
    <AppLayout titulo="Administração">
      <header className="page-header">
        <div>
          <h1>Gerenciar documentos</h1>
          <p>Publique POPs, Fluxogramas e Manuais e acompanhe o que falta em cada processo.</p>
        </div>
      </header>

      <DocumentsPanel documentos={documentos} loading={loading} erro={erro} onReload={recarregar} />
    </AppLayout>
  );
}

export default DocumentosAdmin;
