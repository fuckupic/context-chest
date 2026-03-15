import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/context';

const navItems = [
  { to: '/memories', label: 'Memories', icon: '🗂' },
  { to: '/agents', label: 'Agents', icon: '🤖' },
  { to: '/sessions', label: 'Sessions', icon: '💬' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-vault-bg">
      <aside className="w-56 bg-vault-surface flex flex-col border-r border-vault-border">
        <div className="px-4 py-5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-vault-gold to-vault-gold-dim flex items-center justify-center text-vault-bg font-bold text-xs">
            CC
          </div>
          <span className="font-display text-base text-white">Context Chest</span>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-vault-gold/10 text-vault-gold border border-vault-gold/20'
                    : 'text-vault-muted hover:text-white hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-vault-border">
          <button
            onClick={logout}
            className="text-xs text-vault-muted hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
