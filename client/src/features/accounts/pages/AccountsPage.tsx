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
import { PartyLedgerModal } from '../components/PartyLedgerModal.js';
import { formatCurrency, formatDate } from '../../../lib/formatters.js';
import {
  DollarSign,
  RefreshCw,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  BookOpen,
  Receipt
} from 'lucide-react';

export function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'parties' | 'vouchers'>('parties');
  const [searchTerm, setSearchTerm] = useState('');
  const [partiesPage, setPartiesPage] = useState(1);
  const [partiesLimit, setPartiesLimit] = useState(20);

  const [voucherSearchTerm, setVoucherSearchTerm] = useState('');
  const [vouchersPage, setVouchersPage] = useState(1);
  const [vouchersLimit, setVouchersLimit] = useState(20);

  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<string | null>(null);
  const [preselectedPartyForVoucher, setPreselectedPartyForVoucher] = useState<string | undefined>(undefined);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedVoucherSearchTerm = useDebounce(voucherSearchTerm, 300);

  useEffect(() => {
    setPartiesPage(1);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setVouchersPage(1);
  }, [debouncedVoucherSearchTerm]);

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
    queryKey: ['accounts-parties', debouncedSearchTerm, partiesPage, partiesLimit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: partiesPage, limit: partiesLimit };
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
    queryKey: ['accounts-vouchers', debouncedVoucherSearchTerm, vouchersPage, vouchersLimit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: vouchersPage, limit: vouchersLimit };
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Financial Accounting & Party Ledgers
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Running Dr/Cr ledger balances, double-entry payment vouchers, and cashflow tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefetchAll} title="Refresh accounts">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setPreselectedPartyForVoucher(undefined);
              setIsVoucherOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Log Payment Voucher
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              Total Receivables (Debtors)
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(metrics?.totalReceivables || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Owed by fabric buyers</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Total Payables (Creditors)
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(metrics?.totalPayables || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Owed to knitters & mills</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Net Financial Position
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(metrics?.netReceivablePosition || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Receivables minus payables</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-purple-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Receipt className="w-3 h-3" />
              Monthly Inflow (Receipts)
            </div>
            <div className="text-lg font-bold font-mono text-purple-400 mt-1">
              {formatCurrency(metrics?.monthlyReceipts || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Last 30 days cash & bank receipts</div>
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
          Party Balances & Ledgers ({parties.length})
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'vouchers'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Payment Vouchers Log ({vouchers.length})
        </button>
      </div>

      {activeTab === 'parties' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
            <div className="text-xs font-semibold text-zinc-300">
              Customer & Supplier Accounts Directory
            </div>

            <div className="w-full md:w-72 relative">
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Party</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Role Classification</th>
                    <th className="py-3 px-4 text-right">Running Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {isPartiesLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500">
                        Loading party balances...
                      </td>
                    </tr>
                  ) : parties.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500">
                        No parties found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    parties.map((p) => (
                      <tr key={p._id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-100">{p.name}</div>
                          <div className="text-[10px] font-mono text-zinc-500">{p.code}</div>
                        </td>

                        <td className="py-3 px-4 text-zinc-400">
                          <div>{p.contactPerson || '—'}</div>
                          <div className="text-[10px] font-mono text-zinc-500">{p.phone}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
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
                                Mill
                              </span>
                            )}
                            {p.tags.isYarnClient && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Yarn Client
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <PartyBalanceBadge balance={p.currentBalance} />
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={p.currentBalance > 0 ? 'default' : p.currentBalance < 0 ? 'destructive' : 'outline'}
                            className="text-[10px]"
                          >
                            {p.currentBalance > 0 ? 'Dr (Receivable)' : p.currentBalance < 0 ? 'Cr (Payable)' : 'Settled'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPartyForLedger(p._id)}
                              className="text-[11px] py-1 px-2.5 h-7 gap-1"
                            >
                              <BookOpen className="w-3 h-3 text-emerald-400" />
                              Statement
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setPreselectedPartyForVoucher(p._id);
                                setIsVoucherOpen(true);
                              }}
                              className="text-[11px] py-1 px-2 h-7"
                            >
                              Pay / Receive
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search voucher #, bank, cheque, ref, remarks..."
                value={voucherSearchTerm}
                onChange={(e) => setVoucherSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Bank / Instrument #</th>
                  <th className="py-3 px-4 text-right">Amount (PKR)</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isVouchersLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      Loading payment vouchers...
                    </td>
                  </tr>
                ) : vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No payment vouchers logged yet.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v._id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {v.voucherNo}
                      </td>

                      <td className="py-3 px-4 text-zinc-400 font-mono">
                        {formatDate(v.date)}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={v.voucherType === 'RECEIPT' ? 'success' : 'default'}
                          className="text-[10px]"
                        >
                          {v.voucherType === 'RECEIPT' ? 'RECEIPT (CR)' : 'PAYMENT (DR)'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-100">{v.partyId?.name || '—'}</div>
                        <div className="text-[10px] font-mono text-zinc-500">{v.partyId?.code}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-zinc-300">
                          {v.paymentMode}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-zinc-400 font-mono">
                        {v.bankName ? (
                          <div>
                            <div>{v.bankName}</div>
                            <div className="text-[10px] text-zinc-500">{v.chequeNo || v.transactionRef}</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(v.amount)}
                      </td>

                      <td className="py-3 px-4 text-zinc-400 text-[11px] truncate max-w-xs">
                        {v.remarks || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

      <PartyLedgerModal
        partyId={selectedPartyForLedger}
        isOpen={Boolean(selectedPartyForLedger)}
        onClose={() => setSelectedPartyForLedger(null)}
      />
    </div>
  );
}
