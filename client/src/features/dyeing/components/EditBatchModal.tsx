import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, Factory, Trash2, Calculator, Building2 } from 'lucide-react';
import { DyeingMillType, DyeingBatchItem, UpdateBatchPayload, DyeingUnitItem } from '../types/dyeing.types.js';
import { PartyItem } from '../../parties/types/party.types.js';
import { COMMON_COLORS } from '../../common/constants/colors.js';
import { formatWeight } from '../../../lib/formatters.js';
import { YarnSpecMultiSelect, STANDARD_YARN_SPECS } from './YarnSpecMultiSelect.js';

export interface EditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  batch: DyeingBatchItem | null;
}

const COMMON_FABRIC_TYPES = [
  'Fleece 3-Thread',
  'Interlock Heavy',
  'Interlock Light',
  '1 Tak Mesh',
  'Rib 1x1',
  'Rib 2x2',
  'Single Jersey',
  'Popcorn Pique',
  'Parda Drop Needle',
  'Terry Fleece'
];

export function EditBatchModal({ isOpen, onClose, onSuccess, batch }: EditBatchModalProps) {
  const [millName, setMillName] = useState<DyeingMillType>('GHUMMAN_DYEING');
  const [customMillName, setCustomMillName] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [fabricType, setFabricType] = useState(COMMON_FABRIC_TYPES[0]);
  const [customFabricType, setCustomFabricType] = useState('');
  const [selectedYarnSpecs, setSelectedYarnSpecs] = useState<string[]>([STANDARD_YARN_SPECS[0]]);
  const [customYarnSpec, setCustomYarnSpec] = useState('');
  const [isOtherYarnActive, setIsOtherYarnActive] = useState(false);
  const [color, setColor] = useState(COMMON_COLORS[0]);
  const [customColor, setCustomColor] = useState('');
  const [ogpNo, setOgpNo] = useState('');
  const [igpNo, setIgpNo] = useState('');
  const [dateIssued, setDateIssued] = useState('');
  const [ecruRollsCount, setEcruRollsCount] = useState('');
  const [ecruWeightKg, setEcruWeightKg] = useState('');
  const [finishRollsCount, setFinishRollsCount] = useState('');
  const [finishWeightKg, setFinishWeightKg] = useState('');
  const [allocatedCustomerId, setAllocatedCustomerId] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (batch) {
      setMillName(batch.millName);
      setCustomMillName(batch.customMillName || '');
      setBatchNo(batch.batchNo);

      if (COMMON_FABRIC_TYPES.includes(batch.fabricType)) {
        setFabricType(batch.fabricType);
        setCustomFabricType('');
      } else {
        setFabricType('OTHER');
        setCustomFabricType(batch.fabricType);
      }

      const rawSpecs = batch.yarnSpecs && batch.yarnSpecs.length > 0
        ? batch.yarnSpecs
        : (batch.yarnSpec ? batch.yarnSpec.split(/\s*\+\s*/) : []);

      const std = rawSpecs.filter((s) => STANDARD_YARN_SPECS.includes(s));
      const cust = rawSpecs.filter((s) => !STANDARD_YARN_SPECS.includes(s));
      setSelectedYarnSpecs(std.length > 0 ? std : (cust.length > 0 ? [] : [STANDARD_YARN_SPECS[0]]));
      if (cust.length > 0) {
        setIsOtherYarnActive(true);
        setCustomYarnSpec(cust.join(' + '));
      } else {
        setIsOtherYarnActive(false);
        setCustomYarnSpec('');
      }

      if (COMMON_COLORS.includes(batch.targetColor)) {
        setColor(batch.targetColor);
        setCustomColor('');
      } else {
        setColor('OTHER');
        setCustomColor(batch.targetColor);
      }

      setOgpNo(batch.ogpNo || '');
      setIgpNo(batch.igpNo || '');
      setDateIssued(batch.dateIssued ? new Date(batch.dateIssued).toISOString().split('T')[0] : '');
      setEcruRollsCount(String(batch.ecruRollsCount || 0));
      setEcruWeightKg(String(batch.ecruWeightKg || 0));
      setFinishRollsCount(batch.finishRollsCount !== undefined ? String(batch.finishRollsCount) : '');
      setFinishWeightKg(batch.finishWeightKg !== undefined ? String(batch.finishWeightKg) : '');
      setAllocatedCustomerId(batch.allocatedCustomerId?._id || '');
      setRemarks(batch.remarks || '');
      setConfirmDelete(false);
      setError(null);
      setSuccess(null);
    }
  }, [batch]);

  const { data: buyersData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', 'isFabricBuyer'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: 'isFabricBuyer', limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen && !!batch
  });

  const buyers = buyersData?.items || [];

  const { data: unitsData = [] } = useQuery<DyeingUnitItem[]>({
    queryKey: ['dyeing-units'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DyeingUnitItem[] }>('/dyeing/units');
      return res.data.data;
    },
    enabled: isOpen
  });

  const activeMills = useMemo(() => {
    const list = unitsData.filter((u) => u.isActive && u.type === 'DYEING_MILL');
    if (list.length > 0) return list;
    return [
      { code: 'GHUMMAN_DYEING', shortName: 'Ghumman Dyeing' },
      { code: 'RAJPUT_DYEING', shortName: 'Rajput Dyeing' },
      { code: 'HAFIZ_SAAD_DYEING', shortName: 'Hafiz Saad Dyeing' },
      { code: 'HB_DYEING', shortName: 'HB Dyeing' }
    ] as DyeingUnitItem[];
  }, [unitsData]);

  const settlementMetrics = useMemo(() => {
    const ecru = parseFloat(ecruWeightKg) || 0;
    const finish = parseFloat(finishWeightKg) || 0;
    if (finish <= 0 || ecru <= 0) return null;

    const shortageKg = Math.round((ecru - finish) * 100) / 100;
    const shortagePct = Math.round(((shortageKg / ecru) * 100) * 100) / 100;
    return { shortageKg, shortagePct, isAlert: shortagePct > 5.0 };
  }, [ecruWeightKg, finishWeightKg]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading || !batch) return;

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const allActiveYarnSpecs = [...selectedYarnSpecs];
      if (isOtherYarnActive && customYarnSpec.trim()) {
        const customParts = customYarnSpec.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
        allActiveYarnSpecs.push(...customParts);
      }

      if (allActiveYarnSpecs.length === 0) {
        throw new Error('Please select or enter at least one yarn specification');
      }

      if (millName === 'OTHER' && !customMillName.trim()) {
        throw new Error('Please specify the custom dyeing unit name');
      }

      const activeFabric = fabricType === 'OTHER' ? customFabricType.trim() : fabricType;
      if (!activeFabric) {
        throw new Error('Please specify a fabric variety');
      }

      const activeColor = color === 'OTHER' ? customColor.trim().toUpperCase() : color;
      if (!activeColor) {
        throw new Error('Please specify a target color');
      }

      const payload: UpdateBatchPayload = {
        batchNo: batchNo.trim().toUpperCase(),
        millName,
        customMillName: millName === 'OTHER' ? customMillName.trim() : undefined,
        fabricType: activeFabric,
        yarnSpecs: allActiveYarnSpecs,
        yarnSpec: allActiveYarnSpecs.join(' + '),
        targetColor: activeColor,
        ogpNo: ogpNo.trim(),
        igpNo: igpNo.trim(),
        dateIssued: new Date(dateIssued).toISOString(),
        ecruRollsCount: parseInt(ecruRollsCount, 10),
        ecruWeightKg: parseFloat(ecruWeightKg),
        allocatedCustomerId: allocatedCustomerId || null,
        remarks: remarks.trim()
      };

      if (batch.status === 'COMPLETED') {
        if (finishRollsCount) payload.finishRollsCount = parseInt(finishRollsCount, 10);
        if (finishWeightKg) payload.finishWeightKg = parseFloat(finishWeightKg);
      }

      await api.put(`/dyeing/batches/${batch._id}`, payload);

      setSuccess(`Batch ${batchNo} updated successfully`);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to update batch');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  async function handleDelete() {
    if (isSubmittingRef.current || isDeleting || !batch) return;

    isSubmittingRef.current = true;
    setError(null);
    setIsDeleting(true);

    try {
      await api.delete(`/dyeing/batches/${batch._id}`);
      setSuccess(`Batch ${batch.batchNo} deleted successfully`);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to delete batch');
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
      isSubmittingRef.current = false;
    }
  }

  if (!batch) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Batch: ${batch.batchNo}`}
      description="Update batch details, unit allocation, weights, or delete batch with atomic inventory synchronization."
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

        {batch.status === 'COMPLETED' && (
          <div className="p-3 text-xs rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <span>Batch Completed & Settled in Warehouse Inventory</span>
            </div>
            <p className="text-zinc-400">
              Changes to finished weight, color, or unit will automatically synchronize with live finished fabric inventory stock.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">Processing Unit</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {activeMills.map((unit) => (
              <button
                key={unit.code}
                type="button"
                onClick={() => setMillName(unit.code as DyeingMillType)}
                className={`flex items-center justify-center gap-2 p-2 rounded-md border text-xs font-semibold transition-colors select-none ${
                  millName === unit.code
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <Factory className="w-4 h-4" />
                <span>{unit.shortName}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setMillName('OTHER')}
              className={`flex items-center justify-center gap-2 p-2 rounded-md border text-xs font-semibold transition-colors select-none ${
                millName === 'OTHER'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Other Unit...</span>
            </button>
          </div>

          {millName === 'OTHER' && (
            <div className="pt-1">
              <Input
                id="editCustomMillName"
                label="Custom Dyeing Unit Name"
                value={customMillName}
                onChange={(e) => setCustomMillName(e.target.value)}
                placeholder="e.g. Master Dyeing Unit, Ittehad Dyeing..."
                required
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Input
            id="editBatchNo"
            label="Batch Number"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value.toUpperCase())}
            required
          />

          <Input
            id="editOgpNo"
            label="OGP (Outward)"
            value={ogpNo}
            onChange={(e) => setOgpNo(e.target.value)}
            placeholder="e.g. OGP-123"
          />

          <Input
            id="editIgpNo"
            label="IGP (Inward)"
            value={igpNo}
            onChange={(e) => setIgpNo(e.target.value)}
            placeholder="e.g. IGP-456"
          />

          <Input
            id="editDateIssued"
            type="date"
            label="Issue Date"
            value={dateIssued}
            onChange={(e) => setDateIssued(e.target.value)}
            required
          />
        </div>

        <div className="space-y-3">
          <div>
            <Select
              id="editFabricTypeSelect"
              label="Fabric Variety"
              value={fabricType}
              onChange={(e) => setFabricType(e.target.value)}
              options={[
                ...COMMON_FABRIC_TYPES.map((f) => ({ label: f, value: f })),
                { label: 'Other Fabric Variety...', value: 'OTHER' }
              ]}
            />

            {fabricType === 'OTHER' && (
              <div className="pt-2">
                <Input
                  id="editCustomFabric"
                  label="Custom Fabric Variety"
                  value={customFabricType}
                  onChange={(e) => setCustomFabricType(e.target.value)}
                  required
                  placeholder="e.g. Spandex Parda"
                />
              </div>
            )}
          </div>

          <YarnSpecMultiSelect
            selectedSpecs={selectedYarnSpecs}
            onChange={setSelectedYarnSpecs}
            customSpec={customYarnSpec}
            onCustomSpecChange={setCustomYarnSpec}
            isOtherActive={isOtherYarnActive}
            onToggleOther={setIsOtherYarnActive}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select
            id="editTargetColor"
            label="Target Color / Shade"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            options={COMMON_COLORS.map((c) => ({ label: c, value: c }))}
          />

          <Input
            id="editEcruRollsCount"
            type="number"
            min="1"
            label="Ecru Rolls Count"
            value={ecruRollsCount}
            onChange={(e) => setEcruRollsCount(e.target.value)}
            required
          />

          <Input
            id="editEcruWeightKg"
            type="number"
            step="0.01"
            min="0.01"
            label="Ecru Weight (Kg)"
            value={ecruWeightKg}
            onChange={(e) => setEcruWeightKg(e.target.value)}
            required
          />
        </div>

        {color === 'OTHER' && (
          <Input
            id="editCustomColor"
            label="Custom Color / Shade"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value.toUpperCase())}
            required
            autoFocus
            placeholder="e.g. MINT GREEN / BABY PINK"
          />
        )}

        {batch.status === 'COMPLETED' && (
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
              <span>Finished Weights & Reconciled Shrinkage</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="editFinishRollsCount"
                type="number"
                min="1"
                label="Finished Rolls Received"
                value={finishRollsCount}
                onChange={(e) => setFinishRollsCount(e.target.value)}
                required
              />

              <Input
                id="editFinishWeightKg"
                type="number"
                step="0.01"
                min="0.01"
                label="Finished Weight (Kg)"
                value={finishWeightKg}
                onChange={(e) => setFinishWeightKg(e.target.value)}
                required
              />
            </div>

            {settlementMetrics && (
              <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                <div className="p-2 bg-zinc-900 border border-zinc-800/80 rounded">
                  <span className="text-[10px] text-zinc-500 block">Shortage Loss</span>
                  <strong className="text-zinc-200 font-mono text-sm">
                    {formatWeight(settlementMetrics.shortageKg)}
                  </strong>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800/80 rounded">
                  <span className="text-[10px] text-zinc-500 block">Loss Percentage</span>
                  <strong
                    className={`font-mono text-sm ${
                      settlementMetrics.isAlert ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {settlementMetrics.shortagePct}%
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}

        <Select
          id="editAllocatedCustomer"
          label="Pre-Allocated Customer Order (Optional)"
          value={allocatedCustomerId}
          onChange={(e) => setAllocatedCustomerId(e.target.value)}
          options={[
            { label: '— Open Factory Stock (Unallocated) —', value: '' },
            ...buyers.map((b) => ({
              label: `${b.code} - ${b.name}`,
              value: b._id
            }))
          ]}
        />

        <Input
          id="editRemarks"
          label="Remarks / Lot Instructions"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Special dyeing instructions, temperature, or chemical specs"
        />

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                >
                  Yes, Delete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:border-red-500/50"
                onClick={() => setConfirmDelete(true)}
                disabled={isLoading || isDeleting}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || isDeleting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading} disabled={isDeleting}>
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
