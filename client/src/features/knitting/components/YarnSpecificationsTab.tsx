import { useListPagination } from '../../../hooks/useListPagination.js';
import { uppercaseDisplay } from '../../../lib/displayText.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { QueryError } from '../../../components/ui/QueryError.js';
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
import { Layers, Plus, Search, Edit, Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Filter, X } from 'lucide-react';

export function YarnSpecificationsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | YarnCategory>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<YarnSpecificationItem | null>(null);

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameSourceSpec, setRenameSourceSpec] = useState('');
  const [renameAffectedCount, setRenameAffectedCount] = useState(0);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { isError: hasQueryError1,
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

    if (!window.confirm(uppercaseDisplay(confirmMessage))) return;

    setDeletingId(spec._id);
    try {
      await api.delete(`/knitting/yarn-specs/${spec._id}`);
      handleDataChanged();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      alert(uppercaseDisplay(anyErr.response?.data?.error || anyErr.message || 'Failed to delete specification'));
    } finally {
      setDeletingId(null);
    }
  }

  const filteredCatalog = useMemo(() => {
    let list = [...catalog];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
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
  }, [catalog, debouncedSearch, categoryFilter, activeFilter]);

  const activeSpecsCount = catalog.filter((s) => s.isActive).length;
  const inUseCount = catalog.filter((s) => s.transactionCount > 0).length;

  function getCategoryColor(cat: YarnCategory) {
    switch (cat) {
      case 'Polyester':
        return 'bg-info-soft border-line text-info';
      case 'Cotton':
        return 'bg-brand-soft border-line text-brand';
      case 'Spandex':
        return 'bg-info-soft border-line text-info';
      case 'Blended':
        return 'bg-warning-soft border-line text-warning';
      case 'Viscose':
        return 'bg-info-soft border-line text-info';
      default:
        return 'bg-subtle border-control text-ink';
    }
  }

  const uncatalogedPagination = useListPagination(uncataloged, []);
  const pagination = useListPagination(filteredCatalog, [debouncedSearch, categoryFilter, activeFilter]);

  return (
    <div className="space-y-6">
      {(hasQueryError1) && <QueryError onRetry={() => { refetch(); }} />}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-brand normal-case tracking-normal flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Standard Dropdown Specs
            </div>
            <div className="text-xl font-bold font-mono text-brand mt-1">
              {activeSpecsCount}{' '}
              <span className="text-xs font-normal text-soft">/ {catalog.length} total</span>
            </div>
            <div className="text-xs text-soft mt-0.5">Active options in Issue Yarn modals</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-info normal-case tracking-normal flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Specs in Transactions
            </div>
            <div className="text-xl font-bold font-mono text-info mt-1">
              {inUseCount}
            </div>
            <div className="text-xs text-soft mt-0.5">Catalog specs with logged history</div>
          </CardContent>
        </Card>

        <Card className={`bg-surface/80 p-3 transition-colors ${uncataloged.length > 0 ? 'border-amber-500/50 shadow-sm' : 'border-line'}`}>
          <CardContent className="p-0">
            <div className="text-xs font-medium text-warning normal-case tracking-normal flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Uncataloged / Custom Specs
            </div>
            <div className="text-xl font-bold font-mono text-warning mt-1">
              {uncataloged.length}
            </div>
            <div className="text-xs text-soft mt-0.5">
              {uncataloged.length > 0 ? 'Typos or custom entries to merge' : 'All transactions match catalog'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3 flex flex-col justify-center">
          <CardContent className="p-0">
            <Button
              size="sm"
              onClick={() => {
                setEditingSpec(null);
                setIsAddEditModalOpen(true);
              }}
              className="w-full gap-1.5 bg-primary hover:bg-emerald-800 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Yarn Spec</span>
            </Button>
            <div className="text-xs text-center text-soft mt-1.5">
              Instantly appears in yarn dropdowns
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uncataloged / Typo Specs Alert Panel (if any exist) */}
      {uncataloged.length > 0 && (
        <Card className="border-line bg-warning-soft overflow-hidden">
          <div className="p-3 bg-warning-soft border-b border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <div>
                <h3 className="text-xs font-semibold text-warning">
                  Uncataloged Yarn Specifications Detected ({uncataloged.length})
                </h3>
                <p className="text-xs text-warning">
                  These specification names were found in transactions but are not in the standard catalog. You can merge or rename them to fix typos across all past records.
                </p>
              </div>
            </div>
          </div>

          <ScrollableTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/90 border-b border-line text-soft normal-case font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Recorded Name in Transactions</th>
                  <th className="py-2.5 px-3 text-center">Transactions Count</th>
                  <th className="py-2.5 px-3 text-right">Gross Issued</th>
                  <th className="py-2.5 px-3 text-right">Remaining Yarn</th>
                  <th className="py-2.5 px-3 text-center">Affected Knitters</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {uncatalogedPagination.items.map((item) => (
                  <tr key={item.yarnSpec} className="hover:bg-subtle/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-warning bg-warning-soft border border-line px-2 py-0.5 rounded">
                          {item.yarnSpec}
                        </span>
                        <Badge variant="outline" className="text-xs text-warning border-line">
                          Not In Catalog
                        </Badge>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-ink">
                      {item.transactionCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-ink">
                      {formatWeight(item.totalGrossKg)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-warning">
                      {formatWeight(item.remainingYarnKg)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-soft">
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
                        className="gap-1 text-xs h-7 bg-warning-soft border-line text-warning hover:bg-warning-soft hover:text-strong"
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
          <PaginationControls {...uncatalogedPagination} onPageChange={uncatalogedPagination.setPage} onLimitChange={uncatalogedPagination.setLimit} />
        </Card>
      )}

      {/* Standard Specifications Catalog Table */}
      <Card className="border-line bg-surface/80 overflow-hidden">
        <div className="p-3 border-b border-line bg-canvas/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-surface border border-line rounded-md px-2 py-1 h-9">
              <Filter className="w-3.5 h-3.5 text-soft shrink-0" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | YarnCategory)}
                className="bg-transparent text-xs text-strong focus:outline-none cursor-pointer pr-1"
                title="Filter by Fiber / Category"
              >
                <option value="ALL" className="bg-surface text-strong">All Fiber Categories</option>
                <option value="Polyester" className="bg-surface text-strong">Polyester</option>
                <option value="Cotton" className="bg-surface text-strong">Cotton</option>
                <option value="Spandex" className="bg-surface text-strong">Spandex</option>
                <option value="Blended" className="bg-surface text-strong">Blended</option>
                <option value="Viscose" className="bg-surface text-strong">Viscose</option>
                <option value="Other" className="bg-surface text-strong">Other</option>
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
                <option value="ACTIVE" className="bg-surface text-strong">Active Only (in dropdowns)</option>
                <option value="INACTIVE" className="bg-surface text-strong">Archived / Inactive</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Refresh specifications"
              className="h-9 px-2.5 text-soft"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft pointer-events-none" />
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
                <th className="py-2.5 px-3">Specification Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description / Notes</th>
                <th className="py-2.5 px-3 text-center">Status in Dropdown</th>
                <th className="py-2.5 px-3 text-center">Transaction Usage</th>
                <th className="py-2.5 px-3 text-right">Total Gross</th>
                <th className="py-2.5 px-3 text-right">Remaining Yarn</th>
                <th className="py-2.5 px-3 text-center sticky right-0 bg-canvas z-20 border-l border-line">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={8} message="Loading yarn specifications..." />
              ) : filteredCatalog.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-soft">
                    No yarn specifications found matching the current search/filters.
                  </td>
                </tr>
              ) : (
                pagination.items.map((spec) => (
                  <tr key={spec._id} className="hover:bg-subtle/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-strong text-sm">
                        {spec.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(
                          spec.category
                        )}`}
                      >
                        {spec.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-soft max-w-[200px] truncate">
                      {spec.description || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {spec.isActive ? (
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
                      {spec.transactionCount > 0 ? (
                        <Badge variant="outline" className="font-mono text-xs bg-surface border-control text-ink">
                          {spec.transactionCount} {spec.transactionCount === 1 ? 'tx' : 'txs'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-soft">Unused</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-ink">
                      {spec.totalGrossKg > 0 ? formatWeight(spec.totalGrossKg) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-warning">
                      {spec.remainingYarnKg > 0 ? formatWeight(spec.remainingYarnKg) : '0 Kg'}
                    </td>
                    <td className="py-2.5 px-3 text-center sticky right-0 bg-canvas z-20 border-l border-line">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSpec(spec);
                            setIsAddEditModalOpen(true);
                          }}
                          className="h-7 px-2 text-ink hover:text-strong hover:bg-subtle"
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
                          className="h-7 px-2 text-danger hover:text-danger hover:bg-danger-soft"
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
        <PaginationControls {...pagination} onPageChange={pagination.setPage} onLimitChange={pagination.setLimit} />
      </Card>

      {/* Add / Edit Specification Modal */}
      {isAddEditModalOpen && <AddEditYarnSpecModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingSpec(null);
        }}
        onSuccess={handleDataChanged}
        editingSpec={editingSpec}
      />}

      {/* Bulk Rename Historical Spec Modal */}
      {isRenameModalOpen && <RenameYarnSpecModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onSuccess={handleDataChanged}
        sourceSpec={renameSourceSpec}
        catalogSpecs={catalog}
        affectedTxCount={renameAffectedCount}
      />}
    </div>
  );
}
