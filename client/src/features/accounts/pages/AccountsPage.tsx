import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { PaymentVoucherItem, AccountingMetricsSummary } from '../types/accounts.types.js';
import { PartyItem } from '../../parties/types/party.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { Input } from '../../../components/ui/Input.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { PartyBalanceBadge } from '../../parties/components/PartyBalanceBadge.js';
import { CreateVoucherModal } from '../components/CreateVoucherModal.js';
import { EditVoucherModal } from '../components/EditVoucherModal.js';
import { PartyLedgerModal } from '../components/PartyLedgerModal.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatCurrency, formatDateTime } from '../../../lib/formatters.js';
import { downloadExcelReport } from '../../../lib/reportExport.js';
import {
  DollarSign,
  RefreshCw,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  BookOpen,
  Receipt,
  Edit2,
  FileSpreadsheet,
  ArrowUpDown,
  Filter
} from 'lucide-react';

export function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'parties' | 'vouchers'>('parties');
  const [isExportingMaster, setIsExportingMaster] = useState(false);

  // Parties Tab Filters & Sort (Latest First is Default)
  const [searchTerm, setSearchTerm] = useState('');
  const [partySortBy, setPartySortBy] = useState<string>('latest');
  const [partyBalanceFilter, setPartyBalanceFilter] = useState<string>('all');
  const [partiesPage, setPartiesPage] = useState(1);
  const [partiesLimit, setPartiesLimit] = useState(20);

  // Vouchers Tab Filters & Sort (Latest First is Default)
  const [voucherSearchTerm, setVoucherSearchTerm] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('ALL');
  const [voucherSortOrder, setVoucherSortOrder] = useState<'desc' | 'asc'>('desc');
  const [vouchersPage, setVouchersPage] = useState(1);
  const [vouchersLimit, setVouchersLimit] = useState(20);

  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<PaymentVoucherItem | null>(null);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<string | null>(null);
  const [preselectedPartyForVoucher, setPreselectedPartyForVoucher] = useState<string | undefined>(undefined);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedVoucherSearchTerm = useDebounce(voucherSearchTerm, 300);

  useEffect(() => {
    setPartiesPage(1);
  }, [partySortBy, partyBalanceFilter, debouncedSearchTerm]);

  useEffect(() => {
    setVouchersPage(1);
  }, [voucherTypeFilter, paymentModeFilter, voucherSortOrder, debouncedVoucherSearchTerm]);

  const { data: metrics, refetch: refetchMetrics } = useQuery<AccountingMetricsSummary>({
    queryKey: ['accounting-metrics'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AccountingMetricsSummary }>('/accounts/metrics');
      return res.data.data;
    }
  });

  const { data: partiesData, isLoading: isPartiesLoading, refetch: refetchParties } = useQuery<{
    items: PartyItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['accounts-parties', partySortBy, partyBalanceFilter, debouncedSearchTerm, partiesPage, partiesLimit],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page: partiesPage,
        limit: partiesLimit,
        sortBy: partySortBy,
        balanceFilter: partyBalanceFilter
      };
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }
      const res = await api.get<{
        success: boolean;
        data: { items: PartyItem[]; total: number; page: number; limit: number; totalPages: number };
      }>('/parties', {
        params
      });
      return res.data.data;
    }
  });

  const { data: vouchersData, isLoading: isVouchersLoading, refetch: refetchVouchers } = useQuery<{
    items: PaymentVoucherItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['accounts-vouchers', voucherTypeFilter, paymentModeFilter, voucherSortOrder, debouncedVoucherSearchTerm, vouchersPage, vouchersLimit],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page: vouchersPage,
        limit: vouchersLimit,
        sortOrder: voucherSortOrder
      };
      if (voucherTypeFilter !== 'ALL') {
        params.voucherType = voucherTypeFilter;
      }
      if (paymentModeFilter !== 'ALL') {
        params.paymentMode = paymentModeFilter;
      }
      if (debouncedVoucherSearchTerm.trim()) {
        params.search = debouncedVoucherSearchTerm.trim();
      }
      const res = await api.get<{
        success: boolean;
        data: { items: PaymentVoucherItem[]; total: number; page: number; limit: number; totalPages: number };
      }>('/accounts/vouchers', {
        params
      });
      return res.data.data;
    }
  });

  const parties = partiesData?.items || [];
  const vouchers = vouchersData?.items || [];

  function handleRefetchAll() {
    refetchMetrics();
    refetchParties();
    refetchVouchers();
  }

  async function handleExportMasterBalance() {
    setIsExportingMaster(true);
    try {
      await downloadExcelReport('/reports/master-balance/excel', 'Master_Party_Balance_Directory.xlsx');
    } catch (err) {
      console.error('Failed to export master balance:', err);
    } finally {
      setIsExportingMaster(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>Payments & Account Ledgers</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Track who owes you money, whom you owe, record payments, and view party account statements.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMasterBalance}
            disabled={isExportingMaster}
            className="gap-1.5 whitespace-nowrap shrink-0 bg-emerald-950/30 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50 hover:text-white"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExportingMaster ? 'Exporting...' : 'Master Balance Sheet (.xlsx)'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefetchAll} title="Refresh accounts" className="gap-1 whitespace-nowrap shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setPreselectedPartyForVoucher(undefined);
              setIsVoucherOpen(true);
            }}
            className="gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment / Receipt</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              Money We Have To Take
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(metrics?.totalReceivables || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Pending from customers (Buyers)</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Money We Have To Pay
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(metrics?.totalPayables || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Pending to knitters, units & suppliers</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Net Difference (Take minus Pay)
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(metrics?.netReceivablePosition || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Overall money balance</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-purple-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Receipt className="w-3 h-3" />
              Money Received This Month
            </div>
            <div className="text-lg font-bold font-mono text-purple-400 mt-1">
              {formatCurrency(metrics?.monthlyReceipts || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Total cash & bank collected in last 30 days</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('parties')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'parties'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Customer & Supplier Balances ({parties.length})
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'vouchers'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Payment Records (Money In / Out) ({vouchers.length})
        </button>
      </div>

      {activeTab === 'parties' && (
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
              {/* Balance Filter */}
              <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={partyBalanceFilter}
                  onChange={(e) => setPartyBalanceFilter(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Filter balances"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-200">All Balances</option>
                  <option value="receivable" className="bg-zinc-900 text-zinc-200">Receivable (Dr)</option>
                  <option value="payable" className="bg-zinc-900 text-zinc-200">Payable (Cr)</option>
                  <option value="zero" className="bg-zinc-900 text-zinc-200">Zero Balance</option>
                </select>
              </div>

              {/* Sort By Dropdown (Latest First is Default) */}
              <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <select
                  value={partySortBy}
                  onChange={(e) => setPartySortBy(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Sort order"
                >
                  <option value="latest" className="bg-zinc-900 text-zinc-200">Sort: Latest First (Default)</option>
                  <option value="oldest" className="bg-zinc-900 text-zinc-200">Sort: Oldest First</option>
                  <option value="balance_desc" className="bg-zinc-900 text-zinc-200">Sort: Highest Receivable</option>
                  <option value="balance_asc" className="bg-zinc-900 text-zinc-200">Sort: Highest Payable</option>
                  <option value="code" className="bg-zinc-900 text-zinc-200">Sort: Code (A-Z)</option>
                  <option value="name" className="bg-zinc-900 text-zinc-200">Sort: Name (A-Z)</option>
                </select>
              </div>
            </div>

            <div className="w-full lg:w-72 relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search party code or name..."
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Party</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Last Activity</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Contact & Phone</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Business Role</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Net Balance</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {isPartiesLoading ? (
                    <LoadingState isTableRow colSpan={7} message="Loading party account balances..." />
                  ) : parties.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        No parties found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    parties.map((p) => (
                      <tr key={p._id} className="group hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-semibold text-zinc-100">{p.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400 ml-2 bg-zinc-800/70 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            {p.code}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-zinc-300 whitespace-nowrap">
                          {formatDateTime(p.updatedAt || p.createdAt, true)}
                        </td>

                        <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">
                          <span>{p.contactPerson || '—'}</span>
                          {p.phone && <span className="text-[11px] font-mono text-zinc-500 ml-1.5">({p.phone})</span>}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {p.tags.isFabricBuyer && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Buyer
                              </span>
                            )}
                            {p.tags.isKnitter && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                Knitter
                              </span>
                            )}
                            {p.tags.isDyeingMill && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Unit
                              </span>
                            )}
                            {p.tags.isYarnClient && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Yarn Client
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <PartyBalanceBadge balance={p.currentBalance} />
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <Badge
                            variant={p.currentBalance > 0 ? 'default' : p.currentBalance < 0 ? 'destructive' : 'outline'}
                            className="text-[10px]"
                          >
                            {p.currentBalance > 0 ? 'They Owe Us' : p.currentBalance < 0 ? 'We Owe Them' : 'Settled (Zero)'}
                          </Badge>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPartyForLedger(p._id)}
                              className="text-[11px] py-1 px-2.5 h-7 gap-1 whitespace-nowrap"
                            >
                              <BookOpen className="w-3 h-3 text-emerald-400" />
                              View Ledger
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setPreselectedPartyForVoucher(p._id);
                                setIsVoucherOpen(true);
                              }}
                              className="text-[11px] py-1 px-2 h-7 whitespace-nowrap"
                            >
                              Record Payment
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollableTable>
            <PaginationControls
              page={partiesPage}
              totalPages={partiesData?.totalPages || 1}
              total={partiesData?.total || 0}
              limit={partiesLimit}
              onPageChange={setPartiesPage}
              onLimitChange={setPartiesLimit}
            />
          </Card>
        </div>
      )}

      {activeTab === 'vouchers' && (
        <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="p-2.5 border-b border-zinc-800 bg-zinc-950/40 flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
              {/* Money Flow Filter */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={voucherTypeFilter}
                  onChange={(e) => setVoucherTypeFilter(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Filter money flow"
                >
                  <option value="ALL" className="bg-zinc-900 text-zinc-200">All Money Flow</option>
                  <option value="RECEIPT" className="bg-zinc-900 text-zinc-200">Money Received (Receipts)</option>
                  <option value="PAYMENT" className="bg-zinc-900 text-zinc-200">Money Paid (Payments)</option>
                </select>
              </div>

              {/* Payment Mode Filter */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <select
                  value={paymentModeFilter}
                  onChange={(e) => setPaymentModeFilter(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Filter payment method"
                >
                  <option value="ALL" className="bg-zinc-900 text-zinc-200">All Methods</option>
                  <option value="CASH" className="bg-zinc-900 text-zinc-200">Cash in Hand</option>
                  <option value="BANK_TRANSFER" className="bg-zinc-900 text-zinc-200">Bank Transfer</option>
                  <option value="CHEQUE" className="bg-zinc-900 text-zinc-200">Bank Cheque</option>
                </select>
              </div>

              {/* Sort By Dropdown (Latest First is Default) */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <select
                  value={voucherSortOrder}
                  onChange={(e) => setVoucherSortOrder(e.target.value as 'desc' | 'asc')}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Sort order"
                >
                  <option value="desc" className="bg-zinc-900 text-zinc-200">Sort: Latest First (Default)</option>
                  <option value="asc" className="bg-zinc-900 text-zinc-200">Sort: Oldest First</option>
                </select>
              </div>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <Input
                placeholder="Search voucher #, bank, cheque, notes..."
                value={voucherSearchTerm}
                onChange={(e) => setVoucherSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
          <ScrollableTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Receipt / Payment #</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Money Flow</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Customer / Supplier</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Payment Method</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Bank / Cheque Details</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Amount (PKR)</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Notes</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isVouchersLoading ? (
                  <LoadingState isTableRow colSpan={9} message="Loading payment records..." />
                ) : vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">
                      No payment records found yet.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v._id} className="group hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {v.voucherNo}
                      </td>

                      <td className="py-2.5 px-3 text-zinc-300 font-mono whitespace-nowrap">
                        {formatDateTime(v.date, true)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={v.voucherType === 'RECEIPT' ? 'success' : 'default'}
                          className="text-[10px]"
                        >
                          {v.voucherType === 'RECEIPT' ? 'MONEY RECEIVED' : 'MONEY PAID'}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-zinc-100">{v.partyId?.name || '—'}</span>
                        {v.partyId?.code && (
                          <span className="text-[10px] font-mono text-zinc-400 ml-1.5 bg-zinc-800/70 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            {v.partyId.code}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-zinc-300">
                          {v.paymentMode === 'CASH'
                            ? 'Cash in Hand'
                            : v.paymentMode === 'BANK_TRANSFER'
                            ? 'Bank Transfer'
                            : v.paymentMode === 'CHEQUE'
                            ? 'Bank Cheque'
                            : v.paymentMode}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-zinc-300 font-mono whitespace-nowrap">
                        {v.bankName ? (
                          <span>
                            {v.bankName}
                            {(v.chequeNo || v.transactionRef) && (
                              <span className="text-[10px] text-zinc-400 ml-1.5">
                                ({v.chequeNo || v.transactionRef})
                              </span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatCurrency(v.amount)}
                      </td>

                      <td className="py-2.5 px-3 text-zinc-400 text-[11px] whitespace-nowrap truncate max-w-xs">
                        {v.remarks || '—'}
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingVoucher(v)}
                          className="text-[11px] py-1 px-2.5 h-7 gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-emerald-400" />
                          Edit / Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
          <PaginationControls
            page={vouchersPage}
            totalPages={vouchersData?.totalPages || 1}
            total={vouchersData?.total || 0}
            limit={vouchersLimit}
            onPageChange={setVouchersPage}
            onLimitChange={setVouchersLimit}
          />
        </Card>
      )}

      <CreateVoucherModal
        isOpen={isVoucherOpen}
        preselectedPartyId={preselectedPartyForVoucher}
        onClose={() => {
          setIsVoucherOpen(false);
          setPreselectedPartyForVoucher(undefined);
        }}
        onSuccess={handleRefetchAll}
      />

      <EditVoucherModal
        voucher={editingVoucher}
        isOpen={Boolean(editingVoucher)}
        onClose={() => setEditingVoucher(null)}
        onSuccess={handleRefetchAll}
      />

      <PartyLedgerModal
        partyId={selectedPartyForLedger}
        isOpen={Boolean(selectedPartyForLedger)}
        onClose={() => setSelectedPartyForLedger(null)}
        onSuccess={handleRefetchAll}
      />
    </div>
  );
}
