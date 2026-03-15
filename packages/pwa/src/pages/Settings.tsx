import { useAuth } from '../auth/context';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="font-pixel text-xl text-cc-white tracking-wider mb-6">SETTINGS</h1>
      <div className="space-y-4">
        <div className="border-2 border-cc-border bg-cc-dark p-4">
          <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">ENCRYPTION</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cc-sub">Master Key</span>
            <span className="inline-flex items-center gap-1.5 font-pixel text-[10px] text-green-400 tracking-wider">
              <span className="w-1.5 h-1.5 bg-green-400" />
              ACTIVE
            </span>
          </div>
          <p className="text-cc-muted text-[11px] leading-relaxed">
            AES-256-GCM encryption. Key derived on your device, never sent to server.
          </p>
        </div>

        <div className="border-2 border-cc-border bg-cc-dark p-4">
          <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">ABOUT</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-cc-muted">Version</span>
              <span className="font-mono text-[11px] text-cc-sub">0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cc-muted">License</span>
              <span className="text-cc-sub">MIT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cc-muted">Source</span>
              <a href="https://github.com/fuckupic/context-chest" target="_blank" rel="noopener noreferrer" className="text-cc-pink text-[11px] hover:underline">GITHUB</a>
            </div>
          </div>
        </div>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full py-2.5 border-2 border-cc-border bg-cc-dark text-cc-muted font-pixel text-xs tracking-wider hover:text-red-400 hover:border-red-400/30 transition-colors"
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}
