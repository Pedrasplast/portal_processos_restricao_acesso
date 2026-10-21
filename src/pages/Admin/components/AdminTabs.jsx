import { FiFileText, FiUsers } from 'react-icons/fi';

const TABS = [
  { id: 'documentos', label: 'Gerenciar Documentos', icon: FiFileText },
  { id: 'usuarios', label: 'Usuários', icon: FiUsers },
];

function AdminTabs({ tab, onChange, pendingCount }) {
  return (
    <div className="admin-tabs">
      {TABS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`admin-tab${tab === item.id ? ' active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            <Icon />
            <span>{item.label}</span>
            {item.id === 'usuarios' && pendingCount > 0 && (
              <strong
                className="admin-tab__badge"
                title={`${pendingCount} pedido(s) de acesso aguardando aprovação`}
              >
                {pendingCount}
              </strong>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AdminTabs;
