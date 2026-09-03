import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
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
  ShieldAlert
} from 'lucide-react';

export function AppLayout() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

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
    { to: '/', label: 'Overview', icon: Factory },
    { to: '/parties', label: 'Parties', icon: Users },
    { to: '/knitting', label: 'Knitting', icon: Layers },
    { to: '/dyeing', label: 'Dyeing', icon: Palette },
    { to: '/inventory', label: 'Inventory', icon: Boxes },
    { to: '/dispatch', label: 'Dispatch', icon: Truck },
    { to: '/accounts', label: 'Accounts', icon: FileSpreadsheet },
    ...(user?.role === 'admin' ? [{ to: '/users', label: 'Users', icon: ShieldAlert }] : [])
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md">
        <div className="px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-xs">
                RT
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-white leading-none">
                  ROZAIN & GHUMAN ERP
                </div>
                <div className="text-[10px] text-zinc-400 leading-tight">Textile Operations & Finance</div>
              </div>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30 shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      )
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-zinc-200">{user?.fullName}</div>
              <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 justify-end">
                <span>{user?.email}</span>
                <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="text-[9px] py-0 px-1">
                  {user?.role?.toUpperCase()}
                </Badge>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
