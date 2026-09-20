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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Specification: ${editingSpec?.name}` : 'Add New Yarn Specification'}
      className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Specification Name <span className="text-rose-400">*</span></span>
            <span className="text-[10px] text-zinc-500 font-normal">e.g., 75/72 Sim, 150/48 Rotto, 30/1 Cotton</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 100/144 Micro"
            required
            className="h-9 text-xs font-medium"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Fiber / Category
            </label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as YarnCategory)}
              options={CATEGORY_OPTIONS}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Display Sort Order
            </label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">
            Notes / Description (Optional)
          </label>
          <Input
            value={description}
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
            className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="isActiveSpec" className="text-xs text-zinc-300 cursor-pointer select-none">
            Active in creation dropdowns <span className="text-zinc-500">(uncheck to archive)</span>
          </label>
        </div>

        {nameChanged && txCount > 0 && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Update Historical Transactions?</span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              There are currently <strong className="text-white font-semibold">{txCount}</strong> yarn transactions recorded under the old name <code className="text-amber-300 bg-amber-900/50 px-1 py-0.5 rounded">{editingSpec?.name}</code>.
            </p>
            <label className="flex items-start gap-2 text-xs text-zinc-200 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={propagateToTransactions}
                onChange={(e) => setPropagateToTransactions(e.target.checked)}
                className="rounded border-amber-600 bg-zinc-900 text-amber-500 focus:ring-amber-500 w-4 h-4 mt-0.5 cursor-pointer"
              />
              <span>
                Also automatically update all {txCount} past transactions and knitter balance rows to <strong className="text-emerald-400 font-semibold">{name.trim() || 'the new name'}</strong>.
              </span>
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 min-w-[100px]">
            <Layers className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Saving...' : isEditing ? 'Update Spec' : 'Add Specification'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
