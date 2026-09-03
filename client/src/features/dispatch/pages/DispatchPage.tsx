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
import { formatCurrency, formatWeight, formatDate } from '../../../lib/formatters.js';
import {
  Truck,
  RefreshCw,
  Plus,
  Receipt,
  FileCheck,
  Search,
  Inbox,
  Printer
} from 'lucide-react';

export function DispatchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState<{ type: 'OGP' | 'INVOICE'; dispatch: DispatchItem } | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  const { data, isLoading, refetch } = useQuery<{
    items: DispatchItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['dispatches', debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
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
            <Truck className="w-5 h-5 text-emerald-500" />
            Fast Dispatch, OGP & 18% GST Dual Invoicing
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            RapidGridEntry keyboard roll weighing, pick-from location routing, and atomic ledger posting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh dispatches">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Dispatch (OGP)
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
              Commercial Base Sales
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

      <div className="flex items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
        <div className="text-xs font-semibold text-zinc-300">
          Dispatch & Inward Gate Pass Audit History ({dispatches.length})
        </div>

        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search dispatch, OGP, invoice, buyer..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Dispatch & Date</th>
                <th className="py-3 px-4">OGP #</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Origin Location</th>
                <th className="py-3 px-4">Fabric & Color</th>
                <th className="py-3 px-4 text-right">Rolls</th>
                <th className="py-3 px-4 text-right">Net Weight</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Tax Type</th>
                <th className="py-3 px-4 text-center">Print / Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-500">
                    Loading dispatches...
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-500">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    No dispatches recorded yet. Click &quot;New Dispatch (OGP)&quot; to create your first delivery.
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => (
                  <tr key={d._id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-emerald-400">{d.dispatchNo}</div>
                      <div className="text-[10px] text-zinc-500">{formatDate(d.date)}</div>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-zinc-200">
                      {d.ogpNo}
                    </td>

                    <td className="py-3 px-4 font-mono text-purple-400 font-semibold">
                      {d.invoice?.invoiceNo || '—'}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-100">{d.customerId?.name || '—'}</div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        {d.customerId?.code} • {d.customerId?.phone || 'No phone'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
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
                          ? 'Ghumman Mill'
                          : 'Rajput Mill'}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-200">{d.fabricType}</div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {d.color} • {d.yarnSpec}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-300">
                      {d.totalRolls}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatWeight(d.totalNetWeightKg)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {d.invoice ? formatCurrency(d.invoice.grandTotal) : '—'}
                    </td>

                    <td className="py-3 px-4 text-center">
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

                    <td className="py-3 px-4 text-center">
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
        </div>
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
    </div>
  );
}
