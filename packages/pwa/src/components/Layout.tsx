import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';

const navItems = [
  { to: '/memories', label: 'Memories', icon: 'M' },
  { to: '/agents', label: 'Agents', icon: 'A' },
  { to: '/sessions', label: 'Sessions', icon: 'S' },
  { to: '/settings', label: 'Settings', icon: 'G' },
];

export function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const currentPage = navItems.find((i) => location.pathname.startsWith(i.to))?.label ?? '';

  return (
    <div className="flex flex-col h-screen bg-vault-base">
      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — narrow, icon + label, Obsidian-style */}
        <aside className="w-48 bg-vault-mantle flex flex-col border-r border-vault-border shrink-0">
          {/* Logo */}
          <div className="px-3 py-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-vault-pink flex items-center justify-center text-vault-crust font-bold text-[10px]">
              CC
            </div>
            <span className="text-sm font-medium text-vault-text">Context Chest</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-1.5 mt-1 space-y-px">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[13px] transition-all duration-150 ${
                    isActive
                      ? 'bg-vault-pink-glow text-vault-pink'
                      : 'text-vault-muted hover:text-vault-subtext hover:bg-vault-surface/50'
                  }`
                }
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-medium ${
                  location.pathname.startsWith(item.to)
                    ? 'bg-vault-pink/15 text-vault-pink'
                    : 'bg-vault-surface text-vault-muted'
                }`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Bottom */}
          <div className="px-3 py-2 border-t border-vault-border">
            <button
              onClick={logout}
              className="text-[11px] text-vault-muted hover:text-vault-pink transition-colors"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-vault-base">
          <Outlet />
        </main>
      </div>

      {/* Status bar — Obsidian-style */}
      <div className="h-6 bg-vault-mantle border-t border-vault-border flex items-center px-3 shrink-0">
        <span className="text-[10px] text-vault-muted font-mono">{currentPage}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-vault-muted font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            connected
          </span>
          <span className="text-[10px] text-vault-muted font-mono">v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
