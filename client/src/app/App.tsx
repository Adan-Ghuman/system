import { useEffect, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
import { LoginPage } from '../features/auth/pages/LoginPage.js';
import { UsersPage } from '../features/auth/pages/UsersPage.js';
import { DashboardPage } from '../features/dashboard/DashboardPage.js';
import { PartiesPage } from '../features/parties/pages/PartiesPage.js';
import { KnittingPage } from '../features/knitting/pages/KnittingPage.js';
import { DyeingPage } from '../features/dyeing/pages/DyeingPage.js';
import { InventoryPage } from '../features/inventory/pages/InventoryPage.js';
import { DispatchPage } from '../features/dispatch/pages/DispatchPage.js';
import { AccountsPage } from '../features/accounts/pages/AccountsPage.js';
import { AppLayout } from './AppLayout.js';
import { ErrorBoundary } from '../components/ui/ErrorBoundary.js';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-xs">Connecting to secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ErrorBoundary fallbackTitle="Application Interface Error">
                  <AppLayout />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="parties" element={<PartiesPage />} />
            <Route path="knitting" element={<KnittingPage />} />
            <Route path="dyeing" element={<DyeingPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="dispatch" element={<DispatchPage />} />
            <Route path="accounts" element={<AccountsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
