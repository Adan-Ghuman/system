import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { DispatchItem } from '../types/dispatch.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { Input } from '../../../components/ui/Input.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { CreateDispatchModal } from '../components/CreateDispatchModal.js';
import { PrintDocumentModal } from '../../export/components/PrintDocumentModal.js';
import { GatePassRegisterModal } from '../../reports/components/GatePassRegisterModal.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatCurrency, formatWeight, formatDateTime } from '../../../lib/formatters.js';
import {
  Truck,
  RefreshCw,
  Plus,
  Receipt,
  FileCheck,
  Search,
  Inbox,
  Printer,
  FileText,
  ArrowUpDown,
  Filter
} from 'lucide-react';

export function DispatchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromLocation, setFromLocation] = useState<string>('ALL');
  const [invoiceType, setInvoiceType] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState<{ type: 'OGP' | 'INVOICE'; dispatch: DispatchItem } | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [fromLocation, invoiceType, sortOrder, debouncedSearchTerm]);

  const { data, isLoading, refetch } = useQuery<{
    items: DispatchItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['dispatches', fromLocation, invoiceType, sortOrder, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit, sortOrder };
      if (fromLocation !== 'ALL') {
        params.fromLocation = fromLocation;
      }
      if (invoiceType !== 'ALL') {
        params.invoiceType = invoiceType;
      }
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }
      const res = await api.get<{
        success: boolean;
        data: { items: DispatchItem[]; total: number; page: number; limit: number; totalPages: number };
      }>('/dispatch', {
        params
      });
      return res.data.data;
    }
  });

  const dispatches = data?.items || [];

  const kpis = useMemo(() => {
    let totalRolls = 0;
    let totalNetKg = 0;
    let totalBase = 0;
    let totalTax = 0;
    let totalGrand = 0;

    dispatches.forEach((d) => {
      totalRolls += d.totalRolls;
      totalNetKg += d.totalNetWeightKg;
      if (d.invoice) {
        totalBase += d.invoice.baseAmount;
        totalTax += d.invoice.taxAmount;
        totalGrand += d.invoice.grandTotal;
      }
    });

    return { totalRolls, totalNetKg, totalBase, totalTax, totalGrand };
  }, [dispatches]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>Deliveries, Gate Passes & Invoices</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Create delivery gate passes (OGP), automatically deduct stock, and print bills or 18% GST invoices.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 whitespace-nowrap shrink-0 text-blue-400 border-blue-900/50 hover:bg-blue-950/40"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>OGP / IGP Registers</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh dispatches" className="gap-1 whitespace-nowrap shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" />
            <span>New Delivery (Gate Pass & Bill)</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3 h-3" />
              Total Dispatched Fabric
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.totalNetKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{kpis.totalRolls} total rolls dispatched</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Total Sales (Base Amount)
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {formatCurrency(kpis.totalBase)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Excluding sales tax</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Receipt className="w-3 h-3" />
              18% GST Sales Tax
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(kpis.totalTax)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Sales tax invoiced</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <FileCheck className="w-3 h-3" />
              Total Invoiced (Receivable)
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(kpis.totalGrand)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Debited to customer accounts</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
          {/* Location Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
            <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <select
              value={fromLocation}
              onChange={(e) => setFromLocation(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
              title="Origin warehouse / unit"
            >
              <option value="ALL" className="bg-zinc-900 text-zinc-200">All Locations</option>
              <option value="ZR_GODOWN" className="bg-zinc-900 text-zinc-200">ZR Godown (Main)</option>
              <option value="GHUMMAN_DYEING" className="bg-zinc-900 text-zinc-200">Ghumman Dyeing</option>
              <option value="RAJPUT_DYEING" className="bg-zinc-900 text-zinc-200">Rajput Dyeing</option>
              <option value="HAFIZ_SAAD_DYEING" className="bg-zinc-900 text-zinc-200">Hafiz Saad Dyeing</option>
              <option value="HB_DYEING" className="bg-zinc-900 text-zinc-200">HB Dyeing</option>
            </select>
          </div>

          {/* Invoice / Dispatch Type */}
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
            <select
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
              title="Tax invoice type"
            >
              <option value="ALL" className="bg-zinc-900 text-zinc-200">All Tax Types</option>
              <option value="TAX_18_PERCENT" className="bg-zinc-900 text-zinc-200">18% GST (Tax Invoice)</option>
              <option value="NON_GST" className="bg-zinc-900 text-zinc-200">Non-GST (Commercial)</option>
            </select>
          </div>

          {/* Sort By Dropdown (Latest First is Default) */}
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
              title="Sort order"
            >
              <option value="desc" className="bg-zinc-900 text-zinc-200">Sort: Latest First (Default)</option>
              <option value="asc" className="bg-zinc-900 text-zinc-200">Sort: Oldest First</option>
            </select>
          </div>
        </div>

        <div className="w-full lg:w-72 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search dispatch, OGP, buyer, fabric..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Dispatch #</th>
                <th className="py-3 px-4 whitespace-nowrap">Date</th>
                <th className="py-3 px-4 whitespace-nowrap">OGP #</th>
                <th className="py-3 px-4 whitespace-nowrap">Invoice #</th>
                <th className="py-3 px-4 whitespace-nowrap">Customer</th>
                <th className="py-3 px-4 whitespace-nowrap">Origin Location</th>
                <th className="py-3 px-4 whitespace-nowrap">Fabric & Color</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Rolls</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Net Weight</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Grand Total</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Tax Type</th>
                <th className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Print / Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={12} message="Loading delivery & invoice records..." />
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-zinc-500">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    No dispatches recorded yet. Click &quot;New Dispatch (OGP)&quot; to create your first delivery.
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => (
                  <tr key={d._id} className="group hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {d.dispatchNo}
                    </td>

                    <td className="py-3 px-4 text-zinc-300 font-mono whitespace-nowrap">
                      {formatDateTime(d.date, true)}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-zinc-200 whitespace-nowrap">
                      {d.ogpNo}
                    </td>

                    <td className="py-3 px-4 font-mono text-purple-400 font-semibold whitespace-nowrap">
                      {d.invoice?.invoiceNo || '—'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-zinc-100">{d.customerId?.name || '—'}</span>
                      {d.customerId?.code && (
                        <span className="text-[10px] font-mono text-zinc-400 ml-1.5 bg-zinc-800/70 px-1.5 py-0.5 rounded border border-zinc-700/50">
                          {d.customerId.code}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge
                        variant={
                          d.fromLocation === 'ZR_GODOWN'
                            ? 'default'
                            : d.fromLocation === 'GHUMMAN_DYEING'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {d.fromLocation === 'ZR_GODOWN'
                          ? 'ZR Godown'
                          : d.fromLocation === 'GHUMMAN_DYEING'
                          ? 'Ghuman Unit'
                          : d.fromLocation === 'RAJPUT_DYEING'
                          ? 'Rajput Unit'
                          : d.fromLocation === 'HAFIZ_SAAD_DYEING'
                          ? 'Hafiz Saad Unit'
                          : d.fromLocation === 'HB_DYEING'
                          ? 'HB Unit'
                          : 'Unit'}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-zinc-200">{d.fabricType}</span>
                      <span className="text-[10px] text-zinc-400 ml-1.5">({d.color} • {d.yarnSpec})</span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-300 whitespace-nowrap">
                      {d.totalRolls}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {formatWeight(d.totalNetWeightKg)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {d.invoice ? formatCurrency(d.invoice.grandTotal) : '—'}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {d.invoice?.invoiceType === 'TAX_18_PERCENT' ? (
                        <Badge variant="warning" className="text-[10px]">
                          18% GST
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          Non-GST
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 transition-colors z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPrintDoc({ type: 'OGP', dispatch: d })}
                          className="text-[10px] py-1 px-2 h-6 gap-1"
                        >
                          <Printer className="w-2.5 h-2.5" />
                          OGP
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPrintDoc({ type: 'INVOICE', dispatch: d })}
                          className="text-[10px] py-1 px-2 h-6 gap-1"
                        >
                          <Receipt className="w-2.5 h-2.5" />
                          Invoice
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
          page={page}
          totalPages={data?.totalPages || 1}
          total={data?.total || 0}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </Card>

      <CreateDispatchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />

      <PrintDocumentModal
        isOpen={Boolean(printDoc)}
        onClose={() => setPrintDoc(null)}
        type={printDoc?.type || 'OGP'}
        dispatch={printDoc?.dispatch || null}
      />

      <GatePassRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        defaultType="OGP"
      />
    </div>
  );
}
