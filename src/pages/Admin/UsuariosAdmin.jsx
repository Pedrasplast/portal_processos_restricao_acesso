import AppLayout from '../../components/layout/AppLayout';
import UsersPanel from './components/UsersPanel';
import './Admin.css';

function UsuariosAdmin() {
  return (
    <AppLayout titulo="Administração">
      <UsersPanel />
    </AppLayout>
  );
}

export default UsuariosAdmin;
