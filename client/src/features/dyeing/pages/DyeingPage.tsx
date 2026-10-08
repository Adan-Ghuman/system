import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { DyeingBatchItem, DyeingMillType, DyeingUnitItem } from '../types/dyeing.types.js';
import { WorkflowActions } from '../../../components/ui/WorkflowActions.js';
import { OptionalDetails } from '../../../components/ui/WorkflowForm.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card } from '../../../components/ui/Card.js';
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
import { RefreshCw, Plus, Edit, FileSpreadsheet, FileText, PackageCheck, Truck, Factory } from 'lucide-react';

export function DyeingPage() {
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<'batches' | 'received' | 'units'>('batches');
  const [selectedMill, setSelectedMill] = useState<DyeingMillType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');
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

  const { data, isLoading, isError, refetch } = useQuery<{
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

  function refreshDyeing() {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['received-dyeing-batches'] });
    queryClient.invalidateQueries({ queryKey: ['active-dyeing-batches-for-receive'] });
    queryClient.invalidateQueries({ queryKey: ['dyeing-units'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-inventory-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-batches'] });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold tracking-tight text-zinc-100">Dyeing</h1><p className="mt-1 text-sm text-zinc-400">Send raw fabric to a mill. Receive dyed fabric back. Track each batch along the way.</p></div>
        <Button variant="ghost" size="sm" onClick={refreshDyeing}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      <WorkflowActions actions={[
        { title: 'Send fabric for dyeing', description: 'Record the mill, fabric, color and weight on an outgoing challan.', icon: Truck, onClick: () => setIsMultiGatePassOpen(true) },
        { title: 'Receive dyed fabric', description: 'Match a sent batch or enter an incoming paper challan.', icon: PackageCheck, onClick: () => setIsReceiveGatePassOpen(true) }
      ]} />
      <OptionalDetails title="Reports & mill setup">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsGatePassModalOpen(true)}><FileText className="h-4 w-4" /> Challan register</Button>
          <Button variant="outline" size="sm" onClick={handleExportDyeingExcel} isLoading={isExportingDyeingExcel}><FileSpreadsheet className="h-4 w-4" /> Download dyeing report</Button>
          <Button variant="outline" size="sm" onClick={() => setMainTab('units')}><Factory className="h-4 w-4" /> Manage mills & locations</Button>
          <Button variant="outline" size="sm" onClick={() => setIsIssueOpen(true)}><Plus className="h-4 w-4" /> Add a single batch without a challan</Button>
        </div>
      </OptionalDetails>
      {exportError && <p role="alert" className="rounded-lg border border-red-900/50 p-3 text-sm text-red-300">{exportError}</p>}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        <Button variant={mainTab === 'batches' ? 'primary' : 'ghost'} aria-pressed={mainTab === 'batches'} onClick={() => { setMainTab('batches'); setStatusFilter('ACTIVE'); }}>At the mill</Button>
        <Button variant={mainTab === 'received' ? 'primary' : 'ghost'} aria-pressed={mainTab === 'received'} onClick={() => setMainTab('received')}>Received fabric</Button>
        {mainTab === 'units' && <span className="self-center text-sm text-zinc-400">Mill & location setup</span>}
      </div>
      {mainTab === 'units' ? <DyeingUnitsTab /> : mainTab === 'received' ? <ReceivedDyeingTab onOpenReceiveModal={() => setIsReceiveGatePassOpen(true)} /> : (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input id="dyeing-search" label="Find a batch" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Batch, fabric, color or challan" />
            <Select id="dyeing-mill-filter" label="Mill" value={selectedMill} onChange={(e) => setSelectedMill(e.target.value as typeof selectedMill)}
              options={dynamicMillFilters.map((mill) => ({ label: mill.label, value: mill.id }))} />
            <Select id="dyeing-status-filter" label="Show" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              options={[{ label: 'Awaiting receipt', value: 'ACTIVE' }, { label: 'All batches', value: 'ALL' }, { label: 'Received batches', value: 'COMPLETED' }]} />
            <Select id="dyeing-order" label="Order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              options={[{ label: 'Newest sent first', value: 'desc' }, { label: 'Oldest sent first', value: 'asc' }]} />
          </div>
          <p className="text-xs text-zinc-400">Choose <strong className="text-zinc-200">Receive fabric</strong> beside a batch to use its recorded details.</p>
          <OptionalDetails title="Totals for this page">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-zinc-400">Awaiting receipt</p><p className="mt-1 font-mono text-base text-zinc-100">{formatWeight(kpis.inProcessKg)}</p></div>
              <div><p className="text-xs text-zinc-400">Finished fabric received</p><p className="mt-1 font-mono text-base text-emerald-400">{formatWeight(kpis.completedKg)}</p></div>
              <div><p className="text-xs text-zinc-400">Average weight loss</p><p className="mt-1 font-mono text-base text-zinc-100">{kpis.avgShrinkage.toFixed(2)}%</p></div>
            </div><p className="text-xs text-zinc-500">Calculated from the {batches.length} batches shown on this page.</p>
          </OptionalDetails>
          {isError ? <div role="alert" className="space-y-2 rounded-lg border border-red-900/50 p-4 text-sm text-red-300"><p>Dyeing batches could not be loaded.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : (
            <Card className="overflow-hidden border-zinc-800 bg-zinc-900/80">
              <ScrollableTable>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/70 text-xs text-zinc-400">
                    <tr><th className="px-4 py-3">Batch / sent date</th><th className="px-4 py-3">Mill</th><th className="px-4 py-3">Fabric</th><th className="px-4 py-3 text-right">Sent</th><th className="px-4 py-3 text-right">Received</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Next action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {isLoading ? <LoadingState isTableRow colSpan={7} message="Loading dyeing batches..." /> : batches.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">No batches match these filters. Use Send fabric for dyeing to record a new delivery.</td></tr>
                    ) : batches.map((batch) => (
                      <tr key={batch._id} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-3"><p className="font-mono text-xs font-semibold text-emerald-400">{batch.batchNo}</p><p className="mt-1 text-xs text-zinc-500">{formatDateTime(batch.dateIssued, true)}</p>{batch.ogpNo && <p className="mt-1 text-xs text-zinc-500">Challan {batch.ogpNo}</p>}</td>
                        <td className="px-4 py-3 text-xs text-zinc-300">{unitNameMap.get(batch.millName) || (batch.millName === 'OTHER' ? batch.customMillName || 'Other mill' : batch.millName.split('_').join(' '))}</td>
                        <td className="px-4 py-3"><p className="text-zinc-100">{batch.fabricType}</p><p className="mt-1 text-xs text-zinc-400">{batch.yarnSpec} · {batch.targetColor}</p>{batch.allocatedCustomerId && <p className="mt-1 text-xs text-emerald-400">{batch.allocatedCustomerId.name}</p>}</td>
                        <td className="px-4 py-3 text-right text-xs"><p className="font-mono text-zinc-300 whitespace-nowrap">{formatWeight(batch.ecruWeightKg)}</p><p className="mt-1 text-zinc-500">{batch.ecruRollsCount} rolls</p></td>
                        <td className="px-4 py-3 text-right text-xs">{batch.status === 'COMPLETED' ? <><p className="font-mono text-emerald-400 whitespace-nowrap">{formatWeight(batch.finishWeightKg || 0)}</p><p className="mt-1 text-zinc-500">{batch.finishRollsCount} rolls</p></> : <span className="text-zinc-500">Waiting</span>}</td>
                        <td className="px-4 py-3"><Badge variant={batch.status === 'COMPLETED' ? 'success' : batch.status === 'IN_PROCESS' ? 'default' : 'warning'} className="text-[10px]">{batch.status === 'COMPLETED' ? 'Received' : batch.status === 'IN_PROCESS' ? 'Being dyed' : 'At mill'}</Badge>{batch.status === 'COMPLETED' && <p className={'mt-2 text-xs ' + ((batch.shortagePercent || 0) > 5 ? 'text-amber-400' : 'text-zinc-400')}>Loss: {(batch.shortageWeightKg || 0).toFixed(2)} kg · {(batch.shortagePercent || 0).toFixed(1)}%</p>}</td>
                        <td className="px-4 py-3"><div className="flex flex-wrap gap-2">{batch.status !== 'COMPLETED' && <Button size="sm" onClick={() => setSettlingBatch(batch)}>Receive fabric</Button>}<Button variant="outline" size="sm" onClick={() => setEditingBatch(batch)}><Edit className="h-3.5 w-3.5" /> Edit</Button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
              <PaginationControls page={page} totalPages={data?.totalPages || 1} total={data?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
            </Card>
          )}
        </div>
      )}
      {isMultiGatePassOpen && <CreateGatePassModal isOpen initialMill={selectedMill === 'ALL' ? 'GHUMMAN_DYEING' : selectedMill} onClose={() => setIsMultiGatePassOpen(false)} onSuccess={refreshDyeing} />}
      {isReceiveGatePassOpen && <ReceiveGatePassModal isOpen initialMill={selectedMill === 'ALL' ? 'GHUMMAN_DYEING' : selectedMill} onClose={() => setIsReceiveGatePassOpen(false)} onSuccess={refreshDyeing} />}
      {isIssueOpen && <IssueBatchModal isOpen initialMill={selectedMill === 'ALL' ? 'GHUMMAN_DYEING' : selectedMill} onClose={() => setIsIssueOpen(false)} onSuccess={refreshDyeing} />}
      {settlingBatch && <SettleBatchModal batch={settlingBatch} isOpen onClose={() => setSettlingBatch(null)} onSuccess={refreshDyeing} />}
      <EditBatchModal batch={editingBatch} isOpen={Boolean(editingBatch)} onClose={() => setEditingBatch(null)} onSuccess={refreshDyeing} />
      <GatePassRegisterModal isOpen={isGatePassModalOpen} onClose={() => setIsGatePassModalOpen(false)} defaultType="OGP" />
    </div>
  );
}

