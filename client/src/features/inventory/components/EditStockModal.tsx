import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { formatWeight } from '../../../lib/formatters.js';
import { AlertCircle, CheckCircle2, Save, Sparkles } from 'lucide-react';
import {
  FabricInventoryItem,
  InventoryLocation,
  FabricState,
  UpdateFabricInventoryPayload
} from '../types/inventory.types.js';
import { COMMON_COLORS } from '../../common/constants/colors.js';

export interface EditStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: FabricInventoryItem | null;
}

const LOCATIONS: { label: string; value: InventoryLocation }[] = [
  { label: 'ZR Godown (Central Warehouse)', value: 'ZR_GODOWN' },
  { label: 'Ghuman Dyeing Unit', value: 'GHUMMAN_DYEING' },
  { label: 'Rajput Dyeing Unit', value: 'RAJPUT_DYEING' },
  { label: 'Hafiz Saad Dyeing Unit', value: 'HAFIZ_SAAD_DYEING' },
  { label: 'HB Dyeing Unit', value: 'HB_DYEING' }
];

export function EditStockModal({ isOpen, onClose, onSuccess, item }: EditStockModalProps) {
  const [location, setLocation] = useState<InventoryLocation>('ZR_GODOWN');
  const [state, setState] = useState<FabricState>('FINISHED_DYED');
  const [fabricType, setFabricType] = useState('');
  const [yarnSpec, setYarnSpec] = useState('');
  const [color, setColor] = useState(COMMON_COLORS[0]);
  const [customColor, setCustomColor] = useState('');
  const [totalRolls, setTotalRolls] = useState('0');
  const [totalWeightKg, setTotalWeightKg] = useState('0');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setLocation(item.location);
      setState(item.state);
      setFabricType(item.fabricType);
      setYarnSpec(item.yarnSpec);

      const upperColor = item.color.toUpperCase();
      if (COMMON_COLORS.includes(upperColor)) {
        setColor(upperColor);
        setCustomColor('');
      } else {
        setColor('OTHER');
        setCustomColor(item.color);
      }

      setTotalRolls(String(item.totalRolls || 0));
      setTotalWeightKg(String(item.totalWeightKg || 0));
      setError(null);
      setSuccess(null);
    }
  }, [item, isOpen]);

  const rollsNum = parseInt(totalRolls, 10) || 0;
  const weightNum = parseFloat(totalWeightKg) || 0;
  const avgWeight = rollsNum > 0 ? (weightNum / rollsNum).toFixed(2) : '0.00';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item || isSubmittingRef.current || isLoading) return;

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const activeColor = color === 'OTHER' ? customColor.trim().toUpperCase() : color;
      if (!activeColor) {
        throw new Error('Please specify a valid color');
      }

      if (!fabricType.trim()) {
        throw new Error('Please specify a fabric variety');
      }

      if (!yarnSpec.trim()) {
        throw new Error('Please specify a yarn specification');
      }

      const payload: UpdateFabricInventoryPayload = {
        location,
        state,
        fabricType: fabricType.trim(),
        yarnSpec: yarnSpec.trim(),
        color: activeColor,
        totalRolls: rollsNum,
        totalWeightKg: weightNum
      };

      await api.put(`/inventory/items/${item._id}`, payload);

      setSuccess('Fabric stock updated successfully');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to update fabric inventory');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  if (!item) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Fabric Stock Details"
      description={`Update fabric variety, yarn spec, color, rolls, or weight for ${item.fabricType}.`}
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
            id="editLocation"
            label="Storage Location"
            value={location}
            onChange={(e) => setLocation(e.target.value as InventoryLocation)}
            options={LOCATIONS}
          />

          <Select
            id="editState"
            label="Fabric Processing State"
            value={state}
            onChange={(e) => setState(e.target.value as FabricState)}
            options={[
              { label: 'Finished Dyed Fabric', value: 'FINISHED_DYED' },
              { label: 'Raw Ecru Fabric (Grey)', value: 'RAW_ECRU' }
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="editFabricType"
            label="Fabric Variety / Construction"
            value={fabricType}
            onChange={(e) => setFabricType(e.target.value)}
            required
            placeholder="e.g. Fleece 3-Thread, Interlock"
          />

          <Input
            id="editYarnSpec"
            label="Yarn Specification"
            value={yarnSpec}
            onChange={(e) => setYarnSpec(e.target.value)}
            required
            placeholder="e.g. 75/72 Sim, 100/144 Micro"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="editColor"
            label="Color / Shade"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            options={[
              ...COMMON_COLORS.map((c) => ({ label: c, value: c })),
              { label: 'Other Custom Shade...', value: 'OTHER' }
            ]}
          />

          {color === 'OTHER' ? (
            <Input
              id="editCustomColor"
              label="Custom Shade Name"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              required
              placeholder="e.g. OLIVE GREEN, MAROON"
            />
          ) : (
            <div className="flex flex-col justify-center">
              <span className="text-[11px] text-zinc-500">Selected Shade</span>
              <span className="text-xs font-semibold text-zinc-300 font-mono mt-1">{color}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="editRolls"
            type="number"
            min="0"
            label="Total Rolls In Stock"
            value={totalRolls}
            onChange={(e) => setTotalRolls(e.target.value)}
            required
          />

          <Input
            id="editWeightKg"
            type="number"
            step="0.01"
            min="0"
            label="Total Weight (Kg)"
            value={totalWeightKg}
            onChange={(e) => setTotalWeightKg(e.target.value)}
            required
          />
        </div>

        <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Calculated Roll Average:</span>
          </div>
          <div className="font-mono text-zinc-200">
            <strong className="text-emerald-400 font-bold">{avgWeight}</strong> Kg / Roll ({formatWeight(weightNum)} across {rollsNum} rolls)
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5">
            <Save className="w-4 h-4" />
            <span>Save Stock Changes</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
