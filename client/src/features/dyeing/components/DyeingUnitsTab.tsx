import { useListPagination } from '../../../hooks/useListPagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { QueryError } from '../../../components/ui/QueryError.js';
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
import { PartyLink } from '../../../business/PartyLink.js';
import { Factory, Warehouse, Plus, Search, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Filter, X, Phone, MapPin } from 'lucide-react';

export function DyeingUnitsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [typeFilter, setTypeFilter] = useState<'ALL' | DyeingUnitType>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DyeingUnitItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { isError: hasQueryError1,
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
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
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
  }, [units, debouncedSearch, typeFilter, activeFilter]);

  const activeDyeingMills = units.filter((u) => u.type === 'DYEING_MILL' && u.isActive).length;
  const activeGodowns = units.filter((u) => u.type === 'GODOWN' && u.isActive).length;
  const totalInProcessKg = units.reduce((acc, u) => acc + (u.totalEcruWeightKg || 0), 0);

  const pagination = useListPagination(filteredUnits, [debouncedSearch, typeFilter, activeFilter]);

  return (
    <div className="space-y-6">
      {(hasQueryError1) && <QueryError onRetry={() => { refetch(); }} />}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-brand normal-case tracking-normal flex items-center gap-1">
              <Factory className="w-3 h-3" />
              Active Dyeing Mills
            </div>
            <div className="text-xl font-bold font-mono text-brand mt-1">
              {activeDyeingMills}
            </div>
            <div className="text-xs text-soft mt-0.5">Contract &amp; in-house dyeing units</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-info normal-case tracking-normal flex items-center gap-1">
              <Warehouse className="w-3 h-3" />
              Warehouse Godowns
            </div>
            <div className="text-xl font-bold font-mono text-info mt-1">
              {activeGodowns}
            </div>
            <div className="text-xs text-soft mt-0.5">Storage &amp; distribution godowns</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-info normal-case tracking-normal flex items-center gap-1">
              <Factory className="w-3 h-3" />
              Total Processed at Units
            </div>
            <div className="text-xl font-bold font-mono text-info mt-1">
              {formatWeight(totalInProcessKg)}
            </div>
            <div className="text-xs text-soft mt-0.5">Historical fabric volume</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3 flex flex-col justify-center">
          <CardContent className="p-0">
            <Button
              size="sm"
              onClick={() => {
                setEditingUnit(null);
                setIsAddEditModalOpen(true);
              }}
              className="w-full gap-1.5 bg-primary hover:bg-emerald-800 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dyeing Unit / Godown</span>
            </Button>
            <div className="text-xs text-center text-soft mt-1.5">
              Available instantly in all dropdowns
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Units Table Card */}
      <Card className="border-line bg-surface/80 overflow-hidden">
        <div className="p-3 border-b border-line bg-canvas/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
              <Filter className="w-3.5 h-3.5 text-soft shrink-0" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | DyeingUnitType)}
                className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                title="Filter by Location Type"
              >
                <option value="ALL" className="bg-surface text-strong">All Location Types</option>
                <option value="DYEING_MILL" className="bg-surface text-strong">Dyeing Mills Only</option>
                <option value="GODOWN" className="bg-surface text-strong">Warehouse Godowns Only</option>
                <option value="OTHER" className="bg-surface text-strong">Other Units</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                title="Filter active status"
              >
                <option value="ALL" className="bg-surface text-strong">All Statuses</option>
                <option value="ACTIVE" className="bg-surface text-strong">Active Only</option>
                <option value="INACTIVE" className="bg-surface text-strong">Archived / Inactive</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Refresh units"
              className="h-9 px-2.5 text-soft"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft pointer-events-none" />
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-soft hover:text-ink p-0.5 rounded transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas/90 border-b border-line text-soft normal-case font-semibold">
              <tr>
                <th className="py-2.5 px-3">Unit / Facility Name</th>
                <th className="py-2.5 px-3">Display Button Label</th>
                <th className="py-2.5 px-3">Location Type</th>
                <th className="py-2.5 px-3">Contact &amp; Address</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Batches In Process</th>
                <th className="py-2.5 px-3 text-right">Current Stock (Kg)</th>
                <th className="py-2.5 px-3 text-center sticky right-0 bg-canvas z-20 border-l border-line">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={8} message="Loading dyeing units & locations..." />
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-soft">
                    No dyeing units found matching the current search/filters.
                  </td>
                </tr>
              ) : (
                pagination.items.map((u) => (
                  <tr key={u._id} className="hover:bg-subtle/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-strong text-sm flex items-center gap-1.5">
                        {u.type === 'GODOWN' ? (
                          <Warehouse className="w-4 h-4 text-info shrink-0" />
                        ) : (
                          <Factory className="w-4 h-4 text-brand shrink-0" />
                        )}
                        <span>{u.name}</span>
                      </div>
                      <div className="text-xs font-mono text-soft mt-0.5">
                        Code: {u.code}
                      </div>
                      {u.partyId && <div className="mt-1 text-xs"><PartyLink party={{ _id: u.partyId, name: u.shortName }} /><span className="ml-1 text-soft">· Party ledger</span></div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-subtle border border-control text-brand">
                        {u.shortName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          u.type === 'GODOWN'
                            ? 'bg-info-soft border-line text-info'
                            : 'bg-brand-soft border-line text-brand'
                        }`}
                      >
                        {u.type === 'GODOWN' ? 'Warehouse Godown' : 'Dyeing Mill'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-soft max-w-[220px]">
                      {u.contactPhone && (
                        <div className="flex items-center gap-1 text-xs text-ink">
                          <Phone className="w-3 h-3 text-soft" />
                          <span>{u.contactPhone}</span>
                        </div>
                      )}
                      {u.address && (
                        <div className="flex items-center gap-1 text-xs text-soft truncate mt-0.5">
                          <MapPin className="w-3 h-3 text-soft shrink-0" />
                          <span className="truncate">{u.address}</span>
                        </div>
                      )}
                      {!u.contactPhone && !u.address && <span className="text-soft">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-brand">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-soft">
                          <XCircle className="w-3 h-3" />
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {u.activeBatchesCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-warning-soft border border-line text-warning">
                          {u.activeBatchesCount} in process
                        </span>
                      ) : (
                        <span className="text-xs text-soft">0 active</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-ink">
                      {u.inventoryWeightKg > 0 ? (
                        <div>
                          <div className="font-semibold text-strong">
                            {formatWeight(u.inventoryWeightKg)}
                          </div>
                          <div className="text-xs text-soft">
                            {u.inventoryRollsCount} rolls
                          </div>
                        </div>
                      ) : (
                        <span className="text-soft">0 Kg</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center sticky right-0 bg-canvas z-20 border-l border-line">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingUnit(u);
                            setIsAddEditModalOpen(true);
                          }}
                          className="h-7 px-2 text-ink hover:text-strong hover:bg-subtle"
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
                          className="h-7 px-2 text-danger hover:text-danger hover:bg-danger-soft"
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
        <PaginationControls {...pagination} onPageChange={pagination.setPage} onLimitChange={pagination.setLimit} />
      </Card>

      {/* Add / Edit Unit Modal */}
      {isAddEditModalOpen && <AddEditUnitModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingUnit(null);
        }}
        onSuccess={handleDataChanged}
        editingUnit={editingUnit}
      />}
    </div>
  );
}
