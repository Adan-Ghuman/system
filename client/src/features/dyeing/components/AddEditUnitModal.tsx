import { FormSection } from '../../../components/ui/WorkflowForm.js';
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
    <Dialog footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-edit-unit-modal-form" size="sm" disabled={isLoading} className="gap-1.5 min-w-[110px]">
            <Factory className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Saving...' : isEditing ? 'Update Unit' : 'Add Unit'}</span>
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Unit: ${editingUnit?.name}` : 'Add New Dyeing Unit / Godown'}
      className="max-w-md bg-canvas border-line text-strong shadow-2xl"
    >
      <form id="add-edit-unit-modal-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
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

        <FormSection step={1} title="Unit details">
{!isEditing && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink flex items-center justify-between">
              <span>Unit Identifier Code <span className="text-danger">*</span></span>
              <span className="text-xs text-soft font-normal">e.g., SITARA_DYEING</span>
            </label>
            <Input
              aria-label="Unit Identifier Code" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="e.g. NEW_DYEING_MILL"
              required
              className="h-9 text-xs font-mono"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink flex items-center justify-between">
            <span>Full Unit / Location Name <span className="text-danger">*</span></span>
            <span className="text-xs text-soft font-normal">e.g., Ghumman Dyeing Unit</span>
          </label>
          <Input
            aria-label="Full Unit / Location Name" value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!isEditing && !shortName) {
                setShortName(e.target.value);
              }
            }}
            placeholder="e.g. Example Dyeing Mill"
            required
            className="h-9 text-xs font-medium"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">
              Short Display Label <span className="text-danger">*</span>
            </label>
            <Input
              aria-label="Short Display Label" value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="e.g. Example Mill"
              required
              className="h-9 text-xs font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">
              Location Type
            </label>
            <Select
              aria-label="Location Type" value={type}
              onChange={(e) => setType(e.target.value as DyeingUnitType)}
              options={TYPE_OPTIONS}
              className="h-9 text-xs"
            />
          </div>
        </div>
</FormSection>

        <FormSection step={2} title="Contact and status">
<div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">
              Contact Phone (Optional)
            </label>
            <Input
              aria-label="Contact Phone (Optional)" value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
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

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink">
            Address / Location Description
          </label>
          <Input
            aria-label="Address / Location Description" value={address}
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
            className="rounded border-control bg-surface text-brand focus:ring-emerald-500 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="isActiveUnit" className="text-xs text-ink cursor-pointer select-none">
            Active in production selectors &amp; filters
          </label>
        </div>
</FormSection>


      </form>
    </Dialog>
  );
}
