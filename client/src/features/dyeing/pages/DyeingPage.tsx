import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { DyeingBatchItem, DyeingMillType } from '../types/dyeing.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { Input } from '../../../components/ui/Input.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { IssueBatchModal } from '../components/IssueBatchModal.js';
import { SettleBatchModal } from '../components/SettleBatchModal.js';
import { formatWeight, formatDate } from '../../../lib/formatters.js';
import {
  Palette,
  RefreshCw,
  Plus,
  Factory,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Search,
  CheckCheck
} from 'lucide-react';

export function DyeingPage() {
  const [selectedMill, setSelectedMill] = useState<DyeingMillType | 'ALL'>('GHUMMAN_DYEING');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [settlingBatch, setSettlingBatch] = useState<DyeingBatchItem | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [selectedMill, statusFilter, debouncedSearchTerm]);

  const { data, isLoading, refetch } = useQuery<{
    items: DyeingBatchItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['dyeing-batches', selectedMill, statusFilter, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (selectedMill !== 'ALL') {
        params.millName = selectedMill;
      }
      if (statusFilter === 'ACTIVE') {
        params.status = 'ISSUED';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-emerald-500" />
            Multi-Mill Dyeing & Process Loss Engine
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Coordinate batch allocation and settlement across Ghumman & Rajput Dyeing with live shrinkage loss math.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh batches">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          <Button size="sm" onClick={() => setIsIssueOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Issue New Batch
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Factory className="w-3 h-3" />
              In-Process Ecru Weight
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
              Active Batches in Mill
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
              Finished Dyed Fabric Received
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatWeight(kpis.completedKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{kpis.completedBatches} batches settled</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3 h-3" />
              Average Process Shrinkage
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
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          {[
            { id: 'GHUMMAN_DYEING', label: 'Ghuman Dyeing Mill' },
            { id: 'RAJPUT_DYEING', label: 'Rajput Dyeing Mill' },
            { id: 'ALL', label: 'All Mills Unified' }
          ].map((mill) => (
            <button
              key={mill.id}
              onClick={() => setSelectedMill(mill.id as DyeingMillType | 'ALL')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors select-none ${
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

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
            {[
              { id: 'ACTIVE', label: 'Active / In-Process' },
              { id: 'COMPLETED', label: 'Completed / Settled' },
              { id: 'ALL', label: 'All Batches' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id as typeof statusFilter)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors select-none ${
                  statusFilter === st.id
                    ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72 relative">
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

      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Batch #</th>
                <th className="py-3 px-4">Mill</th>
                <th className="py-3 px-4">Fabric Variety & Count</th>
                <th className="py-3 px-4">Target Color</th>
                <th className="py-3 px-4 text-right">Ecru Issued</th>
                <th className="py-3 px-4 text-right">Finish Received</th>
                <th className="py-3 px-4 text-right">Shortage Loss</th>
                <th className="py-3 px-4 text-center">Shrinkage %</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500">
                    Loading dyeing batches...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500">
                    No batches found matching selected criteria.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-emerald-400">{b.batchNo}</div>
                      <div className="text-[10px] text-zinc-500">{formatDate(b.dateIssued)}</div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={b.millName === 'GHUMMAN_DYEING' ? 'default' : 'success'}
                        className="text-[10px] py-0.5"
                      >
                        {b.millName === 'GHUMMAN_DYEING' ? 'Ghumman' : 'Rajput'}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-100">{b.fabricType}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{b.yarnSpec}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                        {b.targetColor}
                      </span>
                      {b.allocatedCustomerId && (
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          Order: {b.allocatedCustomerId.name}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-300">
                      <div>{formatWeight(b.ecruWeightKg)}</div>
                      <div className="text-[10px] text-zinc-500">{b.ecruRollsCount} rolls</div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      {b.status === 'COMPLETED' ? (
                        <>
                          <div className="text-emerald-400 font-semibold">{formatWeight(b.finishWeightKg || 0)}</div>
                          <div className="text-[10px] text-zinc-500">{b.finishRollsCount} rolls</div>
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      {b.status === 'COMPLETED' ? (
                        <span className={(b.shortagePercent || 0) > 5.0 ? 'text-amber-400 font-bold' : 'text-zinc-300'}>
                          {formatWeight(b.shortageWeightKg || 0)}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
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
                        <span className="text-zinc-600 text-xs">In Process</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {b.status === 'COMPLETED' ? (
                        <Badge variant="success" className="gap-1 text-[10px]">
                          <CheckCheck className="w-3 h-3" />
                          Settled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px] text-amber-400 border-amber-500/30">
                          Active
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {b.status !== 'COMPLETED' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSettlingBatch(b)}
                          className="text-[11px] py-1 px-2.5 h-7"
                        >
                          Settle Batch
                        </Button>
                      ) : (
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {b.igpNo || 'Settled'}
                        </span>
                      )}
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
    </div>
  );
}
