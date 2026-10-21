import AppLayout from '../../components/layout/AppLayout';
import UsersPanel from './components/UsersPanel';
import './Admin.css';

function UsuariosAdmin() {
  return (
    <AppLayout titulo="Administração">
      <header className="page-header">
        <div>
          <h1>Gerenciar usuários</h1>
          <p>Aprove pedidos de acesso, convide pessoas e controle quem pode consultar o portal.</p>
        </div>
      </header>

      <UsersPanel />
    </AppLayout>
  );
}

export default UsuariosAdmin;
