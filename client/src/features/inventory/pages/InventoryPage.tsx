import { useLocations } from '../../../business/useLocations.js';
import { locationLabel } from '../../../business/locations.js';
import { getLocalDateInput } from '../../../lib/formatters.js';
import { useQueryPagination } from '../../../hooks/useQueryPagination.js';
import { loadAllRecords } from '../../../lib/pagedResources.js';
import { QueryError } from '../../../components/ui/QueryError.js';
import { PageHeader } from '../../../components/ui/PageHeader.js';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { EditStockModal } from '../components/EditStockModal.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatWeight, formatDate, formatDateTime } from '../../../lib/formatters.js';
import { exportToCsv } from '../../../lib/csvExport.js';
import { Warehouse, Factory, RefreshCw, ArrowRightLeft, Wrench, Search, ArrowRight, Download, ArrowUpDown, Filter, Edit } from 'lucide-react';

export function InventoryPage() {
  const locations = useLocations();
  const queryClient = useQueryClient();
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'transfers'>('holdings');
  const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | 'ALL'>('ALL');
  const [selectedState, setSelectedState] = useState<FabricState | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'fabricType' | 'weight_desc' | 'rolls_desc'>('latest');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedItemForEdit, setSelectedItemForEdit] = useState<FabricInventoryItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [transfersSearchTerm, setTransfersSearchTerm] = useState('');
  const [transferFromLocation, setTransferFromLocation] = useState<string>('ALL');
  const [transferSortOrder, setTransferSortOrder] = useState<'desc' | 'asc'>('desc');

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<FabricInventoryItem | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedTransfersSearchTerm = useDebounce(transfersSearchTerm, 300);

  const { page: page, limit: limit, setPage: setPage, setLimit: setLimit } = useQueryPagination([selectedLocation, selectedState, sortBy, debouncedSearchTerm]);

  const { page: transfersPage, limit: transfersLimit, setPage: setTransfersPage, setLimit: setTransfersLimit } = useQueryPagination([transferFromLocation, transferSortOrder, debouncedTransfersSearchTerm]);

  const { isError: hasQueryError1,  data: stockData, isLoading: isStockLoading, refetch: refetchStock } = useQuery<{
    items: FabricInventoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    enabled: activeTab === 'holdings',
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

  const { isError: hasQueryError2,  data: transfersData, isLoading: isTransfersLoading, refetch: refetchTransfers } = useQuery<{
    items: StockTransferItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    enabled: activeTab === 'transfers',
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

  const { isError: hasQueryError3,  data: stockSummaryData, refetch: refetchSummary } = useQuery<InventorySummaryGroup[]>({
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
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
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

  async function handleExportCsv() {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    setExportError(null);
    try {
      const result = await loadAllRecords<FabricInventoryItem>('/inventory/items', {
        sortBy,
        ...(selectedLocation !== 'ALL' ? { location: selectedLocation } : {}),
        ...(selectedState !== 'ALL' ? { state: selectedState } : {}),
        ...(debouncedSearchTerm.trim() ? { search: debouncedSearchTerm.trim() } : {})
      });
      exportToCsv<FabricInventoryItem>(
      `inventory_holdings_${getLocalDateInput()}`,
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
      result.items
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The CSV could not be downloaded. Please try again.');
    } finally { setIsExportingCsv(false); }
  }

  return (
    <div className="space-y-6">
      {exportError && <p role="alert" className="rounded-lg border border-line p-3 text-sm text-danger">{exportError}</p>}
      <PageHeader title="Fabric stock" description="See what is available, move fabric between locations, and maintain stock records."><div className="flex max-w-full flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} isLoading={isExportingCsv} title="Download CSV spreadsheet" className="gap-1.5 whitespace-nowrap shrink-0">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button variant="outline" size="sm" preventDoubleClick onClick={handleRefetchAll} title="Refresh inventory" className="gap-1 px-2.5 whitespace-nowrap shrink-0">
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
        </div></PageHeader>
      {(hasQueryError1 || hasQueryError2 || hasQueryError3) && <QueryError onRetry={() => { refetchStock(); refetchTransfers(); refetchSummary(); }} />}


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-brand normal-case tracking-normal flex items-center gap-1">
              <Warehouse className="w-3 h-3" />
              Rozain Textile Stock
            </div>
            <div className="text-lg font-bold font-mono text-brand mt-1">
              {formatWeight(kpis.godownKg)}
            </div>
            <div className="text-xs text-soft mt-0.5">{kpis.godownRolls} ready rolls in central depot</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-brand normal-case tracking-normal flex items-center gap-1">
              <Factory className="w-3 h-3" />
              Stock at Dyeing Units
            </div>
            <div className="text-lg font-bold font-mono text-brand mt-1">
              {formatWeight(kpis.millKg)}
            </div>
            <div className="text-xs text-soft mt-0.5">{kpis.millRolls} rolls across Ghumman & Rajput</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-info normal-case tracking-normal">
              Ready Dyed Fabric
            </div>
            <div className="text-lg font-bold font-mono text-info mt-1">
              {formatWeight(kpis.finishedKg)}
            </div>
            <div className="text-xs text-soft mt-0.5">{kpis.finishedRolls} rolls ready for dispatch</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-warning normal-case tracking-normal">
              Raw Grey Fabric (Un-dyed)
            </div>
            <div className="text-lg font-bold font-mono text-warning mt-1">
              {formatWeight(kpis.ecruKg)}
            </div>
            <div className="text-xs text-soft mt-0.5">{kpis.ecruRolls} unprocessed grey rolls</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-1 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab('holdings')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'holdings'
              ? 'bg-primary text-white shadow-xs'
              : 'text-soft hover:text-strong hover:bg-subtle/60'
          }`}
        >
          Current Fabric in Stock ({items.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
            activeTab === 'transfers'
              ? 'bg-primary text-white shadow-xs'
              : 'text-soft hover:text-strong hover:bg-subtle/60'
          }`}
        >
          Fabric Movement History ({transfers.length})
        </button>
      </div>

      {activeTab === 'holdings' && (
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-surface/50 p-2.5 rounded-lg border border-line">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-soft mr-1">Location:</span>
              {[{ id: 'ALL', label: 'All' }, ...locations.map(location => ({ id: location.value, label: location.label }))].map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc.id as typeof selectedLocation)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    selectedLocation === loc.id
                      ? 'bg-primary text-white font-semibold'
                      : 'bg-canvas text-soft hover:text-strong border border-line'
                  }`}
                >
                  {loc.label}
                </button>
              ))}

              <div className="h-4 w-px bg-muted mx-2" />

              <span className="text-xs font-semibold text-soft mr-1">State:</span>
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
                      ? 'bg-primary text-white font-semibold'
                      : 'bg-canvas text-soft hover:text-strong border border-line'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-canvas/80 border border-line rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-brand shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'latest' | 'fabricType' | 'weight_desc' | 'rolls_desc')}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Sort stock holdings"
                >
                  <option value="latest" className="bg-surface text-strong">Sort: Latest Updated (Default)</option>
                  <option value="fabricType" className="bg-surface text-strong">Sort: Fabric Variety (A-Z)</option>
                  <option value="weight_desc" className="bg-surface text-strong">Sort: Highest Weight (Kg)</option>
                  <option value="rolls_desc" className="bg-surface text-strong">Sort: Highest Rolls Count</option>
                </select>
              </div>

              <div className="w-full sm:w-64 relative">
                <Search className="w-4 h-4 text-soft absolute left-3 top-2.5 pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search fabric, spec, color..."
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <Card className="border-line bg-surface/80 overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/90 border-b border-line text-soft normal-case font-semibold">
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
                    <th className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-canvas z-20 border-l border-line shadow-sm">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {isStockLoading ? (
                    <LoadingState isTableRow colSpan={10} message="Loading fabric inventory..." />
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-soft">
                        No fabric stock found matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const avgWeight = item.totalRolls > 0 ? item.totalWeightKg / item.totalRolls : 0;

                      return (
                        <tr key={item._id} className="group hover:bg-subtle/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-strong whitespace-nowrap">
                            {item.fabricType}
                          </td>

                          <td className="py-3 px-4 font-mono text-ink whitespace-nowrap">
                            {formatDateTime(item.updatedAt, true)}
                          </td>

                          <td className="py-3 px-4 font-mono text-soft whitespace-nowrap">
                            {item.yarnSpec}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge
                              variant={item.state === 'FINISHED_DYED' ? 'success' : 'warning'}
                              className="text-xs"
                            >
                              {item.state === 'FINISHED_DYED' ? 'DYED' : 'RAW ECRU'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-subtle text-strong border border-control">
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
                              className="text-xs"
                            >
                              {locationLabel(item.location, locations)}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-strong whitespace-nowrap">
                            {item.totalRolls}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-brand whitespace-nowrap">
                            {formatWeight(item.totalWeightKg)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-soft whitespace-nowrap">
                            {avgWeight.toFixed(2)} Kg/R
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-surface group-hover:bg-subtle/90 transition-colors z-10 border-l border-line shadow-sm">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedItemForEdit(item);
                                  setIsEditOpen(true);
                                }}
                                className="text-xs py-1 px-2.5 h-7 gap-1 whitespace-nowrap text-ink hover:text-brand hover:border-emerald-500/50"
                                title="Edit rolls, weight, color, or variety"
                              >
                                <Edit className="w-3 h-3" />
                                Edit
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedItemForTransfer(item);
                                  setIsTransferOpen(true);
                                }}
                                className="text-xs py-1 px-2.5 h-7 gap-1 whitespace-nowrap"
                                title="Move to another location"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                Move Location
                              </Button>
                            </div>
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
        <Card className="border-line bg-surface/80 overflow-hidden">
          <div className="p-2.5 border-b border-line bg-canvas/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              {/* Origin Location Filter */}
              <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
                <Filter className="w-3.5 h-3.5 text-soft shrink-0" />
                <select
                  value={transferFromLocation}
                  onChange={(e) => setTransferFromLocation(e.target.value)}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Origin location"
                >
                  <option value="ALL" className="bg-surface text-strong">All Locations</option>
                  {locations.map(location => <option key={location.value} value={location.value} className="bg-surface text-strong">{location.label}</option>)}
                </select>
              </div>

              {/* Sort Order Dropdown (Latest First Default) */}
              <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
                <ArrowUpDown className="w-3.5 h-3.5 text-brand shrink-0" />
                <select
                  value={transferSortOrder}
                  onChange={(e) => setTransferSortOrder(e.target.value as 'desc' | 'asc')}
                  className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                  title="Sort order"
                >
                  <option value="desc" className="bg-surface text-strong">Sort: Latest First (Default)</option>
                  <option value="asc" className="bg-surface text-strong">Sort: Oldest First</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft pointer-events-none" />
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
              <thead className="bg-canvas/90 border-b border-line text-soft normal-case font-semibold">
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
              <tbody className="divide-y divide-line/60">
                {isTransfersLoading ? (
                  <LoadingState isTableRow colSpan={8} message="Loading fabric movements log..." />
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-soft">
                      No inter-location transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((trf) => (
                    <tr key={trf._id} className="hover:bg-subtle/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-brand whitespace-nowrap">
                        {trf.transferNo}
                      </td>

                      <td className="py-3 px-4 text-ink font-mono whitespace-nowrap">
                        {formatDateTime(trf.date, true)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="text-ink">{trf.fromLocation}</span>
                          <ArrowRight className="w-3 h-3 text-brand" />
                          <span className="text-brand">{trf.toLocation}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-strong">{trf.fabricType}</span>
                        <span className="text-xs text-soft ml-1.5">({trf.color} • {trf.state})</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-strong whitespace-nowrap">
                        {trf.rollsCount}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-brand whitespace-nowrap">
                        {formatWeight(trf.weightKg)}
                      </td>

                      <td className="py-3 px-4 font-mono text-ink whitespace-nowrap">
                        {trf.gatePassNo || '—'}
                      </td>

                      <td className="py-3 px-4 text-ink whitespace-nowrap">
                        <span>{trf.driverName || '—'}</span>
                        {trf.vehicleNo && <span className="text-xs font-mono text-soft ml-1.5">({trf.vehicleNo})</span>}
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

      {isTransferOpen && <TransferStockModal
        isOpen={isTransferOpen}
        preselectedItem={selectedItemForTransfer}
        onClose={() => {
          setIsTransferOpen(false);
          setSelectedItemForTransfer(null);
        }}
        onSuccess={handleRefetchAll}
      />}

      {isAdjustOpen && <AdjustStockModal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        onSuccess={handleRefetchAll}
      />}

      {isEditOpen && <EditStockModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedItemForEdit(null);
        }}
        onSuccess={handleRefetchAll}
        item={selectedItemForEdit}
      />}
    </div>
  );
}
