import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { DyeingBatchItem, DyeingMillType, DyeingUnitItem } from '../types/dyeing.types.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card } from '../../../components/ui/Card.js';
import { Select } from '../../../components/ui/Select.js';
import { Input } from '../../../components/ui/Input.js';
import { Button } from '../../../components/ui/Button.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { formatWeight, formatDateTime } from '../../../lib/formatters.js';

export interface ReceivedDyeingTabProps {
  onOpenReceiveModal: () => void;
}

export function ReceivedDyeingTab({ onOpenReceiveModal }: ReceivedDyeingTabProps) {
  const [selectedMill, setSelectedMill] = useState<DyeingMillType | 'ALL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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
    queryKey: ['received-dyeing-batches', selectedMill, sortOrder, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit,
        sortOrder,
        status: 'COMPLETED'
      };
      if (selectedMill !== 'ALL') {
        params.millName = selectedMill;
      }
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }

      const res = await api.get<{
        success: boolean;
        data: { items: DyeingBatchItem[]; total: number; page: number; limit: number; totalPages: number };
      }>('/dyeing/batches', { params });
      return res.data.data;
    }
  });

  useEffect(() => { setPage(1); }, [selectedMill, sortOrder, debouncedSearchTerm]);

  const batches = data?.items || [];

  const metrics = useMemo(() => {
    let totalFinishKg = 0;
    let totalFinishRolls = 0;
    let totalLossKg = 0;
    let totalEcruKg = 0;

    batches.forEach((b) => {
      totalFinishKg += b.finishWeightKg || 0;
      totalFinishRolls += b.finishRollsCount || 0;
      totalLossKg += b.shortageWeightKg || 0;
      totalEcruKg += b.ecruWeightKg || 0;
    });

    const avgShrinkage = totalEcruKg > 0 ? (totalLossKg / totalEcruKg) * 100 : 0;

    return {
      totalBatches: data?.total || 0,
      totalFinishKg,
      totalFinishRolls,
      totalLossKg,
      avgShrinkage
    };
  }, [batches, data?.total]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
        <Input id="received-search" label="Search received fabric" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Challan, batch, fabric or colour" />
        <Select id="received-mill" label="Dyeing mill" value={selectedMill} onChange={(e) => setSelectedMill(e.target.value as DyeingMillType | 'ALL')} options={dynamicMillFilters.map((mill) => ({ value: mill.id, label: mill.label }))} />
        <Select id="received-order" label="Order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')} options={[{value: 'desc', label: 'Newest first'}, {value: 'asc', label: 'Oldest first'}]} />
      </div>
      <details className="rounded-lg border border-zinc-800 bg-zinc-900/50">
        <summary className="cursor-pointer px-4 py-3 text-xs text-zinc-400">Received totals for this page</summary>
        <div className="grid gap-3 border-t border-zinc-800 p-4 text-xs text-zinc-400 sm:grid-cols-3">
          <p>Received weight <strong className="ml-2 text-emerald-400">{formatWeight(metrics.totalFinishKg)}</strong></p>
          <p>Received rolls <strong className="ml-2 text-zinc-200">{metrics.totalFinishRolls}</strong></p>
          <p>Weight loss <strong className="ml-2 text-zinc-200">{formatWeight(metrics.totalLossKg)} · {metrics.avgShrinkage.toFixed(2)}%</strong></p>
        </div>
      </details>
      <Card className="overflow-hidden">
        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/70 text-zinc-400">
              <tr>{['Receiving challan', 'Mill', 'Fabric', 'Sent', 'Received', 'Weight loss'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {isLoading ? <LoadingState isTableRow colSpan={6} message="Loading received fabric..." /> : isError ? (
                <tr><td colSpan={6} className="p-8 text-center text-red-300">Could not load received fabric. <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button></td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={6} className="space-y-3 p-8 text-center text-zinc-400"><p>No received fabric matches these filters.</p><Button size="sm" variant="outline" onClick={onOpenReceiveModal}>Receive dyed fabric</Button></td></tr>
              ) : batches.map((batch) => (
                <tr key={batch._id} className="hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-emerald-400">{batch.igpNo || 'No receiving challan'}</p>
                    <p className="mt-1 text-zinc-400">{batch.dateReceived ? formatDateTime(batch.dateReceived, true) : '—'}</p>
                    <p className="mt-1 text-zinc-500">{batch.batchNo}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{unitNameMap.get(batch.millName) || batch.customMillName || batch.millName.split('_').join(' ')}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-200">{batch.fabricType}</p>
                    <p className="mt-1 text-zinc-400">{batch.yarnSpec} · {batch.targetColor}</p>
                    <details className="mt-2 text-zinc-500"><summary className="cursor-pointer">Delivery details</summary>
                      <div className="mt-2 space-y-1">
                        {batch.ogpNo && <p>Sending challan: {batch.ogpNo}</p>}
                        {batch.machineNo && <p>Machine: {batch.machineNo}</p>}
                        {(batch.gsm || batch.width) && <p>GSM: {batch.gsm || '—'} · Width: {batch.width || '—'}</p>}
                        {batch.driverName && <p>Driver: {batch.driverName}</p>}
                        {batch.vehicleNo && <p>Vehicle: {batch.vehicleNo}</p>}
                        {batch.remarks && <p>{batch.remarks}</p>}
                      </div>
                    </details>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400"><p>{formatWeight(batch.ecruWeightKg)}</p><p className="mt-1">{batch.ecruRollsCount} rolls</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-emerald-400"><p className="font-medium">{formatWeight(batch.finishWeightKg || 0)}</p><p className="mt-1 text-zinc-400">{batch.finishRollsCount || 0} rolls</p></td>
                  <td className="whitespace-nowrap px-4 py-3"><p className="text-zinc-300">{formatWeight(batch.shortageWeightKg || 0)}</p><Badge variant={(batch.shortagePercent || 0) > 5 ? 'warning' : 'success'} className="mt-1">{(batch.shortagePercent || 0).toFixed(2)}%</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
        {data && data.totalPages > 1 && <div className="border-t border-zinc-800 p-3"><PaginationControls page={page} totalPages={data.totalPages} total={data.total} limit={limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} /></div>}
      </Card>
    </div>
  );
}
