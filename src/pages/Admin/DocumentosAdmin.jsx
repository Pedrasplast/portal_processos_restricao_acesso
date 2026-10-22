import AppLayout from '../../components/layout/AppLayout';
import { useDocumentos } from '../../hooks/useDocumentos';
import DocumentsPanel from './components/DocumentsPanel';
import './Admin.css';

function DocumentosAdmin() {
  const { documentos, loading, erro, recarregar } = useDocumentos();

  return (
    <AppLayout titulo="Administração">
      <DocumentsPanel documentos={documentos} loading={loading} erro={erro} onReload={recarregar} />
    </AppLayout>
  );
}

export default DocumentosAdmin;
