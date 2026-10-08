import { useState, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { FormSection, OptionalDetails, EntryCard, FormFeedback, FormFooter } from '../../../components/ui/WorkflowForm.js';
import { Button } from '../../../components/ui/Button.js';
import { Plus } from 'lucide-react';
import {
  DyeingBatchItem,
  DyeingMillType,
  ReceiveGatePassPayload,
  DyeingUnitItem
} from '../types/dyeing.types.js';
import { COMMON_COLORS } from '../../common/constants/colors.js';

export interface ReceiveGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMill?: DyeingMillType;
}

export interface DirectChallanRow {
  id: string;
  lotNo: string;
  fabricType: string;
  yarnSpec: string;
  targetColor: string;
  gsm: string;
  width: string;
  rolls: string;
  lotWeightKg: string;
  finishWeightKg: string;
  remarks: string;
  matchedBatchId?: string;
}

const COMMON_FABRIC_TYPES = [
  'Interlock',
  'Interlock Heavy',
  'Interlock Light',
  '3 Tak Mesh',
  '1 Tak Mesh',
  'Single Jersey',
  'Single Strips',
  'Fleece 3-Thread',
  'Double Parda',
  'Rib 1x1',
  'Rib 2x2',
  'Popcorn Pique',
  'Terry Fleece'
];

function generateRowId(): string {
  return 'row_' + Math.random().toString(36).substring(2, 9);
}

function createDefaultRow(): DirectChallanRow {
  return {
    id: generateRowId(),
    lotNo: '',
    fabricType: '',
    yarnSpec: '',
    targetColor: '',
    gsm: '',
    width: '',
    rolls: '',
    lotWeightKg: '',
    finishWeightKg: '',
    remarks: ''
  };
}

