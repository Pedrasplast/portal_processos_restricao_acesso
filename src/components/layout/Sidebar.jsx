import { FiFileText, FiFolder, FiHome, FiUsers, FiX } from 'react-icons/fi';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

function Sidebar({ open, onClose, pendentes = 0 }) {
  const { isAdmin } = useAuth();

  const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`;

  return (
    <>
      <div className={`sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} aria-hidden="true" />

      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Menu principal">
        <div className="sidebar__brand">
          <img className="sidebar__logo" src="/Logo_Pedrasplast.png" alt="Pedrasplast" />
          <button type="button" className="sidebar__close" onClick={onClose} aria-label="Fechar menu">
            <FiX />
          </button>
        </div>

        <p className="sidebar__produto">Portal de Processos</p>

        <nav className="sidebar__nav">
          <div className="sidebar__grupo">
            <span className="sidebar__titulo">Consulta</span>

            <NavLink to="/" end className={linkClass} onClick={onClose}>
              <FiHome />
              <span>Início</span>
            </NavLink>

            <NavLink to="/pops" className={linkClass} onClick={onClose}>
              <FiFolder />
              <span>Repositório</span>
            </NavLink>
          </div>

          {isAdmin && (
            <div className="sidebar__grupo">
              <span className="sidebar__titulo">Administração</span>

              <NavLink to="/admin/documentos" className={linkClass} onClick={onClose}>
                <FiFileText />
                <span>Documentos</span>
              </NavLink>

              <NavLink to="/admin/usuarios" className={linkClass} onClick={onClose}>
                <FiUsers />
                <span>Usuários</span>
                {pendentes > 0 && (
                  <strong
                    className="sidebar-link__contador"
                    title={`${pendentes} pedido(s) de acesso aguardando aprovação`}
                  >
                    {pendentes}
                  </strong>
                )}
              </NavLink>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
