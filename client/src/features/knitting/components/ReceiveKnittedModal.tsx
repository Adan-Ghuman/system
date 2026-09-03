import { useState, useEffect, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';
import { KnitterBalanceSummary, ReceiveFabricPayload } from '../types/knitting.types.js';

export interface ReceiveKnittedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedBalance?: KnitterBalanceSummary | null;
}

export function ReceiveKnittedModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedBalance
}: ReceiveKnittedModalProps) {
  const [partyId, setPartyId] = useState('');
  const [yarnSpec, setYarnSpec] = useState('');
  const [rollsCount, setRollsCount] = useState('20');
  const [weightKg, setWeightKg] = useState('395.50');
  const [gatePassNo, setGatePassNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: balances = [] } = useQuery<KnitterBalanceSummary[]>({
    queryKey: ['knitter-balances'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: KnitterBalanceSummary[] }>('/knitting/balances');
      return res.data.data;
    },
    enabled: isOpen
  });

  useEffect(() => {
    if (preselectedBalance) {
      setPartyId(preselectedBalance.partyId);
      setYarnSpec(preselectedBalance.yarnSpec);
    } else if (balances.length > 0 && !partyId) {
      setPartyId(balances[0].partyId);
      setYarnSpec(balances[0].yarnSpec);
    }
  }, [preselectedBalance, balances, partyId]);

  const activeBalance = balances.find(
    (b) => b.partyId === partyId && b.yarnSpec === yarnSpec
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: ReceiveFabricPayload = {
        partyId,
        yarnSpec,
        rollsCount: parseInt(rollsCount, 10),
        weightKg: parseFloat(weightKg),
        date: new Date(date).toISOString(),
        gatePassNo: gatePassNo.trim(),
        remarks: remarks.trim()
      };

      await api.post('/knitting/receive', payload);

      setSuccess(`Knitted rolls received. Knitter balance updated.`);
      setGatePassNo('');
      setRemarks('');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to record fabric receipt');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Inward Knitted Rolls Receipt"
      description="Log knitted ecru fabric returning from contract knitter to decrement remaining yarn obligation."
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
            id="receiveKnitterSelect"
            label="Contract Knitter & Spec"
            value={`${partyId}::${yarnSpec}`}
            onChange={(e) => {
              const [pId, spec] = e.target.value.split('::');
              setPartyId(pId);
              setYarnSpec(spec);
            }}
            options={balances.map((b) => ({
              label: `${b.partyName} - ${b.yarnSpec} (${b.remainingYarnKg} Kg left)`,
              value: `${b.partyId}::${b.yarnSpec}`
            }))}
          />

          <Input
            id="inwardGatePass"
            label="Inward Gate Pass (IGP) / Delivery Challan"
            value={gatePassNo}
            onChange={(e) => setGatePassNo(e.target.value)}
            required
            placeholder="e.g. IGP-892"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="receiveDate"
            type="date"
            label="Receipt Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Input
            id="rollsCount"
            type="number"
            min="1"
            label="Total Rolls Count"
            value={rollsCount}
            onChange={(e) => setRollsCount(e.target.value)}
            required
          />

          <Input
            id="weightKg"
            type="number"
            step="0.01"
            min="0.01"
            label="Received Net Fabric (Kg)"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
          />
        </div>

        {activeBalance && (
          <div className="p-3 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <div className="text-zinc-400">Active Unknitted Yarn in Field:</div>
              <div className="font-mono font-bold text-zinc-100 mt-0.5">
                {activeBalance.remainingYarnKg} Kg ({activeBalance.yarnSpec})
              </div>
            </div>
            <div className="text-right">
              <div className="text-zinc-400">Expected Ecru Balance:</div>
              <div className="font-mono font-bold text-emerald-400 mt-0.5">
                {Math.max(0, Math.round((activeBalance.totalExpectedKg - activeBalance.totalReceivedKg) * 100) / 100)} Kg
              </div>
            </div>
          </div>
        )}

        <Input
          id="receiveRemarks"
          label="Remarks / Vehicle / Notes"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Received via Rikshaw Suzuki"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5">
            <PackageCheck className="w-4 h-4" />
            <span>Confirm Fabric Receipt</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
