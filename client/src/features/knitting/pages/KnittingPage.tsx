import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { YarnTransactionItem, KnitterBalanceSummary, YarnTransactionType } from '../types/knitting.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { IssueYarnModal } from '../components/IssueYarnModal.js';
import { ReceiveKnittedModal } from '../components/ReceiveKnittedModal.js';
import { formatWeight, formatDate } from '../../../lib/formatters.js';
import {
  Layers,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  PackageCheck,
  Scale,
  Sparkles,
  Inbox,
  Search
} from 'lucide-react';

export function KnittingPage() {
  const [activeTab, setActiveTab] = useState<'balances' | 'transactions'>('balances');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueType, setIssueType] = useState<YarnTransactionType>('OUTWARD_TO_KNITTER');
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<KnitterBalanceSummary | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  const { data: balances = [], isLoading: isBalancesLoading, refetch: refetchBalances } = useQuery<KnitterBalanceSummary[]>({
    queryKey: ['knitter-balances'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: KnitterBalanceSummary[] }>('/knitting/balances');
      return res.data.data;
    }
  });

  const { data: txData, isLoading: isTxLoading, refetch: refetchTransactions } = useQuery<{
    items: YarnTransactionItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['yarn-transactions', debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }
      const res = await api.get<{
        success: boolean;
        data: { items: YarnTransactionItem[]; total: number; page: number; limit: number; totalPages: number };
      }>('/knitting/transactions', {
        params
      });
      return res.data.data;
    }
  });

  const transactions = txData?.items || [];

  function handleRefetchAll() {
    refetchBalances();
    refetchTransactions();
  }

  const kpis = useMemo(() => {
    let totalGross = 0;
    let totalExpected = 0;
    let totalReceived = 0;
    let totalRemaining = 0;

    balances.forEach((b) => {
      totalGross += b.totalGrossKg;
      totalExpected += b.totalExpectedKg;
      totalReceived += b.totalReceivedKg;
      totalRemaining += b.remainingYarnKg;
    });

    const activeKnitterIds = new Set(balances.filter((b) => b.remainingYarnKg > 0).map((b) => b.partyId));

    return {
      totalGross,
      totalExpected,
      totalReceived,
      totalRemaining,
      activeKnitterCount: activeKnitterIds.size
    };
  }, [balances]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500" />
            Yarn Job-Work & Knitting Operations
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Two-way contract knitter management with automated 1.0% wastage math and live remaining yarn tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefetchAll} title="Refresh records">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setIssueType('OUTWARD_TO_KNITTER');
              setIsIssueModalOpen(true);
            }}
            className="gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4" />
            Issue Yarn Outward
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelectedBalance(null);
              setIsReceiveModalOpen(true);
            }}
            className="gap-1.5"
          >
            <PackageCheck className="w-4 h-4" />
            Receive Knitted Rolls
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIssueType('INWARD_FROM_CLIENT');
              setIsIssueModalOpen(true);
            }}
            className="gap-1.5 text-zinc-300"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Inward Client Yarn
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3 h-3" />
              Yarn in Field (Knitter Balance)
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatWeight(kpis.totalRemaining)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Across {kpis.activeKnitterCount} active contract knitters</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Total Yarn Dispatched
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.totalGross)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Historical issued raw yarn</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-purple-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Projected Ecru Fabric (-1%)
            </div>
            <div className="text-lg font-bold font-mono text-purple-400 mt-1">
              {formatWeight(kpis.totalExpected)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Minus 1.0% standard wastage</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <PackageCheck className="w-3 h-3" />
              Received Ecru Fabric
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.totalReceived)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Returned knitted rolls</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('balances')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'balances'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Live Knitter Yarn Balances ({balances.length})
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'transactions'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Transaction History Log ({transactions.length})
        </button>
      </div>

      {activeTab === 'balances' && (
        <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Knitter</th>
                  <th className="py-3 px-4">Yarn Specification</th>
                  <th className="py-3 px-4 text-right">Gross Issued</th>
                  <th className="py-3 px-4 text-right">Expected (-1%)</th>
                  <th className="py-3 px-4 text-right">Fabric Received</th>
                  <th className="py-3 px-4 text-right">Yarn Left in Field</th>
                  <th className="py-3 px-4">Completion Progress</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isBalancesLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      Loading knitter balances...
                    </td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      No active knitter yarn balances. Issue yarn outward to populate this ledger.
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => {
                    const percent = b.totalExpectedKg > 0
                      ? Math.min(100, Math.round((b.totalReceivedKg / b.totalExpectedKg) * 100))
                      : 0;

                    return (
                      <tr key={`${b.partyId}-${b.yarnSpec}`} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-100">{b.partyName}</div>
                          <div className="text-[11px] font-mono text-zinc-400">
                            {b.partyCode} • {b.phone || 'No phone'}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                          {b.yarnSpec}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-zinc-300">
                          {formatWeight(b.totalGrossKg)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-purple-300">
                          {formatWeight(b.totalExpectedKg)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                          {formatWeight(b.totalReceivedKg)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                          {formatWeight(b.remainingYarnKg)}
                        </td>

                        <td className="py-3 px-4 min-w-36">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Yield Progress</span>
                              <span className="font-mono font-bold text-zinc-200">{percent}%</span>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percent >= 100 ? 'bg-emerald-400' : 'bg-emerald-600'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedBalance(b);
                              setIsReceiveModalOpen(true);
                            }}
                            className="text-[11px] py-1 px-2 h-7"
                          >
                            Receive Rolls
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'transactions' && (
        <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search gate pass, spec, remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Gate Pass #</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Spec</th>
                  <th className="py-3 px-4 text-right">Boxes</th>
                  <th className="py-3 px-4 text-right">Gross (Kg)</th>
                  <th className="py-3 px-4 text-right">1% Loss (Kg)</th>
                  <th className="py-3 px-4 text-right">Expected (Kg)</th>
                  <th className="py-3 px-4 text-right">Received (Kg)</th>
                  <th className="py-3 px-4 text-right">Remaining (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isTxLoading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-500">
                      No yarn transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 text-zinc-400 font-mono">
                        {formatDate(tx.date)}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={tx.transactionType === 'OUTWARD_TO_KNITTER' ? 'default' : 'secondary'}
                        >
                          {tx.transactionType === 'OUTWARD_TO_KNITTER' ? 'OUTWARD' : 'INWARD'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-zinc-200">
                        {tx.gatePassNo}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100">{tx.partyId?.name || '—'}</div>
                        <div className="text-[10px] font-mono text-zinc-500">{tx.partyId?.code}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-emerald-400">
                        {tx.yarnSpec}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-zinc-400">
                        {tx.boxCount}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-zinc-200 font-medium">
                        {formatWeight(tx.grossWeightKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-amber-400">
                        {formatWeight(tx.wastageWeightKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-purple-400">
                        {formatWeight(tx.netExpectedFabricKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatWeight(tx.receivedFabricKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatWeight(tx.remainingYarnBalanceKg)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={page}
            totalPages={txData?.totalPages || 1}
            total={txData?.total || 0}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </Card>
      )}

      <IssueYarnModal
        isOpen={isIssueModalOpen}
        initialType={issueType}
        onClose={() => setIsIssueModalOpen(false)}
        onSuccess={handleRefetchAll}
      />

      <ReceiveKnittedModal
        isOpen={isReceiveModalOpen}
        preselectedBalance={selectedBalance}
        onClose={() => setIsReceiveModalOpen(false)}
        onSuccess={handleRefetchAll}
      />
    </div>
  );
}
