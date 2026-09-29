import { useState, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import {
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Plus,
  Trash2,
  Copy,
  Search,
  CheckSquare,
  Square,
  FileSpreadsheet
} from 'lucide-react';
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
    fabricType: 'Interlock',
    yarnSpec: '75/72',
    targetColor: 'WHITE',
    gsm: '140',
    width: '60"',
    rolls: '5',
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
  const [entryMode, setEntryMode] = useState<'DIRECT' | 'LINK_BATCHES'>('DIRECT');

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
  const { data: activeBatchesData } = useQuery<{ items: DyeingBatchItem[] }>({
    queryKey: ['active-dyeing-batches-for-receive', millName],
    queryFn: async () => {
      const params: Record<string, string> = { status: 'ACTIVE', limit: '200' };
      if (millName !== 'OTHER') {
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
        rolls: '5',
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
      lotNo: ''
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
        if (field === 'lotNo' && val.trim()) {
          const matched = activeBatches.find(
            (b) => b.batchNo.toLowerCase() === val.trim().toLowerCase()
          );
          if (matched) {
            updated.matchedBatchId = matched._id;
            if (!row.fabricType || row.fabricType === 'Interlock') updated.fabricType = matched.fabricType;
            if (!row.yarnSpec || row.yarnSpec === '75/72') updated.yarnSpec = matched.yarnSpec;
            if (!row.targetColor || row.targetColor === 'WHITE') updated.targetColor = matched.targetColor;
            if (!row.lotWeightKg) updated.lotWeightKg = String(matched.ecruWeightKg);
            if (!row.rolls) updated.rolls = String(matched.ecruRollsCount);
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
        const estimatedFinish = Math.round(b.ecruWeightKg * 0.96 * 100) / 100;
        next[b._id] = {
          finishRolls: String(b.ecruRollsCount),
          finishKg: String(estimatedFinish)
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
          const finishKg = parseFloat(vals.finishKg) || 0;
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

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Dyeing Delivery (Inward Gate Pass / Challan)"
      description="Enter incoming finished dyed fabric delivery slips from dyeing mills (AHB, Ghumman, Rajput) directly into stock."
      className="max-w-6xl w-full"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg flex items-center gap-2 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg flex items-center gap-2 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 1. Inward Slip Header */}
        <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4" />
              <span>Challan / Inward Gate Pass Header</span>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs">
              <button
                type="button"
                onClick={() => setEntryMode('DIRECT')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  entryMode === 'DIRECT'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Direct Challan Entry (Paper Slip)
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('LINK_BATCHES')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  entryMode === 'LINK_BATCHES'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Match Sent Batches ({activeBatches.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Input
                id="igpNo"
                label="Challan / IGP #"
                value={igpNo}
                onChange={(e) => setIgpNo(e.target.value)}
                placeholder="e.g. 4009 or 4012"
                required
                className="font-mono font-bold text-emerald-400 text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="dateReceived"
                type="date"
                label="Challan Date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                required
                className="text-xs h-8"
              />
            </div>

            <div>
              <Select
                id="receiveMill"
                label="Dyeing Mill / Sender"
                value={millName}
                onChange={(e) => setMillName(e.target.value as DyeingMillType)}
                options={[
                  ...activeMills.map((u) => ({ label: u.shortName, value: u.code })),
                  { label: 'Other Custom Dyeing Unit', value: 'OTHER' }
                ]}
                className="text-xs h-8 font-semibold text-emerald-300"
              />
            </div>

            <div>
              <Input
                id="driverName"
                label="Driver / Receiver"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Maqsood (0300...)"
                className="text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="vehicleNo"
                label="Vehicle #"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. LES-1127 / ARL"
                className="text-xs h-8"
              />
            </div>
          </div>

          {millName === 'OTHER' && (
            <div>
              <Input
                id="customMillName"
                label="Specify Custom Dyeing Mill Name"
                value={customMillName}
                onChange={(e) => setCustomMillName(e.target.value)}
                placeholder="e.g. AHB Dyeing / Star Mill"
                required
                className="text-xs h-8"
              />
            </div>
          )}
        </div>

        {/* 2. MODE A: Direct Paper Slip Multi-Row Table */}
        {entryMode === 'DIRECT' && (
          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Challan Line Items ({rows.length})</span>
                <span className="text-zinc-500 font-normal lowercase">
                  — enter all lots from the paper slip
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="text-xs h-7 py-0 px-2.5 gap-1 border-dashed border-emerald-600 text-emerald-400 hover:bg-emerald-950/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lot Row</span>
              </Button>
            </div>

            <div className="overflow-x-auto border border-zinc-800 rounded-md">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-950/90 text-zinc-400 uppercase font-semibold text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2 w-28">Lot # (لاٹ)</th>
                    <th className="py-2 px-2 w-36">Fabric Variety (کپڑا)</th>
                    <th className="py-2 px-2 w-24">Yarn Count</th>
                    <th className="py-2 px-2 w-28">Color (رنگ)</th>
                    <th className="py-2 px-2 w-16">GSM</th>
                    <th className="py-2 px-2 w-16">Width</th>
                    <th className="py-2 px-2 text-right w-16">Rolls</th>
                    <th className="py-2 px-2 text-right w-24">Lot Wt (kg)</th>
                    <th className="py-2 px-2 text-right w-24 text-emerald-400">Finish Wt (kg)*</th>
                    <th className="py-2 px-2 text-center w-28">Shortage / Loss</th>
                    <th className="py-2 px-2 text-center w-14">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {rows.map((row, idx) => {
                    const lotKg = parseFloat(row.lotWeightKg) || 0;
                    const finKg = parseFloat(row.finishWeightKg) || 0;
                    const lossKg = lotKg > 0 && finKg > 0 ? Math.round((lotKg - finKg) * 100) / 100 : 0;
                    const shrinkPercent = lotKg > 0 && finKg > 0 ? Math.round(((lossKg / lotKg) * 100) * 100) / 100 : 0;

                    return (
                      <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-1.5 px-2 text-center font-mono text-zinc-500 font-bold">
                          {idx + 1}
                        </td>

                        {/* Lot # */}
                        <td className="py-1.5 px-1">
                          <input
                            type="text"
                            value={row.lotNo}
                            onChange={(e) => handleRowChange(row.id, 'lotNo', e.target.value)}
                            placeholder="e.g. 2054"
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        {/* Fabric Variety */}
                        <td className="py-1.5 px-1">
                          <input
                            type="text"
                            list={`fabrics_${row.id}`}
                            value={row.fabricType}
                            onChange={(e) => handleRowChange(row.id, 'fabricType', e.target.value)}
                            placeholder="e.g. Interlock"
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none font-medium"
                          />
                          <datalist id={`fabrics_${row.id}`}>
                            {COMMON_FABRIC_TYPES.map((f) => (
                              <option key={f} value={f} />
                            ))}
                          </datalist>
                        </td>

                        {/* Yarn Spec */}
                        <td className="py-1.5 px-1">
                          <input
                            type="text"
                            value={row.yarnSpec}
                            onChange={(e) => handleRowChange(row.id, 'yarnSpec', e.target.value)}
                            placeholder="e.g. 75/72"
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-mono focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        {/* Color */}
                        <td className="py-1.5 px-1">
                          <input
                            type="text"
                            list={`colors_${row.id}`}
                            value={row.targetColor}
                            onChange={(e) => handleRowChange(row.id, 'targetColor', e.target.value)}
                            placeholder="e.g. MAROON"
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 uppercase font-semibold focus:border-emerald-500 focus:outline-none"
                          />
                          <datalist id={`colors_${row.id}`}>
                            {COMMON_COLORS.map((c) => (
                              <option key={c} value={c} />
                            ))}
                            <option value="SULFUR" />
                            <option value="SKIN" />
                            <option value="MAROON" />
                            <option value="SILVER" />
                          </datalist>
                        </td>

                        {/* GSM */}
                        <td className="py-1.5 px-1">
                          <input
                            type="text"
                            value={row.gsm}
                            onChange={(e) => handleRowChange(row.id, 'gsm', e.target.value)}
                            placeholder="140"
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-200 text-center focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        {/* Width */}
                        <td className="py-1.5 px-1">
                          <input
                            type="text"
                            value={row.width}
                            onChange={(e) => handleRowChange(row.id, 'width', e.target.value)}
                            placeholder='60"'
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-200 text-center focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        {/* Rolls */}
                        <td className="py-1.5 px-1">
                          <input
                            type="number"
                            min="1"
                            value={row.rolls}
                            onChange={(e) => handleRowChange(row.id, 'rolls', e.target.value)}
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-mono text-right focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        {/* Lot Wt */}
                        <td className="py-1.5 px-1">
                          <input
                            type="number"
                            step="0.01"
                            value={row.lotWeightKg}
                            onChange={(e) => handleRowChange(row.id, 'lotWeightKg', e.target.value)}
                            placeholder="192.00"
                            className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 font-mono text-right focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        {/* Finish Wt */}
                        <td className="py-1.5 px-1">
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={row.finishWeightKg}
                            onChange={(e) => handleRowChange(row.id, 'finishWeightKg', e.target.value)}
                            placeholder="190.70"
                            className={`w-full px-2 py-1 bg-zinc-950 border rounded text-xs font-mono font-bold text-right focus:outline-none ${
                              lotKg > 0 && finKg > lotKg
                                ? 'border-red-500 bg-red-950/40 text-red-300 focus:border-red-400'
                                : 'border-emerald-600/80 text-emerald-300 focus:border-emerald-500'
                            }`}
                          />
                        </td>

                        {/* Shortage */}
                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                          {lotKg > 0 && finKg > 0 ? (
                            finKg > lotKg ? (
                              <span className="text-[10px] font-bold text-red-400 font-mono px-1.5 py-0.5 bg-red-950/70 border border-red-800 rounded inline-block animate-pulse">
                                Exceeds Lot Wt (+{(finKg - lotKg).toFixed(2)} kg)
                              </span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className={`font-mono text-[11px] font-bold ${shrinkPercent > 5 ? 'text-amber-400' : 'text-zinc-300'}`}>
                                  {lossKg > 0 ? `-${lossKg.toFixed(2)} kg` : `${lossKg.toFixed(2)} kg`}
                                </span>
                                <span className={`text-[9px] ${shrinkPercent > 5 ? 'text-amber-400 font-bold' : 'text-zinc-500'}`}>
                                  ({shrinkPercent.toFixed(1)}%)
                                </span>
                              </div>
                            )
                          ) : (
                            <span className="text-zinc-600 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(idx)}
                              title="Duplicate row"
                              className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              disabled={rows.length <= 1}
                              title="Delete row"
                              className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Direct Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-md text-xs font-mono">
              <div className="flex items-center gap-4 text-zinc-400">
                <span>
                  Total Lots: <strong className="text-zinc-200">{directSummary.itemsCount}</strong>
                </span>
                <span>
                  Total Rolls: <strong className="text-zinc-200">{directSummary.totalRolls}</strong>
                </span>
                {directSummary.totalLotKg > 0 && (
                  <span>
                    Lot Wt: <strong className="text-zinc-200">{directSummary.totalLotKg} kg</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-emerald-400">
                  Total Finish Wt:{' '}
                  <strong className="text-sm font-bold">{directSummary.totalFinishKg} kg</strong>
                </span>
                {directSummary.totalLotKg > 0 && (
                  <span className={directSummary.avgShrinkage > 5 ? 'text-amber-400 font-bold' : 'text-zinc-400'}>
                    Weight Loss: {directSummary.totalLossKg} kg ({directSummary.avgShrinkage}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. MODE B: Link From Sent Batches Table with Search */}
        {entryMode === 'LINK_BATCHES' && (
          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Type Lot #, Batch #, Fabric Variety, Color, or Weight to find instantly..."
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="text-xs text-zinc-400 whitespace-nowrap">
                Selected: <strong className="text-emerald-400">{Object.keys(selectedBatchIds).length}</strong> of {activeBatches.length} active
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-800 rounded-md max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] sticky top-0 border-b border-zinc-800">
                  <tr>
                    <th className="py-2 px-2 text-center w-10">Select</th>
                    <th className="py-2 px-2 w-28">Batch #</th>
                    <th className="py-2 px-2 w-24">OGP #</th>
                    <th className="py-2 px-2">Fabric Variety</th>
                    <th className="py-2 px-2 w-24">Color</th>
                    <th className="py-2 px-2 text-right w-24">Sent Wt</th>
                    <th className="py-2 px-2 w-24 text-right">Finish Rolls</th>
                    <th className="py-2 px-2 w-28 text-right">Finish Wt (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredActiveBatches.length > 0 ? (
                    filteredActiveBatches.map((b) => {
                      const isSelected = !!selectedBatchIds[b._id];
                      const vals = selectedBatchIds[b._id] || {
                        finishRolls: String(b.ecruRollsCount),
                        finishKg: String(Math.round(b.ecruWeightKg * 0.96 * 100) / 100)
                      };

                      return (
                        <tr
                          key={b._id}
                          className={`transition-colors ${isSelected ? 'bg-emerald-950/30' : 'hover:bg-zinc-800/40'}`}
                        >
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleBatch(b)}
                              className="text-zinc-400 hover:text-emerald-400"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-zinc-600" />
                              )}
                            </button>
                          </td>
                          <td className="py-2 px-2 font-mono font-bold text-emerald-400">
                            {b.batchNo}
                          </td>
                          <td className="py-2 px-2 font-mono text-zinc-400">
                            {b.ogpNo || '—'}
                          </td>
                          <td className="py-2 px-2 text-zinc-200">
                            {b.fabricType}{' '}
                            <span className="text-[10px] text-zinc-500 font-mono">({b.yarnSpec})</span>
                          </td>
                          <td className="py-2 px-2 font-semibold text-zinc-300">
                            {b.targetColor}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-zinc-300">
                            {b.ecruWeightKg} kg
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="1"
                              disabled={!isSelected}
                              value={vals.finishRolls}
                              onChange={(e) =>
                                setSelectedBatchIds((prev) => ({
                                  ...prev,
                                  [b._id]: { ...vals, finishRolls: e.target.value }
                                }))
                              }
                              className="w-16 px-1.5 py-0.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-right font-mono disabled:opacity-40"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            {(() => {
                              const finVal = parseFloat(vals.finishKg) || 0;
                              const isOver = isSelected && b.ecruWeightKg > 0 && finVal > b.ecruWeightKg;
                              return (
                                <div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={!isSelected}
                                    value={vals.finishKg}
                                    onChange={(e) =>
                                      setSelectedBatchIds((prev) => ({
                                        ...prev,
                                        [b._id]: { ...vals, finishKg: e.target.value }
                                      }))
                                    }
                                    className={`w-20 px-1.5 py-0.5 bg-zinc-950 border rounded text-xs text-right font-mono font-bold disabled:opacity-40 ${
                                      isOver
                                        ? 'border-red-500 bg-red-950/40 text-red-300 focus:border-red-400'
                                        : 'border-emerald-600 text-emerald-300 focus:border-emerald-500'
                                    }`}
                                  />
                                  {isOver && (
                                    <div className="text-[9px] text-red-400 font-bold whitespace-nowrap mt-0.5">
                                      Exceeds lot ({b.ecruWeightKg} kg)
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-500 text-xs">
                        No matching active batches found. Use{' '}
                        <button
                          type="button"
                          onClick={() => setEntryMode('DIRECT')}
                          className="text-emerald-400 underline font-semibold"
                        >
                          Direct Challan Entry
                        </button>{' '}
                        to type the slip directly.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Inward Remarks */}
        <div>
          <Input
            id="inwardRemarks"
            label="Inward Remarks (Optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Checked by Tariq at godown, quality ok"
            className="text-xs h-8"
          />
        </div>

        {/* Weight Violation Banner */}
        {((entryMode === 'DIRECT' && directSummary.hasWeightViolation) ||
          (entryMode === 'LINK_BATCHES' && hasModeBViolation)) && (
          <div className="p-3 bg-red-950/80 border border-red-800 rounded-md flex items-center gap-2.5 text-red-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>
              Finish weight cannot be more than lot weight. Please correct the highlighted entries before saving.
            </span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="text-[11px] text-zinc-500">
            Finished fabric rolls will automatically deposit into finished stock inventory.
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                isLoading ||
                (entryMode === 'DIRECT' && directSummary.hasWeightViolation) ||
                (entryMode === 'LINK_BATCHES' && hasModeBViolation)
              }
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <span>
                {entryMode === 'DIRECT'
                  ? `Save Inward Challan (${directSummary.itemsCount} Lots - ${directSummary.totalFinishKg} Kg)`
                  : `Receive ${Object.keys(selectedBatchIds).length} Selected Batches`}
              </span>
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
