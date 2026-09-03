import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { formatWeight } from '../../../lib/formatters.js';
import { AlertCircle, CheckCircle2, Calculator, ArrowRight } from 'lucide-react';
import { YarnTransactionType, CreateYarnTransactionPayload } from '../types/knitting.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

export interface IssueYarnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: YarnTransactionType;
}

const COMMON_YARN_SPECS = [
  '75/72 Sim',
  '100/36 Sim',
  '150/48 Rotto',
  '100/144 Micro',
  '150/144 Micro',
  '30/1 Cotton',
  '20/1 Cotton',
  '50D Spandex'
];

export function IssueYarnModal({ isOpen, onClose, onSuccess, initialType = 'OUTWARD_TO_KNITTER' }: IssueYarnModalProps) {
  const [transactionType, setTransactionType] = useState<YarnTransactionType>(initialType);
  const [partyId, setPartyId] = useState('');
  const [yarnSpec, setYarnSpec] = useState(COMMON_YARN_SPECS[0]);
  const [customSpec, setCustomSpec] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [boxCount, setBoxCount] = useState<string>('10');
  const [netWeightPerBox, setNetWeightPerBox] = useState<string>('33.33');
  const [wastagePercent, setWastagePercent] = useState<string>('1.0');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTransactionType(initialType);
  }, [initialType]);

  const targetTag = transactionType === 'OUTWARD_TO_KNITTER' ? 'isKnitter' : 'isYarnClient';

  const { data: partiesData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', targetTag],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: targetTag, limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const parties = partiesData?.items || [];

  useEffect(() => {
    if (parties.length > 0 && !partyId) {
      setPartyId(parties[0]._id);
    }
  }, [parties, partyId]);

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
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const activeYarnSpec = yarnSpec === 'OTHER' ? customSpec.trim() : yarnSpec;
      if (!activeYarnSpec) {
        throw new Error('Please specify a valid yarn specification');
      }

      const payload: CreateYarnTransactionPayload = {
        transactionType,
        partyId,
        yarnSpec: activeYarnSpec,
        gatePassNo: gatePassNo.trim(),
        date: new Date(date).toISOString(),
        boxCount: parseInt(boxCount, 10),
        netWeightPerBox: parseFloat(netWeightPerBox),
        wastagePercent: parseFloat(wastagePercent),
        remarks: remarks.trim()
      };

      await api.post('/knitting/transactions', payload);

      setSuccess('Yarn dispatch logged and knitter balance updated');
      setGatePassNo('');
      setRemarks('');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to log yarn transaction');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={transactionType === 'OUTWARD_TO_KNITTER' ? 'Issue Yarn Outward to Knitter' : 'Inward Yarn Receipt from Client'}
      description="Record yarn outward/inward with automated 1.0% standard wastage deduction math."
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

        <div className="flex items-center gap-2 p-1 rounded-md bg-zinc-950 border border-zinc-800">
          <button
            type="button"
            onClick={() => setTransactionType('OUTWARD_TO_KNITTER')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
              transactionType === 'OUTWARD_TO_KNITTER'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Outward to Contract Knitter
          </button>
          <button
            type="button"
            onClick={() => setTransactionType('INWARD_FROM_CLIENT')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
              transactionType === 'INWARD_FROM_CLIENT'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Inward from Job-Work Client
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="partySelect"
            label={transactionType === 'OUTWARD_TO_KNITTER' ? 'Contract Knitter' : 'Job-Work Client'}
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            options={parties.map((p) => ({
              label: `${p.code} - ${p.name}`,
              value: p._id
            }))}
          />

          <Input
            id="gatePassNo"
            label="Outward Gate Pass / Challan #"
            value={gatePassNo}
            onChange={(e) => setGatePassNo(e.target.value)}
            required
            placeholder="e.g. OGP-YARN-4501"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="txDate"
            type="date"
            label="Transaction Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Select
            id="yarnSpecSelect"
            label="Yarn Specification / Count"
            value={yarnSpec}
            onChange={(e) => setYarnSpec(e.target.value)}
            options={[
              ...COMMON_YARN_SPECS.map((s) => ({ label: s, value: s })),
              { label: 'Other / Custom Count...', value: 'OTHER' }
            ]}
          />
        </div>

        {yarnSpec === 'OTHER' && (
          <Input
            id="customYarnSpec"
            label="Custom Yarn Specification"
            value={customSpec}
            onChange={(e) => setCustomSpec(e.target.value)}
            required
            placeholder="e.g. 40/1 Carded Cotton"
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="boxCount"
            type="number"
            min="1"
            label="Carton / Box Count"
            value={boxCount}
            onChange={(e) => setBoxCount(e.target.value)}
            required
            placeholder="50"
          />

          <Input
            id="netWeightPerBox"
            type="number"
            step="0.01"
            min="0.1"
            label="Net Weight per Box (Kg)"
            value={netWeightPerBox}
            onChange={(e) => setNetWeightPerBox(e.target.value)}
            required
            placeholder="45.36"
          />

          <Input
            id="wastagePercent"
            type="number"
            step="0.1"
            min="0"
            max="10"
            label="Wastage Allowance (%)"
            value={wastagePercent}
            onChange={(e) => setWastagePercent(e.target.value)}
            required
            placeholder="1.0"
          />
        </div>

        <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              Automated 1% Standard Wastage Engine
            </span>
            <span className="text-[11px] text-zinc-400">Tolerance Rule</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-400 uppercase">Gross Yarn</div>
              <div className="text-sm font-bold font-mono text-zinc-100 mt-0.5">
                {formatWeight(calculations.gross)}
              </div>
            </div>

            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-400 uppercase">1.0% Wastage</div>
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                {formatWeight(calculations.wastage)}
              </div>
            </div>

            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-400 uppercase">Expected Ecru</div>
              <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                {formatWeight(calculations.expected)}
              </div>
            </div>
          </div>
        </div>

        <Input
          id="remarks"
          label="Remarks / Vehicle / Notes"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional notes or vehicle number"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5">
            <span>Commit Transaction</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
