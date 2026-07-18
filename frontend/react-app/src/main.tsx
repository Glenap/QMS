import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { queryClient } from './lib/queryClient.ts';
import './index.css';
// Shared design-system classes (tables, form sections, page headers, grids) live
// in these page stylesheets but are used across many pages that don't import them.
// Load them globally so a direct reload of any page (with JS route code-splitting)
// never renders unstyled. Dev injects CSS per-module, so this is required there too
// — cssCodeSplit:false only covers the production build.
import './pages/Dashboard.css';
import './pages/ProjectMasterForm.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
