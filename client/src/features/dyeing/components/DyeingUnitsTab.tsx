import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { DyeingUnitItem, DyeingUnitType } from '../types/dyeing.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { AddEditUnitModal } from './AddEditUnitModal.js';
import { formatWeight } from '../../../lib/formatters.js';
import {
  Factory,
  Warehouse,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Filter,
  X,
  Phone,
  MapPin
} from 'lucide-react';

export function DyeingUnitsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | DyeingUnitType>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DyeingUnitItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: units = [],
    isLoading,
    isRefetching,
    refetch
  } = useQuery<DyeingUnitItem[]>({
    queryKey: ['dyeing-units'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DyeingUnitItem[] }>('/dyeing/units');
      return res.data.data;
    }
  });

  function handleDataChanged() {
    queryClient.invalidateQueries({ queryKey: ['dyeing-units'] });
    queryClient.invalidateQueries({ queryKey: ['dyeing-batches'] });
    queryClient.invalidateQueries({ queryKey: ['dyeing-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
  }

  async function handleDeleteUnit(unit: DyeingUnitItem) {
    const isUsed = unit.activeBatchesCount > 0 || unit.inventoryWeightKg > 0;
    const confirmMsg = unit.isSystemDefault
      ? `System unit '${unit.name}' cannot be permanently deleted. It will be archived / deactivated from dropdown selectors. Proceed?`
      : isUsed
      ? `Unit '${unit.name}' has recorded history. It will be archived / deactivated from future selectors. Proceed?`
      : `Are you sure you want to delete '${unit.name}'?`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(unit._id);
    try {
      await api.delete(`/dyeing/units/${unit._id}`);
      handleDataChanged();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      alert(anyErr.response?.data?.error || anyErr.message || 'Failed to archive unit');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredUnits = useMemo(() => {
    let list = [...units];
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.shortName.toLowerCase().includes(q) ||
          u.code.toLowerCase().includes(q) ||
          (u.address && u.address.toLowerCase().includes(q))
      );
    }
    if (typeFilter !== 'ALL') {
      list = list.filter((u) => u.type === typeFilter);
    }
    if (activeFilter === 'ACTIVE') {
      list = list.filter((u) => u.isActive);
    } else if (activeFilter === 'INACTIVE') {
      list = list.filter((u) => !u.isActive);
    }
    return list;
  }, [units, searchTerm, typeFilter, activeFilter]);

  const activeDyeingMills = units.filter((u) => u.type === 'DYEING_MILL' && u.isActive).length;
  const activeGodowns = units.filter((u) => u.type === 'GODOWN' && u.isActive).length;
  const totalInProcessKg = units.reduce((acc, u) => acc + (u.totalEcruWeightKg || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Factory className="w-3 h-3" />
              Active Dyeing Mills
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {activeDyeingMills}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Contract &amp; in-house dyeing units</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-blue-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <Warehouse className="w-3 h-3" />
              Warehouse Godowns
            </div>
            <div className="text-xl font-bold font-mono text-blue-400 mt-1">
              {activeGodowns}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Storage &amp; distribution godowns</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-purple-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Factory className="w-3 h-3" />
              Total Processed at Units
            </div>
            <div className="text-xl font-bold font-mono text-purple-400 mt-1">
              {formatWeight(totalInProcessKg)}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Historical fabric volume</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3 flex flex-col justify-center">
          <CardContent className="p-0">
            <Button
              size="sm"
              onClick={() => {
                setEditingUnit(null);
                setIsAddEditModalOpen(true);
              }}
              className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dyeing Unit / Godown</span>
            </Button>
            <div className="text-[10px] text-center text-zinc-500 mt-1.5">
              Available instantly in all dropdowns
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Units Table Card */}
      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="p-3 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
              <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | DyeingUnitType)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                title="Filter by Location Type"
              >
                <option value="ALL" className="bg-zinc-900 text-zinc-200">All Location Types</option>
                <option value="DYEING_MILL" className="bg-zinc-900 text-zinc-200">Dyeing Mills Only</option>
                <option value="GODOWN" className="bg-zinc-900 text-zinc-200">Warehouse Godowns Only</option>
                <option value="OTHER" className="bg-zinc-900 text-zinc-200">Other Units</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                title="Filter active status"
              >
                <option value="ALL" className="bg-zinc-900 text-zinc-200">All Statuses</option>
                <option value="ACTIVE" className="bg-zinc-900 text-zinc-200">Active Only</option>
                <option value="INACTIVE" className="bg-zinc-900 text-zinc-200">Archived / Inactive</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Refresh units"
              className="h-9 px-2.5 text-zinc-400"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <Input
              placeholder="Search units, codes, locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Unit / Facility Name</th>
                <th className="py-2.5 px-3">Display Button Label</th>
                <th className="py-2.5 px-3">Location Type</th>
                <th className="py-2.5 px-3">Contact &amp; Address</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Batches In Process</th>
                <th className="py-2.5 px-3 text-right">Current Stock (Kg)</th>
                <th className="py-2.5 px-3 text-center sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={8} message="Loading dyeing units & locations..." />
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No dyeing units found matching the current search/filters.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => (
                  <tr key={u._id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-zinc-100 text-sm flex items-center gap-1.5">
                        {u.type === 'GODOWN' ? (
                          <Warehouse className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : (
                          <Factory className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span>{u.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        Code: {u.code}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-zinc-800 border border-zinc-700 text-emerald-300">
                        {u.shortName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${
                          u.type === 'GODOWN'
                            ? 'bg-blue-950/50 border-blue-800 text-blue-300'
                            : 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                        }`}
                      >
                        {u.type === 'GODOWN' ? 'Warehouse Godown' : 'Dyeing Mill'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 max-w-[220px]">
                      {u.contactPhone && (
                        <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                          <Phone className="w-3 h-3 text-zinc-500" />
                          <span>{u.contactPhone}</span>
                        </div>
                      )}
                      {u.address && (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 truncate mt-0.5">
                          <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                          <span className="truncate">{u.address}</span>
                        </div>
                      )}
                      {!u.contactPhone && !u.address && <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                          <XCircle className="w-3 h-3" />
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {u.activeBatchesCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-950/60 border border-amber-800/80 text-amber-300">
                          {u.activeBatchesCount} in process
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-600">0 active</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                      {u.inventoryWeightKg > 0 ? (
                        <div>
                          <div className="font-semibold text-zinc-200">
                            {formatWeight(u.inventoryWeightKg)}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {u.inventoryRollsCount} rolls
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-600">0 Kg</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingUnit(u);
                            setIsAddEditModalOpen(true);
                          }}
                          className="h-7 px-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
                          title="Edit unit name, display label, or contact info"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          <span>Edit</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteUnit(u)}
                          disabled={deletingId === u._id}
                          className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                          title="Archive / Deactivate unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* Add / Edit Unit Modal */}
      <AddEditUnitModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingUnit(null);
        }}
        onSuccess={handleDataChanged}
        editingUnit={editingUnit}
      />
    </div>
  );
}
