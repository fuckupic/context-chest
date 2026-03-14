import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/memories', label: 'Memories', icon: '🗂' },
  { to: '/agents', label: 'Connected Agents', icon: '🤖' },
  { to: '/sessions', label: 'Sessions', icon: '💬' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Layout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-vault-surface flex flex-col border-r border-white/10">
        <div className="px-4 py-5">
          <span className="text-vault-accent font-bold text-lg">Context Chest</span>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-vault-accent/15 text-white'
                    : 'text-vault-muted hover:text-white hover:bg-white/5'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 text-vault-muted text-xs">
          Free tier
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
