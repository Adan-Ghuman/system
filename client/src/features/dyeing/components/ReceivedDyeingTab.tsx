import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { DyeingBatchItem, DyeingMillType, DyeingUnitItem } from '../types/dyeing.types.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { Input } from '../../../components/ui/Input.js';
import { Button } from '../../../components/ui/Button.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { formatWeight, formatDateTime } from '../../../lib/formatters.js';
import {
  PackageCheck,
  Search,
  Factory,
  Scale,
  AlertTriangle,
  ArrowUpDown,
  Plus
} from 'lucide-react';

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

  // Query only COMPLETED batches (finished fabric received)
  const { data, isLoading } = useQuery<{
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

  const batches = data?.items || [];

  // Metrics for received fabric
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
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <PackageCheck className="w-3.5 h-3.5" />
              Total Received Fabric
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(metrics.totalFinishKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Across {metrics.totalBatches} settled batches
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Total Finished Rolls
            </div>
            <div className="text-lg font-bold text-white mt-1">
              {metrics.totalFinishRolls} Rolls
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Deposited into finished stock</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" />
              Average Shrinkage Loss
            </div>
            <div
              className={`text-lg font-bold font-mono mt-1 ${
                metrics.avgShrinkage > 5.0 ? 'text-amber-400' : 'text-zinc-200'
              }`}
            >
              {metrics.avgShrinkage.toFixed(2)}%
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Total weight loss: {formatWeight(metrics.totalLossKg)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3 flex flex-col justify-center">
          <CardContent className="p-0 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Inward Action
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Record new delivery</div>
            </div>

            <Button
              size="sm"
              onClick={onOpenReceiveModal}
              className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Receive Delivery (IGP)</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
          {dynamicMillFilters.map((mill) => (
            <button
              key={mill.id}
              onClick={() => {
                setSelectedMill(mill.id as DyeingMillType | 'ALL');
                setPage(1);
              }}
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
          <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            <span>Inward Gate Pass & Received Lots Register</span>
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
                <option value="desc" className="bg-zinc-900 text-zinc-200">Sort: Latest Received First</option>
                <option value="asc" className="bg-zinc-900 text-zinc-200">Sort: Oldest Received First</option>
              </select>
            </div>

            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search IGP #, OGP #, batch, color, driver..."
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Received Batches Table */}
      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Date Received</th>
                <th className="py-3 px-4 whitespace-nowrap">IGP #</th>
                <th className="py-3 px-4 whitespace-nowrap">Batch #</th>
                <th className="py-3 px-4 whitespace-nowrap">OGP #</th>
                <th className="py-3 px-4 whitespace-nowrap">Dyeing Unit</th>
                <th className="py-3 px-4 whitespace-nowrap">Fabric Variety & Spec</th>
                <th className="py-3 px-4 whitespace-nowrap">Color</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Ecru Sent</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Finish Received</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Loss (Kg)</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Shrink %</th>
                <th className="py-3 px-4 whitespace-nowrap">Driver / Transport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={12} message="Loading received dyeing lots..." />
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-zinc-500">
                    No received dyeing batches found. Click &quot;Receive Delivery (IGP)&quot; to record incoming fabric.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 text-zinc-300 font-mono whitespace-nowrap">
                      {b.dateReceived ? formatDateTime(b.dateReceived, true) : '—'}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {b.igpNo || '—'}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-zinc-200 whitespace-nowrap">
                      {b.batchNo}
                    </td>

                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      {b.ogpNo || '—'}
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
                      {b.machineNo && (
                        <span className="text-[10px] font-mono text-emerald-500 ml-1">[{b.machineNo}]</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                        {b.targetColor}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                      <span>{formatWeight(b.ecruWeightKg)}</span>
                      <span className="text-[10px] text-zinc-500 ml-1">({b.ecruRollsCount}R)</span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      <span>{formatWeight(b.finishWeightKg || 0)}</span>
                      <span className="text-[10px] text-emerald-500/80 font-normal ml-1">({b.finishRollsCount || 0}R)</span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono whitespace-nowrap text-zinc-300">
                      {formatWeight(b.shortageWeightKg || 0)}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
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
                    </td>

                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap text-[11px]">
                      {b.driverName || b.vehicleNo ? (
                        <span>
                          {b.driverName || ''} {b.vehicleNo ? `(${b.vehicleNo})` : ''}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>

        {data && data.totalPages > 1 && (
          <div className="p-3 border-t border-zinc-800 bg-zinc-950/40">
            <PaginationControls
              page={page}
              totalPages={data.totalPages}
              total={data.total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
