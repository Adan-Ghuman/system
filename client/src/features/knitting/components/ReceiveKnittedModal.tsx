import { useState, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { getLocalDateInput } from '../../../lib/formatters.js';
import { Input } from '../../../components/ui/Input.js';
import { Button } from '../../../components/ui/Button.js';
import { FormSection, OptionalDetails, EntryCard, FormFeedback, FormFooter } from '../../../components/ui/WorkflowForm.js';
import { PartyCombobox } from '../../../components/ui/PartyCombobox.js';
import { Plus } from 'lucide-react';
import {
  KnitterBalanceSummary,
  ReceiveFabricPayload,
  YarnSpecsResponseData
} from '../types/knitting.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

export interface ReceiveKnittedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedBalance?: KnitterBalanceSummary | null;
}

export interface KnittedSlipRow {
  id: string;
  fabricType: string;
  yarnSpec: string;
  rollsCount: string;
  weightKg: string;
  remarks: string;
}

const COMMON_FABRICS = [
  'Single Jersey',
  'Interlock',
  '3 Tak Mesh',
  '1 Tak Mesh',
  'Fleece 3-Thread',
  'Double Parda',
  'Rib 1x1',
  'Rib 2x2',
  'لاٹ سیڈو (Sedo)',
  'Single Strips',
  'Popcorn Pique'
];

const DEFAULT_YARN_SPECS = [
  '75/72 Sim',
  '75/36',
  '100/36 Sim',
  '150/48 Rotto',
  '100/144 Micro',
  '150/144 Micro',
  '30/1 Cotton',
  '20/1 Cotton',
  '50D Spandex'
];

function generateRowId(): string {
  return 'knit_row_' + Math.random().toString(36).substring(2, 9);
}

function createDefaultRow(defaultSpec = '75/72 Sim'): KnittedSlipRow {
  return {
    id: generateRowId(),
    fabricType: 'Single Jersey',
    yarnSpec: defaultSpec,
    rollsCount: '',
    weightKg: '',
    remarks: ''
  };
}

