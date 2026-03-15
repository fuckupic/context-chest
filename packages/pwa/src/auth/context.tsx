import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ApiClient } from '../api/client';

const STORAGE_KEY_TOKEN = 'cc_auth_token';
const STORAGE_KEY_MASTER_KEY = 'cc_master_key';

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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function persistSession(token: string, masterKey: Uint8Array): void {
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_MASTER_KEY, uint8ArrayToBase64(masterKey));
}

function clearPersistedSession(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_MASTER_KEY);
  localStorage.removeItem('cc_wrapped_mk');
}

function restoreSession(): AuthState {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const masterKeyBase64 = localStorage.getItem(STORAGE_KEY_MASTER_KEY);

  if (!token || !masterKeyBase64 || isTokenExpired(token)) {
    clearPersistedSession();
    return { isAuthenticated: false, token: null, masterKey: null, client: null };
  }

  const masterKey = base64ToUint8Array(masterKeyBase64);
  const client = new ApiClient(token);
  return { isAuthenticated: true, token, masterKey, client };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(restoreSession);

  const login = useCallback((token: string, masterKey: Uint8Array) => {
    persistSession(token, masterKey);
    const client = new ApiClient(token);
    setState({ isAuthenticated: true, token, masterKey, client });
  }, []);

  const logout = useCallback(() => {
    clearPersistedSession();
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
