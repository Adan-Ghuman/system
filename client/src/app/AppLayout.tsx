import { useQuery } from '@tanstack/react-query';
import { BusinessItem } from '../business/BusinessPicker.js';
import { BusinessPicker } from '../business/BusinessPicker.js';
import { useBusinessStore } from '../business/store.js';
import { useEffect, useRef, useState, Suspense } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.js';
import { GlobalSyncBar } from '../components/ui/GlobalSyncBar.js';
import { ThemePicker } from '../components/ui/Theme.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { Dialog } from '../components/ui/Dialog.js';
import { cn } from '../lib/cn.js';
import { LayoutDashboard, Users, Layers, Palette, Boxes, Truck, Wallet, LogOut, Shield, Menu, ArrowUpRight } from 'lucide-react';

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { to: '/knitting', label: 'Knitting', icon: Layers, group: 'Operations' },
  { to: '/yarn', label: 'Yarn stock', icon: Boxes, group: 'Operations' },
  { to: '/dyeing', label: 'Dyeing', icon: Palette, group: 'Operations' },
  { to: '/inventory', label: 'Fabric stock', icon: Boxes, group: 'Operations' },
  { to: '/dispatch', label: 'Deliveries & invoices', icon: Truck, group: 'Operations' },
  { to: '/buying', label: 'Buy fabric', icon: Boxes, group: 'Operations' },
  { to: '/catalog', label: 'Color program & names', icon: Palette, group: 'Operations' },
  { to: '/production', label: 'Production report', icon: Layers, group: 'Operations' },
  { to: '/intercompany', label: 'Trade between businesses', icon: Truck, group: 'Finance & parties' },
  { to: '/bills', label: 'Bills & charges', icon: Wallet, group: 'Finance & parties' },
  { to: '/parties', label: 'Parties', icon: Users, group: 'Finance & parties' },
  { to: '/accounts', label: 'Accounts & ledgers', icon: Wallet, group: 'Finance & parties' },
  { to: '/users', label: 'Staff & access', icon: Shield, group: 'Administration' }
];

export function AppLayout() {
  const businessId = useBusinessStore(state => state.id);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const access: Record<string, string[]> = { '/knitting': ['knitting:read'], '/yarn': ['knitting:read'], '/dyeing': ['dyeing:read'], '/inventory': ['inventory:read'], '/dispatch': ['dispatch:read'], '/buying': ['inventory:read', 'accounts:read'], '/bills': ['accounts:read'], '/parties': ['parties:read'], '/accounts': ['accounts:read'], '/production': ['knitting:read', 'dyeing:read', 'inventory:read'], '/intercompany': ['inventory:read', 'accounts:read'] };
  const items = navigation.filter(item => user?.role === 'admin' || (item.to !== '/users' && (access[item.to] || []).every(permission => user?.permissions.includes(permission))));
  const path = location.pathname.replace(/^\/b\/[^/]+/, '') || '/';
  const link = (value: string) => businessId ? '/b/' + businessId + (value === '/' ? '' : value) : value;
  const businesses = useQuery({ queryKey: ['businesses'], queryFn: async () => (await api.get<{ data: BusinessItem[] }>('/businesses')).data.data });
  const businessName = businesses.data?.find(item => item._id === businessId)?.name || 'Company workspace';
  const current = navigation.find((item) => item.to === path);

  useEffect(() => { setIsMobileOpen(false); }, [location.pathname]);

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch {}
    finally { clearAuth(); navigate('/login'); }
  }

  function renderNavigation() {
    return (
      <nav aria-label="Main navigation" className="space-y-6">
        {Array.from(new Set(items.map((item) => item.group))).map((group) => (
          <div key={group}>
            <p className="mb-2 px-3 text-xs font-medium tracking-wide text-soft">{group}</p>
            <div className="space-y-1">
              {items.filter((item) => item.group === group).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={link(to)} end={to === '/'} onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) => cn('flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-brand-soft text-brand' : 'text-soft hover:bg-subtle hover:text-strong')}>
                  <Icon className="h-[18px] w-[18px] shrink-0" /><span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  if (businessId && !location.pathname.startsWith('/b/')) return <Navigate to={link(path) + location.search} replace />;
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <a href="#main-content" className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-2 text-white focus:translate-y-0">Skip to content</a>
      <GlobalSyncBar />
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <NavLink to={link("/")} className="flex items-center gap-3 px-6 py-7">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white">rt.</span>
          <span><span className="block text-sm font-semibold tracking-tight text-strong">{businessName}</span><span className="mt-0.5 block text-xs text-soft">Operations workspace</span></span>
        </NavLink>
        <div className="flex-1 overflow-y-auto px-4 py-2">{renderNavigation()}</div>
        <div className="space-y-3 border-t border-line p-4">
          <NavLink to={link("/dispatch")} className="flex items-center justify-between rounded-lg bg-subtle p-3 text-xs font-medium text-ink">Create a delivery<ArrowUpRight className="h-4 w-4" /></NavLink>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{user?.fullName?.charAt(0).toUpperCase() || 'U'}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-strong">{user?.fullName}</p><p className="mt-0.5 truncate text-xs capitalize text-soft">{user?.role}</p></div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={menuRef} type="button" onClick={() => setIsMobileOpen(true)} aria-label="Open menu" aria-expanded={isMobileOpen} className="rounded-lg p-2 text-soft hover:bg-subtle lg:hidden"><Menu className="h-5 w-5" /></button>
            <p className="truncate text-xs text-soft"><span className="hidden sm:inline">Workspace <span className="mx-2 text-control">/</span></span><span className="font-medium text-ink">{current?.label || 'Overview'}</span></p>
          </div>
          <div className="flex shrink-0 items-center gap-2"><BusinessPicker /><span className="hidden sm:inline"><ThemePicker /></span><span className="hidden text-xs text-soft md:block">{user?.email}</span><Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0 lg:hidden" aria-label="Sign out"><LogOut className="h-4 w-4" /></Button></div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 outline-none sm:p-7 lg:p-8"><Suspense fallback={<LoadingState className="min-h-48" />}><Outlet /></Suspense></main>
      </div>
      <Dialog isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} title="Your workspace" description="Choose where you want to work." className="max-w-sm">
        {renderNavigation()}
      </Dialog>
    </div>
  );
}
