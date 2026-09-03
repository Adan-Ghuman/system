import { useState, FormEvent } from 'react';
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

export interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LOCATIONS: { label: string; value: InventoryLocation }[] = [
  { label: 'ZR Godown (Main Depot)', value: 'ZR_GODOWN' },
  { label: 'Ghumman Dyeing Mill', value: 'GHUMMAN_DYEING' },
  { label: 'Rajput Dyeing Mill', value: 'RAJPUT_DYEING' }
];

const REASONS: { label: string; value: StockAdjustmentReason }[] = [
  { label: 'Physical Audit Discrepancy (Stocktake)', value: 'AUDIT_DISCREPANCY' },
  { label: 'Fabric Damage / Oil Stains / Tears', value: 'DAMAGE' },
  { label: 'Buyer Sample Cutting / Swatches', value: 'SAMPLE_CUTTING' },
  { label: 'Scrap / Unusable End Pieces', value: 'SCRAP' },
  { label: 'Manual Data Correction', value: 'MANUAL_CORRECTION' }
];

export function AdjustStockModal({ isOpen, onClose, onSuccess }: AdjustStockModalProps) {
  const [location, setLocation] = useState<InventoryLocation>('ZR_GODOWN');
  const [state, setState] = useState<FabricState>('FINISHED_DYED');
  const [fabricType, setFabricType] = useState('Fleece 3-Thread');
  const [yarnSpec, setYarnSpec] = useState('75/72 Sim');
  const [color, setColor] = useState('BLACK');
  const [adjustmentRolls, setAdjustmentRolls] = useState('1');
  const [adjustmentWeightKg, setAdjustmentWeightKg] = useState('22.50');
  const [reason, setReason] = useState<StockAdjustmentReason>('AUDIT_DISCREPANCY');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: CreateAdjustmentPayload = {
        location,
        state,
        fabricType: fabricType.trim(),
        yarnSpec: yarnSpec.trim(),
        color: color.trim().toUpperCase(),
        adjustmentRolls: parseInt(adjustmentRolls, 10),
        adjustmentWeightKg: parseFloat(adjustmentWeightKg),
        reason,
        date: new Date(date).toISOString(),
        remarks: remarks.trim()
      };

      await api.post('/inventory/adjustments', payload);

      setSuccess('Physical stock adjustment recorded and balance reconciled');
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
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Inventory Stock Adjustment"
      description="Record stock adjustments, write-offs, or audit reconciliations with full audit logging."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="adjustLocation"
            label="Location to Adjust"
            value={location}
            onChange={(e) => setLocation(e.target.value as InventoryLocation)}
            options={LOCATIONS}
          />

          <Select
            id="adjustState"
            label="Fabric Processing State"
            value={state}
            onChange={(e) => setState(e.target.value as FabricState)}
            options={[
              { label: 'Finished Dyed Fabric', value: 'FINISHED_DYED' },
              { label: 'Raw Ecru Fabric (Grey)', value: 'RAW_ECRU' }
            ]}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="adjustFabricType"
            label="Fabric Variety"
            value={fabricType}
            onChange={(e) => setFabricType(e.target.value)}
            required
          />

          <Input
            id="adjustYarnSpec"
            label="Yarn Specification"
            value={yarnSpec}
            onChange={(e) => setYarnSpec(e.target.value)}
            required
          />

          <Input
            id="adjustColor"
            label="Color / Shade"
            value={color}
            onChange={(e) => setColor(e.target.value.toUpperCase())}
            required
          />
        </div>

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
            <p className="text-[10px] text-zinc-500 mt-0.5">Negative to reduce stock</p>
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
            <p className="text-[10px] text-zinc-500 mt-0.5">e.g. -22.50 or +45.00</p>
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
          placeholder="e.g. Monthly physical inventory variance verified by warehouse supervisor"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            <span>Commit Adjustment</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