export function ReceiveGatePassModal({
  isOpen,
  onClose,
  onSuccess,
  initialMill = 'HB_DYEING'
}: ReceiveGatePassModalProps) {
  // Mode toggle: 'DIRECT' (Mirror Paper Challan) vs 'LINK_BATCHES' (Select from Sent Batches)
  const [entryMode, setEntryMode] = useState<'DIRECT' | 'LINK_BATCHES'>('LINK_BATCHES');

  // Header Details
  const [igpNo, setIgpNo] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [millName, setMillName] = useState<DyeingMillType>(initialMill || 'HB_DYEING');
  const [customMillName, setCustomMillName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Mode A: Direct Multi-Row Challan Rows
  const [rows, setRows] = useState<DirectChallanRow[]>([createDefaultRow()]);

  // Mode B: Link Existing Batches Search & Selected States
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<Record<string, { finishRolls: string; finishKg: string }>>({});

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
      { code: 'HB_DYEING', shortName: 'HB Dyeing (AHB)' },
      { code: 'GHUMMAN_DYEING', shortName: 'Ghumman Dyeing' },
      { code: 'RAJPUT_DYEING', shortName: 'Rajput Dyeing' },
      { code: 'HAFIZ_SAAD_DYEING', shortName: 'Hafiz Saad Dyeing' }
    ] as DyeingUnitItem[];
  }, [unitsData]);

  // Load Active Batches for auto-matching or tab 2
  const { data: activeBatchesData, isLoading: isBatchesLoading, isError: isBatchesError, refetch: refetchBatches } = useQuery<{ items: DyeingBatchItem[] }>({
    queryKey: ['active-dyeing-batches-for-receive', millName],
    queryFn: async () => {
      const params: Record<string, string> = { status: 'ACTIVE', limit: '200' };
      if (millName !== 'OTHER') {
        params.millName = millName;
      }
      const items: DyeingBatchItem[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await api.get<{
          success: boolean;
          data: { items: DyeingBatchItem[]; totalPages: number };
        }>('/dyeing/batches', { params: { ...params, limit: 100, page } });
        items.push(...res.data.data.items);
        totalPages = res.data.data.totalPages || 1;
        page++;
      } while (page <= totalPages);
      return { items };
    },
    enabled: isOpen
  });

  const activeBatches = activeBatchesData?.items || [];

  // Filtered batches for Mode B
  const filteredActiveBatches = useMemo(() => {
    if (!batchSearch.trim()) return activeBatches;
    const q = batchSearch.toLowerCase().trim();
    return activeBatches.filter(
      (b) =>
        b.batchNo.toLowerCase().includes(q) ||
        b.fabricType.toLowerCase().includes(q) ||
        b.targetColor.toLowerCase().includes(q) ||
        (b.ogpNo && b.ogpNo.toLowerCase().includes(q)) ||
        String(b.ecruWeightKg).includes(q)
    );
  }, [activeBatches, batchSearch]);

  // Add / Duplicate / Remove direct rows
  function handleAddRow() {
    const lastRow = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      {
        id: generateRowId(),
        lotNo: '',
        fabricType: lastRow ? lastRow.fabricType : 'Interlock',
        yarnSpec: lastRow ? lastRow.yarnSpec : '75/72',
        targetColor: lastRow ? lastRow.targetColor : 'WHITE',
        gsm: lastRow ? lastRow.gsm : '140',
        width: lastRow ? lastRow.width : '60"',
        rolls: '',
        lotWeightKg: '',
        finishWeightKg: '',
        remarks: ''
      }
    ]);
  }

  function handleDuplicateRow(index: number) {
    const source = rows[index];
    if (!source) return;
    const dup: DirectChallanRow = {
      ...source,
      id: generateRowId(),
      lotNo: '',
      rolls: '',
      lotWeightKg: '',
      finishWeightKg: '',
      matchedBatchId: undefined
    };
    setRows((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, dup);
      return copy;
    });
  }

  function handleRemoveRow(id: string) {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleRowChange(id: string, field: keyof DirectChallanRow, val: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };

        // Auto-match open batch when user types Lot #
        if (field === 'lotNo') {
          const matched = activeBatches.find((batch) => batch.batchNo.toLowerCase() === val.trim().toLowerCase());
          updated.matchedBatchId = matched?._id;
          if (matched) {
            updated.fabricType = matched.fabricType;
            updated.yarnSpec = matched.yarnSpec;
            updated.targetColor = matched.targetColor;
            updated.lotWeightKg = String(matched.ecruWeightKg);
            updated.rolls = String(matched.ecruRollsCount);
            if (row.matchedBatchId && row.matchedBatchId !== matched._id) updated.finishWeightKg = '';
          } else if (row.matchedBatchId) {
            updated.fabricType = '';
            updated.yarnSpec = '';
            updated.targetColor = '';
            updated.lotWeightKg = '';
            updated.rolls = '';
            updated.finishWeightKg = '';
          }
        }
        return updated;
      })
    );
  }

  // Calculate Live Direct Summary
  const directSummary = useMemo(() => {
    let totalRolls = 0;
    let totalLotKg = 0;
    let totalFinishKg = 0;

    rows.forEach((r) => {
      const rolls = parseInt(r.rolls, 10) || 0;
      const lotKg = parseFloat(r.lotWeightKg) || 0;
      const finishKg = parseFloat(r.finishWeightKg) || 0;
      totalRolls += rolls;
      totalLotKg += lotKg;
      totalFinishKg += finishKg;
    });

    const totalLossKg = Math.round((totalLotKg - totalFinishKg) * 100) / 100;
    const avgShrinkage = totalLotKg > 0 ? Math.round(((totalLossKg / totalLotKg) * 100) * 100) / 100 : 0;

    const hasWeightViolation = rows.some((r) => {
      const lotKg = parseFloat(r.lotWeightKg);
      const finKg = parseFloat(r.finishWeightKg);
      return !isNaN(lotKg) && lotKg > 0 && !isNaN(finKg) && finKg > lotKg;
    });

    return {
      itemsCount: rows.length,
      totalRolls,
      totalLotKg: Math.round(totalLotKg * 100) / 100,
      totalFinishKg: Math.round(totalFinishKg * 100) / 100,
      totalLossKg,
      avgShrinkage,
      hasWeightViolation
    };
  }, [rows]);

  // Mode B weight check
  const hasModeBViolation = useMemo(() => {
    return Object.entries(selectedBatchIds).some(([bId, vals]) => {
      const matched = activeBatches.find((b) => b._id === bId);
      const finishKg = parseFloat(vals.finishKg) || 0;
      return matched && matched.ecruWeightKg > 0 && finishKg > matched.ecruWeightKg;
    });
  }, [selectedBatchIds, activeBatches]);

  // Handle Mode B batch selection
  function handleToggleBatch(b: DyeingBatchItem) {
    setSelectedBatchIds((prev) => {
      const next = { ...prev };
      if (next[b._id]) {
        delete next[b._id];
      } else {
        next[b._id] = {
          finishRolls: String(b.ecruRollsCount),
          finishKg: ''
        };
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!igpNo.trim()) {
      setError('Please enter Inward Gate Pass (IGP) # or Receiving Challan # from the paper slip');
      return;
    }

    if (millName === 'OTHER' && !customMillName.trim()) {
      setError('Please enter the mill name.');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      let payload: ReceiveGatePassPayload;

      if (entryMode === 'DIRECT') {
        // Validate rows
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const finishKg = parseFloat(r.finishWeightKg);
          const lotKg = parseFloat(r.lotWeightKg);
          const rolls = parseInt(r.rolls, 10);
          if (!r.fabricType.trim()) {
            throw new Error(`Row #${i + 1}: Please select or enter a fabric variety`);
          }
          if (isNaN(finishKg) || finishKg <= 0) {
            throw new Error(`Row #${i + 1}: Ready / Finish Weight must be a positive number`);
          }
          if (!isNaN(lotKg) && lotKg > 0 && finishKg > lotKg) {
            throw new Error(
              `Row #${i + 1} (Lot ${r.lotNo || i + 1}): Finish weight (${finishKg} kg) cannot be more than lot weight (${lotKg} kg)`
            );
          }
          if (isNaN(rolls) || rolls < 1) {
            throw new Error(`Row #${i + 1}: Roll count must be at least 1`);
          }
        }

        payload = {
          igpNo: igpNo.trim(),
          dateReceived: new Date(dateReceived).toISOString(),
          millName,
          customMillName: millName === 'OTHER' ? customMillName.trim() : undefined,
          driverName: driverName.trim(),
          vehicleNo: vehicleNo.trim(),
          remarks: remarks.trim(),
          items: rows.map((r) => {
            const lotKg = parseFloat(r.lotWeightKg);
            const finishKg = parseFloat(r.finishWeightKg);
            return {
              batchId: r.matchedBatchId || undefined,
              lotNo: r.lotNo.trim() || undefined,
              fabricType: r.fabricType.trim(),
              yarnSpec: r.yarnSpec.trim(),
              targetColor: r.targetColor.trim().toUpperCase(),
              gsm: r.gsm.trim() || undefined,
              width: r.width.trim() || undefined,
              ecruRollsCount: parseInt(r.rolls, 10),
              ecruWeightKg: !isNaN(lotKg) && lotKg > 0 ? lotKg : finishKg,
              finishRollsCount: parseInt(r.rolls, 10),
              finishWeightKg: finishKg,
              remarks: r.remarks.trim() || undefined
            };
          })
        };
      } else {
        // Mode B: Link batches
        const selectedEntries = Object.entries(selectedBatchIds);
        if (selectedEntries.length === 0) {
          throw new Error('Please select at least one batch from the list');
        }

        // Validate Mode B weights
        for (const [bId, vals] of selectedEntries) {
          const matched = activeBatches.find((b) => b._id === bId);
          const finishKg = Number(vals.finishKg);
          const finishRolls = Number(vals.finishRolls);
          if (!matched) throw new Error('A selected batch is no longer available. Refresh the batch list.');
          if (!Number.isFinite(finishKg) || finishKg <= 0 || !Number.isInteger(finishRolls) || finishRolls < 1) {
            throw new Error('Enter the actual rolls and weight received for batch ' + matched.batchNo + '.');
          }
          if (matched && matched.ecruWeightKg > 0 && finishKg > matched.ecruWeightKg) {
            throw new Error(
              `Batch ${matched.batchNo}: Finish weight (${finishKg} kg) cannot be more than lot weight (${matched.ecruWeightKg} kg)`
            );
          }
        }

        payload = {
          igpNo: igpNo.trim(),
          dateReceived: new Date(dateReceived).toISOString(),
          millName,
          customMillName: millName === 'OTHER' ? customMillName.trim() : undefined,
          driverName: driverName.trim(),
          vehicleNo: vehicleNo.trim(),
          remarks: remarks.trim(),
          items: selectedEntries.map(([bId, vals]) => ({
            batchId: bId,
            finishRollsCount: parseInt(vals.finishRolls, 10) || 1,
            finishWeightKg: parseFloat(vals.finishKg) || 0
          }))
        };
      }

      await api.post('/dyeing/gate-passes/receive', payload);

      setSuccess(`Inward Challan ${igpNo} successfully recorded. Finished dyed stock credited.`);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to save inward delivery slip');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  const linkedTotals = Object.values(selectedBatchIds).reduce(
    (total, value) => ({ rolls: total.rolls + (parseInt(value.finishRolls, 10) || 0), weight: total.weight + (parseFloat(value.finishKg) || 0) }),
    { rolls: 0, weight: 0 }
  );
  const hasWeightViolation = entryMode === 'DIRECT' ? directSummary.hasWeightViolation : hasModeBViolation;

  function changeMill(value: string) {
    setMillName(value as DyeingMillType);
    setSelectedBatchIds({});
    setBatchSearch('');
    setRows((current) => current.map((row) => ({ ...row, matchedBatchId: undefined })));
  }

  return (
    <Dialog isOpen={isOpen} onClose={() => { if (!isLoading) onClose(); }} title="Receive dyed fabric"
      description="Choose the mill and enter the actual finished fabric received." className="max-w-2xl"
      footer={<FormFooter formId="receive-dyeing-form" onClose={onClose} isLoading={isLoading} isSaved={Boolean(success)}
        disabled={hasWeightViolation || (entryMode === 'LINK_BATCHES' && (isBatchesLoading || isBatchesError))}
        submitLabel="Save dyed fabric receipt"
        summary={<><strong className="text-zinc-200">{entryMode === 'DIRECT' ? directSummary.totalRolls : linkedTotals.rolls} rolls</strong> · {(entryMode === 'DIRECT' ? directSummary.totalFinishKg : linkedTotals.weight).toFixed(2)} kg</>} />}>
      <form id="receive-dyeing-form" onSubmit={handleSubmit}>
        <fieldset disabled={isLoading || Boolean(success)} className="space-y-6">
          <FormFeedback error={error} success={success} />
          <FormSection step={1} title="Which mill sent the fabric?">
            <Select id="receive-dyeing-mill" label="Dyeing mill" value={millName} onChange={(e) => changeMill(e.target.value)}
              options={[...activeMills.map((mill) => ({ label: mill.shortName, value: mill.code })), { label: 'Another mill', value: 'OTHER' }]} />
            {millName === 'OTHER' && <Input id="receive-custom-mill" label="Mill name" value={customMillName} onChange={(e) => setCustomMillName(e.target.value)} required />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="receive-dyeing-challan" label="Challan number" value={igpNo} onChange={(e) => setIgpNo(e.target.value)} placeholder="Incoming slip number (IGP)" required />
              <Input id="receive-dyeing-date" label="Received date" type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} required />
            </div>
          </FormSection>
          <FormSection step={2} title="Which fabric are you receiving?">
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" aria-pressed={entryMode === 'LINK_BATCHES'} onClick={() => setEntryMode('LINK_BATCHES')}
                className={'rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + (entryMode === 'LINK_BATCHES' ? 'border-emerald-500/60 bg-emerald-950/30' : 'border-zinc-700 bg-zinc-950/40')}>
                <span className="block text-sm font-medium text-zinc-100">From sent batches</span>
                <span className="mt-1 block text-xs text-zinc-400">Select fabric already recorded as sent to this mill.</span>
              </button>
              <button type="button" aria-pressed={entryMode === 'DIRECT'} onClick={() => setEntryMode('DIRECT')}
                className={'rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + (entryMode === 'DIRECT' ? 'border-emerald-500/60 bg-emerald-950/30' : 'border-zinc-700 bg-zinc-950/40')}>
                <span className="block text-sm font-medium text-zinc-100">From a paper challan</span>
                <span className="mt-1 block text-xs text-zinc-400">Enter a delivery that has no sent batch in the system.</span>
              </button>
            </div>
            {entryMode === 'LINK_BATCHES' ? (
              <div className="space-y-3">
                <Input id="receive-batch-search" label="Find a sent batch" value={batchSearch} onChange={(e) => setBatchSearch(e.target.value)} placeholder="Batch number, challan, fabric or color" />
                <p className="text-xs text-zinc-400">{Object.keys(selectedBatchIds).length} batches selected</p>
                {isBatchesLoading ? <p role="status" className="py-5 text-sm text-zinc-400">Loading sent batches...</p> : isBatchesError ? (
                  <div role="alert" className="space-y-2 rounded-lg border border-red-900/50 p-3 text-sm text-red-300">
                    <p>Sent batches could not be loaded.</p><Button type="button" variant="outline" onClick={() => refetchBatches()}>Try again</Button>
                  </div>
                ) : filteredActiveBatches.length === 0 ? (
                  <div className="space-y-2 rounded-lg border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
                    <p>{batchSearch ? 'No sent batches match this search.' : 'No fabric is awaiting receipt at this mill.'}</p>
                    <Button type="button" variant="outline" onClick={() => setEntryMode('DIRECT')}>Enter a paper challan instead</Button>
                  </div>
                ) : filteredActiveBatches.map((batch) => {
                  const selected = selectedBatchIds[batch._id];
                  const overWeight = selected && Number(selected.finishKg) > batch.ecruWeightKg;
                  return (
                    <div key={batch._id} className={'rounded-xl border p-4 ' + (selected ? 'border-emerald-800 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-950/40')}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={Boolean(selected)} onChange={() => handleToggleBatch(batch)}
                          aria-label={'Receive batch ' + batch.batchNo} className="mt-1 h-4 w-4 shrink-0 accent-emerald-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-zinc-100">{batch.batchNo} · {batch.fabricType}</span>
                          <span className="mt-1 block text-xs text-zinc-400">{batch.yarnSpec} · {batch.targetColor}{batch.ogpNo ? ' · Challan ' + batch.ogpNo : ''}</span>
                          <span className="mt-2 block text-xs text-zinc-300">Sent: {batch.ecruRollsCount} rolls · {batch.ecruWeightKg.toFixed(2)} kg</span>
                        </span>
                      </label>
                      {selected && (
                        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-emerald-900/40 pt-4">
                          <Input id={'receive-batch-rolls-' + batch._id} label="Rolls received" type="number" min="1" step="1" value={selected.finishRolls} required
                            onChange={(e) => setSelectedBatchIds((current) => ({ ...current, [batch._id]: { ...selected, finishRolls: e.target.value } }))} />
                          <Input id={'receive-batch-weight-' + batch._id} label="Weight received (kg)" type="number" min="0.01" max={batch.ecruWeightKg || undefined} step="0.01" value={selected.finishKg} required
                            placeholder="Actual finished weight" error={overWeight ? 'Cannot exceed the sent weight.' : undefined}
                            onChange={(e) => setSelectedBatchIds((current) => ({ ...current, [batch._id]: { ...selected, finishKg: e.target.value } }))} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row, index) => {
                  const sentKg = Number(row.lotWeightKg) || 0;
                  const receivedKg = Number(row.finishWeightKg) || 0;
                  const overWeight = sentKg > 0 && receivedKg > sentKg;
                  return (
                    <EntryCard key={row.id} title={'Fabric item ' + (index + 1)} onCopy={() => handleDuplicateRow(index)}
                      onRemove={() => handleRemoveRow(row.id)} canRemove={rows.length > 1}>
                      <Input id={'receive-lot-' + row.id} label="Lot / batch number (if on slip)" value={row.lotNo}
                        onChange={(e) => handleRowChange(row.id, 'lotNo', e.target.value)} placeholder="Matches an existing sent batch when found" />
                      {row.matchedBatchId && <p role="status" className="text-xs text-emerald-400">Matched a sent batch. Its fabric details and sent weight are filled below.</p>}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input id={'receive-fabric-' + row.id} label="Fabric type" list="receive-fabric-types" value={row.fabricType} readOnly={Boolean(row.matchedBatchId)}
                          onChange={(e) => handleRowChange(row.id, 'fabricType', e.target.value)} placeholder="e.g. Interlock" required />
                        <Input id={'receive-yarn-' + row.id} label="Yarn count" value={row.yarnSpec} readOnly={Boolean(row.matchedBatchId)}
                          onChange={(e) => handleRowChange(row.id, 'yarnSpec', e.target.value)} placeholder="e.g. 75/72" required />
                      </div>
                      <Input id={'receive-color-' + row.id} label="Received color" list="receive-dyeing-colors" value={row.targetColor} readOnly={Boolean(row.matchedBatchId)}
                        onChange={(e) => handleRowChange(row.id, 'targetColor', e.target.value)} placeholder="e.g. Navy blue" required />
                      <div className="grid grid-cols-2 gap-4">
                        <Input id={'receive-rolls-' + row.id} label="Rolls received" type="number" min="1" step="1" value={row.rolls} required
                          onChange={(e) => handleRowChange(row.id, 'rolls', e.target.value)} placeholder="e.g. 10" />
                        <Input id={'receive-weight-' + row.id} label="Weight received (kg)" type="number" min="0.01" step="0.01" value={row.finishWeightKg} required
                          onChange={(e) => handleRowChange(row.id, 'finishWeightKg', e.target.value)} placeholder="Actual finished weight"
                          error={overWeight ? 'Cannot exceed the sent weight.' : undefined} />
                      </div>
                      <Input id={'receive-sent-' + row.id} label="Raw weight sent (kg, if known)" type="number" min="0.01" step="0.01" value={row.lotWeightKg} readOnly={Boolean(row.matchedBatchId)}
                        onChange={(e) => handleRowChange(row.id, 'lotWeightKg', e.target.value)} placeholder="Used to calculate weight loss" />
                      {sentKg > 0 && receivedKg > 0 && !overWeight && <p className="text-xs text-zinc-400">Weight loss: <strong className="text-zinc-200">{(sentKg - receivedKg).toFixed(2)} kg ({((sentKg - receivedKg) / sentKg * 100).toFixed(1)}%)</strong></p>}
                      <OptionalDetails title="Fabric specifications and note (optional)">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input id={'receive-gsm-' + row.id} label="GSM (fabric density)" value={row.gsm} onChange={(e) => handleRowChange(row.id, 'gsm', e.target.value)} />
                          <Input id={'receive-width-' + row.id} label="Fabric width" value={row.width} onChange={(e) => handleRowChange(row.id, 'width', e.target.value)} />
                        </div>
                        <Input id={'receive-note-' + row.id} label="Note for this fabric" value={row.remarks} onChange={(e) => handleRowChange(row.id, 'remarks', e.target.value)} />
                      </OptionalDetails>
                    </EntryCard>
                  );
                })}
                <Button type="button" variant="outline" onClick={handleAddRow}><Plus className="h-4 w-4" /> Add another fabric</Button>
              </div>
            )}
          </FormSection>
          {hasWeightViolation && <p role="alert" className="text-sm text-red-300">Correct the received weight before saving. It cannot be greater than the raw weight sent.</p>}
          <OptionalDetails title="Driver, vehicle and delivery note (optional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="receive-driver" label="Driver" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
              <Input id="receive-vehicle" label="Vehicle number" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            </div>
            <Input id="receive-remarks" label="Delivery note" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </OptionalDetails>
          <datalist id="receive-fabric-types">{COMMON_FABRIC_TYPES.map((name) => <option key={name} value={name} />)}</datalist>
          <datalist id="receive-dyeing-colors">{COMMON_COLORS.map((name) => <option key={name} value={name} />)}</datalist>
        </fieldset>
      </form>
    </Dialog>
  );
}
