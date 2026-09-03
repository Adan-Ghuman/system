import { useState, useEffect, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, Factory } from 'lucide-react';
import { DyeingMillType, CreateBatchPayload } from '../types/dyeing.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

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

const COMMON_YARN_SPECS = [
  '75/72 Sim',
  '100/36 Sim',
  '150/48 Rotto',
  '100/144 Micro',
  '30/1 Cotton',
  '20/1 Cotton'
];

export function IssueBatchModal({ isOpen, onClose, onSuccess, initialMill = 'GHUMMAN_DYEING' }: IssueBatchModalProps) {
  const [millName, setMillName] = useState<DyeingMillType>(initialMill);
  const [batchNo, setBatchNo] = useState('');
  const [fabricType, setFabricType] = useState(COMMON_FABRIC_TYPES[0]);
  const [customFabricType, setCustomFabricType] = useState('');
  const [yarnSpec, setYarnSpec] = useState(COMMON_YARN_SPECS[0]);
  const [targetColor, setTargetColor] = useState('');
  const [ogpNo, setOgpNo] = useState('');
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0]);
  const [ecruRollsCount, setEcruRollsCount] = useState('24');
  const [ecruWeightKg, setEcruWeightKg] = useState('520.00');
  const [allocatedCustomerId, setAllocatedCustomerId] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const activeFabric = fabricType === 'OTHER' ? customFabricType.trim() : fabricType;
      if (!activeFabric) {
        throw new Error('Please specify a fabric variety');
      }

      const payload: CreateBatchPayload = {
        batchNo: batchNo.trim().toUpperCase(),
        millName,
        fabricType: activeFabric,
        yarnSpec,
        targetColor: targetColor.trim().toUpperCase(),
        ogpNo: ogpNo.trim(),
        dateIssued: new Date(dateIssued).toISOString(),
        ecruRollsCount: parseInt(ecruRollsCount, 10),
        ecruWeightKg: parseFloat(ecruWeightKg),
        allocatedCustomerId: allocatedCustomerId || undefined,
        remarks: remarks.trim()
      };

      await api.post('/dyeing/batches', payload);

      setSuccess(`Batch ${batchNo} issued to ${millName === 'GHUMMAN_DYEING' ? 'Ghumman Dyeing' : 'Rajput Dyeing'}`);
      setTargetColor('');
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
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Issue Dyeing Batch to Processing Mill"
      description="Allocate raw ecru rolls for dyeing processing across Ghumman or Rajput Dyeing."
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

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">Select Target Processing Mill</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMillName('GHUMMAN_DYEING')}
              className={`flex items-center justify-center gap-2 p-2 rounded-md border text-xs font-semibold transition-colors select-none ${
                millName === 'GHUMMAN_DYEING'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <Factory className="w-4 h-4" />
              <span>Ghumman Dyeing Mill</span>
            </button>

            <button
              type="button"
              onClick={() => setMillName('RAJPUT_DYEING')}
              className={`flex items-center justify-center gap-2 p-2 rounded-md border text-xs font-semibold transition-colors select-none ${
                millName === 'RAJPUT_DYEING'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <Factory className="w-4 h-4" />
              <span>Rajput Dyeing Mill</span>
            </button>
          </div>
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

        <div className="grid grid-cols-2 gap-3">
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

          <Select
            id="yarnSpecSelect"
            label="Yarn Specification"
            value={yarnSpec}
            onChange={(e) => setYarnSpec(e.target.value)}
            options={COMMON_YARN_SPECS.map((s) => ({ label: s, value: s }))}
          />
        </div>

        {fabricType === 'OTHER' && (
          <Input
            id="customFabric"
            label="Custom Fabric Variety"
            value={customFabricType}
            onChange={(e) => setCustomFabricType(e.target.value)}
            required
            placeholder="e.g. Spandex Parda"
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="targetColor"
            label="Target Color / Shade"
            value={targetColor}
            onChange={(e) => setTargetColor(e.target.value.toUpperCase())}
            required
            autoFocus
            placeholder="e.g. BLACK / NAVY"
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
            Issue Batch to Mill
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
