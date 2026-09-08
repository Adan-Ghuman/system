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
import { ThemedLoadingScreen } from '../components/ui/ThemedLoadingScreen.js';

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
      <ThemedLoadingScreen
        message="Connecting to secure session..."
        subtitle="Verifying credentials & loading operations workspace"
      />
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
