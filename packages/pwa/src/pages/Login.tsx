import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { ApiClient } from '../api/client';
import { deriveWrappingKey, generateMasterKey, wrapMasterKey, unwrapMasterKey } from '../crypto';

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
        // Simplified OPAQUE flow for development
        // TODO: Wire up full OpaqueClient when server is running
        const regResult = await api.register(email, btoa(password));
        const finishResult = await api.registerFinish(email, regResult.registrationResponse ?? btoa('record'));
        const token = finishResult.token;
        api.setToken(token);

        const mk = generateMasterKey();
        const fakeExportKey = new TextEncoder().encode(password.padEnd(32, '0').slice(0, 32));
        const wrappingKey = await deriveWrappingKey(fakeExportKey, email);
        const wrappedMk = await wrapMasterKey(mk, wrappingKey);
        await api.putMasterKey(wrappedMk);
        localStorage.setItem('cc_wrapped_mk', wrappedMk);

        login(token, mk);
      } else {
        // Simplified OPAQUE login
        const loginResult = await api.login(email, btoa(password));
        const finishResult = await api.loginFinish(email, loginResult.credentialResponse ?? btoa('finalization'));
        const token = finishResult.token;
        api.setToken(token);

        const fakeExportKey = new TextEncoder().encode(password.padEnd(32, '0').slice(0, 32));
        const wrappingKey = await deriveWrappingKey(fakeExportKey, email);
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
    <div className="min-h-screen flex items-center justify-center bg-vault-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-vault-accent mb-2">Context Chest</h1>
          <p className="text-vault-muted text-sm">Your encrypted AI memory vault</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-vault-surface rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-vault-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-vault-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vault-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-vault-muted mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-vault-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vault-accent"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-vault-accent text-white rounded-lg text-sm font-medium hover:bg-vault-accent/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <p className="text-center text-vault-muted text-xs">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button type="button" onClick={() => setMode('register')} className="text-vault-accent hover:underline">
                  Create one
                </button>
              </>
            ) : (
              <>
                Have an account?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-vault-accent hover:underline">
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
