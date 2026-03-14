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
      <h1 className="text-xl font-bold mb-6">Settings</h1>
      <div className="space-y-6">
        <div className="bg-vault-surface rounded-lg p-4">
          <h2 className="text-sm font-medium text-vault-muted uppercase mb-3">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-vault-muted">Email</span>
              <span>Loaded from session</span>
            </div>
          </div>
        </div>
        <div className="bg-vault-surface rounded-lg p-4">
          <h2 className="text-sm font-medium text-vault-muted uppercase mb-3">Encryption</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-vault-muted">Master Key</span>
              <span className="text-green-400">Active</span>
            </div>
            <p className="text-vault-muted text-xs mt-2">
              Your vault is encrypted with AES-256-GCM. The encryption key never leaves your device.
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
