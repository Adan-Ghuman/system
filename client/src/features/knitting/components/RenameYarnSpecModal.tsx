import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  YarnSpecificationItem,
  YarnCategory,
  BulkRenameYarnSpecPayload
} from '../types/knitting.types.js';

export interface RenameYarnSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceSpec: string;
  catalogSpecs: YarnSpecificationItem[];
  affectedTxCount?: number;
}

const CATEGORY_OPTIONS: { label: string; value: YarnCategory }[] = [
  { label: 'Polyester', value: 'Polyester' },
  { label: 'Cotton', value: 'Cotton' },
  { label: 'Spandex', value: 'Spandex' },
  { label: 'Blended', value: 'Blended' },
  { label: 'Viscose', value: 'Viscose' },
  { label: 'Other', value: 'Other' }
];

export function RenameYarnSpecModal({
  isOpen,
  onClose,
  onSuccess,
  sourceSpec,
  catalogSpecs,
  affectedTxCount = 0
}: RenameYarnSpecModalProps) {
  const [targetMode, setTargetMode] = useState<'catalog' | 'custom'>('catalog');
  const [selectedCatalogSpec, setSelectedCatalogSpec] = useState('');
  const [customSpec, setCustomSpec] = useState('');
  const [category, setCategory] = useState<YarnCategory>('Polyester');
  const [addToCatalog, setAddToCatalog] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setCustomSpec('');
      setCategory('Polyester');
      setAddToCatalog(true);

      const availableCatalog = catalogSpecs.filter(
        (s) => s.name.toLowerCase() !== sourceSpec.toLowerCase()
      );
      if (availableCatalog.length > 0) {
        setTargetMode('catalog');
        setSelectedCatalogSpec(availableCatalog[0].name);
      } else {
        setTargetMode('custom');
      }
    }
  }, [isOpen, sourceSpec, catalogSpecs]);

  const targetSpec = (targetMode === 'catalog' ? selectedCatalogSpec : customSpec).trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!targetSpec) {
      setError('Please select or enter a target yarn specification.');
      return;
    }

    if (targetSpec.toLowerCase() === sourceSpec.toLowerCase()) {
      setError('Target specification must be different from current specification.');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: BulkRenameYarnSpecPayload = {
        oldSpec: sourceSpec,
        newSpec: targetSpec,
        addToCatalogIfMissing: addToCatalog,
        category
      };

      const res = await api.post<{ success: boolean; message: string; data: { modifiedCount: number } }>(
        '/knitting/yarn-specs/bulk-rename',
        payload
      );

      setSuccess(res.data.message || `Renamed across ${res.data.data.modifiedCount} transactions.`);
      onSuccess();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to rename specification');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  const catalogOptions = catalogSpecs
    .filter((s) => s.name.toLowerCase() !== sourceSpec.toLowerCase())
    .map((s) => ({ label: `${s.name} (${s.category || 'General'})`, value: s.name }));

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Rename or Merge Yarn Specification"
      className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <div>{success}</div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="text-[11px] text-zinc-400 uppercase font-semibold">Current Specification</div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded">
              {sourceSpec}
            </span>
            <span className="text-xs text-zinc-400">
              ({affectedTxCount} {affectedTxCount === 1 ? 'transaction' : 'transactions'} found)
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Target Specification</span>
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
              <button
                type="button"
                onClick={() => setTargetMode('catalog')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                  targetMode === 'catalog'
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                From Catalog
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('custom')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                  targetMode === 'custom'
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Type New
              </button>
            </div>
          </label>

          {targetMode === 'catalog' ? (
            <Select
              value={selectedCatalogSpec}
              onChange={(e) => setSelectedCatalogSpec(e.target.value)}
              options={catalogOptions}
              className="h-9 text-xs"
            />
          ) : (
            <div className="space-y-2">
              <Input
                value={customSpec}
                onChange={(e) => setCustomSpec(e.target.value)}
                placeholder="e.g. 75/72 Sim or 100/144 Micro"
                required
                className="h-9 text-xs font-medium"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as YarnCategory)}
                  options={CATEGORY_OPTIONS}
                  className="h-8 text-xs"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={addToCatalog}
                    onChange={(e) => setAddToCatalog(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Add to catalog</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            All <strong className="text-white">{affectedTxCount}</strong> past transactions logged under <code className="text-amber-300 font-mono">{sourceSpec}</code> will be safely updated to <strong className="text-emerald-300 font-mono">{targetSpec || '...'}</strong>. Knitter yarn balances will automatically consolidate.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !targetSpec || targetSpec.toLowerCase() === sourceSpec.toLowerCase()}
            className="gap-1.5 min-w-[120px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Renaming...' : 'Confirm Rename'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
