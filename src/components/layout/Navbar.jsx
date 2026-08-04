import { FiLogIn, FiLogOut, FiMenu, FiUser } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { nomePorEmail } from '../../utils/texto';
import './Navbar.css';

function Navbar({ onMenu }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleAuth() {
    if (!user) {
      navigate('/login');
      return;
    }

    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="topbar__menu" type="button" onClick={onMenu} aria-label="Abrir menu">
          <FiMenu />
        </button>
        <img className='logo' src="/Logo_Pedrasplast.png" alt="Pedrasplast" />
      </div>

      <div className="topbar__right">
        {user && (
          <div className="topbar__user">
            <span className="topbar__avatar" aria-hidden="true">
              <FiUser />
            </span>
            <span className="topbar__user-name">{nomePorEmail(user.email)}</span>
          </div>
        )}

        <button
          type="button"
          className="topbar__auth"
          onClick={handleAuth}
          aria-label={user ? 'Sair do sistema' : 'Entrar no sistema'}
        >
          {user ? <FiLogOut /> : <FiLogIn />}
        </button>
      </div>
    </header>
  );
}

export default Navbar;
