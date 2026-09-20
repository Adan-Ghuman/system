import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, Factory, Building2 } from 'lucide-react';
import { DyeingMillType, CreateBatchPayload, DyeingUnitItem } from '../types/dyeing.types.js';
import { PartyItem } from '../../parties/types/party.types.js';
import { COMMON_COLORS } from '../../common/constants/colors.js';
import { YarnSpecMultiSelect, STANDARD_YARN_SPECS } from './YarnSpecMultiSelect.js';

export interface IssueBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMill?: DyeingMillType;
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

export function IssueBatchModal({ isOpen, onClose, onSuccess, initialMill = 'GHUMMAN_DYEING' }: IssueBatchModalProps) {
  const [millName, setMillName] = useState<DyeingMillType>(initialMill);
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
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0]);
  const [ecruRollsCount, setEcruRollsCount] = useState('20');
  const [ecruWeightKg, setEcruWeightKg] = useState('420.00');
  const [allocatedCustomerId, setAllocatedCustomerId] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMillName(initialMill);
  }, [initialMill]);

  useEffect(() => {
    if (isOpen) {
      api.get<{ success: boolean; data: { nextBatchNo: string } }>('/dyeing/batches/next-no')
        .then((res) => {
          if (res.data?.data?.nextBatchNo) {
            setBatchNo(res.data.data.nextBatchNo);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const { data: buyersData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', 'isFabricBuyer'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: 'isFabricBuyer', limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const allActiveYarnSpecs = [
        ...selectedYarnSpecs,
        ...(isOtherYarnActive && customYarnSpec.trim() ? [customYarnSpec.trim()] : [])
      ];
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

      const payload: CreateBatchPayload = {
        batchNo: batchNo.trim().toUpperCase(),
        millName,
        customMillName: millName === 'OTHER' ? customMillName.trim() : undefined,
        fabricType: activeFabric,
        yarnSpecs: allActiveYarnSpecs,
        yarnSpec: allActiveYarnSpecs.join(' + '),
        targetColor: activeColor,
        ogpNo: ogpNo.trim(),
        dateIssued: new Date(dateIssued).toISOString(),
        ecruRollsCount: parseInt(ecruRollsCount, 10),
        ecruWeightKg: parseFloat(ecruWeightKg),
        allocatedCustomerId: allocatedCustomerId || undefined,
        remarks: remarks.trim()
      };

      await api.post('/dyeing/batches', payload);

      const millDisplay = millName === 'OTHER'
        ? (customMillName.trim() || 'Other Unit')
        : millName === 'GHUMMAN_DYEING'
        ? 'Ghumman Dyeing'
        : millName === 'RAJPUT_DYEING'
        ? 'Rajput Dyeing'
        : millName === 'HAFIZ_SAAD_DYEING'
        ? 'Hafiz Saad Dyeing'
        : 'HB Dyeing';

      setSuccess(`Batch ${batchNo} issued to ${millDisplay}`);
      setCustomColor('');
      setCustomMillName('');
      setCustomYarnSpec('');
      setIsOtherYarnActive(false);
      setOgpNo('');
      setRemarks('');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to issue dyeing batch');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Send Fabric to Dyeing Unit"
      description="Create a delivery gate pass to send raw fabric rolls to Ghumman, Rajput, or another unit for dyeing."
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

        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300">Select Target Processing Unit</label>
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
                id="customMillName"
                label="Custom Dyeing Unit Name"
                value={customMillName}
                onChange={(e) => setCustomMillName(e.target.value)}
                placeholder="e.g. Master Dyeing Unit, Ittehad Dyeing..."
                required
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="batchNo"
            label="Batch Number"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value.toUpperCase())}
            required
            placeholder="BATCH-001"
          />

          <Input
            id="ogpNo"
            label="Outward Gate Pass (OGP)"
            value={ogpNo}
            onChange={(e) => setOgpNo(e.target.value)}
            placeholder="e.g. OGP-551"
          />

          <Input
            id="dateIssued"
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
              id="fabricTypeSelect"
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
                  id="customFabric"
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
            id="targetColor"
            label="Target Color / Shade"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            options={COMMON_COLORS.map((c) => ({ label: c, value: c }))}
          />

          <Input
            id="ecruRollsCount"
            type="number"
            min="1"
            label="Ecru Rolls Count"
            value={ecruRollsCount}
            onChange={(e) => setEcruRollsCount(e.target.value)}
            required
          />

          <Input
            id="ecruWeightKg"
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
            id="customColor"
            label="Custom Color / Shade"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value.toUpperCase())}
            required
            autoFocus
            placeholder="e.g. MINT GREEN / BABY PINK"
          />
        )}

        <Select
          id="allocatedCustomer"
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
          id="remarks"
          label="Remarks / Lot Instructions"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Special dyeing instructions, temperature, or chemical specs"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Save & Issue Gate Pass
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
