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
import { EditYarnTransactionModal } from '../components/EditYarnTransactionModal.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatWeight, formatDateTime } from '../../../lib/formatters.js';
import { downloadExcelReport } from '../../../lib/reportExport.js';
import {
  Layers,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  PackageCheck,
  Scale,
  Sparkles,
  Inbox,
  Search,
  Edit,
  FileSpreadsheet,
  ArrowUpDown,
  Filter,
  X
} from 'lucide-react';

export function KnittingPage() {
  const [activeTab, setActiveTab] = useState<'balances' | 'transactions'>('balances');
  const [isExportingKnitting, setIsExportingKnitting] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueType, setIssueType] = useState<YarnTransactionType>('OUTWARD_TO_KNITTER');
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<KnitterBalanceSummary | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<YarnTransactionItem | null>(null);

  // Balances Tab Filters & Sort
  const [balanceSearchTerm, setBalanceSearchTerm] = useState('');
  const [balanceStatusFilter, setBalanceStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLEARED'>('ALL');
  const [balanceSortBy, setBalanceSortBy] = useState<'latest' | 'name' | 'remaining_desc'>('latest');

  // Transactions Tab Filters & Sort (Latest Date First Default)
  const [searchTerm, setSearchTerm] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'OUTWARD_TO_KNITTER' | 'INWARD_FROM_CLIENT'>('ALL');
  const [txSortOrder, setTxSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [txTypeFilter, txSortOrder, debouncedSearchTerm]);

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
    queryKey: ['yarn-transactions', txTypeFilter, txSortOrder, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit, sortOrder: txSortOrder };
      if (txTypeFilter !== 'ALL') {
        params.transactionType = txTypeFilter;
      }
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

  const isBalancesFiltered = Boolean(balanceSearchTerm.trim() || balanceStatusFilter !== 'ALL');

  const filteredBalances = useMemo(() => {
    let list = [...balances];
    if (balanceSearchTerm.trim()) {
      const q = balanceSearchTerm.trim().toLowerCase();
      list = list.filter((b) => {
        const partyName = b.partyName.toLowerCase();
        const partyCode = b.partyCode.toLowerCase();
        // Match party name or party code
        if (partyName.includes(q) || partyCode.includes(q)) return true;

        const specLower = b.yarnSpec.toLowerCase();
        // If search query has digits, slashes, or hyphens (e.g. '30/1', '75/36', '100'), test substring
        if ((q.includes('/') || q.includes('-') || !isNaN(Number(q))) && specLower.includes(q)) {
          return true;
        }

        // Word-boundary / prefix match so 'star' does NOT match 'mistari'
        const words = specLower.split(/[\s/\-_,]+/);
        return words.some((w) => w.startsWith(q));
      });
    }
    if (balanceStatusFilter === 'ACTIVE') {
      list = list.filter((b) => b.remainingYarnKg > 0);
    } else if (balanceStatusFilter === 'CLEARED') {
      list = list.filter((b) => b.remainingYarnKg <= 0);
    }

    if (balanceSortBy === 'name') {
      list.sort((a, b) => a.partyName.localeCompare(b.partyName));
    } else if (balanceSortBy === 'remaining_desc') {
      list.sort((a, b) => b.remainingYarnKg - a.remainingYarnKg);
    } else {
      list.sort((a, b) => new Date(b.lastDate || 0).getTime() - new Date(a.lastDate || 0).getTime());
    }
    return list;
  }, [balances, balanceSearchTerm, balanceStatusFilter, balanceSortBy]);

  const kpis = useMemo(() => {
    const isPartyView = activeTab === 'balances' && isBalancesFiltered;
    const sourceList = isPartyView ? filteredBalances : balances;
    let totalGross = 0;
    let totalExpected = 0;
    let totalReceived = 0;
    let totalRemaining = 0;

    sourceList.forEach((b) => {
      totalGross += b.totalGrossKg;
      totalExpected += b.totalExpectedKg;
      totalReceived += b.totalReceivedKg;
      totalRemaining += b.remainingYarnKg;
    });

    const activeKnitterIds = new Set(sourceList.filter((b) => b.remainingYarnKg > 0).map((b) => b.partyId));
    const allKnitterNames = Array.from(new Set(sourceList.map((b) => b.partyName)));
    const singlePartyName = allKnitterNames.length === 1 ? allKnitterNames[0] : null;

    return {
      totalGross,
      totalExpected,
      totalReceived,
      totalRemaining,
      activeKnitterCount: activeKnitterIds.size,
      totalKnitterCount: allKnitterNames.length,
      itemCount: sourceList.length,
      singlePartyName,
      isFiltered: isPartyView
    };
  }, [activeTab, isBalancesFiltered, filteredBalances, balances]);

  async function handleExportKnittingExcel() {
    setIsExportingKnitting(true);
    try {
      await downloadExcelReport('/reports/knitting-yarn/excel', 'Knitting_Yarn_Stock_Report.xlsx');
    } catch (err) {
      console.error('Failed to export knitting yarn report:', err);
    } finally {
      setIsExportingKnitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>Yarn Job-Work & Knitting Operations</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Two-way contract knitter management with automated 1.0% wastage math and live remaining yarn tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 pb-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportKnittingExcel}
            disabled={isExportingKnitting}
            className="gap-1.5 whitespace-nowrap shrink-0 bg-emerald-950/30 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50 hover:text-white"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExportingKnitting ? 'Exporting...' : 'Yarn Stock Report (.xlsx)'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefetchAll} title="Refresh records" className="gap-1 px-2.5 shrink-0 whitespace-nowrap">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setIssueType('OUTWARD_TO_KNITTER');
              setIsIssueModalOpen(true);
            }}
            className="gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Send Yarn to Knitter</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelectedBalance(null);
              setIsReceiveModalOpen(true);
            }}
            className="gap-1.5 whitespace-nowrap shrink-0"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Receive Knitted Fabric</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIssueType('INWARD_FROM_CLIENT');
              setIsIssueModalOpen(true);
            }}
            className="gap-1.5 text-zinc-300 whitespace-nowrap shrink-0"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Receive Outside Yarn</span>
          </Button>
        </div>
      </div>

      {kpis.isFiltered && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-zinc-300">
              Showing Summary for:{' '}
              <strong className="text-emerald-400 font-semibold">
                {kpis.singlePartyName || balanceSearchTerm.trim() || 'Filtered Knitters'}
              </strong>{' '}
              ({kpis.itemCount} {kpis.itemCount === 1 ? 'yarn specification' : 'yarn specifications'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setBalanceSearchTerm('');
              setBalanceStatusFilter('ALL');
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-medium whitespace-nowrap"
          >
            Reset to All Knitters Summary &rarr;
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={`bg-zinc-900/80 p-3 transition-colors ${kpis.isFiltered ? 'border-amber-500/40 shadow-sm' : 'border-amber-950/40'}`}>
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3 h-3" />
              {kpis.isFiltered && kpis.singlePartyName ? 'Yarn Remaining' : 'Yarn Remaining at Knitters'}
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatWeight(kpis.totalRemaining)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {kpis.isFiltered
                ? (kpis.singlePartyName ? `For ${kpis.singlePartyName} (${kpis.itemCount} specs)` : `Across ${kpis.activeKnitterCount} filtered knitters`)
                : `Across ${kpis.activeKnitterCount} active contract knitters`}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-zinc-900/80 p-3 transition-colors ${kpis.isFiltered ? 'border-emerald-500/40 shadow-sm' : 'border-emerald-950/40'}`}>
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Total Yarn Sent Out
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.totalGross)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {kpis.isFiltered
                ? (kpis.singlePartyName ? `All yarn issued to ${kpis.singlePartyName}` : `Issued across ${kpis.totalKnitterCount} knitters`)
                : 'All yarn issued to knitters'}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-zinc-900/80 p-3 transition-colors ${kpis.isFiltered ? 'border-purple-500/40 shadow-sm' : 'border-purple-950/40'}`}>
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

        <Card className={`bg-zinc-900/80 p-3 transition-colors ${kpis.isFiltered ? 'border-emerald-500/40 shadow-sm' : 'border-emerald-950/40'}`}>
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <PackageCheck className="w-3 h-3" />
              Fabric Received Back
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.totalReceived)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {kpis.isFiltered && kpis.singlePartyName ? `Returned from ${kpis.singlePartyName}` : 'Returned knitted rolls'}
            </div>
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
          <div className="p-2.5 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={balanceStatusFilter}
                  onChange={(e) => setBalanceStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'CLEARED')}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Filter balances"
                >
                  <option value="ALL" className="bg-zinc-900 text-zinc-200">All Knitter Balances</option>
                  <option value="ACTIVE" className="bg-zinc-900 text-zinc-200">Active (Yarn Left &gt; 0)</option>
                  <option value="CLEARED" className="bg-zinc-900 text-zinc-200">Settled / Cleared (0 Kg)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <select
                  value={balanceSortBy}
                  onChange={(e) => setBalanceSortBy(e.target.value as 'latest' | 'name' | 'remaining_desc')}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Sort balances"
                >
                  <option value="latest" className="bg-zinc-900 text-zinc-200">Sort: Latest Activity First (Default)</option>
                  <option value="name" className="bg-zinc-900 text-zinc-200">Sort: Knitter Name (A-Z)</option>
                  <option value="remaining_desc" className="bg-zinc-900 text-zinc-200">Sort: Highest Remaining Yarn</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <Input
                placeholder="Search knitter, code, spec..."
                value={balanceSearchTerm}
                onChange={(e) => setBalanceSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs"
              />
              {balanceSearchTerm && (
                <button
                  type="button"
                  onClick={() => setBalanceSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <ScrollableTable>
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
                ) : filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      No knitter yarn balances matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((b) => {
                    const percent = b.totalExpectedKg > 0
                      ? Math.min(100, Math.round((b.totalReceivedKg / b.totalExpectedKg) * 100))
                      : 0;

                    return (
                      <tr key={`${b.partyId}-${b.yarnSpec}`} className="group hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setBalanceSearchTerm(b.partyName)}
                            className="text-left font-semibold text-zinc-100 hover:text-emerald-400 transition-colors cursor-pointer"
                            title={`Click to view summary for ${b.partyName}`}
                          >
                            {b.partyName}
                          </button>
                          <span className="text-[10px] font-mono text-zinc-400 ml-2 bg-zinc-800/70 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            {b.partyCode}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-zinc-300 font-mono whitespace-nowrap">
                          {formatDateTime(b.lastDate, true)}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-emerald-400 font-medium whitespace-nowrap">
                          {b.yarnSpec}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                          {formatWeight(b.totalGrossKg)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                          {formatWeight(b.totalExpectedKg)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold whitespace-nowrap">
                          {formatWeight(b.totalReceivedKg)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          <span className={b.remainingYarnKg > 0 ? 'text-amber-400 font-bold' : 'text-zinc-500'}>
                            {formatWeight(b.remainingYarnKg)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">{percent}%</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 transition-colors z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                          <Button
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
          </ScrollableTable>
        </Card>
      )}

      {activeTab === 'transactions' && (
        <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="p-2.5 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value as 'ALL' | 'OUTWARD_TO_KNITTER' | 'INWARD_FROM_CLIENT')}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Filter transaction type"
                >
                  <option value="ALL" className="bg-zinc-900 text-zinc-200">All Movement Types</option>
                  <option value="OUTWARD_TO_KNITTER" className="bg-zinc-900 text-zinc-200">Outward to Knitter</option>
                  <option value="INWARD_FROM_CLIENT" className="bg-zinc-900 text-zinc-200">Inward from Client</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <select
                  value={txSortOrder}
                  onChange={(e) => setTxSortOrder(e.target.value as 'desc' | 'asc')}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Sort order"
                >
                  <option value="desc" className="bg-zinc-900 text-zinc-200">Sort: Latest First (Default)</option>
                  <option value="asc" className="bg-zinc-900 text-zinc-200">Sort: Oldest First</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <Input
                placeholder="Search gate pass, spec, remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
          <ScrollableTable>
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
                  <th className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isTxLoading ? (
                  <LoadingState isTableRow colSpan={12} message="Loading yarn movement history..." />
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-zinc-500">
                      No yarn transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="group hover:bg-zinc-800/40 transition-colors">
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

                      <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 transition-colors z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTransaction(tx);
                            setIsEditModalOpen(true);
                          }}
                          className="text-[11px] py-1 px-2.5 h-7 gap-1 whitespace-nowrap"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
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

      <EditYarnTransactionModal
        isOpen={isEditModalOpen}
        transaction={editingTransaction}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTransaction(null);
        }}
        onSuccess={handleRefetchAll}
      />
    </div>
  );
}
