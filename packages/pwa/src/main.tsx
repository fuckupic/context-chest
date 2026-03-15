import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './auth/context';
import { AppRouter } from './lib/router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRouter />
      <Analytics />
    </AuthProvider>
  </React.StrictMode>
);
