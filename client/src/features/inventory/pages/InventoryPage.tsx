import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import {
  FabricInventoryItem,
  StockTransferItem,
  InventoryLocation,
  FabricState
} from '../types/inventory.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { Input } from '../../../components/ui/Input.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { TransferStockModal } from '../components/TransferStockModal.js';
import { AdjustStockModal } from '../components/AdjustStockModal.js';
import { formatWeight, formatDate } from '../../../lib/formatters.js';
import { exportToCsv } from '../../../lib/csvExport.js';
import {
  Boxes,
  Warehouse,
  Factory,
  RefreshCw,
  ArrowRightLeft,
  Wrench,
  Search,
  ArrowRight,
  Download
} from 'lucide-react';

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'holdings' | 'transfers'>('holdings');
  const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | 'ALL'>('ALL');
  const [selectedState, setSelectedState] = useState<FabricState | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [transfersSearchTerm, setTransfersSearchTerm] = useState('');
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersLimit, setTransfersLimit] = useState(20);

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<FabricInventoryItem | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedTransfersSearchTerm = useDebounce(transfersSearchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [selectedLocation, selectedState, debouncedSearchTerm]);

  useEffect(() => {
    setTransfersPage(1);
  }, [debouncedTransfersSearchTerm]);

  const { data: stockData, isLoading: isStockLoading, refetch: refetchStock } = useQuery<{
    items: FabricInventoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['inventory-items', selectedLocation, selectedState, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (selectedLocation !== 'ALL') {
        params.location = selectedLocation;
      }
      if (selectedState !== 'ALL') {
        params.state = selectedState;
      }
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }

      const res = await api.get<{
        success: boolean;
        data: { items: FabricInventoryItem[]; total: number; page: number; limit: number; totalPages: number };
      }>(
        '/inventory/items',
        { params }
      );
      return res.data.data;
    }
  });

  const { data: transfersData, isLoading: isTransfersLoading, refetch: refetchTransfers } = useQuery<{
    items: StockTransferItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['inventory-transfers', debouncedTransfersSearchTerm, transfersPage, transfersLimit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: transfersPage, limit: transfersLimit };
      if (debouncedTransfersSearchTerm.trim()) {
        params.search = debouncedTransfersSearchTerm.trim();
      }
      const res = await api.get<{
        success: boolean;
        data: { items: StockTransferItem[]; total: number; page: number; limit: number; totalPages: number };
      }>('/inventory/transfers', { params });
      return res.data.data;
    }
  });

  const items = stockData?.items || [];
  const transfers = transfersData?.items || [];

  function handleRefetchAll() {
    refetchStock();
    refetchTransfers();
  }

  const kpis = useMemo(() => {
    let godownRolls = 0;
    let godownKg = 0;
    let millRolls = 0;
    let millKg = 0;
    let finishedRolls = 0;
    let finishedKg = 0;
    let ecruRolls = 0;
    let ecruKg = 0;

    items.forEach((i) => {
      if (i.location === 'ZR_GODOWN') {
        godownRolls += i.totalRolls;
        godownKg += i.totalWeightKg;
      } else {
        millRolls += i.totalRolls;
        millKg += i.totalWeightKg;
      }

      if (i.state === 'FINISHED_DYED') {
        finishedRolls += i.totalRolls;
        finishedKg += i.totalWeightKg;
      } else {
        ecruRolls += i.totalRolls;
        ecruKg += i.totalWeightKg;
      }
    });

    return { godownRolls, godownKg, millRolls, millKg, finishedRolls, finishedKg, ecruRolls, ecruKg };
  }, [items]);

  function handleExportCsv() {
    exportToCsv(
      `inventory_holdings_${new Date().toISOString().split('T')[0]}`,
      [
        { header: 'Location', accessor: (i) => i.location },
        { header: 'Fabric Variety', accessor: (i) => i.fabricType },
        { header: 'State', accessor: (i) => i.state },
        { header: 'Color / Shade', accessor: (i) => i.color || 'ECRU' },
        { header: 'Yarn Spec', accessor: (i) => i.yarnSpec },
        { header: 'Total Rolls', accessor: (i) => i.totalRolls },
        { header: 'Total Weight (Kg)', accessor: (i) => i.totalWeightKg },
        {
          header: 'Avg Weight/Roll (Kg)',
          accessor: (i) => (i.totalRolls > 0 ? (i.totalWeightKg / i.totalRolls).toFixed(2) : 0)
        }
      ],
      items
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-500" />
            Live Location-Aware Inventory
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time dual-state fabric tracking across ZR Godown and Processing Mills.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} title="Download CSV spreadsheet" className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefetchAll} title="Refresh inventory">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setSelectedItemForTransfer(null);
              setIsTransferOpen(true);
            }}
            className="gap-1.5"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transfer Stock
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAdjustOpen(true)}
            className="gap-1.5"
          >
            <Wrench className="w-4 h-4" />
            Audit Adjustment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Warehouse className="w-3 h-3" />
              ZR Godown (Main Depot)
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.godownKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{kpis.godownRolls} ready rolls in central depot</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Factory className="w-3 h-3" />
              Processing Mills Stock
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.millKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{kpis.millRolls} rolls across Ghumman & Rajput</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-purple-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">
              Finished Dyed Fabric
            </div>
            <div className="text-lg font-bold font-mono text-purple-400 mt-1">
              {formatWeight(kpis.finishedKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{kpis.finishedRolls} rolls ready for dispatch</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
              Raw Ecru Knitted Fabric
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatWeight(kpis.ecruKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{kpis.ecruRolls} unprocessed grey rolls</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('holdings')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'holdings'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Live Fabric Inventory Holdings ({items.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'transfers'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Inter-Location Transfer Log ({transfers.length})
        </button>
      </div>

      {activeTab === 'holdings' && (
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-400 mr-1">Location:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ZR_GODOWN', label: 'ZR Godown' },
                { id: 'GHUMMAN_DYEING', label: 'Ghumman Mill' },
                { id: 'RAJPUT_DYEING', label: 'Rajput Mill' }
              ].map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc.id as typeof selectedLocation)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    selectedLocation === loc.id
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {loc.label}
                </button>
              ))}

              <div className="h-4 w-px bg-zinc-700 mx-2" />

              <span className="text-[11px] font-semibold text-zinc-400 mr-1">State:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'FINISHED_DYED', label: 'Finished Dyed' },
                { id: 'RAW_ECRU', label: 'Raw Ecru' }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedState(st.id as typeof selectedState)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    selectedState === st.id
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="w-full md:w-64 relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search fabric, spec, color..."
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Fabric Variety</th>
                    <th className="py-3 px-4">Yarn Spec</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Color Shade</th>
                    <th className="py-3 px-4">Current Location</th>
                    <th className="py-3 px-4 text-right">Rolls Count</th>
                    <th className="py-3 px-4 text-right">Available Weight</th>
                    <th className="py-3 px-4 text-right">Avg Weight / Roll</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {isStockLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500">
                        Loading fabric inventory...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500">
                        No fabric stock found matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const avgWeight = item.totalRolls > 0 ? item.totalWeightKg / item.totalRolls : 0;

                      return (
                        <tr key={item._id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-zinc-100">
                            {item.fabricType}
                          </td>

                          <td className="py-3 px-4 font-mono text-zinc-400">
                            {item.yarnSpec}
                          </td>

                          <td className="py-3 px-4">
                            <Badge
                              variant={item.state === 'FINISHED_DYED' ? 'success' : 'warning'}
                              className="text-[10px]"
                            >
                              {item.state === 'FINISHED_DYED' ? 'DYED' : 'RAW ECRU'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                              {item.color}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                item.location === 'ZR_GODOWN'
                                  ? 'default'
                                  : item.location === 'GHUMMAN_DYEING'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="text-[10px]"
                            >
                              {item.location === 'ZR_GODOWN'
                                ? 'ZR Godown'
                                : item.location === 'GHUMMAN_DYEING'
                                ? 'Ghumman Mill'
                                : 'Rajput Mill'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-zinc-200">
                            {item.totalRolls}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatWeight(item.totalWeightKg)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-zinc-400">
                            {avgWeight.toFixed(2)} Kg/R
                          </td>

                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedItemForTransfer(item);
                                setIsTransferOpen(true);
                              }}
                              className="text-[11px] py-1 px-2.5 h-7 gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              Transfer
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={stockData?.totalPages || 1}
              total={stockData?.total || 0}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </Card>
        </div>
      )}

      {activeTab === 'transfers' && (
        <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search transfer #, fabric, color, vehicle..."
                value={transfersSearchTerm}
                onChange={(e) => setTransfersSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Fabric Variety & Color</th>
                  <th className="py-3 px-4 text-right">Rolls</th>
                  <th className="py-3 px-4 text-right">Weight (Kg)</th>
                  <th className="py-3 px-4">Gate Pass #</th>
                  <th className="py-3 px-4">Driver / Vehicle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isTransfersLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      Loading transfers log...
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No inter-location transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((trf) => (
                    <tr key={trf._id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {trf.transferNo}
                      </td>

                      <td className="py-3 px-4 text-zinc-400 font-mono">
                        {formatDate(trf.date)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                          <span className="text-zinc-300">{trf.fromLocation}</span>
                          <ArrowRight className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">{trf.toLocation}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100">{trf.fabricType}</div>
                        <div className="text-[10px] text-zinc-400">
                          {trf.color} • {trf.state}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200">
                        {trf.rollsCount}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatWeight(trf.weightKg)}
                      </td>

                      <td className="py-3 px-4 font-mono text-zinc-300">
                        {trf.gatePassNo || '—'}
                      </td>

                      <td className="py-3 px-4 text-zinc-400">
                        <div>{trf.driverName || '—'}</div>
                        <div className="text-[10px] font-mono text-zinc-500">{trf.vehicleNo}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={transfersPage}
            totalPages={transfersData?.totalPages || 1}
            total={transfersData?.total || 0}
            limit={transfersLimit}
            onPageChange={setTransfersPage}
            onLimitChange={setTransfersLimit}
          />
        </Card>
      )}

      <TransferStockModal
        isOpen={isTransferOpen}
        preselectedItem={selectedItemForTransfer}
        onClose={() => {
          setIsTransferOpen(false);
          setSelectedItemForTransfer(null);
        }}
        onSuccess={handleRefetchAll}
      />

      <AdjustStockModal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        onSuccess={handleRefetchAll}
      />
    </div>
  );
}
