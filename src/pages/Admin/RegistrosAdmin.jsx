import AppLayout from '../../components/layout/AppLayout';
import RegistrosPanel from './components/registros/RegistrosPanel';
import './Admin.css';
import './Registros.css';

function RegistrosAdmin() {
  return (
    <AppLayout titulo="Administração">
      <RegistrosPanel />
    </AppLayout>
  );
}

export default RegistrosAdmin;
