import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { formatWeight } from '../../../lib/formatters.js';
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { YarnTransactionItem, UpdateYarnTransactionPayload, YarnSpecsResponseData } from '../types/knitting.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

export interface EditYarnTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction: YarnTransactionItem | null;
}

const DEFAULT_YARN_SPECS = [
  '75/72 Sim',
  '100/36 Sim',
  '150/48 Rotto',
  '100/144 Micro',
  '150/144 Micro',
  '30/1 Cotton',
  '20/1 Cotton',
  '50D Spandex'
];

export function EditYarnTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  transaction
}: EditYarnTransactionModalProps) {
  const [partyId, setPartyId] = useState('');
  const [yarnSpec, setYarnSpec] = useState(DEFAULT_YARN_SPECS[0]);
  const [customSpec, setCustomSpec] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [date, setDate] = useState('');
  const [boxCount, setBoxCount] = useState<string>('');
  const [netWeightPerBox, setNetWeightPerBox] = useState<string>('');
  const [wastagePercent, setWastagePercent] = useState<string>('');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: specsData } = useQuery<YarnSpecsResponseData>({
    queryKey: ['yarn-specs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: YarnSpecsResponseData }>('/knitting/yarn-specs');
      return res.data.data;
    },
    enabled: isOpen
  });

  const availableSpecs = useMemo(() => {
    if (specsData?.catalog && specsData.catalog.length > 0) {
      return specsData.catalog.filter((s) => s.isActive).map((s) => s.name);
    }
    return DEFAULT_YARN_SPECS;
  }, [specsData]);

  useEffect(() => {
    if (transaction) {
      setPartyId(transaction.partyId?._id || '');
      const isKnownSpec = availableSpecs.includes(transaction.yarnSpec);
      if (isKnownSpec) {
        setYarnSpec(transaction.yarnSpec);
        setCustomSpec('');
      } else {
        setYarnSpec('OTHER');
        setCustomSpec(transaction.yarnSpec);
      }
      setGatePassNo(transaction.gatePassNo || '');
      setDate(transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : '');
      setBoxCount(String(transaction.boxCount || 0));
      setNetWeightPerBox(String(transaction.netWeightPerBox || 0));
      setWastagePercent(String(transaction.wastagePercent ?? 1.0));
      setRemarks(transaction.remarks || '');
      setConfirmDelete(false);
      setError(null);
      setSuccess(null);
    }
  }, [transaction]);

  const targetTag = transaction?.transactionType === 'OUTWARD_TO_KNITTER' ? 'isKnitter' : 'isYarnClient';

  const { data: partiesData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', targetTag],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: targetTag, limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen && !!transaction
  });

  const parties = partiesData?.items || [];

  const calculations = useMemo(() => {
    const boxes = parseInt(boxCount, 10) || 0;
    const netPerBox = parseFloat(netWeightPerBox) || 0;
    const wastageP = parseFloat(wastagePercent) || 0;

    const gross = Math.round(boxes * netPerBox * 100) / 100;
    const wastage = Math.round(gross * (wastageP / 100) * 100) / 100;
    const expected = Math.round((gross - wastage) * 100) / 100;

    return { gross, wastage, expected };
  }, [boxCount, netWeightPerBox, wastagePercent]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading || !transaction) return;

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const activeYarnSpec = yarnSpec === 'OTHER' ? customSpec.trim() : yarnSpec;
      if (!activeYarnSpec) {
        throw new Error('Please specify a valid yarn specification');
      }

      const payload: UpdateYarnTransactionPayload = {
        partyId,
        yarnSpec: activeYarnSpec,
        gatePassNo: gatePassNo.trim(),
        date: new Date(date).toISOString(),
        boxCount: parseInt(boxCount, 10),
        netWeightPerBox: parseFloat(netWeightPerBox),
        wastagePercent: parseFloat(wastagePercent),
        remarks: remarks.trim()
      };

      await api.put(`/knitting/transactions/${transaction._id}`, payload);

      setSuccess('Yarn transaction updated successfully');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to update transaction');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  async function handleDelete() {
    if (isSubmittingRef.current || isDeleting || !transaction) return;

    isSubmittingRef.current = true;
    setError(null);
    setIsDeleting(true);

    try {
      await api.delete(`/knitting/transactions/${transaction._id}`);
      setSuccess('Yarn transaction deleted successfully');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to delete transaction');
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
      isSubmittingRef.current = false;
    }
  }

  if (!transaction) return null;

  const hasReceivedFabric = (transaction.receivedFabricKg || 0) > 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Yarn Transaction"
      description={`Update or correct details for Gate Pass ${transaction.gatePassNo}`}
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

        {hasReceivedFabric && (
          <div className="p-3 text-xs rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Fabric Already Received Against This Gate Pass</span>
            </div>
            <p className="text-zinc-400">
              Received so far:{' '}
              <strong className="text-zinc-200">{formatWeight(transaction.receivedFabricKg)}</strong>.
              Remaining balance:{' '}
              <strong className="text-zinc-200">{formatWeight(transaction.remainingYarnBalanceKg)}</strong>.
              This transaction cannot be deleted while fabric receipts exist.
            </p>
          </div>
        )}

        <Select
          id="editPartySelect"
          label={transaction.transactionType === 'OUTWARD_TO_KNITTER' ? 'Knitter Party' : 'Client Party'}
          value={partyId}
          onChange={(e) => setPartyId(e.target.value)}
          options={parties.map((p) => ({
            label: `${p.code} - ${p.name} (${p.phone || 'No phone'})`,
            value: p._id
          }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="editYarnSpec"
            label="Yarn Specification"
            value={yarnSpec}
            onChange={(e) => setYarnSpec(e.target.value)}
            options={[
              ...availableSpecs.map((s) => ({ label: s, value: s })),
              { label: 'Other Yarn Specification...', value: 'OTHER' }
            ]}
          />

          <Input
            id="editGatePassNo"
            label="Gate Pass / Challan Number"
            value={gatePassNo}
            onChange={(e) => setGatePassNo(e.target.value)}
            required
          />
        </div>

        {yarnSpec === 'OTHER' && (
          <Input
            id="editCustomSpec"
            label="Custom Yarn Specification"
            value={customSpec}
            onChange={(e) => setCustomSpec(e.target.value)}
            required
            placeholder="e.g. 40/1 Combed Cotton"
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="editTxDate"
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Input
            id="editBoxCount"
            type="number"
            min="1"
            label="Boxes Count"
            value={boxCount}
            onChange={(e) => setBoxCount(e.target.value)}
            required
          />

          <Input
            id="editNetWeightPerBox"
            type="number"
            step="0.01"
            min="0.01"
            label="Net Wt / Box (Kg)"
            value={netWeightPerBox}
            onChange={(e) => setNetWeightPerBox(e.target.value)}
            required
          />
        </div>

        <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg flex items-center justify-between">
          <div className="text-xs">
            <span className="text-zinc-400">Total Dispatched Yarn Weight:</span>
            <span className="text-zinc-500 text-[11px] ml-1.5">({boxCount || 0} boxes × {netWeightPerBox || 0} Kg)</span>
          </div>
          <div className="text-base font-bold font-mono text-emerald-400">
            {formatWeight(calculations.gross)}
          </div>
        </div>

        <Input
          id="editRemarks"
          label="Remarks / Reference"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Lot number, container info, or special notes"
        />

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <div>
            {!hasReceivedFabric && (
              confirmDelete ? (
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
              )
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
