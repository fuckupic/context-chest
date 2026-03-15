import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { ApiClient } from '../api/client';
import { deriveWrappingKey, generateMasterKey, wrapMasterKey, unwrapMasterKey } from '../crypto';

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const api = new ApiClient('');

      if (mode === 'register') {
        const result = await api.registerSimple(email, password);
        const token = result.token;
        api.setToken(token);

        const mk = generateMasterKey();
        const exportKeyBytes = hexToBytes(result.exportKey);
        const wrappingKey = await deriveWrappingKey(exportKeyBytes, result.userId);
        const wrappedMk = await wrapMasterKey(mk, wrappingKey);
        await api.putMasterKey(wrappedMk);
        localStorage.setItem('cc_wrapped_mk', wrappedMk);

        login(token, mk);
      } else {
        const result = await api.loginSimple(email, password);
        const token = result.token;
        api.setToken(token);

        const exportKeyBytes = hexToBytes(result.exportKey);
        const wrappingKey = await deriveWrappingKey(exportKeyBytes, result.userId);
        const wrappedMk = await api.getMasterKey();
        const mk = await unwrapMasterKey(wrappedMk, wrappingKey);
        localStorage.setItem('cc_wrapped_mk', wrappedMk);

        login(token, mk);
      }

      navigate('/memories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-vault-crust">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-vault-pink flex items-center justify-center text-vault-crust font-bold text-xs">
              CC
            </div>
          </Link>
          <h1 className="text-xl font-medium text-vault-text mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your vault'}
          </h1>
          <p className="text-vault-muted text-[13px]">
            {mode === 'login' ? 'Sign in to your encrypted vault' : 'Set up end-to-end encryption'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-vault-mantle rounded-xl border border-vault-border p-5 space-y-3">
          <div>
            <label className="block text-[11px] text-vault-muted mb-1 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-vault-surface border border-vault-border rounded-lg px-3 py-2 text-[13px] text-vault-text focus:outline-none focus:border-vault-pink/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] text-vault-muted mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-vault-surface border border-vault-border rounded-lg px-3 py-2 text-[13px] text-vault-text focus:outline-none focus:border-vault-pink/50 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-red-400 text-[12px]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-vault-pink text-vault-crust rounded-lg text-[13px] font-medium hover:bg-vault-pink-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <p className="text-center text-vault-muted text-[12px] pt-1">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button type="button" onClick={() => setMode('register')} className="text-vault-pink hover:underline">
                  Create one
                </button>
              </>
            ) : (
              <>
                Have an account?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-vault-pink hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
