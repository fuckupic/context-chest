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
    <div className="min-h-screen flex items-center justify-center bg-cc-black relative">
      <div className="fixed inset-0 dither-bg pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <img src="/chest-white.png" alt="" className="w-12 h-12 mx-auto" style={{ imageRendering: 'auto' }} />
          </Link>
          <h1 className="font-pixel text-2xl text-cc-white tracking-wide mb-1">
            {mode === 'login' ? 'SIGN IN' : 'CREATE VAULT'}
          </h1>
          <p className="text-cc-muted text-xs">
            {mode === 'login' ? 'Access your encrypted memories' : 'Set up end-to-end encryption'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="border-2 border-cc-border bg-cc-dark p-5 space-y-4">
          <div>
            <label className="block font-pixel text-[10px] text-cc-muted tracking-wider mb-1.5">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-cc-black border-2 border-cc-border px-3 py-2 text-sm text-cc-white focus:outline-none focus:border-cc-pink transition-colors"
            />
          </div>
          <div>
            <label className="block font-pixel text-[10px] text-cc-muted tracking-wider mb-1.5">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-cc-black border-2 border-cc-border px-3 py-2 text-sm text-cc-white focus:outline-none focus:border-cc-pink transition-colors"
            />
          </div>

          {error && (
            <div className="border-2 border-red-500/30 bg-red-500/5 p-2.5 text-red-400 text-xs">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-cc-pink text-cc-black font-pixel text-sm tracking-wider hover:bg-cc-pink-dim transition-colors disabled:opacity-50"
          >
            {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'ENTER' : 'CREATE'}
          </button>

          <p className="text-center text-cc-muted text-xs">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button type="button" onClick={() => setMode('register')} className="text-cc-pink hover:underline">
                  Create one
                </button>
              </>
            ) : (
              <>
                Have an account?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-cc-pink hover:underline">
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
