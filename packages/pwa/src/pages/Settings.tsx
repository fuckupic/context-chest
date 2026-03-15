import { useAuth } from '../auth/context';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-lg font-medium mb-6 text-vault-text">Settings</h1>
      <div className="space-y-4">
        <div className="bg-vault-mantle rounded-lg border border-vault-border p-4">
          <h2 className="text-[10px] font-medium text-vault-muted uppercase tracking-wider mb-3">Encryption</h2>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-vault-subtext">Master Key</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
          </div>
          <p className="text-vault-muted text-[11px] mt-2 leading-relaxed">
            Your vault is encrypted with AES-256-GCM. The encryption key is derived on your device and never sent to the server.
          </p>
        </div>

        <div className="bg-vault-mantle rounded-lg border border-vault-border p-4">
          <h2 className="text-[10px] font-medium text-vault-muted uppercase tracking-wider mb-3">About</h2>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-vault-muted">Version</span>
              <span className="text-vault-subtext font-mono text-[11px]">0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-muted">License</span>
              <span className="text-vault-subtext">MIT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-muted">Source</span>
              <a
                href="https://github.com/fuckupic/context-chest"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vault-pink text-[11px] hover:underline"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-2 bg-vault-surface border border-vault-border text-vault-muted rounded-lg text-[13px] hover:text-red-400 hover:border-red-400/30 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
