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
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { formatWeight, formatDateTime } from '../../../lib/formatters.js';
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
            Send Yarn to Knitter
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
            Receive Knitted Fabric
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
            Receive Outside Yarn
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3 h-3" />
              Yarn Remaining at Knitters
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
              Total Yarn Sent Out
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.totalGross)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">All yarn issued to knitters</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-purple-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Expected Fabric (After 1% Wastage)
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
              Fabric Received Back
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
          Knitter Yarn Balances ({balances.length})
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'transactions'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Yarn Movement History ({transactions.length})
        </button>
      </div>

      {activeTab === 'balances' && (
        <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Knitter</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Last Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Yarn Specification</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Gross Issued</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Expected (-1%)</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Fabric Received</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Yarn Left in Field</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Completion Progress</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isBalancesLoading ? (
                  <LoadingState isTableRow colSpan={9} message="Loading knitter yarn balances..." />
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">
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
                      <tr key={`${b.partyId}-${b.yarnSpec}`} className="group hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-semibold text-zinc-100">{b.partyName}</span>
                          <span className="text-[10px] font-mono text-zinc-400 ml-2 bg-zinc-800/70 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            {b.partyCode}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-zinc-300 font-mono whitespace-nowrap">
                          {formatDateTime(b.lastDate, true)}
                        </td>

                        <td className="py-2.5 px-3 font-mono font-medium text-emerald-400 whitespace-nowrap">
                          {b.yarnSpec}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                          {formatWeight(b.totalGrossKg)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-purple-300 whitespace-nowrap">
                          {formatWeight(b.totalExpectedKg)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold whitespace-nowrap">
                          {formatWeight(b.totalReceivedKg)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">
                          {formatWeight(b.remainingYarnKg)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percent >= 100 ? 'bg-emerald-400' : 'bg-emerald-600'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-bold text-zinc-200">{percent}%</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedBalance(b);
                              setIsReceiveModalOpen(true);
                            }}
                            className="text-[11px] py-1 px-2.5 h-7 whitespace-nowrap"
                          >
                            Receive Fabric
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
                  <th className="py-3 px-4 whitespace-nowrap">Gate Pass #</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Type</th>
                  <th className="py-3 px-4 whitespace-nowrap">Party</th>
                  <th className="py-3 px-4 whitespace-nowrap">Spec</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Boxes</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Gross (Kg)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">1% Loss (Kg)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Expected (Kg)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Received (Kg)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Remaining (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isTxLoading ? (
                  <LoadingState isTableRow colSpan={11} message="Loading yarn movement history..." />
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-500">
                      No yarn transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {tx.gatePassNo}
                      </td>

                      <td className="py-3 px-4 text-zinc-300 font-mono whitespace-nowrap">
                        {formatDateTime(tx.date, true)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant={tx.transactionType === 'OUTWARD_TO_KNITTER' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {tx.transactionType === 'OUTWARD_TO_KNITTER' ? 'OUTWARD' : 'INWARD'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-zinc-100">{tx.partyId?.name || '—'}</span>
                        {tx.partyId?.code && (
                          <span className="text-[10px] font-mono text-zinc-400 ml-1.5 bg-zinc-800/70 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            {tx.partyId.code}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-emerald-400 whitespace-nowrap">
                        {tx.yarnSpec}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                        {tx.boxCount}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-zinc-200 font-medium whitespace-nowrap">
                        {formatWeight(tx.grossWeightKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-amber-400 whitespace-nowrap">
                        {formatWeight(tx.wastageWeightKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-purple-400 whitespace-nowrap">
                        {formatWeight(tx.netExpectedFabricKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-400 whitespace-nowrap">
                        {formatWeight(tx.receivedFabricKg)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 whitespace-nowrap">
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
