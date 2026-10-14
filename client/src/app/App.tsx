import { ReasonDialog } from '../components/ui/ReasonDialog.js';
import { LegacyReviewPage } from '../business/LegacyReviewPage.js';
import { IntercompanyPage } from '../business/IntercompanyPage.js';
import { LedgerPage } from '../business/LedgerPage.js';
import { CatalogPage } from '../business/CatalogPage.js';
import { WorkspacePage } from '../business/WorkspacePage.js';
import { YarnPage } from '../business/YarnPage.js';
import { ProductionPage } from '../business/ProductionPage.js';
import { useBusinessStore } from '../business/store.js';
import { useMemo } from 'react';
import { useEffect, ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
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

function createQueryClient() { return new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
      gcTime: 300000
    }
  }
}); }

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

function BusinessRoute() {
  const { businessId = '' } = useParams();const current = useBusinessStore(state => state.id);const setBusiness = useBusinessStore(state => state.setBusiness);
  useEffect(() => { if (current !== businessId) setBusiness(businessId); }, [businessId, current, setBusiness]);
  if (current !== businessId) return <ThemedLoadingScreen />;
  return <ProtectedRoute><ErrorBoundary fallbackTitle="Application Interface Error"><AppLayout /></ErrorBoundary></ProtectedRoute>;
}

export function App() {
  const businessId = useBusinessStore(state => state.id);
  const queryClient = useMemo(createQueryClient, [businessId]);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    const preparePrint = () => { const areas = Array.from(document.querySelectorAll('#print-area'));areas.forEach((area, index) => area.toggleAttribute('data-inactive-print', index !== areas.length - 1)); };
    window.addEventListener('beforeprint', preparePrint);return () => window.removeEventListener('beforeprint', preparePrint);
  }, []);
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <QueryClientProvider key={businessId || 'legacy'} client={queryClient}>
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
            <Route path="users" element={<UsersPage />} /><Route path="legacy-review" element={<LegacyReviewPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="buying" element={<WorkspacePage mode="buying" />} />
            <Route path="bills" element={<WorkspacePage mode="bills" />} />
            <Route path="yarn" element={<YarnPage />} />
            <Route path="production" element={<ProductionPage />} />
            <Route path="intercompany" element={<IntercompanyPage />} />
            <Route path="accounts/parties/:partyId/ledger" element={<LedgerPage />} />
            <Route path="parties" element={<PartiesPage />} />
            <Route path="knitting" element={<KnittingPage />} />
            <Route path="dyeing" element={<DyeingPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="dispatch" element={<DispatchPage />} />
            <Route path="accounts" element={<AccountsPage />} />
          </Route>

          <Route path="/b/:businessId" element={<BusinessRoute />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} /><Route path="legacy-review" element={<LegacyReviewPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="buying" element={<WorkspacePage mode="buying" />} />
            <Route path="bills" element={<WorkspacePage mode="bills" />} />
            <Route path="yarn" element={<YarnPage />} />
            <Route path="production" element={<ProductionPage />} />
            <Route path="intercompany" element={<IntercompanyPage />} />
            <Route path="accounts/parties/:partyId/ledger" element={<LedgerPage />} />
            <Route path="parties" element={<PartiesPage />} />
            <Route path="knitting" element={<KnittingPage />} />
            <Route path="dyeing" element={<DyeingPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="dispatch" element={<DispatchPage />} />
            <Route path="accounts" element={<AccountsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense>
      </BrowserRouter><ReasonDialog />
    </QueryClientProvider>
  );
}
