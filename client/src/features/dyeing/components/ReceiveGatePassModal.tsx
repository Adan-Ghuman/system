import { useState, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { formatWeight } from '../../../lib/formatters.js';
import {
  AlertCircle,
  CheckCircle2,
  CheckCheck,
  PackageCheck,
  Layers,
  Scale
} from 'lucide-react';
import {
  DyeingBatchItem,
  DyeingMillType,
  ReceiveGatePassPayload,
  DyeingUnitItem
} from '../types/dyeing.types.js';

export interface ReceiveGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMill?: DyeingMillType;
}

interface ReceivingItemState {
  batch: DyeingBatchItem;
  selected: boolean;
  finishRollsCount: string;
  finishWeightKg: string;
  remarks: string;
}

export function ReceiveGatePassModal({
  isOpen,
  onClose,
  onSuccess,
  initialMill = 'GHUMMAN_DYEING'
}: ReceiveGatePassModalProps) {
  const [igpNo, setIgpNo] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [millName, setMillName] = useState<DyeingMillType | 'ALL'>(initialMill || 'ALL');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  const [itemStates, setItemStates] = useState<Record<string, ReceivingItemState>>({});

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load Dyeing Units
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

  // Load Active Batches (Pending Receipt)
  const { data: activeBatchesData, isLoading: isBatchesLoading } = useQuery<{
    items: DyeingBatchItem[];
  }>({
    queryKey: ['active-dyeing-batches-for-receive', millName],
    queryFn: async () => {
      const params: Record<string, string> = { status: 'ACTIVE', limit: '100' };
      if (millName !== 'ALL') {
        params.millName = millName;
      }
      const res = await api.get<{
        success: boolean;
        data: { items: DyeingBatchItem[] };
      }>('/dyeing/batches', { params });
      return res.data.data;
    },
    enabled: isOpen
  });

  const activeBatches = activeBatchesData?.items || [];

  // Synchronize state when active batches are fetched
  useMemo(() => {
    if (activeBatches.length > 0) {
      setItemStates((prev) => {
        const next: Record<string, ReceivingItemState> = { ...prev };
        activeBatches.forEach((b) => {
          if (!next[b._id]) {
            // Default expected finished weight (~2% estimated loss)
            const estimatedFinished = Math.round(b.ecruWeightKg * 0.98 * 100) / 100;
            next[b._id] = {
              batch: b,
              selected: false,
              finishRollsCount: String(b.ecruRollsCount),
              finishWeightKg: String(estimatedFinished),
              remarks: ''
            };
          }
        });
        return next;
      });
    }
  }, [activeBatches]);

  function handleToggleSelect(batchId: string) {
    setItemStates((prev) => {
      const current = prev[batchId];
      if (!current) return prev;
      return {
        ...prev,
        [batchId]: { ...current, selected: !current.selected }
      };
    });
  }

  function handleFieldChange(batchId: string, field: 'finishRollsCount' | 'finishWeightKg' | 'remarks', val: string) {
    setItemStates((prev) => {
      const current = prev[batchId];
      if (!current) return prev;
      return {
        ...prev,
        [batchId]: { ...current, [field]: val }
      };
    });
  }

  const selectedItems = useMemo(() => {
    return Object.values(itemStates).filter((s) => s.selected);
  }, [itemStates]);

  const summary = useMemo(() => {
    let totalEcruKg = 0;
    let totalFinishKg = 0;
    let totalFinishRolls = 0;

    selectedItems.forEach((item) => {
      const finishKg = parseFloat(item.finishWeightKg) || 0;
      const finishRolls = parseInt(item.finishRollsCount, 10) || 0;
      totalEcruKg += item.batch.ecruWeightKg;
      totalFinishKg += finishKg;
      totalFinishRolls += finishRolls;
    });

    const totalLossKg = Math.round((totalEcruKg - totalFinishKg) * 100) / 100;
    const avgShrinkage = totalEcruKg > 0 ? (totalLossKg / totalEcruKg) * 100 : 0;

    return {
      count: selectedItems.length,
      totalEcruKg,
      totalFinishKg: Math.round(totalFinishKg * 100) / 100,
      totalFinishRolls,
      totalLossKg,
      avgShrinkage
    };
  }, [selectedItems]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!igpNo.trim()) {
      setError('Please enter Inward Gate Pass (IGP) # or Receiving Challan #');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please select at least one batch to mark received');
      return;
    }

    for (const item of selectedItems) {
      const rolls = parseInt(item.finishRollsCount, 10);
      const weight = parseFloat(item.finishWeightKg);
      if (isNaN(rolls) || rolls < 1) {
        setError(`Batch ${item.batch.batchNo}: Finish roll count must be at least 1`);
        return;
      }
      if (isNaN(weight) || weight <= 0) {
        setError(`Batch ${item.batch.batchNo}: Finished weight must be a positive number`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: ReceiveGatePassPayload = {
        igpNo: igpNo.trim(),
        dateReceived: new Date(dateReceived).toISOString(),
        driverName: driverName.trim(),
        vehicleNo: vehicleNo.trim(),
        remarks: remarks.trim(),
        items: selectedItems.map((item) => ({
          batchId: item.batch._id,
          finishRollsCount: parseInt(item.finishRollsCount, 10),
          finishWeightKg: parseFloat(item.finishWeightKg),
          remarks: item.remarks.trim() || undefined
        }))
      };

      await api.post('/dyeing/gate-passes/receive', payload);

      setSuccess(`Inward Gate Pass ${igpNo} saved. ${selectedItems.length} batches received into finished stock.`);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to settle received gate pass');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Dyeing Delivery (Inward Gate Pass / IGP)"
      description="Record incoming finished dyed fabric delivery from dyeing mills and credit finished inventory."
      className="max-w-5xl w-full"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg flex items-center gap-2 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-lg flex items-center gap-2 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 1. Inward Header */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Inward Gate Pass (IGP) Header</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Input
                id="igpNo"
                label="Inward Pass (IGP) #"
                value={igpNo}
                onChange={(e) => setIgpNo(e.target.value)}
                placeholder="e.g. IGP-442"
                required
                className="font-mono font-bold text-emerald-400 text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="dateReceived"
                type="date"
                label="Date Arrived"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                required
                className="text-xs h-8"
              />
            </div>

            <div>
              <Select
                id="receiveMillFilter"
                label="Filter by Dyeing Unit"
                value={millName}
                onChange={(e) => setMillName(e.target.value as any)}
                options={[
                  { label: 'All Dyeing Units', value: 'ALL' },
                  ...activeMills.map((u) => ({ label: u.shortName, value: u.code }))
                ]}
                className="text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="driverName"
                label="Driver Name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Aslam"
                className="text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="vehicleNo"
                label="Vehicle #"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. Suzuki / Raksha"
                className="text-xs h-8"
              />
            </div>
          </div>
        </div>

        {/* 2. Batches Selection Table */}
        <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Select Batches to Receive ({selectedItems.length} selected of {activeBatches.length} active)</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-zinc-800 rounded-md max-h-72 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-950/90 text-zinc-400 uppercase font-semibold text-[10px] border-b border-zinc-800 sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-2 text-center w-10">Select</th>
                  <th className="py-2 px-2 w-24">Batch #</th>
                  <th className="py-2 px-2 w-20">OGP #</th>
                  <th className="py-2 px-2 w-32">Fabric Variety</th>
                  <th className="py-2 px-2 w-24">Color</th>
                  <th className="py-2 px-2 text-right w-24">Ecru Sent</th>
                  <th className="py-2 px-2 text-right w-24">Finish Rolls</th>
                  <th className="py-2 px-2 text-right w-28">Finish Wt (kg)</th>
                  <th className="py-2 px-2 text-center w-24">Loss / Shrink</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {isBatchesLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-500">
                      Loading pending dyeing batches...
                    </td>
                  </tr>
                ) : activeBatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-500">
                      No active batches found pending receipt.
                    </td>
                  </tr>
                ) : (
                  activeBatches.map((b) => {
                    const state = itemStates[b._id];
                    const isSelected = !!state?.selected;
                    const finishKg = parseFloat(state?.finishWeightKg || '0') || 0;
                    const lossKg = Math.round((b.ecruWeightKg - finishKg) * 100) / 100;
                    const shrinkage = b.ecruWeightKg > 0 ? (lossKg / b.ecruWeightKg) * 100 : 0;

                    return (
                      <tr
                        key={b._id}
                        className={`transition-colors ${
                          isSelected ? 'bg-emerald-950/20' : 'hover:bg-zinc-800/40'
                        }`}
                      >
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(b._id)}
                            className="rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          />
                        </td>

                        <td className="py-2 px-2 font-mono font-bold text-emerald-400">
                          {b.batchNo}
                        </td>

                        <td className="py-2 px-2 font-mono text-zinc-400 text-[11px]">
                          {b.ogpNo || '—'}
                        </td>

                        <td className="py-2 px-2">
                          <span className="font-medium text-zinc-200">{b.fabricType}</span>
                          <span className="text-[10px] text-zinc-500 block font-mono">
                            {b.yarnSpec}
                          </span>
                        </td>

                        <td className="py-2 px-2">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                            {b.targetColor}
                          </span>
                        </td>

                        <td className="py-2 px-2 text-right font-mono text-zinc-300">
                          <div>{formatWeight(b.ecruWeightKg)}</div>
                          <div className="text-[10px] text-zinc-500">{b.ecruRollsCount} rolls</div>
                        </td>

                        <td className="py-2 px-1 text-right">
                          <input
                            type="number"
                            min="1"
                            disabled={!isSelected}
                            value={state?.finishRollsCount || ''}
                            onChange={(e) => handleFieldChange(b._id, 'finishRollsCount', e.target.value)}
                            className={`w-20 bg-zinc-950 border rounded px-1.5 py-1 text-xs text-right font-mono font-bold focus:outline-none ${
                              isSelected
                                ? 'border-zinc-700 text-zinc-100 focus:border-emerald-500'
                                : 'border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                            }`}
                          />
                        </td>

                        <td className="py-2 px-1 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            disabled={!isSelected}
                            value={state?.finishWeightKg || ''}
                            onChange={(e) => handleFieldChange(b._id, 'finishWeightKg', e.target.value)}
                            className={`w-24 bg-zinc-950 border rounded px-1.5 py-1 text-xs text-right font-mono font-bold focus:outline-none ${
                              isSelected
                                ? 'border-emerald-700 text-emerald-400 focus:border-emerald-400'
                                : 'border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                            }`}
                          />
                        </td>

                        <td className="py-2 px-2 text-center font-mono text-xs">
                          {isSelected ? (
                            <span
                              className={`text-[11px] font-bold ${
                                shrinkage > 5.0 ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {shrinkage.toFixed(1)}%
                              <span className="text-[10px] text-zinc-500 block">
                                -{formatWeight(lossKg)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Live Summary Bar */}
          {selectedItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>Selected to Receive: {summary.count} Batches</span>
              </span>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded">
                  {summary.totalFinishRolls} Finished Rolls
                </span>

                <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded">
                  {formatWeight(summary.totalFinishKg)}
                </span>

                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                    summary.avgShrinkage > 5.0
                      ? 'bg-amber-950/50 border-amber-800/80 text-amber-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                  }`}
                >
                  Avg Shrink: {summary.avgShrinkage.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. Remarks */}
        <div>
          <Input
            id="receiveRemarks"
            label="Inward Remarks (Optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Received via Kashif rickshaw, checked rolls in godown"
            className="text-xs h-8"
          />
        </div>

        {/* 4. Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="text-xs text-zinc-400">
            Selected fabric rolls will automatically deposit into finished stock inventory.
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isLoading || selectedItems.length === 0}
              className="gap-1.5 font-bold"
            >
              {isLoading ? (
                'Processing Inward...'
              ) : (
                <>
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Receive {selectedItems.length} Batch(es) ({formatWeight(summary.totalFinishKg)})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
