import { ownerOptions, canonicalOwnerKey } from '../../../business/ownership.js';
import { CatalogField } from '../../../components/ui/CatalogField.js';
import { useQuery } from '@tanstack/react-query';
import { loadAllRecords } from '../../../lib/pagedResources.js';
import { DocumentReferences, useDocumentReferences } from '../../../components/ui/DocumentReferences.js';
import { getLocalDateInput } from '../../../lib/formatters.js';
import { useLocations } from '../../../business/useLocations.js';
import { FormSection } from '../../../components/ui/WorkflowForm.js';
import { useState, useRef, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, Wrench } from 'lucide-react';
import {
  InventoryLocation,
  FabricState,
  StockAdjustmentReason,
  CreateAdjustmentPayload
} from '../types/inventory.types.js';
import { COMMON_COLORS } from '../../common/constants/colors.js';

export interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}



const REASONS: { label: string; value: StockAdjustmentReason }[] = [
  { label: 'Physical Stocktake / Warehouse Count', value: 'AUDIT_DISCREPANCY' },
  { label: 'Fabric Damage / Oil Stains / Tears', value: 'DAMAGE' },
  { label: 'Buyer Sample Cutting / Swatches', value: 'SAMPLE_CUTTING' },
  { label: 'Scrap / Unusable End Pieces', value: 'SCRAP' },
  { label: 'New Stock Entry / Data Correction', value: 'MANUAL_CORRECTION' }
];

export function AdjustStockModal({ isOpen, onClose, onSuccess }: AdjustStockModalProps) {
  const [ownerKey, setOwnerKey] = useState('OWN');
  const owners = useQuery({ queryKey: ['party-options', 'all'], queryFn: () => loadAllRecords<{ _id: string; name: string }>('/parties') });
  const [references, setReferences] = useDocumentReferences();
  const locations = useLocations();
  const [location, setLocation] = useState<InventoryLocation>('ZR_GODOWN');
  const [state, setState] = useState<FabricState>('FINISHED_DYED');
  const [fabricType, setFabricType] = useState('');
  const [yarnSpec, setYarnSpec] = useState('');
  const [color, setColor] = useState(COMMON_COLORS[0]);
  const [customColor, setCustomColor] = useState('');
  const [adjustmentRolls, setAdjustmentRolls] = useState('');
  const [adjustmentWeightKg, setAdjustmentWeightKg] = useState('');
  const [reason, setReason] = useState<StockAdjustmentReason>('AUDIT_DISCREPANCY');
  const [date, setDate] = useState(getLocalDateInput());
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const activeColor = state === 'RAW_ECRU' ? 'ECRU' : color === 'OTHER' ? customColor.trim().toUpperCase() : color;
      if (!activeColor) {
        throw new Error('Please specify a color');
      }

      const payload: CreateAdjustmentPayload = { ...references, ownerKey,
        location,
        state,
        fabricType: fabricType.trim(),
        yarnSpec: yarnSpec.trim(),
        color: activeColor,
        adjustmentRolls: parseInt(adjustmentRolls, 10),
        adjustmentWeightKg: parseFloat(adjustmentWeightKg),
        reason,
        date: new Date(date).toISOString(),
        remarks: remarks.trim()
      };

      await api.post('/inventory/adjustments', payload);

      setSuccess('Stock changes recorded and live balance updated');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to record adjustment');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-stock-modal-form" isLoading={isLoading} className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            <span>Save Stock Changes</span>
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Stock or Correct Inventory"
      description="Enter brand new fabric received into warehouse, or adjust roll and weight counts."
      className="max-w-xl"
    >
      <form id="adjust-stock-modal-form" onSubmit={handleSubmit} className="space-y-4"><Select label="Fabric owner" value={canonicalOwnerKey(ownerKey, owners.data?.items || [])} onChange={event => setOwnerKey(event.target.value)} options={ownerOptions(owners.data?.items || [])} /><DocumentReferences value={references} onChange={setReferences} />
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div role="status" className="flex items-center gap-2 p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-brand">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <FormSection step={1} title="Fabric details">
<div className="grid grid-cols-2 gap-3">
          <Select
            id="adjustLocation"
            label="Location to Adjust"
            value={location}
            onChange={(e) => setLocation(e.target.value as InventoryLocation)}
            options={locations}
          />

          <Select
            id="adjustState"
            label="Fabric Processing State"
            value={state}
            onChange={(e) => { setState(e.target.value as FabricState);setColor(e.target.value === 'RAW_ECRU' ? 'ECRU' : COMMON_COLORS[0]);setCustomColor(''); }}
            options={[
              { label: 'Finished Dyed Fabric', value: 'FINISHED_DYED' },
              { label: 'Raw Ecru Fabric (Grey)', value: 'RAW_ECRU' }
            ]}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <CatalogField kind="FABRIC"
            id="adjustFabricType"
            label="Fabric Variety"
            value={fabricType}
            onChange={setFabricType}
            required
          />

          <CatalogField kind="YARN"
            id="adjustYarnSpec"
            label="Yarn Specification"
            value={yarnSpec}
            onChange={setYarnSpec}
            required
          />

          {state === 'RAW_ECRU' ? <Input label="Color / Shade" value="ECRU" readOnly /> : <Select
            id="adjustColor"
            label="Color / Shade"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            options={COMMON_COLORS.map((c) => ({ label: c, value: c }))}
          />}
        </div>

        {state === 'RAW_ECRU' && <p className="text-xs text-soft">Undyed grey stock uses ECRU. Choose its target shade when sending it for dyeing.</p>}
        {state !== 'RAW_ECRU' && color === 'OTHER' && (
          <Input
            id="adjustCustomColor"
            label="Custom Color / Shade"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value.toUpperCase())}
            required
            autoFocus
            placeholder="e.g. SKY BLUE / PALE KHAKI"
          />
        )}
</FormSection>

        <FormSection step={2} title="Adjustment">
<div className="grid grid-cols-3 gap-3">
          <div>
            <Input
              id="adjustmentRolls"
              type="number"
              label="Rolls (+/-)"
              value={adjustmentRolls}
              onChange={(e) => setAdjustmentRolls(e.target.value)}
              required
            />
            <p className="text-xs text-soft mt-0.5">Negative to reduce stock</p>
          </div>

          <div>
            <Input
              id="adjustmentWeightKg"
              type="number"
              step="0.01"
              label="Weight Kg (+/-)"
              value={adjustmentWeightKg}
              onChange={(e) => setAdjustmentWeightKg(e.target.value)}
              required
            />
            <p className="text-xs text-soft mt-0.5">e.g. -22.50 or +45.00</p>
          </div>

          <Input
            id="adjustDate"
            type="date"
            label="Adjustment Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <Select
          id="adjustReason"
          label="Audit / Adjustment Reason Code"
          value={reason}
          onChange={(e) => setReason(e.target.value as StockAdjustmentReason)}
          options={REASONS}
        />

        <Input
          id="adjustRemarks"
          label="Remarks / Audit Explanation"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Initial stock intake from factory or monthly physical count"
        />
</FormSection>


      </form>
    </Dialog>
  );
}
