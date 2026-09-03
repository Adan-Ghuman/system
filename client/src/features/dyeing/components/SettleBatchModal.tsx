import { useState, useEffect, useMemo, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { formatWeight } from '../../../lib/formatters.js';
import { AlertCircle, CheckCircle2, AlertTriangle, CheckCircle, Scale } from 'lucide-react';
import { DyeingBatchItem, SettleBatchPayload } from '../types/dyeing.types.js';

export interface SettleBatchModalProps {
  batch: DyeingBatchItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SettleBatchModal({ batch, isOpen, onClose, onSuccess }: SettleBatchModalProps) {
  const [finishRollsCount, setFinishRollsCount] = useState('');
  const [finishWeightKg, setFinishWeightKg] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [igpNo, setIgpNo] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (batch) {
      setFinishRollsCount(String(batch.ecruRollsCount || 20));
      const estimatedWeight = batch.ecruWeightKg ? (batch.ecruWeightKg * 0.96).toFixed(2) : '';
      setFinishWeightKg(estimatedWeight);
      setIgpNo(batch.igpNo || '');
      setError(null);
      setSuccess(null);
    }
  }, [batch]);

  const settlementMath = useMemo(() => {
    if (!batch) return { lossKg: 0, shrinkagePercent: 0, isAlert: false };

    const finish = parseFloat(finishWeightKg) || 0;
    const ecru = batch.ecruWeightKg || 0;

    const lossKg = Math.round((ecru - finish) * 100) / 100;
    const shrinkagePercent = ecru > 0
      ? Math.round(((lossKg / ecru) * 100) * 100) / 100
      : 0;

    const isAlert = shrinkagePercent > 5.0;

    return { lossKg, shrinkagePercent, isAlert };
  }, [batch, finishWeightKg]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!batch) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: SettleBatchPayload = {
        finishRollsCount: parseInt(finishRollsCount, 10),
        finishWeightKg: parseFloat(finishWeightKg),
        dateReceived: new Date(dateReceived).toISOString(),
        igpNo: igpNo.trim(),
        remarks: remarks.trim()
      };

      await api.put(`/dyeing/batches/${batch._id}/settle`, payload);

      setSuccess(`Batch ${batch.batchNo} settled successfully. Finished dyed inventory credited.`);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to settle dyeing batch');
    } finally {
      setIsLoading(false);
    }
  }

  if (!batch) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Settle Dyeing Batch: ${batch.batchNo}`}
      description="Record finished dyed fabric received, compute process yield shrinkage loss, and credit finished inventory."
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

        <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 grid grid-cols-4 gap-2 text-xs">
          <div>
            <div className="text-zinc-500 text-[10px] uppercase">Mill</div>
            <div className="font-semibold text-zinc-200 mt-0.5">
              {batch.millName === 'GHUMMAN_DYEING' ? 'Ghumman Dyeing' : 'Rajput Dyeing'}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-[10px] uppercase">Fabric / Spec</div>
            <div className="font-semibold text-emerald-400 mt-0.5 truncate">
              {batch.fabricType} ({batch.yarnSpec})
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-[10px] uppercase">Target Color</div>
            <Badge variant="default" className="mt-0.5 font-bold">
              {batch.targetColor}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-zinc-500 text-[10px] uppercase">Ecru Issued</div>
            <div className="font-mono font-bold text-zinc-100 mt-0.5">
              {formatWeight(batch.ecruWeightKg)} ({batch.ecruRollsCount} R)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="finishRollsCount"
            type="number"
            min="1"
            label="Finished Rolls Received"
            value={finishRollsCount}
            onChange={(e) => setFinishRollsCount(e.target.value)}
            required
            autoFocus
          />

          <Input
            id="finishWeightKg"
            type="number"
            step="0.01"
            min="0.01"
            label="Finished Net Weight (Kg)"
            value={finishWeightKg}
            onChange={(e) => setFinishWeightKg(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="igpNo"
            label="Inward Gate Pass (IGP) / Delivery Challan"
            value={igpNo}
            onChange={(e) => setIgpNo(e.target.value)}
            placeholder="e.g. IGP-772"
          />

          <Input
            id="dateReceived"
            type="date"
            label="Receipt Date"
            value={dateReceived}
            onChange={(e) => setDateReceived(e.target.value)}
            required
          />
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              Dynamic Shrinkage & Loss Engine
            </span>
            {settlementMath.isAlert ? (
              <Badge variant="warning" className="gap-1 font-semibold text-[11px]">
                <AlertTriangle className="w-3 h-3" />
                Excess Shrinkage (&gt; 5.0%)
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1 font-semibold text-[11px]">
                <CheckCircle className="w-3 h-3" />
                Normal Yield (&le; 5.0%)
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">Shortage Loss (Kg)</div>
              <div
                className={`text-sm font-mono font-bold mt-0.5 ${
                  settlementMath.isAlert ? 'text-amber-400' : 'text-zinc-200'
                }`}
              >
                {formatWeight(settlementMath.lossKg)}
              </div>
            </div>

            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">Shrinkage %</div>
              <div
                className={`text-sm font-mono font-bold mt-0.5 ${
                  settlementMath.isAlert ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {settlementMath.shrinkagePercent.toFixed(2)}%
              </div>
            </div>

            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-[10px] text-zinc-500 uppercase">Finished Yield</div>
              <div className="text-sm font-mono font-bold text-zinc-200 mt-0.5">
                {(100 - settlementMath.shrinkagePercent).toFixed(2)}%
              </div>
            </div>
          </div>

          {settlementMath.isAlert && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Process loss exceeds standard 5.0% contract tolerance limit. An alert flag will be saved in the batch audit log.</span>
            </div>
          )}
        </div>

        <Input
          id="settleRemarks"
          label="Settlement Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Approved by Haji Ghumman, slight heat shrinkage"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Confirm Settlement & Credit Stock
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
