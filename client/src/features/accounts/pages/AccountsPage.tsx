import { PartyLink } from '../../../business/PartyLink.js';
import { useQueryPagination } from '../../../hooks/useQueryPagination.js';
import { QueryError } from '../../../components/ui/QueryError.js';
import { PageHeader } from '../../../components/ui/PageHeader.js';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { RefreshCw, Plus, ArrowDownLeft, ArrowUpRight, Search, BookOpen, Receipt, Edit2, FileSpreadsheet, ArrowUpDown, Filter } from 'lucide-react';

export function AccountsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'parties' | 'vouchers'>('parties');
  const [isExportingMaster, setIsExportingMaster] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Parties Tab Filters & Sort (Latest First is Default)
  const [searchTerm, setSearchTerm] = useState('');
  const [partySortBy, setPartySortBy] = useState<string>('latest');
  const [partyBalanceFilter, setPartyBalanceFilter] = useState<string>('all');

  // Vouchers Tab Filters & Sort (Latest First is Default)
  const [voucherSearchTerm, setVoucherSearchTerm] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('ALL');
  const [voucherSortOrder, setVoucherSortOrder] = useState<'desc' | 'asc'>('desc');

  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<PaymentVoucherItem | null>(null);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<string | null>(null);
  const [preselectedPartyForVoucher, setPreselectedPartyForVoucher] = useState<string | undefined>(undefined);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedVoucherSearchTerm = useDebounce(voucherSearchTerm, 300);

  const { page: partiesPage, limit: partiesLimit, setPage: setPartiesPage, setLimit: setPartiesLimit } = useQueryPagination([partySortBy, partyBalanceFilter, debouncedSearchTerm]);

  const { page: vouchersPage, limit: vouchersLimit, setPage: setVouchersPage, setLimit: setVouchersLimit } = useQueryPagination([voucherTypeFilter, paymentModeFilter, voucherSortOrder, debouncedVoucherSearchTerm]);

  const { isError: hasQueryError1,  data: metrics, refetch: refetchMetrics } = useQuery<AccountingMetricsSummary>({
    queryKey: ['accounting-metrics'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AccountingMetricsSummary }>('/accounts/metrics');
      return res.data.data;
    }
  });

  const { isError: hasQueryError2,  data: partiesData, isLoading: isPartiesLoading, refetch: refetchParties } = useQuery<{
    items: PartyItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    enabled: activeTab === 'parties',
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

  const { isError: hasQueryError3,  data: vouchersData, isLoading: isVouchersLoading, refetch: refetchVouchers } = useQuery<{
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
    queryClient.invalidateQueries({ queryKey: ['accounting-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['accounts-parties'] });
    queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
  }

  async function handleExportMasterBalance() {
    if (isExportingMaster) return;
    setExportError(null);
    setIsExportingMaster(true);
    try {
      await downloadExcelReport('/reports/master-balance/excel', 'Master_Party_Balance_Directory.xlsx');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'The master report could not be downloaded. Please try again.');
    } finally {
      setIsExportingMaster(false);
    }
  }

  return (
    <div className="space-y-6">
      {exportError && <p role="alert" className="rounded-lg border border-line p-3 text-sm text-danger">{exportError}</p>}
      <PageHeader title="Accounts & ledgers" description="Record payments and receipts. See balances and open a party statement."><div className="flex max-w-full flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMasterBalance}
            isLoading={isExportingMaster}
            className="gap-1.5 whitespace-nowrap shrink-0 bg-brand-soft border-line text-brand hover:bg-brand-soft hover:text-strong"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-brand" />
            <span>Master Balance Sheet (.xlsx)</span>
          </Button>

          <Button variant="outline" size="sm" preventDoubleClick onClick={handleRefetchAll} title="Refresh accounts" className="gap-1 whitespace-nowrap shrink-0">
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
        </div></PageHeader>
      {(hasQueryError1 || hasQueryError2 || hasQueryError3) && <QueryError onRetry={() => { refetchMetrics(); refetchParties(); refetchVouchers(); }} />}


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-brand normal-case tracking-normal flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              Money We Have To Take
            </div>
            <div className="text-lg font-bold font-mono text-brand mt-1">
              {formatCurrency(metrics?.totalReceivables || 0)}
            </div>
            <div className="text-xs text-soft mt-0.5">Pending from customers (Buyers)</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-warning normal-case tracking-normal flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Money We Have To Pay
            </div>
            <div className="text-lg font-bold font-mono text-warning mt-1">
              {formatCurrency(metrics?.totalPayables || 0)}
            </div>
            <div className="text-xs text-soft mt-0.5">Pending to knitters, units & suppliers</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-brand normal-case tracking-normal">
              Net Difference (Take minus Pay)
            </div>
            <div className="text-lg font-bold font-mono text-brand mt-1">
              {formatCurrency(metrics?.netReceivablePosition || 0)}
            </div>
            <div className="text-xs text-soft mt-0.5">Overall money balance</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-info normal-case tracking-normal flex items-center gap-1">
              <Receipt className="w-3 h-3" />
              Money Received This Month
            </div>
            <div className="text-lg font-bold font-mono text-info mt-1">
              {formatCurrency(metrics?.monthlyReceipts || 0)}
            </div>
            <div className="text-xs text-soft mt-0.5">Total cash & bank collected in last 30 days</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-1 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab('parties')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'parties'
              ? 'bg-primary text-white shadow-xs'
              : 'text-soft hover:text-strong hover:bg-subtle/60'
          }`}
        >
          Customer & Supplier Balances ({parties.length})
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'vouchers'
              ? 'bg-primary text-white shadow-xs'
              : 'text-soft hover:text-strong hover:bg-subtle/60'
          }`}
        >
          Payment Records (Money In / Out) ({vouchers.length})
        </button>
      </div>

      {activeTab === 'parties' && (
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-surface/50 p-2.5 rounded-lg border border-line">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
              {/* Balance Filter */}
              <div className="flex items-center gap-1.5 bg-canvas/80 border border-line rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-soft shrink-0" />
                <select
                  value={partyBalanceFilter}
                  onChange={(e) => setPartyBalanceFilter(e.target.value)}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Filter balances"
                >
                  <option value="all" className="bg-surface text-strong">All Balances</option>
                  <option value="receivable" className="bg-surface text-strong">Receivable (Dr)</option>
                  <option value="payable" className="bg-surface text-strong">Payable (Cr)</option>
                  <option value="zero" className="bg-surface text-strong">Zero Balance</option>
                </select>
              </div>

              {/* Sort By Dropdown (Latest First is Default) */}
              <div className="flex items-center gap-1.5 bg-canvas/80 border border-line rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-brand shrink-0" />
                <select
                  value={partySortBy}
                  onChange={(e) => setPartySortBy(e.target.value)}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Sort order"
                >
                  <option value="latest" className="bg-surface text-strong">Sort: Latest First (Default)</option>
                  <option value="oldest" className="bg-surface text-strong">Sort: Oldest First</option>
                  <option value="balance_desc" className="bg-surface text-strong">Sort: Highest Receivable</option>
                  <option value="balance_asc" className="bg-surface text-strong">Sort: Highest Payable</option>
                  <option value="code" className="bg-surface text-strong">Sort: Code (A-Z)</option>
                  <option value="name" className="bg-surface text-strong">Sort: Name (A-Z)</option>
                </select>
              </div>
            </div>

            <div className="w-full lg:w-72 relative">
              <Search className="w-4 h-4 text-soft absolute left-3 top-2.5 pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search party code or name..."
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <Card className="border-line bg-surface/80 overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/90 border-b border-line text-soft normal-case font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Party</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Last Activity</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Contact & Phone</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Business Role</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Net Balance</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-canvas z-20 border-l border-line shadow-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {isPartiesLoading ? (
                    <LoadingState isTableRow colSpan={7} message="Loading party account balances..." />
                  ) : parties.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-soft">
                        No parties found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    parties.map((p) => (
                      <tr key={p._id} className="group hover:bg-subtle/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <PartyLink party={p} />
                          <span className="text-xs font-mono text-soft ml-2 bg-subtle/70 px-1.5 py-0.5 rounded border border-control/50">
                            {p.code}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-ink whitespace-nowrap">
                          {formatDateTime(p.updatedAt || p.createdAt, true)}
                        </td>

                        <td className="py-2.5 px-3 text-ink whitespace-nowrap">
                          <span>{p.contactPerson || '—'}</span>
                          {p.phone && <span className="text-xs font-mono text-soft ml-1.5">({p.phone})</span>}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {p.tags.isFabricBuyer && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-brand border border-emerald-500/20">
                                Buyer
                              </span>
                            )}
                            {p.tags.isKnitter && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-info border border-purple-500/20">
                                Knitter
                              </span>
                            )}
                            {p.tags.isDyeingMill && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-brand border border-emerald-500/20">
                                Unit
                              </span>
                            )}
                            {p.tags.isYarnClient && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-warning border border-amber-500/20">
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
                            className="text-xs"
                          >
                            {p.currentBalance > 0 ? 'They Owe Us' : p.currentBalance < 0 ? 'We Owe Them' : 'Settled (Zero)'}
                          </Badge>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-surface group-hover:bg-subtle/90 z-10 border-l border-line shadow-sm">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPartyForLedger(p._id)}
                              className="text-xs py-1 px-2.5 h-7 gap-1 whitespace-nowrap"
                            >
                              <BookOpen className="w-3 h-3 text-brand" />
                              View Ledger
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setPreselectedPartyForVoucher(p._id);
                                setIsVoucherOpen(true);
                              }}
                              className="text-xs py-1 px-2 h-7 whitespace-nowrap"
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
        <Card className="border-line bg-surface/80 overflow-hidden">
          <div className="p-2.5 border-b border-line bg-canvas/40 flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
              {/* Money Flow Filter */}
              <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-soft shrink-0" />
                <select
                  value={voucherTypeFilter}
                  onChange={(e) => setVoucherTypeFilter(e.target.value)}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Filter money flow"
                >
                  <option value="ALL" className="bg-surface text-strong">All Money Flow</option>
                  <option value="RECEIPT" className="bg-surface text-strong">Money Received (Receipts)</option>
                  <option value="PAYMENT" className="bg-surface text-strong">Money Paid (Payments)</option>
                </select>
              </div>

              {/* Payment Mode Filter */}
              <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
                <select
                  value={paymentModeFilter}
                  onChange={(e) => setPaymentModeFilter(e.target.value)}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Filter payment method"
                >
                  <option value="ALL" className="bg-surface text-strong">All Methods</option>
                  <option value="CASH" className="bg-surface text-strong">Cash in Hand</option>
                  <option value="BANK_TRANSFER" className="bg-surface text-strong">Bank Transfer</option>
                  <option value="CHEQUE" className="bg-surface text-strong">Bank Cheque</option>
                </select>
              </div>

              {/* Sort By Dropdown (Latest First is Default) */}
              <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-brand shrink-0" />
                <select
                  value={voucherSortOrder}
                  onChange={(e) => setVoucherSortOrder(e.target.value as 'desc' | 'asc')}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Sort order"
                >
                  <option value="desc" className="bg-surface text-strong">Sort: Latest First (Default)</option>
                  <option value="asc" className="bg-surface text-strong">Sort: Oldest First</option>
                </select>
              </div>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft pointer-events-none" />
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
              <thead className="bg-canvas/90 border-b border-line text-soft normal-case font-semibold">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Receipt / Payment #</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Money Flow</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Customer / Supplier</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Payment Method</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Bank / Cheque Details</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Amount (PKR)</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Notes</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-canvas z-20 border-l border-line shadow-sm">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {isVouchersLoading ? (
                  <LoadingState isTableRow colSpan={9} message="Loading payment records..." />
                ) : vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-soft">
                      No payment records found yet.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v._id} className="group hover:bg-subtle/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-brand whitespace-nowrap">
                        {v.voucherNo}
                      </td>

                      <td className="py-2.5 px-3 text-ink font-mono whitespace-nowrap">
                        {formatDateTime(v.date, true)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={v.voucherType === 'RECEIPT' ? 'success' : 'default'}
                          className="text-xs"
                        >
                          {v.voucherType === 'RECEIPT' ? 'MONEY RECEIVED' : 'MONEY PAID'}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <PartyLink party={v.partyId} />
                        {v.partyId?.code && (
                          <span className="text-xs font-mono text-soft ml-1.5 bg-subtle/70 px-1.5 py-0.5 rounded border border-control/50">
                            {v.partyId.code}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-ink">
                          {v.paymentMode === 'CASH'
                            ? 'Cash in Hand'
                            : v.paymentMode === 'BANK_TRANSFER'
                            ? 'Bank Transfer'
                            : v.paymentMode === 'CHEQUE'
                            ? 'Bank Cheque'
                            : v.paymentMode}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-ink font-mono whitespace-nowrap">
                        {v.bankName ? (
                          <span>
                            {v.bankName}
                            {(v.chequeNo || v.transactionRef) && (
                              <span className="text-xs text-soft ml-1.5">
                                ({v.chequeNo || v.transactionRef})
                              </span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand whitespace-nowrap">
                        {formatCurrency(v.amount)}
                      </td>

                      <td className="py-2.5 px-3 text-soft text-xs whitespace-nowrap truncate max-w-xs">
                        {v.remarks || '—'}
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-surface group-hover:bg-subtle/90 z-10 border-l border-line shadow-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingVoucher(v)}
                          className="text-xs py-1 px-2.5 h-7 gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-brand" />
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

      {isVoucherOpen && <CreateVoucherModal
        isOpen={isVoucherOpen}
        preselectedPartyId={preselectedPartyForVoucher}
        onClose={() => {
          setIsVoucherOpen(false);
          setPreselectedPartyForVoucher(undefined);
        }}
        onSuccess={handleRefetchAll}
      />}

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
