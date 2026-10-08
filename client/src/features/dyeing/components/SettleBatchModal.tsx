import { useState, useMemo, useRef, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { FormSection, OptionalDetails, FormFeedback, FormFooter } from '../../../components/ui/WorkflowForm.js';
import { getLocalDateInput, formatWeight } from '../../../lib/formatters.js';
import { DyeingBatchItem, SettleBatchPayload } from '../types/dyeing.types.js';

export interface SettleBatchModalProps {
  batch: DyeingBatchItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SettleBatchModal({ batch, isOpen, onClose, onSuccess }: SettleBatchModalProps) {
  const [finishRollsCount, setFinishRollsCount] = useState(String(batch?.ecruRollsCount || ''));
  const [finishWeightKg, setFinishWeightKg] = useState('');
  const [dateReceived, setDateReceived] = useState(getLocalDateInput());
  const [igpNo, setIgpNo] = useState(batch?.igpNo || '');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const settlementMath = useMemo(() => {
    if (!batch) return { lossKg: 0, shrinkagePercent: 0, isAlert: false, isExceeded: false };

    const finish = parseFloat(finishWeightKg) || 0;
    const ecru = batch.ecruWeightKg || 0;
    const isExceeded = ecru > 0 && finish > ecru;

    const lossKg = Math.round((ecru - finish) * 100) / 100;
    const shrinkagePercent = ecru > 0
      ? Math.round(((lossKg / ecru) * 100) * 100) / 100
      : 0;

    const isAlert = shrinkagePercent > 5.0 && !isExceeded;

    return { lossKg, shrinkagePercent, isAlert, isExceeded };
  }, [batch, finishWeightKg]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!batch || isSubmittingRef.current || isLoading) return;

    const finish = Number(finishWeightKg);
    const rolls = Number(finishRollsCount);
    if (!Number.isFinite(finish) || finish <= 0 || !Number.isInteger(rolls) || rolls <= 0) {
      setError('Enter the actual rolls and weight received.');
      return;
    }
    if (batch.ecruWeightKg && batch.ecruWeightKg > 0 && finish > batch.ecruWeightKg) {
      setError(`Finish weight (${finish} kg) cannot be more than lot weight (${batch.ecruWeightKg} kg)`);
      return;
    }

    isSubmittingRef.current = true;
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
      isSubmittingRef.current = false;
    }
  }

  if (!batch) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => { if (!isLoading) onClose(); }}
      title="Receive dyed fabric"
      description="Record the actual delivery from this batch. The received fabric will be added to stock."
      className="max-w-2xl"
      footer={<FormFooter formId="receive-batch-form" summary={finishWeightKg ? `${finishRollsCount || 0} rolls · ${formatWeight(Number(finishWeightKg))}` : 'Enter the actual received weight'} onClose={onClose} isLoading={isLoading} isSaved={Boolean(success)} disabled={settlementMath.isExceeded} submitLabel="Save receipt" />}
    >
      <form id="receive-batch-form" onSubmit={handleSubmit}>
        <FormFeedback error={error} success={success} />
        <fieldset disabled={isLoading || Boolean(success)} className="min-w-0 space-y-6">
          <FormSection step={1} title="Which batch came back?">
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
              <p className="font-medium text-zinc-100">{batch.batchNo} · {batch.customMillName || batch.millName.split('_').join(' ')}</p>
              <p className="text-zinc-400">{batch.fabricType} · {batch.yarnSpec} · {batch.targetColor}</p>
              <p className="text-zinc-300">Sent: {batch.ecruRollsCount} rolls · {formatWeight(batch.ecruWeightKg)}</p>
              {batch.ogpNo && <p className="text-xs text-zinc-500">Sending challan: {batch.ogpNo}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="settle-challan" label="Receiving challan number (optional)" value={igpNo} onChange={(e) => setIgpNo(e.target.value)} />
              <Input id="settle-date" type="date" label="Received on" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} required />
            </div>
          </FormSection>
          <FormSection step={2} title="How much did you receive?" description="Check these values against the delivery, including the roll count.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="settle-rolls" type="number" min="1" step="1" label="Rolls received" value={finishRollsCount} onChange={(e) => setFinishRollsCount(e.target.value)} required />
              <Input id="settle-weight" type="number" step="0.01" min="0.01" label="Actual received weight (kg)" value={finishWeightKg} onChange={(e) => setFinishWeightKg(e.target.value)} error={settlementMath.isExceeded ? 'Received weight cannot exceed the sent weight.' : undefined} required />
            </div>
            {Number(finishWeightKg) > 0 && (
              <div className={`rounded-lg border p-3 text-sm ${settlementMath.isExceeded ? 'border-red-500/30 bg-red-500/10 text-red-300' : settlementMath.isAlert ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-zinc-800 bg-zinc-950/30 text-zinc-300'}`}>
                {settlementMath.isExceeded ? 'Please check the weight before saving.' : <>Weight loss: {formatWeight(settlementMath.lossKg)} ({settlementMath.shrinkagePercent.toFixed(2)}%).{settlementMath.isAlert && ' Above the 5% tolerance; the batch will be flagged.'}</>}
              </div>
            )}
          </FormSection>
          <OptionalDetails title="Delivery notes (optional)">
            <Input id="settle-remarks" label="Notes" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </OptionalDetails>
        </fieldset>
      </form>
    </Dialog>
  );
}
