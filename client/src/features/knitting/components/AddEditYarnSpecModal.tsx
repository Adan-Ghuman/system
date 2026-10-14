import { FormSection } from '../../../components/ui/WorkflowForm.js';
import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, Layers, AlertTriangle } from 'lucide-react';
import {
  YarnSpecificationItem,
  YarnCategory,
  CreateYarnSpecPayload,
  UpdateYarnSpecPayload
} from '../types/knitting.types.js';

export interface AddEditYarnSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSpec?: YarnSpecificationItem | null;
}

const CATEGORY_OPTIONS: { label: string; value: YarnCategory }[] = [
  { label: 'Polyester', value: 'Polyester' },
  { label: 'Cotton', value: 'Cotton' },
  { label: 'Spandex', value: 'Spandex' },
  { label: 'Blended', value: 'Blended' },
  { label: 'Viscose', value: 'Viscose' },
  { label: 'Other', value: 'Other' }
];

export function AddEditYarnSpecModal({
  isOpen,
  onClose,
  onSuccess,
  editingSpec
}: AddEditYarnSpecModalProps) {
  const isEditing = Boolean(editingSpec);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<YarnCategory>('Polyester');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [propagateToTransactions, setPropagateToTransactions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (editingSpec) {
      setName(editingSpec.name);
      setCategory(editingSpec.category || 'Polyester');
      setDescription(editingSpec.description || '');
      setIsActive(editingSpec.isActive);
      setSortOrder(String(editingSpec.sortOrder || 0));
      setPropagateToTransactions(false);
    } else {
      setName('');
      setCategory('Polyester');
      setDescription('');
      setIsActive(true);
      setSortOrder('0');
      setPropagateToTransactions(false);
    }
    setError(null);
    setSuccess(null);
  }, [editingSpec, isOpen]);

  const nameChanged = isEditing && editingSpec && name.trim().toLowerCase() !== editingSpec.name.toLowerCase();
  const txCount = editingSpec?.transactionCount || 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!name.trim()) {
      setError('Specification name is required.');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (isEditing && editingSpec) {
        const payload: UpdateYarnSpecPayload = {
          name: name.trim(),
          category,
          description: description.trim(),
          isActive,
          sortOrder: parseInt(sortOrder, 10) || 0,
          propagateToTransactions: nameChanged ? propagateToTransactions : false
        };

        const res = await api.put<{ success: boolean; message: string }>(
          `/knitting/yarn-specs/${editingSpec._id}`,
          payload
        );
        setSuccess(res.data.message || 'Yarn specification updated successfully.');
      } else {
        const payload: CreateYarnSpecPayload = {
          name: name.trim(),
          category,
          description: description.trim(),
          isActive,
          sortOrder: parseInt(sortOrder, 10) || 0
        };

        await api.post('/knitting/yarn-specs', payload);
        setSuccess(`Specification '${name.trim()}' added to catalog.`);
      }

      onSuccess();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 750);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to save yarn specification');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-edit-yarn-spec-modal-form" size="sm" disabled={isLoading} className="gap-1.5 min-w-[100px]">
            <Layers className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Saving...' : isEditing ? 'Update Spec' : 'Add Specification'}</span>
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Specification: ${editingSpec?.name}` : 'Add New Yarn Specification'}
      className="max-w-md bg-canvas border-line text-strong shadow-2xl"
    >
      <form id="add-edit-yarn-spec-modal-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
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

        <FormSection step={1} title="Specification">
<div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink flex items-center justify-between">
            <span>Specification Name <span className="text-danger">*</span></span>
            <span className="text-xs text-soft font-normal">e.g., 75/72 Sim, 150/48 Rotto, 30/1 Cotton</span>
          </label>
          <Input
            aria-label="Specification Name" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 100/144 Micro"
            required
            className="h-9 text-xs font-medium"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">
              Fiber / Category
            </label>
            <Select
              aria-label="Fiber / Category" value={category}
              onChange={(e) => setCategory(e.target.value as YarnCategory)}
              options={CATEGORY_OPTIONS}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">
              Display Sort Order
            </label>
            <Input
              aria-label="Display Sort Order" type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>
</FormSection>

        <FormSection step={2} title="Notes and status">
<div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink">
            Notes / Description (Optional)
          </label>
          <Input
            aria-label="Notes / Description (Optional)" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Microfilament Terry, Dull, Spun"
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isActiveSpec"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-control bg-surface text-brand focus:ring-emerald-500 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="isActiveSpec" className="text-xs text-ink cursor-pointer select-none">
            Active in creation dropdowns <span className="text-soft">(uncheck to archive)</span>
          </label>
        </div>

        {nameChanged && txCount > 0 && (
          <div className="p-3 rounded-lg bg-warning-soft border border-line space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-warning">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <span>Update Historical Transactions?</span>
            </div>
            <p className="text-xs text-warning leading-relaxed">
              There are currently <strong className="text-strong font-semibold">{txCount}</strong> yarn transactions recorded under the old name <code className="text-warning bg-warning-soft px-1 py-0.5 rounded">{editingSpec?.name}</code>.
            </p>
            <label className="flex items-start gap-2 text-xs text-strong cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={propagateToTransactions}
                onChange={(e) => setPropagateToTransactions(e.target.checked)}
                className="rounded border-amber-600 bg-surface text-warning focus:ring-amber-500 w-4 h-4 mt-0.5 cursor-pointer"
              />
              <span>
                Also automatically update all {txCount} past transactions and knitter balance rows to <strong className="text-brand font-semibold">{name.trim() || 'the new name'}</strong>.
              </span>
            </label>
          </div>
        )}
</FormSection>


      </form>
    </Dialog>
  );
}
