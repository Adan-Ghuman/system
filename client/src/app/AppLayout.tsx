import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { GlobalSyncBar } from '../components/ui/GlobalSyncBar.js';
import { cn } from '../lib/cn.js';
import {
  Factory,
  Users,
  Layers,
  Palette,
  Boxes,
  Truck,
  FileSpreadsheet,
  LogOut,
  ShieldAlert,
  Menu,
  X
} from 'lucide-react';

export function AppLayout() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
    } finally {
      clearAuth();
      navigate('/login');
    }
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: Factory },
    { to: '/parties', label: 'Parties', icon: Users },
    { to: '/knitting', label: 'Knitting & Yarn', icon: Layers },
    { to: '/dyeing', label: 'Dyeing Batches', icon: Palette },
    { to: '/inventory', label: 'Fabric Stock', icon: Boxes },
    { to: '/dispatch', label: 'Deliveries & Bills', icon: Truck },
    { to: '/accounts', label: 'Payments & Ledgers', icon: FileSpreadsheet },
    ...(user?.role === 'admin' ? [{ to: '/users', label: 'Staff Users', icon: ShieldAlert }] : [])
  ];

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100">
      <GlobalSyncBar />

      {/* Desktop Persistent Sidebar - strictly separated in flex flow to eliminate overlap */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-900/90 backdrop-blur-md sticky top-0 h-screen z-30 select-none">
        {/* Brand / Company Header */}
        <div className="p-5 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-extrabold text-white text-sm shadow-md shadow-emerald-950/50 shrink-0">
              RT
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-white leading-tight truncate">
                ROZAIN TEXTILE
              </div>
              <div className="text-[10px] text-zinc-400 leading-tight truncate mt-0.5">
                Textile Operations & Finance
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group whitespace-nowrap',
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-200'
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Profile & Logout Card */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40 shrink-0">
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-200 truncate">
                  {user?.fullName}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {user?.email}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0 shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live System
            </span>
            <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="text-[9px] py-0 px-1">
              {user?.role?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Mobile Header (Hidden on lg screens) */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xs shadow-xs">
                RT
              </div>
              <span className="text-sm font-bold tracking-tight text-white">ROZAIN TEXTILE</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="text-[9px] py-0 px-1">
              {user?.role?.toUpperCase()}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Mobile Drawer (Hidden on lg screens) */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-zinc-900 border-r border-zinc-800 shadow-2xl z-50 flex flex-col justify-between">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-sm shadow-xs">
                    RT
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">ROZAIN TEXTILE</div>
                    <div className="text-[10px] text-zinc-400">Operations & Finance</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                        )
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>

              <div className="p-3 border-t border-zinc-800 bg-zinc-950/40">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-200 truncate">{user?.fullName}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{user?.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Page Content View - completely separated from sidebar */}
        <main className="flex-1 p-4 sm:p-6 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
