import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import {
  FabricInventoryItem,
  StockTransferItem,
  InventoryLocation,
  FabricState,
  InventorySummaryGroup
} from '../types/inventory.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { Input } from '../../../components/ui/Input.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { TransferStockModal } from '../components/TransferStockModal.js';
import { AdjustStockModal } from '../components/AdjustStockModal.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatWeight, formatDate, formatDateTime } from '../../../lib/formatters.js';
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
  Download,
  ArrowUpDown,
  Filter
} from 'lucide-react';

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'holdings' | 'transfers'>('holdings');
  const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | 'ALL'>('ALL');
  const [selectedState, setSelectedState] = useState<FabricState | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'fabricType' | 'weight_desc' | 'rolls_desc'>('latest');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [transfersSearchTerm, setTransfersSearchTerm] = useState('');
  const [transferFromLocation, setTransferFromLocation] = useState<string>('ALL');
  const [transferSortOrder, setTransferSortOrder] = useState<'desc' | 'asc'>('desc');
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersLimit, setTransfersLimit] = useState(20);

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<FabricInventoryItem | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedTransfersSearchTerm = useDebounce(transfersSearchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [selectedLocation, selectedState, sortBy, debouncedSearchTerm]);

  useEffect(() => {
    setTransfersPage(1);
  }, [transferFromLocation, transferSortOrder, debouncedTransfersSearchTerm]);

  const { data: stockData, isLoading: isStockLoading, refetch: refetchStock } = useQuery<{
    items: FabricInventoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['inventory-items', selectedLocation, selectedState, sortBy, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit, sortBy };
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
    queryKey: ['inventory-transfers', transferFromLocation, transferSortOrder, debouncedTransfersSearchTerm, transfersPage, transfersLimit],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page: transfersPage,
        limit: transfersLimit,
        sortOrder: transferSortOrder
      };
      if (transferFromLocation !== 'ALL') {
        params.fromLocation = transferFromLocation;
      }
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

  const { data: stockSummaryData, refetch: refetchSummary } = useQuery<InventorySummaryGroup[]>({
    queryKey: ['inventory-summary', selectedLocation, selectedState, debouncedSearchTerm],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedLocation !== 'ALL') {
        params.location = selectedLocation;
      }
      if (selectedState !== 'ALL') {
        params.state = selectedState;
      }
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }
      const res = await api.get<{ success: boolean; data: InventorySummaryGroup[] }>('/inventory/summary', { params });
      return res.data.data;
    }
  });

  const items = stockData?.items || [];
  const transfers = transfersData?.items || [];

  function handleRefetchAll() {
    refetchStock();
    refetchTransfers();
    refetchSummary();
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

    (stockSummaryData || []).forEach((group) => {
      if (group._id.location === 'ZR_GODOWN') {
        godownRolls += group.totalRolls;
        godownKg += group.totalWeightKg;
      } else {
        millRolls += group.totalRolls;
        millKg += group.totalWeightKg;
      }

      if (group._id.state === 'FINISHED_DYED') {
        finishedRolls += group.totalRolls;
        finishedKg += group.totalWeightKg;
      } else {
        ecruRolls += group.totalRolls;
        ecruKg += group.totalWeightKg;
      }
    });

    return { godownRolls, godownKg, millRolls, millKg, finishedRolls, finishedKg, ecruRolls, ecruKg };
  }, [stockSummaryData]);

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
        { header: 'Last Updated', accessor: (i) => (i.updatedAt ? formatDate(i.updatedAt) : '—') },
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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>Fabric Stock & Warehouse</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Live stock of finished dyed fabric and raw grey rolls across ZR Godown and partner units.
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 pb-1">
          <Button variant="outline" size="sm" onClick={handleExportCsv} title="Download CSV spreadsheet" className="gap-1.5 whitespace-nowrap shrink-0">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefetchAll} title="Refresh inventory" className="gap-1 px-2.5 whitespace-nowrap shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setSelectedItemForTransfer(null);
              setIsTransferOpen(true);
            }}
            className="gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Move Fabric</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAdjustOpen(true)}
            className="gap-1.5 whitespace-nowrap shrink-0"
          >
            <Wrench className="w-4 h-4" />
            <span>Add / Adjust Stock</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Warehouse className="w-3 h-3" />
              Main Godown Stock (ZR)
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
              Stock at Dyeing Units
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
              Ready Dyed Fabric
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
              Raw Grey Fabric (Un-dyed)
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
          Current Fabric in Stock ({items.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'transfers'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Fabric Movement History ({transfers.length})
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
                { id: 'GHUMMAN_DYEING', label: 'Ghuman Unit' },
                { id: 'RAJPUT_DYEING', label: 'Rajput Unit' },
                { id: 'HAFIZ_SAAD_DYEING', label: 'Hafiz Saad Unit' },
                { id: 'HB_DYEING', label: 'HB Dyeing Unit' }
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
                { id: 'FINISHED_DYED', label: 'Ready Dyed' },
                { id: 'RAW_ECRU', label: 'Raw Grey' }
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

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'latest' | 'fabricType' | 'weight_desc' | 'rolls_desc')}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Sort stock holdings"
                >
                  <option value="latest" className="bg-zinc-900 text-zinc-200">Sort: Latest Updated (Default)</option>
                  <option value="fabricType" className="bg-zinc-900 text-zinc-200">Sort: Fabric Variety (A-Z)</option>
                  <option value="weight_desc" className="bg-zinc-900 text-zinc-200">Sort: Highest Weight (Kg)</option>
                  <option value="rolls_desc" className="bg-zinc-900 text-zinc-200">Sort: Highest Rolls Count</option>
                </select>
              </div>

              <div className="w-full sm:w-64 relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search fabric, spec, color..."
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">Fabric Variety</th>
                    <th className="py-3 px-4 whitespace-nowrap">Last Updated</th>
                    <th className="py-3 px-4 whitespace-nowrap">Yarn Spec</th>
                    <th className="py-3 px-4 whitespace-nowrap">State</th>
                    <th className="py-3 px-4 whitespace-nowrap">Color Shade</th>
                    <th className="py-3 px-4 whitespace-nowrap">Current Location</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Rolls Count</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Available Weight</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Avg Weight / Roll</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {isStockLoading ? (
                    <LoadingState isTableRow colSpan={10} message="Loading fabric inventory..." />
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-zinc-500">
                        No fabric stock found matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const avgWeight = item.totalRolls > 0 ? item.totalWeightKg / item.totalRolls : 0;

                      return (
                        <tr key={item._id} className="group hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-zinc-100 whitespace-nowrap">
                            {item.fabricType}
                          </td>

                          <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                            {formatDateTime(item.updatedAt, true)}
                          </td>

                          <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                            {item.yarnSpec}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge
                              variant={item.state === 'FINISHED_DYED' ? 'success' : 'warning'}
                              className="text-[10px]"
                            >
                              {item.state === 'FINISHED_DYED' ? 'DYED' : 'RAW ECRU'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                              {item.color}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
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
                                ? 'Ghuman Unit'
                                : item.location === 'RAJPUT_DYEING'
                                ? 'Rajput Unit'
                                : item.location === 'HAFIZ_SAAD_DYEING'
                                ? 'Hafiz Saad Unit'
                                : item.location === 'HB_DYEING'
                                ? 'HB Unit'
                                : 'Unit'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-zinc-200 whitespace-nowrap">
                            {item.totalRolls}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {formatWeight(item.totalWeightKg)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                            {avgWeight.toFixed(2)} Kg/R
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 transition-colors z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedItemForTransfer(item);
                                setIsTransferOpen(true);
                              }}
                              className="text-[11px] py-1 px-2.5 h-7 gap-1 whitespace-nowrap"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              Move Location
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScrollableTable>
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
          <div className="p-2.5 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              {/* Origin Location Filter */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={transferFromLocation}
                  onChange={(e) => setTransferFromLocation(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                  title="Origin location"
                >
                  <option value="ALL" className="bg-zinc-900 text-zinc-200">All Locations</option>
                  <option value="ZR_GODOWN" className="bg-zinc-900 text-zinc-200">ZR Godown</option>
                  <option value="GHUMMAN_DYEING" className="bg-zinc-900 text-zinc-200">Ghuman Unit</option>
                  <option value="RAJPUT_DYEING" className="bg-zinc-900 text-zinc-200">Rajput Unit</option>
                  <option value="HAFIZ_SAAD_DYEING" className="bg-zinc-900 text-zinc-200">Hafiz Saad Unit</option>
                  <option value="HB_DYEING" className="bg-zinc-900 text-zinc-200">HB Dyeing Unit</option>
                </select>
              </div>

              {/* Sort Order Dropdown (Latest First Default) */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <select
                  value={transferSortOrder}
                  onChange={(e) => setTransferSortOrder(e.target.value as 'desc' | 'asc')}
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
                placeholder="Search transfer #, fabric, color, driver..."
                value={transfersSearchTerm}
                onChange={(e) => setTransfersSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
          <ScrollableTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Transfer #</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Route</th>
                  <th className="py-3 px-4 whitespace-nowrap">Fabric Variety & Color</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Rolls</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Weight (Kg)</th>
                  <th className="py-3 px-4 whitespace-nowrap">Gate Pass #</th>
                  <th className="py-3 px-4 whitespace-nowrap">Driver / Vehicle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isTransfersLoading ? (
                  <LoadingState isTableRow colSpan={8} message="Loading fabric movements log..." />
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No inter-location transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((trf) => (
                    <tr key={trf._id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {trf.transferNo}
                      </td>

                      <td className="py-3 px-4 text-zinc-300 font-mono whitespace-nowrap">
                        {formatDateTime(trf.date, true)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                          <span className="text-zinc-300">{trf.fromLocation}</span>
                          <ArrowRight className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">{trf.toLocation}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-zinc-100">{trf.fabricType}</span>
                        <span className="text-[10px] text-zinc-400 ml-1.5">({trf.color} • {trf.state})</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200 whitespace-nowrap">
                        {trf.rollsCount}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatWeight(trf.weightKg)}
                      </td>

                      <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                        {trf.gatePassNo || '—'}
                      </td>

                      <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                        <span>{trf.driverName || '—'}</span>
                        {trf.vehicleNo && <span className="text-[10px] font-mono text-zinc-500 ml-1.5">({trf.vehicleNo})</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
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
