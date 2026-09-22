import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { DyeingBatchItem, DyeingMillType, DyeingUnitItem } from '../types/dyeing.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { Input } from '../../../components/ui/Input.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { IssueBatchModal } from '../components/IssueBatchModal.js';
import { CreateGatePassModal } from '../components/CreateGatePassModal.js';
import { ReceiveGatePassModal } from '../components/ReceiveGatePassModal.js';
import { ReceivedDyeingTab } from '../components/ReceivedDyeingTab.js';
import { SettleBatchModal } from '../components/SettleBatchModal.js';
import { EditBatchModal } from '../components/EditBatchModal.js';
import { DyeingUnitsTab } from '../components/DyeingUnitsTab.js';
import { GatePassRegisterModal } from '../../reports/components/GatePassRegisterModal.js';
import { downloadExcelReport } from '../../../lib/reportExport.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatWeight, formatDateTime } from '../../../lib/formatters.js';
import {
  Palette,
  RefreshCw,
  Plus,
  Factory,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Search,
  CheckCheck,
  Edit,
  FileSpreadsheet,
  FileText,
  ArrowUpDown,
  PackageCheck,
  Truck
} from 'lucide-react';

export function DyeingPage() {
  const [mainTab, setMainTab] = useState<'batches' | 'received' | 'units'>('batches');
  const [selectedMill, setSelectedMill] = useState<DyeingMillType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [isMultiGatePassOpen, setIsMultiGatePassOpen] = useState(false);
  const [isReceiveGatePassOpen, setIsReceiveGatePassOpen] = useState(false);
  const [settlingBatch, setSettlingBatch] = useState<DyeingBatchItem | null>(null);
  const [editingBatch, setEditingBatch] = useState<DyeingBatchItem | null>(null);
  const [isGatePassModalOpen, setIsGatePassModalOpen] = useState(false);
  const [isExportingDyeingExcel, setIsExportingDyeingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [selectedMill, statusFilter, sortOrder, debouncedSearchTerm]);

  const { data: unitsData = [] } = useQuery<DyeingUnitItem[]>({
    queryKey: ['dyeing-units'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DyeingUnitItem[] }>('/dyeing/units');
      return res.data.data;
    }
  });

  const unitNameMap = useMemo(() => {
    const map = new Map<string, string>();
    unitsData.forEach((u) => {
      map.set(u.code, u.shortName);
    });
    return map;
  }, [unitsData]);

  const dynamicMillFilters = useMemo(() => {
    const activeMills = unitsData.filter((u) => u.isActive && u.type === 'DYEING_MILL');
    if (activeMills.length > 0) {
      return [
        { id: 'ALL', label: 'All Dyeing Units' },
        ...activeMills.map((u) => ({ id: u.code, label: u.shortName })),
        { id: 'OTHER', label: 'Other Units' }
      ];
    }
    return [
      { id: 'ALL', label: 'All Dyeing Units' },
      { id: 'GHUMMAN_DYEING', label: 'Ghumman Dyeing' },
      { id: 'RAJPUT_DYEING', label: 'Rajput Unit' },
      { id: 'HAFIZ_SAAD_DYEING', label: 'Hafiz Saad Unit' },
      { id: 'HB_DYEING', label: 'HB Dyeing Unit' },
      { id: 'OTHER', label: 'Other Units' }
    ];
  }, [unitsData]);

  const { data, isLoading, refetch } = useQuery<{
    items: DyeingBatchItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['dyeing-batches', selectedMill, statusFilter, sortOrder, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit, sortOrder };
      if (selectedMill !== 'ALL') {
        params.millName = selectedMill;
      }
      if (statusFilter === 'ACTIVE') {
        params.status = 'ACTIVE';
      } else if (statusFilter === 'COMPLETED') {
        params.status = 'COMPLETED';
      }
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }

      const res = await api.get<{
        success: boolean;
        data: { items: DyeingBatchItem[]; total: number; page: number; limit: number; totalPages: number };
      }>(
        '/dyeing/batches',
        { params }
      );
      return res.data.data;
    }
  });

  const batches = data?.items || [];

  const kpis = useMemo(() => {
    let inProcessKg = 0;
    let inProcessBatches = 0;
    let completedKg = 0;
    let completedBatches = 0;
    let totalLossKg = 0;
    let totalEcruSettled = 0;

    batches.forEach((b) => {
      if (b.status === 'COMPLETED') {
        completedKg += b.finishWeightKg || 0;
        completedBatches++;
        totalLossKg += b.shortageWeightKg || 0;
        totalEcruSettled += b.ecruWeightKg;
      } else {
        inProcessKg += b.ecruWeightKg;
        inProcessBatches++;
      }
    });

    const avgShrinkage = totalEcruSettled > 0 ? (totalLossKg / totalEcruSettled) * 100 : 0;

    return { inProcessKg, inProcessBatches, completedKg, completedBatches, avgShrinkage };
  }, [batches]);

  async function handleExportDyeingExcel() {
    setIsExportingDyeingExcel(true);
    setExportError(null);
    try {
      let url = '/reports/dyeing-mill/excel';
      if (selectedMill !== 'ALL') {
        url += `?millName=${selectedMill}`;
      }
      await downloadExcelReport(url, 'Dyeing_Production_Report.xlsx');
    } catch (err: any) {
      console.error('Failed to export Dyeing Excel:', err);
      setExportError(err.message || 'Failed to export Dyeing Report. Please try again.');
    } finally {
      setIsExportingDyeingExcel(false);
    }
  }

  return (
    <div className="space-y-6">
      {exportError && (
        <div className="p-3 bg-red-950/50 border border-red-800 text-red-300 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>Multi-Unit Dyeing & Process Loss Engine</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Coordinate batch allocation and settlement across Ghumman & Rajput Dyeing with live shrinkage loss math.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGatePassModalOpen(true)}
            className="gap-1.5 whitespace-nowrap shrink-0 text-blue-400 border-blue-900/50 hover:bg-blue-950/40"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>OGP / IGP Registers</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDyeingExcel}
            disabled={isExportingDyeingExcel}
            className="gap-1.5 whitespace-nowrap shrink-0 bg-emerald-950/30 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50 hover:text-white"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExportingDyeingExcel ? 'Exporting...' : 'Export Report (.xlsx)'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh batches" className="p-2 h-8 w-8 whitespace-nowrap shrink-0 text-zinc-400 hover:text-zinc-200">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReceiveGatePassOpen(true)}
            className="gap-1.5 whitespace-nowrap shrink-0 text-emerald-400 border-emerald-800/60 hover:bg-emerald-950/40 font-semibold"
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Receive Delivery (IGP)</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsMultiGatePassOpen(true)}
            className="gap-1.5 whitespace-nowrap shrink-0 bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-xs"
          >
            <Truck className="w-4 h-4" />
            <span>New Gate Pass (OGP)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsIssueOpen(true)}
            className="gap-1 whitespace-nowrap shrink-0 text-zinc-400 hover:text-zinc-200"
            title="Send single batch"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Single Batch</span>
          </Button>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMainTab('batches')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            mainTab === 'batches'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Active Batches & In-Process</span>
          {data?.total !== undefined && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                mainTab === 'batches' ? 'bg-emerald-700/80 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {data.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('received')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            mainTab === 'received'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Received Dyeing (IGP)</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('units')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            mainTab === 'units'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>Dyeing Units & Locations</span>
          {unitsData.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                mainTab === 'units' ? 'bg-emerald-700/80 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {unitsData.length}
            </span>
          )}
        </button>
      </div>

      {mainTab === 'units' ? (
        <DyeingUnitsTab />
      ) : mainTab === 'received' ? (
        <ReceivedDyeingTab onOpenReceiveModal={() => setIsReceiveGatePassOpen(true)} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
              <CardContent className="p-0">
                <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Factory className="w-3 h-3" />
                  Fabric Currently at Units
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  {formatWeight(kpis.inProcessKg)}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Across {kpis.inProcessBatches} active batches</div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/80 border-zinc-800 p-3">
              <CardContent className="p-0">
                <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Batches Being Dyed
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {kpis.inProcessBatches}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Pending finished fabric receipt</div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
              <CardContent className="p-0">
                <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Total Dyed Fabric Received
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  {formatWeight(kpis.completedKg)}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{kpis.completedBatches} batches received</div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/80 border-zinc-800 p-3">
              <CardContent className="p-0">
                <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  Average Weight Loss (Shrinkage)
                </div>
                <div
                  className={`text-lg font-bold font-mono mt-1 ${
                    kpis.avgShrinkage > 5.0 ? 'text-amber-400' : 'text-zinc-200'
                  }`}
                >
                  {kpis.avgShrinkage.toFixed(2)}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Standard tolerance: &le; 5.0%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
              {dynamicMillFilters.map((mill) => (
                <button
                  key={mill.id}
                  onClick={() => setSelectedMill(mill.id as DyeingMillType | 'ALL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors select-none whitespace-nowrap ${
                    selectedMill === mill.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <Factory className="w-3.5 h-3.5" />
                  <span>{mill.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                  { id: 'ALL', label: 'All Batches' },
                  { id: 'ACTIVE', label: 'Currently Being Dyed' },
                  { id: 'COMPLETED', label: 'Finished & Received' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setStatusFilter(st.id as typeof statusFilter)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors select-none whitespace-nowrap ${
                      statusFilter === st.id
                        ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
                  <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                    className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                    title="Sort order"
                  >
                    <option value="desc" className="bg-zinc-900 text-zinc-200">Sort: Latest Issued First (Default)</option>
                    <option value="asc" className="bg-zinc-900 text-zinc-200">Sort: Oldest Issued First</option>
                  </select>
                </div>

                <div className="w-full sm:w-64 relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search batch #, color, fabric..."
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">Batch #</th>
                    <th className="py-3 px-4 whitespace-nowrap">Date Issued</th>
                    <th className="py-3 px-4 whitespace-nowrap">Unit</th>
                    <th className="py-3 px-4 whitespace-nowrap">Fabric Variety & Count</th>
                    <th className="py-3 px-4 whitespace-nowrap">Target Color</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Ecru Issued</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Finish Received</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Shortage Loss</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Shrinkage %</th>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {isLoading ? (
                    <LoadingState isTableRow colSpan={11} message="Loading dyeing batches..." />
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-zinc-500">
                        No batches found matching selected criteria.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b._id} className="group hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {b.batchNo}
                        </td>

                        <td className="py-3 px-4 text-zinc-300 font-mono whitespace-nowrap">
                          {formatDateTime(b.dateIssued, true)}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge
                            variant={
                              b.millName === 'GHUMMAN_DYEING'
                                ? 'default'
                                : b.millName === 'RAJPUT_DYEING'
                                ? 'success'
                                : 'outline'
                            }
                            className="text-[10px] py-0.5"
                          >
                            {unitNameMap.get(b.millName) || (b.millName === 'OTHER' ? (b.customMillName || 'Other Unit') : b.millName)}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-zinc-100">{b.fabricType}</span>
                          <span className="text-[10px] font-mono text-zinc-400 ml-1.5">({b.yarnSpec})</span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                            {b.targetColor}
                          </span>
                          {b.allocatedCustomerId && (
                            <span className="text-[10px] text-emerald-400 ml-1.5 font-medium">
                              ({b.allocatedCustomerId.name})
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-zinc-300 whitespace-nowrap">
                          <span>{formatWeight(b.ecruWeightKg)}</span>
                          <span className="text-[10px] text-zinc-500 ml-1">({b.ecruRollsCount}R)</span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {b.status === 'COMPLETED' ? (
                            <span className="text-emerald-400 font-semibold">
                              {formatWeight(b.finishWeightKg || 0)}
                              <span className="text-[10px] text-zinc-500 font-normal ml-1">({b.finishRollsCount}R)</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {b.status === 'COMPLETED' ? (
                            <span className={(b.shortagePercent || 0) > 5.0 ? 'text-amber-400 font-bold' : 'text-zinc-300'}>
                              {formatWeight(b.shortageWeightKg || 0)}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {b.status === 'COMPLETED' ? (
                            <div className="inline-flex items-center gap-1 font-mono font-bold text-xs">
                              {(b.shortagePercent || 0) > 5.0 ? (
                                <Badge variant="warning" className="gap-1 text-[10px]">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {b.shortagePercent?.toFixed(2)}%
                                </Badge>
                              ) : (
                                <Badge variant="success" className="gap-1 text-[10px]">
                                  {b.shortagePercent?.toFixed(2)}%
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-mono text-xs">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge
                            variant={
                              b.status === 'COMPLETED'
                                ? 'success'
                                : b.status === 'IN_PROCESS'
                                ? 'default'
                                : 'warning'
                            }
                            className="text-[10px]"
                          >
                            {b.status === 'COMPLETED'
                              ? 'RECEIVED'
                              : b.status === 'IN_PROCESS'
                              ? 'DYEING'
                              : 'ISSUED'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 transition-colors z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                          <div className="flex items-center justify-center gap-1.5">
                            {b.status !== 'COMPLETED' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSettlingBatch(b)}
                                className="text-[11px] py-1 px-2.5 h-7 gap-1 whitespace-nowrap"
                              >
                                <CheckCheck className="w-3 h-3" />
                                Receive Finished
                              </Button>
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-medium mr-1">Reconciled</span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingBatch(b)}
                              className="text-[11px] py-1 px-2.5 h-7 gap-1 whitespace-nowrap"
                            >
                              <Edit className="w-3 h-3" />
                              Edit
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
        </>
      )}

      <CreateGatePassModal
        isOpen={isMultiGatePassOpen}
        initialMill={selectedMill === 'ALL' ? 'GHUMMAN_DYEING' : selectedMill}
        onClose={() => setIsMultiGatePassOpen(false)}
        onSuccess={() => refetch()}
      />

      <ReceiveGatePassModal
        isOpen={isReceiveGatePassOpen}
        initialMill={selectedMill === 'ALL' ? 'GHUMMAN_DYEING' : selectedMill}
        onClose={() => setIsReceiveGatePassOpen(false)}
        onSuccess={() => refetch()}
      />

      <IssueBatchModal
        isOpen={isIssueOpen}
        initialMill={selectedMill === 'ALL' ? 'GHUMMAN_DYEING' : selectedMill}
        onClose={() => setIsIssueOpen(false)}
        onSuccess={() => refetch()}
      />

      <SettleBatchModal
        batch={settlingBatch}
        isOpen={Boolean(settlingBatch)}
        onClose={() => setSettlingBatch(null)}
        onSuccess={() => refetch()}
      />

      <EditBatchModal
        batch={editingBatch}
        isOpen={Boolean(editingBatch)}
        onClose={() => setEditingBatch(null)}
        onSuccess={() => refetch()}
      />

      <GatePassRegisterModal
        isOpen={isGatePassModalOpen}
        onClose={() => setIsGatePassModalOpen(false)}
        defaultType="OGP"
      />
    </div>
  );
}

