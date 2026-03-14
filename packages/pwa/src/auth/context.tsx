import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ApiClient } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  masterKey: Uint8Array | null;
  client: ApiClient | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, masterKey: Uint8Array) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    masterKey: null,
    client: null,
  });

  const login = useCallback((token: string, masterKey: Uint8Array) => {
    const client = new ApiClient(token);
    setState({ isAuthenticated: true, token, masterKey, client });
  }, []);

  const logout = useCallback(() => {
    setState({ isAuthenticated: false, token: null, masterKey: null, client: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
