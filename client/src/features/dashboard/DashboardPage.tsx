import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../auth/stores/useAuthStore.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import {
  Users,
  Layers,
  Palette,
  Boxes,
  Truck,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Activity,
  Warehouse,
  Scale,
  Building2,
  ShieldCheck
} from 'lucide-react';

interface PartySummary {
  _id: string;
  tags: {
    isFabricBuyer: boolean;
    isKnitter: boolean;
    isDyeingMill: boolean;
    isYarnClient: boolean;
  };
  currentBalance: number;
}

interface InventorySummary {
  location: 'ZR_GODOWN' | 'GHUMMAN_DYEING' | 'RAJPUT_DYEING';
  state: 'RAW_ECRU' | 'FINISHED_DYED';
  totalRolls: number;
  totalWeightKg: number;
}

interface DyeingBatchSummary {
  _id: string;
  millName: 'GHUMMAN_DYEING' | 'RAJPUT_DYEING';
  status: 'ISSUED' | 'IN_PROCESS' | 'COMPLETED';
  shortagePercent?: number;
}

interface AccountsStats {
  totalReceivables: number;
  totalPayables: number;
  netReceivablePosition: number;
  monthlyReceipts: number;
  monthlyPayments: number;
  totalParties: number;
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const { data: partiesData, refetch: refetchParties, isFetching: isFetchingParties } = useQuery<{ items: PartySummary[]; total: number }>({
    queryKey: ['dashboard-parties'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartySummary[]; total: number } }>('/parties', {
        params: { limit: 200 }
      });
      return res.data.data;
    }
  });

  const { data: inventoryData, refetch: refetchInventory } = useQuery<{ items: InventorySummary[]; total: number }>({
    queryKey: ['dashboard-inventory'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: InventorySummary[]; total: number } }>('/inventory/items', {
        params: { limit: 200 }
      });
      return res.data.data;
    }
  });

  const { data: batchesData, refetch: refetchBatches } = useQuery<{ items: DyeingBatchSummary[]; total: number }>({
    queryKey: ['dashboard-batches'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: DyeingBatchSummary[]; total: number } }>('/dyeing/batches', {
        params: { limit: 200 }
      });
      return res.data.data;
    }
  });

  const { data: accountsStats, refetch: refetchAccounts } = useQuery<AccountsStats>({
    queryKey: ['dashboard-accounts'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AccountsStats }>('/accounts/metrics');
      return res.data.data;
    }
  });

  function handleRefreshAll() {
    refetchParties();
    refetchInventory();
    refetchBatches();
    refetchAccounts();
  }

  const parties = partiesData?.items || [];
  const inventory = inventoryData?.items || [];
  const batches = batchesData?.items || [];

  const buyersCount = parties.filter((p) => p?.tags?.isFabricBuyer).length;
  const knittersCount = parties.filter((p) => p?.tags?.isKnitter).length;
  const millsCount = parties.filter((p) => p?.tags?.isDyeingMill).length;
  const totalParties = partiesData?.total || parties.length;

  const totalRolls = inventory.reduce((sum, item) => sum + (item.totalRolls || 0), 0);
  const totalWeightKg = inventory.reduce((sum, item) => sum + (item.totalWeightKg || 0), 0);

  const zrGodownRolls = inventory
    .filter((i) => i.location === 'ZR_GODOWN')
    .reduce((sum, i) => sum + (i.totalRolls || 0), 0);
  const zrGodownKg = inventory
    .filter((i) => i.location === 'ZR_GODOWN')
    .reduce((sum, i) => sum + (i.totalWeightKg || 0), 0);

  const ghummanRolls = inventory
    .filter((i) => i.location === 'GHUMMAN_DYEING')
    .reduce((sum, i) => sum + (i.totalRolls || 0), 0);
  const ghummanKg = inventory
    .filter((i) => i.location === 'GHUMMAN_DYEING')
    .reduce((sum, i) => sum + (i.totalWeightKg || 0), 0);

  const rajputRolls = inventory
    .filter((i) => i.location === 'RAJPUT_DYEING')
    .reduce((sum, i) => sum + (i.totalRolls || 0), 0);
  const rajputKg = inventory
    .filter((i) => i.location === 'RAJPUT_DYEING')
    .reduce((sum, i) => sum + (i.totalWeightKg || 0), 0);

  const activeGhummanBatches = batches.filter((b) => b.millName === 'GHUMMAN_DYEING' && b.status !== 'COMPLETED').length;
  const activeRajputBatches = batches.filter((b) => b.millName === 'RAJPUT_DYEING' && b.status !== 'COMPLETED').length;
  const totalBatches = batchesData?.total || batches.length;

  const modules = [
    {
      title: 'Party Directory',
      description: 'Profiles for Yarn Clients, Knitters, Fabric Buyers & Dyeing Mills with live Dr/Cr balances.',
      to: '/parties',
      icon: Users,
      badge: `${totalParties} Active Entities`
    },
    {
      title: 'Yarn & Knitting',
      description: 'Yarn outward to contract knitters & inward fabric receipts with automated 1% wastage deduction.',
      to: '/knitting',
      icon: Layers,
      badge: `${knittersCount} Contract Knitters`
    },
    {
      title: 'Multi-Mill Dyeing',
      description: 'Dual-mill batch tracking across Ghumman & Rajput Dyeing with process shrinkage calculation.',
      to: '/dyeing',
      icon: Palette,
      badge: `${activeGhummanBatches + activeRajputBatches} In Process`
    },
    {
      title: 'Live Inventory',
      description: 'Real-time stock of Raw Ecru and Finished Dyed fabric across ZR Godown & partner mills.',
      to: '/inventory',
      icon: Boxes,
      badge: `${totalRolls} Rolls (${Math.round(totalWeightKg).toLocaleString()} Kg)`
    },
    {
      title: 'Fast Dispatch & Invoicing',
      description: 'Rapid roll-entry grid, sequential OGP generation, and 18% GST / Commercial invoicing.',
      to: '/dispatch',
      icon: Truck,
      badge: 'Rapid Roll Grid'
    },
    {
      title: 'Accounts & Ledgers',
      description: 'Double-entry running ledgers, payment voucher entry (CRV/BRV/BPV), and statement exports.',
      to: '/accounts',
      icon: FileSpreadsheet,
      badge: `Rs. ${Math.round(accountsStats?.totalReceivables || 0).toLocaleString()} Rec.`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Operations Command Center</h1>
            <Badge variant="success" className="gap-1 py-0.5 px-2 text-[10px]">
              <ShieldCheck className="w-3 h-3" />
              Live Connected
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Operator: <span className="text-zinc-200 font-semibold">{user?.fullName}</span> | Single Operator Unified ERP & Financial Accounting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshAll} isLoading={isFetchingParties}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Stats</span>
          </Button>
          <Link to="/dispatch">
            <Button size="sm">
              <Truck className="w-3.5 h-3.5" />
              <span>Fast Dispatch</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Commercial Network</span>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{totalParties}</span>
              <span className="text-xs text-zinc-400">registered</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/80">
              <span>{buyersCount} Buyers</span>
              <span>•</span>
              <span>{knittersCount} Knitters</span>
              <span>•</span>
              <span>{millsCount} Mills</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Total Fabric Stock</span>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Warehouse className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{totalRolls}</span>
              <span className="text-xs text-zinc-400">rolls total</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/80">
              <span className="text-emerald-400 font-medium">{Math.round(totalWeightKg).toLocaleString()} Kg</span>
              <span>Across 3 Locations</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Dyeing Operations</span>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Palette className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{activeGhummanBatches + activeRajputBatches}</span>
              <span className="text-xs text-zinc-400">active batches</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/80">
              <span>Ghumman: {activeGhummanBatches}</span>
              <span>•</span>
              <span>Rajput: {activeRajputBatches}</span>
              <span>•</span>
              <span>{totalBatches} Total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Total Receivables</span>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-400">
                Rs. {Math.round(accountsStats?.totalReceivables || 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/80">
              <span>Inflow: Rs. {Math.round(accountsStats?.monthlyReceipts || 0).toLocaleString()}</span>
              <span>Payables: Rs. {Math.round(accountsStats?.totalPayables || 0).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xs">
          <CardHeader className="pb-3 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-emerald-400" />
                  Inventory Holding by Location
                </CardTitle>
                <CardDescription className="text-xs">Live physical stock across ZR Godown and partner mills</CardDescription>
              </div>
              <Link to="/inventory">
                <Button variant="ghost" size="sm" className="text-xs text-emerald-400 hover:text-emerald-300">
                  Manage Inventory &rarr;
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200">ZR Godown (Central Warehouse)</span>
                <span className="text-zinc-400">{zrGodownRolls} rolls • {Math.round(zrGodownKg).toLocaleString()} Kg</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${totalWeightKg > 0 ? (zrGodownKg / totalWeightKg) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200">Ghumman Dyeing Mill</span>
                <span className="text-zinc-400">{ghummanRolls} rolls • {Math.round(ghummanKg).toLocaleString()} Kg</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all"
                  style={{ width: `${totalWeightKg > 0 ? (ghummanKg / totalWeightKg) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200">Rajput Dyeing Mill</span>
                <span className="text-zinc-400">{rajputRolls} rolls • {Math.round(rajputKg).toLocaleString()} Kg</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-700 h-2 rounded-full transition-all"
                  style={{ width: `${totalWeightKg > 0 ? (rajputKg / totalWeightKg) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Raw Ecru Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-700" />
                Finished Dyed Stock
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xs">
          <CardHeader className="pb-3 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Dyeing Processing & Contract Knitting
                </CardTitle>
                <CardDescription className="text-xs">Job-work status and shrinkage loss monitoring</CardDescription>
              </div>
              <Link to="/dyeing">
                <Button variant="ghost" size="sm" className="text-xs text-emerald-400 hover:text-emerald-300">
                  View Batches &rarr;
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Ghumman Dyeing Mill</div>
                  <div className="text-[11px] text-zinc-400">Daska Road • Primary Processing Mill</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={activeGhummanBatches > 0 ? 'default' : 'secondary'} className="text-[10px]">
                  {activeGhummanBatches} Active In-Process
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Rajput Dyeing Mill</div>
                  <div className="text-[11px] text-zinc-400">Kashmir Road • Secondary Processing Mill</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={activeRajputBatches > 0 ? 'default' : 'secondary'} className="text-[10px]">
                  {activeRajputBatches} Active In-Process
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Contract Knitting 1% Engine</div>
                  <div className="text-[11px] text-zinc-400">{knittersCount} Registered Knitters with auto-wastage</div>
                </div>
              </div>
              <Link to="/knitting">
                <Badge variant="success" className="text-[10px]">
                  Active Math Engine
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Operational Consoles</h2>
            <p className="text-xs text-zinc-400">Direct shortcuts into the 6 specialized production modules</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.title} className="hover:border-zinc-700 bg-zinc-900/80 transition-colors group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="p-2 rounded-md bg-zinc-800 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px]">{m.badge}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  <CardTitle className="text-sm text-zinc-100">{m.title}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 text-zinc-400">{m.description}</CardDescription>
                  <div className="pt-2">
                    <Link to={m.to}>
                      <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-zinc-300 hover:text-emerald-300">
                        <span>Launch Console</span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
