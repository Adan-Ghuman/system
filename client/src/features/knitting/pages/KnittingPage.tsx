import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import {
  YarnTransactionItem,
  KnitterBalanceSummary,
  YarnTransactionType,
  YarnSpecsResponseData
} from '../types/knitting.types.js';
import { Button } from '../../../components/ui/Button.js';
import { WorkflowActions } from '../../../components/ui/WorkflowActions.js';
import { OptionalDetails } from '../../../components/ui/WorkflowForm.js';
import { Select } from '../../../components/ui/Select.js';
import { Input } from '../../../components/ui/Input.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card } from '../../../components/ui/Card.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { IssueYarnModal } from '../components/IssueYarnModal.js';
import { ReceiveKnittedModal } from '../components/ReceiveKnittedModal.js';
import { EditYarnTransactionModal } from '../components/EditYarnTransactionModal.js';
import { YarnSpecificationsTab } from '../components/YarnSpecificationsTab.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatWeight, formatDateTime } from '../../../lib/formatters.js';
import { downloadExcelReport } from '../../../lib/reportExport.js';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, PackageCheck, Edit, FileSpreadsheet, Sliders } from 'lucide-react';

export function KnittingPage() {
  const queryClient = useQueryClient();
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'balances' | 'transactions' | 'specs'>('balances');
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

  const { data: balances = [], isLoading: isBalancesLoading, isError: isBalancesError, refetch: refetchBalances } = useQuery<KnitterBalanceSummary[]>({
    queryKey: ['knitter-balances'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: KnitterBalanceSummary[] }>('/knitting/balances');
      return res.data.data;
    }
  });

  const { data: txData, isLoading: isTxLoading, isError: isTxError, refetch: refetchTransactions } = useQuery<{
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

  const { data: specsData, refetch: refetchSpecs } = useQuery<YarnSpecsResponseData>({
    queryKey: ['yarn-specs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: YarnSpecsResponseData }>('/knitting/yarn-specs');
      return res.data.data;
    }
  });

  function handleRefetchAll() {
    refetchBalances();
    refetchTransactions();
    refetchSpecs();
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-inventory-summary'] });
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
    setExportError(null);
    try {
      await downloadExcelReport('/reports/knitting-yarn/excel', 'Knitting_Yarn_Stock_Report.xlsx');
    } catch (err) {
      const failure = err as { message?: string };
      setExportError(failure.message || 'The yarn report could not be downloaded. Please try again.');
    } finally {
      setIsExportingKnitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Knitting</h1>
          <p className="mt-1 text-sm text-zinc-400">Send yarn out. Receive knitted fabric back. See what is still with each knitter.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefetchAll}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      <WorkflowActions actions={[
        { title: 'Send yarn to a knitter', description: 'Record boxes and yarn weight on an outgoing challan.', icon: ArrowUpRight, onClick: () => { setIssueType('OUTWARD_TO_KNITTER'); setIsIssueModalOpen(true); } },
        { title: 'Receive knitted fabric', description: 'Record rolls and actual weight delivered to your godown.', icon: PackageCheck, onClick: () => { setSelectedBalance(null); setIsReceiveModalOpen(true); } }
      ]} />
      <OptionalDetails title="Reports, client yarn & setup">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportKnittingExcel} isLoading={isExportingKnitting}><FileSpreadsheet className="h-4 w-4" /> Download yarn report</Button>
          <Button variant="outline" size="sm" onClick={() => { setIssueType('INWARD_FROM_CLIENT'); setIsIssueModalOpen(true); }}><ArrowDownLeft className="h-4 w-4" /> Receive yarn from a client</Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('specs')}><Sliders className="h-4 w-4" /> Manage yarn counts</Button>
        </div>
      </OptionalDetails>
      {exportError && <p role="alert" className="rounded-lg border border-red-900/50 p-3 text-sm text-red-300">{exportError}</p>}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        <Button variant={activeTab === 'balances' ? 'primary' : 'ghost'} aria-pressed={activeTab === 'balances'} onClick={() => setActiveTab('balances')}>Yarn with knitters</Button>
        <Button variant={activeTab === 'transactions' ? 'primary' : 'ghost'} aria-pressed={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')}>Yarn delivery history</Button>
        {activeTab === 'specs' && <span className="self-center text-sm text-zinc-400">Yarn count setup</span>}
      </div>
      {activeTab !== 'specs' && (
        <OptionalDetails title={kpis.isFiltered ? 'Yarn totals for this selection' : 'View yarn totals'}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Yarn sent', value: kpis.totalGross },
              { label: 'Expected fabric after wastage', value: kpis.totalExpected },
              { label: 'Fabric received', value: kpis.totalReceived },
              { label: 'Yarn still with knitters', value: kpis.totalRemaining }
            ].map((item) => <div key={item.label}><p className="text-xs text-zinc-400">{item.label}</p><p className="mt-1 font-mono text-base font-semibold text-zinc-100">{formatWeight(item.value)}</p></div>)}
          </div>
          <p className="text-xs text-zinc-500">{kpis.isFiltered ? 'For the knitters matching your filters.' : 'Across all knitter balances.'}</p>
        </OptionalDetails>
      )}
      {activeTab === 'balances' && (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="knitter-search" label="Find a knitter or yarn" placeholder="Name, code or yarn count" value={balanceSearchTerm} onChange={(e) => setBalanceSearchTerm(e.target.value)} />
            <Select id="knitter-status" label="Show" value={balanceStatusFilter} onChange={(e) => setBalanceStatusFilter(e.target.value as typeof balanceStatusFilter)}
              options={[{ label: 'All balances', value: 'ALL' }, { label: 'Yarn still with knitter', value: 'ACTIVE' }, { label: 'Cleared balances', value: 'CLEARED' }]} />
            <Select id="knitter-sort" label="Order" value={balanceSortBy} onChange={(e) => setBalanceSortBy(e.target.value as typeof balanceSortBy)}
              options={[{ label: 'Recent activity first', value: 'latest' }, { label: 'Knitter name A–Z', value: 'name' }, { label: 'Most yarn remaining', value: 'remaining_desc' }]} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <p>Choose <strong className="text-zinc-200">Receive fabric</strong> beside a knitter to fill their details for you.</p>
            {isBalancesFiltered && <Button variant="ghost" size="sm" onClick={() => { setBalanceSearchTerm(''); setBalanceStatusFilter('ALL'); }}>Clear filters</Button>}
          </div>
          {isBalancesError ? <div role="alert" className="space-y-2 rounded-lg border border-red-900/50 p-4 text-sm text-red-300"><p>Knitter balances could not be loaded.</p><Button variant="outline" onClick={() => refetchBalances()}>Try again</Button></div> : (
            <Card className="overflow-hidden border-zinc-800 bg-zinc-900/80">
              <ScrollableTable>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/70 text-xs text-zinc-400">
                    <tr><th className="px-4 py-3">Knitter</th><th className="px-4 py-3">Yarn count</th><th className="px-4 py-3 text-right whitespace-nowrap">Yarn sent</th><th className="px-4 py-3 text-right whitespace-nowrap">Fabric received</th><th className="px-4 py-3 text-right whitespace-nowrap">Yarn left</th><th className="px-4 py-3">Next action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {isBalancesLoading ? <LoadingState isTableRow colSpan={6} message="Loading knitter balances..." /> : filteredBalances.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">{isBalancesFiltered ? 'No balances match these filters.' : 'No yarn has been sent to a knitter yet. Start with Send yarn to a knitter above.'}</td></tr>
                    ) : filteredBalances.map((balance) => (
                      <tr key={balance.partyId + '-' + balance.yarnSpec} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setBalanceSearchTerm(balance.partyName)} className="text-left font-medium text-zinc-100 hover:text-emerald-400">{balance.partyName}</button>
                          <p className="mt-1 text-xs text-zinc-500">{balance.partyCode}{balance.lastDate ? ' · ' + formatDateTime(balance.lastDate, true) : ''}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-300">{balance.yarnSpec}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-zinc-300 whitespace-nowrap">{formatWeight(balance.totalGrossKg)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400 whitespace-nowrap">{formatWeight(balance.totalReceivedKg)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap"><span className={balance.remainingYarnKg > 0 ? 'font-semibold text-amber-400' : 'text-zinc-500'}>{formatWeight(balance.remainingYarnKg)}</span></td>
                        <td className="px-4 py-3 whitespace-nowrap"><Button size="sm" onClick={() => { setSelectedBalance(balance); setIsReceiveModalOpen(true); }}>Receive fabric</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </Card>
          )}
        </div>
      )}
      {activeTab === 'transactions' && (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-3">
            <Input id="yarn-history-search" label="Find a delivery" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Challan number, yarn or note" />
            <Select id="yarn-history-type" label="Show" value={txTypeFilter} onChange={(e) => setTxTypeFilter(e.target.value as typeof txTypeFilter)}
              options={[{ label: 'All yarn deliveries', value: 'ALL' }, { label: 'Sent to knitters', value: 'OUTWARD_TO_KNITTER' }, { label: 'Received from clients', value: 'INWARD_FROM_CLIENT' }]} />
            <Select id="yarn-history-sort" label="Order" value={txSortOrder} onChange={(e) => setTxSortOrder(e.target.value as typeof txSortOrder)}
              options={[{ label: 'Newest first', value: 'desc' }, { label: 'Oldest first', value: 'asc' }]} />
          </div>
          {isTxError ? <div role="alert" className="space-y-2 rounded-lg border border-red-900/50 p-4 text-sm text-red-300"><p>Yarn deliveries could not be loaded.</p><Button variant="outline" onClick={() => refetchTransactions()}>Try again</Button></div> : (
            <Card className="overflow-hidden border-zinc-800 bg-zinc-900/80">
              <ScrollableTable>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/70 text-xs text-zinc-400">
                    <tr><th className="px-4 py-3">Challan / date</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Yarn</th><th className="px-4 py-3 text-right">Yarn weight</th><th className="px-4 py-3 text-right">Fabric received</th><th className="px-4 py-3 text-right">Yarn left</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {isTxLoading ? <LoadingState isTableRow colSpan={7} message="Loading yarn deliveries..." /> : transactions.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-400">No yarn deliveries match these filters.</td></tr>
                    ) : transactions.map((transaction) => (
                      <tr key={transaction._id} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-3"><p className="font-mono text-xs font-semibold text-emerald-400">{transaction.gatePassNo}</p><p className="mt-1 text-xs text-zinc-500">{formatDateTime(transaction.date, true)}</p>{transaction.remarks && <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer">Delivery note</summary><p className="mt-1 max-w-56 whitespace-normal">{transaction.remarks}</p></details>}</td>
                        <td className="px-4 py-3"><p className="text-zinc-200">{transaction.partyId?.name || '—'}</p><Badge variant="outline" className="mt-1 text-[10px]">{transaction.transactionType === 'OUTWARD_TO_KNITTER' ? 'Sent to knitter' : 'Received from client'}</Badge></td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-300">{transaction.yarnSpec}</td>
                        <td className="px-4 py-3 text-right text-xs"><p className="font-mono text-zinc-200 whitespace-nowrap">{formatWeight(transaction.grossWeightKg)}</p><p className="mt-1 text-zinc-500">{transaction.boxCount} boxes</p><details className="mt-2 text-zinc-400"><summary className="cursor-pointer">Wastage details</summary><p className="mt-1 whitespace-nowrap">Loss: {formatWeight(transaction.wastageWeightKg)} ({transaction.wastagePercent}%)</p><p className="mt-1 whitespace-nowrap">Expected: {formatWeight(transaction.netExpectedFabricKg)}</p></details></td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400 whitespace-nowrap">{formatWeight(transaction.receivedFabricKg)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-amber-400 whitespace-nowrap">{formatWeight(transaction.remainingYarnBalanceKg)}</td>
                        <td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => { setEditingTransaction(transaction); setIsEditModalOpen(true); }}><Edit className="h-3.5 w-3.5" /> Edit</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
              <PaginationControls page={page} totalPages={txData?.totalPages || 1} total={txData?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
            </Card>
          )}
        </div>
      )}
      {activeTab === 'specs' && <YarnSpecificationsTab />}
      {isIssueModalOpen && <IssueYarnModal isOpen initialType={issueType} onClose={() => setIsIssueModalOpen(false)} onSuccess={handleRefetchAll} />}
      {isReceiveModalOpen && <ReceiveKnittedModal isOpen preselectedBalance={selectedBalance} onClose={() => { setIsReceiveModalOpen(false); setSelectedBalance(null); }} onSuccess={handleRefetchAll} />}
      <EditYarnTransactionModal isOpen={isEditModalOpen} transaction={editingTransaction} onClose={() => { setIsEditModalOpen(false); setEditingTransaction(null); }} onSuccess={handleRefetchAll} />
    </div>
  );
}
