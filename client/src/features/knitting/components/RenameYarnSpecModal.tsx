import { FormSection } from '../../../components/ui/WorkflowForm.js';
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
    <Dialog footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit" form="rename-yarn-spec-modal-form"
            size="sm"
            disabled={isLoading || !targetSpec || targetSpec.toLowerCase() === sourceSpec.toLowerCase()}
            className="gap-1.5 min-w-[120px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Renaming...' : 'Confirm Rename'}</span>
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title="Rename or Merge Yarn Specification"
      className="max-w-md bg-canvas border-line text-strong shadow-2xl"
    >
      <form id="rename-yarn-spec-modal-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div role="alert" className="flex items-start gap-2.5 p-3 rounded-lg bg-danger-soft border border-line text-xs text-danger">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {success && (
          <div role="status" className="flex items-center gap-2 p-3 rounded-lg bg-brand-soft border border-line text-xs text-brand">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand" />
            <div>{success}</div>
          </div>
        )}

        <FormSection step={1} title="Current specification">
<div className="p-3 rounded-lg bg-surface border border-line space-y-2">
          <div className="text-xs text-soft normal-case font-semibold">Current Specification</div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-warning bg-warning-soft border border-line px-2.5 py-1 rounded">
              {sourceSpec}
            </span>
            <span className="text-xs text-soft">
              ({affectedTxCount} {affectedTxCount === 1 ? 'transaction' : 'transactions'} found)
            </span>
          </div>
        </div>
</FormSection>

        <FormSection step={2} title="New specification">
<div className="space-y-2">
          <label className="text-xs font-semibold text-ink flex items-center justify-between">
            <span>Target Specification</span>
            <div className="flex items-center gap-1 bg-surface p-0.5 rounded border border-line">
              <button
                type="button"
                onClick={() => setTargetMode('catalog')}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  targetMode === 'catalog'
                    ? 'bg-primary text-white font-medium'
                    : 'text-soft hover:text-strong'
                }`}
              >
                From Catalog
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('custom')}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  targetMode === 'custom'
                    ? 'bg-primary text-white font-medium'
                    : 'text-soft hover:text-strong'
                }`}
              >
                Type New
              </button>
            </div>
          </label>

          {targetMode === 'catalog' ? (
            <Select
              aria-label="New yarn specification" value={selectedCatalogSpec}
              onChange={(e) => setSelectedCatalogSpec(e.target.value)}
              options={catalogOptions}
              className="h-9 text-xs"
            />
          ) : (
            <div className="space-y-2">
              <Input
                aria-label="New yarn specification" value={customSpec}
                onChange={(e) => setCustomSpec(e.target.value)}
                placeholder="e.g. 75/72 Sim or 100/144 Micro"
                required
                className="h-9 text-xs font-medium"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  aria-label="Fiber / Category" value={category}
                  onChange={(e) => setCategory(e.target.value as YarnCategory)}
                  options={CATEGORY_OPTIONS}
                  className="h-8 text-xs"
                />
                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={addToCatalog}
                    onChange={(e) => setAddToCatalog(e.target.checked)}
                    className="rounded border-control bg-surface text-brand focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Add to catalog</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-warning-soft border border-line flex items-start gap-2.5 text-xs text-warning leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div>
            All <strong className="text-strong">{affectedTxCount}</strong> past transactions logged under <code className="text-warning font-mono">{sourceSpec}</code> will be safely updated to <strong className="text-brand font-mono">{targetSpec || '...'}</strong>. Knitter yarn balances will automatically consolidate.
          </div>
        </div>
</FormSection>


      </form>
    </Dialog>
  );
}
