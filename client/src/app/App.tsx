import { useEffect, ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.js').then(module => ({ default: module.LoginPage })));
const UsersPage = lazy(() => import('../features/auth/pages/UsersPage.js').then(module => ({ default: module.UsersPage })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage.js').then(module => ({ default: module.DashboardPage })));
const PartiesPage = lazy(() => import('../features/parties/pages/PartiesPage.js').then(module => ({ default: module.PartiesPage })));
const KnittingPage = lazy(() => import('../features/knitting/pages/KnittingPage.js').then(module => ({ default: module.KnittingPage })));
const DyeingPage = lazy(() => import('../features/dyeing/pages/DyeingPage.js').then(module => ({ default: module.DyeingPage })));
const InventoryPage = lazy(() => import('../features/inventory/pages/InventoryPage.js').then(module => ({ default: module.InventoryPage })));
const DispatchPage = lazy(() => import('../features/dispatch/pages/DispatchPage.js').then(module => ({ default: module.DispatchPage })));
const AccountsPage = lazy(() => import('../features/accounts/pages/AccountsPage.js').then(module => ({ default: module.AccountsPage })));
import { AppLayout } from './AppLayout.js';
import { ErrorBoundary } from '../components/ui/ErrorBoundary.js';
import { ThemedLoadingScreen } from '../components/ui/ThemedLoadingScreen.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
      gcTime: 300000
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
      <ThemedLoadingScreen fullScreen
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
        <Suspense fallback={<ThemedLoadingScreen />}><Routes>
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
        </Routes></Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
