import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, Factory } from 'lucide-react';
import {
  DyeingUnitItem,
  DyeingUnitType,
  CreateDyeingUnitPayload,
  UpdateDyeingUnitPayload
} from '../types/dyeing.types.js';

export interface AddEditUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingUnit?: DyeingUnitItem | null;
}

const TYPE_OPTIONS: { label: string; value: DyeingUnitType }[] = [
  { label: 'Dyeing Mill / Contract Unit', value: 'DYEING_MILL' },
  { label: 'Warehouse / Central Godown', value: 'GODOWN' },
  { label: 'Other External Unit', value: 'OTHER' }
];

export function AddEditUnitModal({
  isOpen,
  onClose,
  onSuccess,
  editingUnit
}: AddEditUnitModalProps) {
  const isEditing = Boolean(editingUnit);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [type, setType] = useState<DyeingUnitType>('DYEING_MILL');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (editingUnit) {
      setCode(editingUnit.code);
      setName(editingUnit.name);
      setShortName(editingUnit.shortName);
      setType(editingUnit.type || 'DYEING_MILL');
      setContactPhone(editingUnit.contactPhone || '');
      setAddress(editingUnit.address || '');
      setSortOrder(String(editingUnit.sortOrder || 0));
      setIsActive(editingUnit.isActive);
    } else {
      setCode('');
      setName('');
      setShortName('');
      setType('DYEING_MILL');
      setContactPhone('');
      setAddress('');
      setSortOrder('0');
      setIsActive(true);
    }
    setError(null);
    setSuccess(null);
  }, [editingUnit, isOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!name.trim()) {
      setError('Unit name is required.');
      return;
    }
    if (!shortName.trim()) {
      setError('Short display label is required.');
      return;
    }
    if (!isEditing && !code.trim()) {
      setError('Unit code identifier is required.');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (isEditing && editingUnit) {
        const payload: UpdateDyeingUnitPayload = {
          name: name.trim(),
          shortName: shortName.trim(),
          type,
          contactPhone: contactPhone.trim(),
          address: address.trim(),
          sortOrder: parseInt(sortOrder, 10) || 0,
          isActive
        };

        const res = await api.put<{ success: boolean; message?: string }>(
          `/dyeing/units/${editingUnit._id}`,
          payload
        );
        setSuccess(res.data.message || `Unit '${shortName.trim()}' updated successfully.`);
      } else {
        const payload: CreateDyeingUnitPayload = {
          code: code.trim().toUpperCase().replace(/\s+/g, '_'),
          name: name.trim(),
          shortName: shortName.trim(),
          type,
          contactPhone: contactPhone.trim(),
          address: address.trim(),
          sortOrder: parseInt(sortOrder, 10) || 0,
          isActive
        };

        await api.post('/dyeing/units', payload);
        setSuccess(`Dyeing unit '${name.trim()}' created successfully.`);
      }

      onSuccess();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 750);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to save unit');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Unit: ${editingUnit?.name}` : 'Add New Dyeing Unit / Godown'}
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

        {!isEditing && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Unit Identifier Code <span className="text-rose-400">*</span></span>
              <span className="text-[10px] text-zinc-500 font-normal">e.g., SITARA_DYEING</span>
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="e.g. NEW_DYEING_MILL"
              required
              className="h-9 text-xs font-mono"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Full Unit / Location Name <span className="text-rose-400">*</span></span>
            <span className="text-[10px] text-zinc-500 font-normal">e.g., Ghumman Dyeing Unit</span>
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!isEditing && !shortName) {
                setShortName(e.target.value);
              }
            }}
            placeholder="e.g. Ghumman Dyeing Unit"
            required
            className="h-9 text-xs font-medium"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Short Display Label <span className="text-rose-400">*</span>
            </label>
            <Input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="e.g. Ghumman Unit"
              required
              className="h-9 text-xs font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Location Type
            </label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as DyeingUnitType)}
              options={TYPE_OPTIONS}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Contact Phone (Optional)
            </label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
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
            Address / Location Description
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Small Industrial Estate, Faisalabad"
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isActiveUnit"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="isActiveUnit" className="text-xs text-zinc-300 cursor-pointer select-none">
            Active in production selectors &amp; filters
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 min-w-[110px]">
            <Factory className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Saving...' : isEditing ? 'Update Unit' : 'Add Unit'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
