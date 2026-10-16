import { QueryError } from '../../components/ui/QueryError.js';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../auth/stores/useAuthStore.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { formatCurrency, formatWeight } from '../../lib/formatters.js';
import { Users, Layers, Palette, Boxes, Truck, FileSpreadsheet, RefreshCw, Plus, Wallet, ArrowUpRight } from 'lucide-react';
import { InventorySummaryGroup } from '../inventory/types/inventory.types.js';

interface PartySummary { total: number; buyers: number; knitters: number; mills: number; }
interface DyeingSummary { activeStats: { _id: string; count: number }[]; completedStats: { _id: string; count: number }[]; }

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

  const { isError: hasQueryError1,  data: partiesData, refetch: refetchParties, isFetching: isFetchingParties } = useQuery<PartySummary>({
    queryKey: ['dashboard-parties'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PartySummary }>('/parties/summary');
      return res.data.data;
    }
  });

  const { isError: hasQueryError2,  data: inventorySummaryData, refetch: refetchInventory } = useQuery<InventorySummaryGroup[]>({
    queryKey: ['dashboard-inventory-summary'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: InventorySummaryGroup[] }>('/inventory/summary');
      return res.data.data;
    }
  });

  const { isError: hasQueryError3,  data: batchesData, refetch: refetchBatches } = useQuery<DyeingSummary>({
    queryKey: ['dashboard-batches'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DyeingSummary }>('/dyeing/metrics');
      return res.data.data;
    }
  });

  const { isError: hasQueryError4,  data: accountsStats, refetch: refetchAccounts } = useQuery<AccountsStats>({
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

  const inventorySummary = inventorySummaryData || [];

  const buyersCount = partiesData?.buyers || 0;
  const knittersCount = partiesData?.knitters || 0;
  const millsCount = partiesData?.mills || 0;
  const totalParties = partiesData?.total || 0;

  const totalRolls = inventorySummary.reduce((sum, g) => sum + (g.totalRolls || 0), 0);
  const totalWeightKg = inventorySummary.reduce((sum, g) => sum + (g.totalWeightKg || 0), 0);

  const zrGodownRolls = inventorySummary
    .filter((g) => g._id.location === 'ZR_GODOWN')
    .reduce((sum, g) => sum + (g.totalRolls || 0), 0);
  const zrGodownKg = inventorySummary
    .filter((g) => g._id.location === 'ZR_GODOWN')
    .reduce((sum, g) => sum + (g.totalWeightKg || 0), 0);

  const ghummanRolls = inventorySummary
    .filter((g) => g._id.location === 'GHUMMAN_DYEING')
    .reduce((sum, g) => sum + (g.totalRolls || 0), 0);
  const ghummanKg = inventorySummary
    .filter((g) => g._id.location === 'GHUMMAN_DYEING')
    .reduce((sum, g) => sum + (g.totalWeightKg || 0), 0);

  const rajputRolls = inventorySummary
    .filter((g) => g._id.location === 'RAJPUT_DYEING')
    .reduce((sum, g) => sum + (g.totalRolls || 0), 0);
  const rajputKg = inventorySummary
    .filter((g) => g._id.location === 'RAJPUT_DYEING')
    .reduce((sum, g) => sum + (g.totalWeightKg || 0), 0);

  const activeGhummanBatches = batchesData?.activeStats.find(group => group._id === 'GHUMMAN_DYEING')?.count || 0;
  const activeRajputBatches = batchesData?.activeStats.find(group => group._id === 'RAJPUT_DYEING')?.count || 0;
  const totalBatches = [...(batchesData?.activeStats || []), ...(batchesData?.completedStats || [])].reduce((sum, group) => sum + group.count, 0);

  const modules = [
    {
      title: 'Parties',
      description: 'Manage Yarn Clients, Knitters, Fabric Buyers & Dyeing Units and view their balances.',
      to: '/parties',
      icon: Users,
      badge: `${totalParties} Total Parties`
    },
    {
      title: 'Knitting',
      description: 'Send yarn to knitters, receive fabric rolls, and track 1% wastage.',
      to: '/knitting',
      icon: Layers,
      badge: `${knittersCount} Contract Knitters`
    },
    {
      title: 'Dyeing',
      description: 'Track fabric sent to Ghumman & Rajput units, target colors, and weight loss.',
      to: '/dyeing',
      icon: Palette,
      badge: `${activeGhummanBatches + activeRajputBatches} In Process`
    },
    {
      title: 'Fabric Stock',
      description: 'Live stock of ready dyed fabric and raw grey rolls across Rozain Textile, ZR Trading and partner locations.',
      to: '/inventory',
      icon: Boxes,
      badge: `${totalRolls} Rolls (${Math.round(totalWeightKg).toLocaleString()} Kg)`
    },
    {
      title: 'Deliveries & invoices',
      description: 'Create delivery gate passes (OGP), deduct stock, and print bills or 18% GST tax invoices.',
      to: '/dispatch',
      icon: Truck,
      badge: 'Delivery & Invoicing'
    },
    {
      title: 'Accounts & ledgers',
      description: 'Record money received or paid, track who owes money, and view party account statements.',
      to: '/accounts',
      icon: FileSpreadsheet,
      badge: `Rs. ${Math.round(accountsStats?.totalReceivables || 0).toLocaleString()} Receivable`
    }
  ];

  const stockLocations = [
    { label: 'ZR godown', rolls: zrGodownRolls, weight: zrGodownKg },
    { label: 'Ghumman Dyeing', rolls: ghummanRolls, weight: ghummanKg },
    { label: 'Rajput Dyeing', rolls: rajputRolls, weight: rajputKg }
  ];
  return (
    <div className="space-y-7">
      <PageHeader title="Overview" description={<>Welcome back, {user?.fullName?.split(' ')[0] || 'operator'}. Here is your workspace at a glance.</>}>
        <Button variant="outline" size="sm" preventDoubleClick onClick={handleRefreshAll} isLoading={isFetchingParties}><RefreshCw className="h-4 w-4" />Refresh</Button>
        <Link to="/dispatch" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-emerald-800"><Plus className="h-4 w-4" />New delivery</Link>
      </PageHeader>
      {(hasQueryError1 || hasQueryError2 || hasQueryError3 || hasQueryError4) && <QueryError onRetry={() => { refetchParties(); refetchInventory(); refetchBatches(); refetchAccounts(); }} />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Parties', value: totalParties.toLocaleString(), detail: `${buyersCount} buyers · ${knittersCount} knitters · ${millsCount} mills`, to: '/parties', icon: Users },
          { label: 'Fabric in stock', value: totalRolls.toLocaleString() + ' rolls', detail: Math.round(totalWeightKg).toLocaleString() + ' kg across locations', to: '/inventory', icon: Boxes },
          { label: 'Dyeing batches', value: String(activeGhummanBatches + activeRajputBatches) + ' active', detail: `${totalBatches} batches recorded`, to: '/dyeing', icon: Palette },
          { label: 'Receivables', value: formatCurrency(accountsStats?.totalReceivables || 0), detail: 'Outstanding customer balances', to: '/accounts', icon: Wallet }
        ].map(({ label, value, detail, to, icon: Icon }) => (
          <Link key={label} to={to} className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-control">
            <div className="flex items-center justify-between text-soft"><span className="text-xs font-medium">{label}</span><Icon className="h-4 w-4" /></div>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-strong tabular-nums">{value}</p>
            <p className="mt-2 text-xs leading-relaxed text-soft">{detail}</p>
          </Link>
        ))}
      </div>
      <section className="space-y-3">
        <div><h2 className="text-base font-semibold text-strong">Continue your work</h2><p className="mt-1 text-sm text-soft">Choose an area to send, receive, record or review.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ title, description, to, icon: Icon, badge }) => (
            <Link key={to} to={to} className="group flex gap-4 rounded-xl border border-line bg-surface p-5 hover:border-brand/40">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-brand"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-strong">{title}</h3><p className="mt-1.5 text-xs leading-relaxed text-soft">{description}</p><p className="mt-3 text-xs text-brand">{badge}</p></div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-soft group-hover:text-brand" />
            </Link>
          ))}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Stock by location</CardTitle><Link to="/inventory" className="text-xs font-medium text-brand">View all stock <span aria-hidden="true">→</span></Link></div><CardDescription>Raw and finished fabric held in your warehouses.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {stockLocations.map((item) => <div key={item.label} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"><p className="text-sm text-ink">{item.label}</p><p className="text-xs text-soft"><strong className="font-medium text-strong">{item.rolls} rolls</strong> · {formatWeight(item.weight)}</p></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Production & accounts</CardTitle><Link to="/accounts" className="text-xs font-medium text-brand">View accounts <span aria-hidden="true">→</span></Link></div><CardDescription>Quick references for work in progress and money movement.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-soft">Ghumman / Rajput batches</span><Link to="/dyeing" className="text-ink">{activeGhummanBatches} / {activeRajputBatches} active</Link></div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-soft">Contract knitting</span><Link to="/knitting" className="text-brand">{knittersCount} knitters · 1% standard wastage</Link></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-soft">Receipts this month</span><strong className="font-medium text-strong">{formatCurrency(accountsStats?.monthlyReceipts || 0)}</strong></div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-soft">Payables</span><strong className="font-medium text-strong">{formatCurrency(accountsStats?.totalPayables || 0)}</strong></div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-line pt-4 text-xs text-soft"><Link to="/dyeing" className="hover:text-brand">Receive dyed fabric →</Link><Link to="/knitting" className="hover:text-brand">Receive knitted fabric →</Link></div>
    </div>
  );
}
