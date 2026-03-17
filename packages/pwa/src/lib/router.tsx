import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { Layout } from '../components/Layout';
import { ChestProvider } from '../context/chest-context';
import { Landing } from '../pages/Landing';
import { Login } from '../pages/Login';
import { Memories } from '../pages/Memories';
import { Agents } from '../pages/Agents';
import { Sessions } from '../pages/Sessions';
import { Settings } from '../pages/Settings';
import { Docs } from '../pages/Docs';
import { Pricing } from '../pages/Pricing';
import { Chests } from '../pages/Chests';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <AuthGuard>
              <ChestProvider>
                <Layout />
              </ChestProvider>
            </AuthGuard>
          }
        >
          <Route path="/memories" element={<Memories />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/chests" element={<Chests />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
