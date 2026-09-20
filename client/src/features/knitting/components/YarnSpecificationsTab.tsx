import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import {
  YarnSpecificationItem,
  YarnSpecsResponseData,
  YarnCategory
} from '../types/knitting.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { AddEditYarnSpecModal } from './AddEditYarnSpecModal.js';
import { RenameYarnSpecModal } from './RenameYarnSpecModal.js';
import { formatWeight } from '../../../lib/formatters.js';
import {
  Layers,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  X
} from 'lucide-react';

export function YarnSpecificationsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | YarnCategory>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<YarnSpecificationItem | null>(null);

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameSourceSpec, setRenameSourceSpec] = useState('');
  const [renameAffectedCount, setRenameAffectedCount] = useState(0);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<YarnSpecsResponseData>({
    queryKey: ['yarn-specs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: YarnSpecsResponseData }>('/knitting/yarn-specs');
      return res.data.data;
    }
  });

  const catalog = data?.catalog || [];
  const uncataloged = data?.uncataloged || [];

  function handleDataChanged() {
    queryClient.invalidateQueries({ queryKey: ['yarn-specs'] });
    queryClient.invalidateQueries({ queryKey: ['knitter-balances'] });
    queryClient.invalidateQueries({ queryKey: ['yarn-transactions'] });
  }

  async function handleDeleteSpec(spec: YarnSpecificationItem) {
    const isUsed = spec.transactionCount > 0;
    const confirmMessage = isUsed
      ? `Specification '${spec.name}' is used in ${spec.transactionCount} transaction(s). It cannot be permanently deleted, but will be archived / deactivated from future dropdowns. Proceed?`
      : `Are you sure you want to delete yarn specification '${spec.name}' from the catalog?`;

    if (!window.confirm(confirmMessage)) return;

    setDeletingId(spec._id);
    try {
      await api.delete(`/knitting/yarn-specs/${spec._id}`);
      handleDataChanged();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      alert(anyErr.response?.data?.error || anyErr.message || 'Failed to delete specification');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredCatalog = useMemo(() => {
    let list = [...catalog];
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.category.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'ALL') {
      list = list.filter((s) => s.category === categoryFilter);
    }
    if (activeFilter === 'ACTIVE') {
      list = list.filter((s) => s.isActive);
    } else if (activeFilter === 'INACTIVE') {
      list = list.filter((s) => !s.isActive);
    }
    return list;
  }, [catalog, searchTerm, categoryFilter, activeFilter]);

  const activeSpecsCount = catalog.filter((s) => s.isActive).length;
  const inUseCount = catalog.filter((s) => s.transactionCount > 0).length;

  function getCategoryColor(cat: YarnCategory) {
    switch (cat) {
      case 'Polyester':
        return 'bg-blue-950/60 border-blue-700/60 text-blue-300';
      case 'Cotton':
        return 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300';
      case 'Spandex':
        return 'bg-purple-950/60 border-purple-700/60 text-purple-300';
      case 'Blended':
        return 'bg-amber-950/60 border-amber-700/60 text-amber-300';
      case 'Viscose':
        return 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-300';
    }
  }

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Standard Dropdown Specs
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {activeSpecsCount}{' '}
              <span className="text-xs font-normal text-zinc-500">/ {catalog.length} total</span>
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Active options in Issue Yarn modals</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-blue-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Specs in Transactions
            </div>
            <div className="text-xl font-bold font-mono text-blue-400 mt-1">
              {inUseCount}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Catalog specs with logged history</div>
          </CardContent>
        </Card>

        <Card className={`bg-zinc-900/80 p-3 transition-colors ${uncataloged.length > 0 ? 'border-amber-500/50 shadow-sm' : 'border-zinc-800'}`}>
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Uncataloged / Custom Specs
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {uncataloged.length}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {uncataloged.length > 0 ? 'Typos or custom entries to merge' : 'All transactions match catalog'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3 flex flex-col justify-center">
          <CardContent className="p-0">
            <Button
              size="sm"
              onClick={() => {
                setEditingSpec(null);
                setIsAddEditModalOpen(true);
              }}
              className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Yarn Spec</span>
            </Button>
            <div className="text-[10px] text-center text-zinc-500 mt-1.5">
              Instantly appears in yarn dropdowns
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uncataloged / Typo Specs Alert Panel (if any exist) */}
      {uncataloged.length > 0 && (
        <Card className="border-amber-800/60 bg-amber-950/20 overflow-hidden">
          <div className="p-3 bg-amber-950/40 border-b border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-xs font-semibold text-amber-300">
                  Uncataloged Yarn Specifications Detected ({uncataloged.length})
                </h3>
                <p className="text-[11px] text-amber-200/80">
                  These specification names were found in transactions but are not in the standard catalog. You can merge or rename them to fix typos across all past records.
                </p>
              </div>
            </div>
          </div>

          <ScrollableTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Recorded Name in Transactions</th>
                  <th className="py-2.5 px-3 text-center">Transactions Count</th>
                  <th className="py-2.5 px-3 text-right">Gross Issued</th>
                  <th className="py-2.5 px-3 text-right">Remaining Yarn</th>
                  <th className="py-2.5 px-3 text-center">Affected Knitters</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {uncataloged.map((item) => (
                  <tr key={item.yarnSpec} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-amber-400 bg-amber-950/50 border border-amber-800/60 px-2 py-0.5 rounded">
                          {item.yarnSpec}
                        </span>
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-800">
                          Not In Catalog
                        </Badge>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-zinc-300">
                      {item.transactionCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                      {formatWeight(item.totalGrossKg)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-400">
                      {formatWeight(item.remainingYarnKg)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-zinc-400">
                      {item.partiesCount}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRenameSourceSpec(item.yarnSpec);
                          setRenameAffectedCount(item.transactionCount);
                          setIsRenameModalOpen(true);
                        }}
                        className="gap-1 text-xs h-7 bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/50 hover:text-white"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Rename / Merge Spec</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
      )}

      {/* Standard Specifications Catalog Table */}
      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="p-3 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 h-9">
              <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | YarnCategory)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
                title="Filter by Fiber / Category"
              >
                <option value="ALL" className="bg-zinc-900 text-zinc-200">All Fiber Categories</option>
                <option value="Polyester" className="bg-zinc-900 text-zinc-200">Polyester</option>
                <option value="Cotton" className="bg-zinc-900 text-zinc-200">Cotton</option>
                <option value="Spandex" className="bg-zinc-900 text-zinc-200">Spandex</option>
                <option value="Blended" className="bg-zinc-900 text-zinc-200">Blended</option>
                <option value="Viscose" className="bg-zinc-900 text-zinc-200">Viscose</option>
                <option value="Other" className="bg-zinc-900 text-zinc-200">Other</option>
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
                <option value="ACTIVE" className="bg-zinc-900 text-zinc-200">Active Only (in dropdowns)</option>
                <option value="INACTIVE" className="bg-zinc-900 text-zinc-200">Archived / Inactive</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Refresh specifications"
              className="h-9 px-2.5 text-zinc-400"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <Input
              placeholder="Search specifications..."
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
                <th className="py-2.5 px-3">Specification Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description / Notes</th>
                <th className="py-2.5 px-3 text-center">Status in Dropdown</th>
                <th className="py-2.5 px-3 text-center">Transaction Usage</th>
                <th className="py-2.5 px-3 text-right">Total Gross</th>
                <th className="py-2.5 px-3 text-right">Remaining Yarn</th>
                <th className="py-2.5 px-3 text-center sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={8} message="Loading yarn specifications..." />
              ) : filteredCatalog.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No yarn specifications found matching the current search/filters.
                  </td>
                </tr>
              ) : (
                filteredCatalog.map((spec) => (
                  <tr key={spec._id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-zinc-100 text-sm">
                        {spec.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getCategoryColor(
                          spec.category
                        )}`}
                      >
                        {spec.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 max-w-[200px] truncate">
                      {spec.description || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {spec.isActive ? (
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
                      {spec.transactionCount > 0 ? (
                        <Badge variant="outline" className="font-mono text-[11px] bg-zinc-900 border-zinc-700 text-zinc-300">
                          {spec.transactionCount} {spec.transactionCount === 1 ? 'tx' : 'txs'}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-zinc-600">Unused</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                      {spec.totalGrossKg > 0 ? formatWeight(spec.totalGrossKg) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-400">
                      {spec.remainingYarnKg > 0 ? formatWeight(spec.remainingYarnKg) : '0 Kg'}
                    </td>
                    <td className="py-2.5 px-3 text-center sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSpec(spec);
                            setIsAddEditModalOpen(true);
                          }}
                          className="h-7 px-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
                          title="Edit specification name, category, or notes"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          <span>Edit</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSpec(spec)}
                          disabled={deletingId === spec._id}
                          className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                          title={spec.transactionCount > 0 ? 'Archive / Deactivate' : 'Delete'}
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

      {/* Add / Edit Specification Modal */}
      <AddEditYarnSpecModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingSpec(null);
        }}
        onSuccess={handleDataChanged}
        editingSpec={editingSpec}
      />

      {/* Bulk Rename Historical Spec Modal */}
      <RenameYarnSpecModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onSuccess={handleDataChanged}
        sourceSpec={renameSourceSpec}
        catalogSpecs={catalog}
        affectedTxCount={renameAffectedCount}
      />
    </div>
  );
}
