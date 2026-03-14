import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { Layout } from '../components/Layout';
import { Login } from '../pages/Login';
import { Memories } from '../pages/Memories';
import { Agents } from '../pages/Agents';
import { Sessions } from '../pages/Sessions';
import { Settings } from '../pages/Settings';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<Navigate to="/memories" replace />} />
          <Route path="/memories" element={<Memories />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