export function ReceiveKnittedModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedBalance
}: ReceiveKnittedModalProps) {
  const [partyId, setPartyId] = useState(preselectedBalance?.partyId || '');
  const [partyName, setPartyName] = useState(preselectedBalance?.partyName || '');
  const [gatePassNo, setGatePassNo] = useState('');
  const [date, setDate] = useState(getLocalDateInput());
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-row items state
  const [rows, setRows] = useState<KnittedSlipRow[]>([createDefaultRow(preselectedBalance?.yarnSpec || undefined)]);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch all Knitters
  const { data: partiesData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', 'isKnitter'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: 'isKnitter', limit: 150 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const knitters = partiesData?.items || [];

  // Fetch active yarn specifications
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

  function handleAddRow() {
    const lastRow = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      {
        id: generateRowId(),
        fabricType: lastRow ? lastRow.fabricType : 'Single Jersey',
        yarnSpec: lastRow ? lastRow.yarnSpec : availableSpecs[0] || '75/72',
        rollsCount: '',
        weightKg: '',
        remarks: ''
      }
    ]);
  }

  function handleDuplicateRow(index: number) {
    const source = rows[index];
    if (!source) return;
    const duplicated: KnittedSlipRow = {
      ...source,
      id: generateRowId(),
      rollsCount: '',
      weightKg: ''
    };
    setRows((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicated);
      return copy;
    });
  }

  function handleRemoveRow(id: string) {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleRowChange(id: string, field: keyof KnittedSlipRow, val: string) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: val } : row))
    );
  }

  // Summary Totals
  const totals = useMemo(() => {
    let totalRolls = 0;
    let totalWeight = 0;

    rows.forEach((r) => {
      const rolls = parseInt(r.rollsCount, 10) || 0;
      const wt = parseFloat(r.weightKg) || 0;
      totalRolls += rolls;
      totalWeight += wt;
    });

    return {
      count: rows.length,
      totalRolls,
      totalWeightKg: Math.round(totalWeight * 100) / 100
    };
  }, [rows]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!partyId && !partyName) {
      setError('Please select or specify the knitter / sender party');
      return;
    }

    if (!gatePassNo.trim()) {
      setError('Please enter Delivery Challan / Inward Gate Pass # from the paper slip');
      return;
    }

    // Validate rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rolls = parseInt(r.rollsCount, 10);
      const wt = parseFloat(r.weightKg);

      if (!r.yarnSpec.trim()) {
        setError(`Row #${i + 1}: Yarn specification is required`);
        return;
      }
      if (isNaN(rolls) || rolls < 1) {
        setError(`Row #${i + 1}: Rolls count must be at least 1`);
        return;
      }
      if (isNaN(wt) || wt <= 0) {
        setError(`Row #${i + 1}: Net fabric weight must be a positive number`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: ReceiveFabricPayload = {
        partyId: partyId || partyName,
        partyName: partyName || undefined,
        gatePassNo: gatePassNo.trim(),
        date: new Date(date).toISOString(),
        remarks: [driverName ? `Driver: ${driverName}` : '', remarks].filter(Boolean).join(' | '),
        items: rows.map((r) => ({
          fabricType: r.fabricType.trim() || 'Single Jersey',
          yarnSpec: r.yarnSpec.trim(),
          rollsCount: parseInt(r.rollsCount, 10),
          weightKg: parseFloat(r.weightKg),
          remarks: r.remarks.trim() || undefined
        }))
      };

      await api.post('/knitting/receive', payload);

      setSuccess(`Inward Challan ${gatePassNo} recorded. ${totals.totalRolls} rolls (${totals.totalWeightKg} kg) added to raw ecru stock.`);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to record knitted fabric receipt');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={() => { if (!isLoading) onClose(); }} title="Receive fabric from a knitter"
      description="Enter the actual rolls and weight on the knitter's delivery slip." className="max-w-2xl"
      footer={<FormFooter formId="knitted-receipt-form" onClose={onClose} isLoading={isLoading} isSaved={Boolean(success)}
        submitLabel="Save fabric receipt" summary={<><strong className="text-zinc-200">{totals.totalRolls} rolls</strong> · {totals.totalWeightKg.toFixed(2)} kg</>} />}>
      <form id="knitted-receipt-form" onSubmit={handleSubmit}>
        <fieldset disabled={isLoading || Boolean(success)} className="space-y-6">
          <FormFeedback error={error} success={success} />
          <FormSection step={1} title="Who delivered the fabric?">
            <PartyCombobox id="knitted-party" label="Knitter" value={partyId} parties={knitters} required
              placeholder="Choose or type the knitter name"
              onChange={(value, selected) => { setPartyId(value); setPartyName(selected?.name || value); }} />
            {preselectedBalance && <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-zinc-300">
              Yarn at this knitter: <strong className="text-emerald-400">{preselectedBalance.remainingYarnKg.toFixed(2)} kg</strong> of {preselectedBalance.yarnSpec}.
            </p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="knitted-challan" label="Challan number" value={gatePassNo} onChange={(e) => setGatePassNo(e.target.value)} placeholder="Number on the delivery slip" required />
              <Input id="knitted-date" label="Received date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </FormSection>
          <FormSection step={2} title="What fabric did you receive?" description="Add a separate item for each fabric type or yarn count.">
            {rows.map((row, index) => (
              <EntryCard key={row.id} title={'Fabric item ' + (index + 1)} onCopy={() => handleDuplicateRow(index)}
                onRemove={() => handleRemoveRow(row.id)} canRemove={rows.length > 1}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input id={'knitted-fabric-' + row.id} label="Fabric type" list="knitted-fabric-types" value={row.fabricType} required
                    onChange={(e) => handleRowChange(row.id, 'fabricType', e.target.value)} placeholder="e.g. Single Jersey" />
                  <Input id={'knitted-yarn-' + row.id} label="Yarn count" list="knitted-yarn-counts" value={row.yarnSpec} required
                    onChange={(e) => handleRowChange(row.id, 'yarnSpec', e.target.value)} placeholder="e.g. 75/72" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input id={'knitted-rolls-' + row.id} label="Rolls received" type="number" min="1" step="1" value={row.rollsCount} required
                    onChange={(e) => handleRowChange(row.id, 'rollsCount', e.target.value)} placeholder="e.g. 10" />
                  <Input id={'knitted-weight-' + row.id} label="Weight received (kg)" type="number" min="0.01" step="0.01" value={row.weightKg} required
                    onChange={(e) => handleRowChange(row.id, 'weightKg', e.target.value)} placeholder="Actual net weight" />
                </div>
                <OptionalDetails title="Item note (optional)">
                  <Input id={'knitted-note-' + row.id} label="Note for this fabric" value={row.remarks} onChange={(e) => handleRowChange(row.id, 'remarks', e.target.value)} />
                </OptionalDetails>
              </EntryCard>
            ))}
            <Button type="button" variant="outline" onClick={handleAddRow}><Plus className="h-4 w-4" /> Add another fabric</Button>
            <p className="text-xs text-zinc-400">Received fabric is recorded as raw fabric in ZR godown.</p>
          </FormSection>
          <OptionalDetails title="Driver and delivery note (optional)">
            <Input id="knitted-driver" label="Driver / vehicle" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            <Input id="knitted-remarks" label="Delivery note" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </OptionalDetails>
          <datalist id="knitted-fabric-types">{COMMON_FABRICS.map((name) => <option key={name} value={name} />)}</datalist>
          <datalist id="knitted-yarn-counts">{availableSpecs.map((name) => <option key={name} value={name} />)}</datalist>
        </fieldset>
      </form>
    </Dialog>
  );
}
