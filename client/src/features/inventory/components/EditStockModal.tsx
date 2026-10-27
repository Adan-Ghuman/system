import { useLocations } from '../../../business/useLocations.js';
import { FormSection } from '../../../components/ui/WorkflowForm.js';
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
  initialCorrection?: boolean;
}



export function EditStockModal({ isOpen, onClose, onSuccess, item, initialCorrection = false }: EditStockModalProps) {
  const locations = useLocations();
  const [location, setLocation] = useState<InventoryLocation>('ZR_GODOWN');
  const [state, setState] = useState<FabricState>('FINISHED_DYED');
  const [fabricType, setFabricType] = useState('');
  const [yarnSpec, setYarnSpec] = useState('');
  const [color, setColor] = useState(COMMON_COLORS[0]);
  const [customColor, setCustomColor] = useState('');
  const [totalRolls, setTotalRolls] = useState('0');
  const [totalWeightKg, setTotalWeightKg] = useState('0');
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

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
      const correctShade = initialCorrection && item.state === 'RAW_ECRU' && item.color !== 'ECRU';
      setCorrectionMode(correctShade);if (correctShade) { setColor('ECRU');setCustomColor(''); }setCorrectionReason('');setRequestId(crypto.randomUUID());
    }
  }, [item, isOpen, initialCorrection]);

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
        requestId,
        correctionReason: correctionMode ? correctionReason.trim() : undefined,
        location,
        state,
        fabricType: fabricType.trim(),
        yarnSpec: yarnSpec.trim(),
        color: activeColor,
        totalRolls: rollsNum,
        totalWeightKg: weightNum
      };

      await api.put(`/inventory/items/${item._id}`, payload);

      setSuccess(correctionMode ? 'Raw shade corrected to ECRU. Stock quantities are unchanged.' : 'Fabric stock updated successfully');
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
  const needsRawShadeCorrection = item.state === 'RAW_ECRU' && item.color !== 'ECRU';

  return (
    <Dialog footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-stock-modal-form" isLoading={isLoading} className="gap-1.5">
            <Save className="w-4 h-4" />
            <span>{correctionMode ? 'Save shade correction' : 'Save Stock Changes'}</span>
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Fabric Stock Details"
      description={`Correct the counted rolls or weight for ${item.fabricType}.`}
      className="max-w-xl"
    >
      <form id="edit-stock-modal-form" onSubmit={handleSubmit} className="space-y-4">
        {needsRawShadeCorrection && <div className="space-y-3 rounded-lg border border-line bg-warning-soft p-3 text-xs text-ink"><p>This raw stock has current shade {item.color}. If it is physically undyed grey, correct it to ECRU. Enter {item.color} as the target shade when sending it for dyeing.</p>{!correctionMode && <Button variant="outline" size="sm" type="button" onClick={() => { setCorrectionMode(true);setColor('ECRU');setCustomColor('');setState(item.state);setLocation(item.location);setTotalRolls(String(item.totalRolls));setTotalWeightKg(String(item.totalWeightKg)); }}>Correct raw shade to ECRU</Button>}{correctionMode && <Input label="Reason for shade correction" value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} required minLength={3} placeholder="e.g. Navy blue is the target shade; the fabric is undyed grey" />}</div>}
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
            id="editLocation"
            label="Storage Location"
            disabled={correctionMode}
            value={location}
            onChange={(e) => setLocation(e.target.value as InventoryLocation)}
            options={locations}
          />

          <Select
            id="editState"
            label="Fabric Processing State"
            disabled={correctionMode}
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
            id="editFabricType" readOnly
            label="Fabric Variety / Construction"
            value={fabricType}
            onChange={(e) => setFabricType(e.target.value)}
            required
            placeholder="e.g. Fleece 3-Thread, Interlock"
          />

          <Input
            id="editYarnSpec" readOnly
            label="Yarn Specification"
            value={yarnSpec}
            onChange={(e) => setYarnSpec(e.target.value)}
            required
            placeholder="e.g. 75/72 Sim, 100/144 Micro"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {state === 'RAW_ECRU' ? <Input label="Color / Shade" value={correctionMode ? 'ECRU' : item.color} readOnly /> : <Select
            id="editColor"
            label="Color / Shade"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            options={[
              ...COMMON_COLORS.filter(c => c !== 'OTHER').map((c) => ({ label: c, value: c })),
              { label: 'Other Custom Shade...', value: 'OTHER' }
            ]}
          />}

          {state !== 'RAW_ECRU' && (color === 'OTHER' ? (
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
              <span className="text-xs text-soft">Selected Shade</span>
              <span className="text-xs font-semibold text-ink font-mono mt-1">{color}</span>
            </div>
          ))}
        </div>
</FormSection>

        <FormSection step={2} title="Stock quantities">
<div className="grid grid-cols-2 gap-3">
          <Input
            id="editRolls"
            type="number"
            min="0"
            label="Total Rolls In Stock"
            readOnly={correctionMode}
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
            readOnly={correctionMode}
            value={totalWeightKg}
            onChange={(e) => setTotalWeightKg(e.target.value)}
            required
          />
        </div>

        <div className="p-3 rounded-lg bg-canvas border border-line flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-soft">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>Calculated Roll Average:</span>
          </div>
          <div className="font-mono text-strong">
            <strong className="text-brand font-bold">{avgWeight}</strong> Kg / Roll ({formatWeight(weightNum)} across {rollsNum} rolls)
          </div>
        </div>
</FormSection>


      </form>
    </Dialog>
  );
}
