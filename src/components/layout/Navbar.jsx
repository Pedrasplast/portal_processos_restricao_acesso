import { FiLogOut, FiMenu } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { nomeExibicao, nomePorEmail } from '../../utils/texto';

function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${primeira}${ultima}`.toUpperCase();
}

function Navbar({ onMenu, titulo }) {
  const navigate = useNavigate();
  const { user, profile, isAdmin, logout } = useAuth();

  const nome = profile?.nome ? nomeExibicao(profile.nome) : nomePorEmail(user?.email || '');

  async function handleSair() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="topbar__menu" type="button" onClick={onMenu} aria-label="Abrir menu">
          <FiMenu />
        </button>
        <img className="topbar__logo" src="/Logo_Pedrasplast.png" alt="Pedrasplast" />
        {titulo && <span className="topbar__titulo">{titulo}</span>}
      </div>

      {user && (
        <div className="topbar__right">
          <div className="topbar__user">
            <span className="topbar__avatar" aria-hidden="true">{iniciais(nome)}</span>
            <span className="topbar__identidade">
              <strong>{nome}</strong>
              <small>{isAdmin ? 'Administrador' : 'Usuário'}</small>
            </span>
          </div>

          <button type="button" className="btn btn-ghost topbar__sair" onClick={handleSair}>
            <FiLogOut />
            <span>Sair</span>
          </button>
        </div>
      )}
    </header>
  );
}

export default Navbar;
