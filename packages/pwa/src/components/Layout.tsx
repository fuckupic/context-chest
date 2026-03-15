import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';

const navItems = [
  { to: '/memories', label: 'MEMORIES' },
  { to: '/agents', label: 'AGENTS' },
  { to: '/sessions', label: 'SESSIONS' },
  { to: '/settings', label: 'SETTINGS' },
];

export function Layout() {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-cc-black">
      {/* Sidebar */}
      <aside className="w-52 bg-cc-dark flex flex-col border-r-2 border-cc-border shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b-2 border-cc-border">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-7 h-7" style={{ imageRendering: 'auto' }} />
            <span className="font-pixel text-lg text-cc-white tracking-wide">Context Chest</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`block px-4 py-2 font-pixel text-sm tracking-wider transition-colors border-l-2 ${
                  active
                    ? 'border-cc-pink text-cc-pink bg-cc-pink-glow'
                    : 'border-transparent text-cc-muted hover:text-cc-white hover:bg-cc-surface'
                }`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Feedback */}
        <a
          href="https://www.feedsea.com/submit/feedback/ad2ca0f3-23df-4362-8e95-5778ca3a85ac"
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-2 font-pixel text-sm tracking-wider text-cc-muted hover:text-cc-pink border-l-2 border-transparent hover:bg-cc-surface transition-colors"
        >
          FEEDBACK
        </a>

        {/* Footer */}
        <div className="px-4 py-3 border-t-2 border-cc-border flex items-center justify-between">
          <span className="font-pixel text-[10px] text-cc-muted tracking-wider">V0.1.0</span>
          <button
            onClick={logout}
            className="font-pixel text-[10px] text-cc-muted hover:text-cc-pink tracking-wider transition-colors"
          >
            EXIT
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
