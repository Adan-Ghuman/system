import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Button } from '../../../components/ui/Button.js';
import { PartyCombobox } from '../../../components/ui/PartyCombobox.js';
import {
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Plus,
  Trash2,
  Copy,
  FileSpreadsheet
} from 'lucide-react';
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
    rollsCount: '10',
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
  const [partyId, setPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-row items state
  const [rows, setRows] = useState<KnittedSlipRow[]>([createDefaultRow()]);

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

  // Handle preselected knitter balance if opened from balances table
  useEffect(() => {
    if (preselectedBalance) {
      setPartyId(preselectedBalance.partyId);
      setPartyName(preselectedBalance.partyName);
      if (preselectedBalance.yarnSpec) {
        setRows([
          {
            id: generateRowId(),
            fabricType: 'Single Jersey',
            yarnSpec: preselectedBalance.yarnSpec,
            rollsCount: '10',
            weightKg: '',
            remarks: ''
          }
        ]);
      }
    } else if (knitters.length > 0 && !partyId) {
      setPartyId(knitters[0]._id);
      setPartyName(knitters[0].name);
    }
  }, [preselectedBalance, knitters, partyId]);

  function handleAddRow() {
    const lastRow = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      {
        id: generateRowId(),
        fabricType: lastRow ? lastRow.fabricType : 'Single Jersey',
        yarnSpec: lastRow ? lastRow.yarnSpec : availableSpecs[0] || '75/72',
        rollsCount: '10',
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
      id: generateRowId()
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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Knitted Fabric (Inward Delivery Challan)"
      description="Record multi-roll knitted fabric delivery slips from contract knitters (e.g. Starco Industry) directly into godown stock."
      className="max-w-5xl w-full"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-950/60 border border-red-800 text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-emerald-950/60 border border-emerald-800 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 1. Header Card */}
        <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4" />
            <span>Knitter Delivery Slip Header</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <PartyCombobox
                id="receiveKnitterParty"
                label="Contract Knitter / Sender Mill"
                value={partyId || partyName}
                parties={knitters}
                placeholder="Select knitter or type name (e.g. Starco Industry)..."
                onChange={(val, party) => {
                  setPartyId(val);
                  setPartyName(party ? party.name : val);
                }}
                required
                className="text-xs h-8 font-semibold text-emerald-300"
              />
            </div>

            <div>
              <Input
                id="inwardChallanNo"
                label="Challan / Gate Pass #"
                value={gatePassNo}
                onChange={(e) => setGatePassNo(e.target.value)}
                placeholder="e.g. 919"
                required
                className="font-mono font-bold text-emerald-400 text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="receiveDate"
                type="date"
                label="Receipt Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-zinc-850">
            <Input
              id="knitterDriver"
              label="Driver Name / Vehicle (Optional)"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Faraz / Rickshaw"
              className="text-xs h-8"
            />
            <Input
              id="knitterRemarks"
              label="Challan Remarks (Optional)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Received at ZR Godown"
              className="text-xs h-8"
            />
          </div>
        </div>

        {/* 2. Multi-Row Table */}
        <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Challan Line Items ({rows.length})</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="text-xs h-7 py-0 px-2.5 gap-1 border-dashed border-emerald-600 text-emerald-400 hover:bg-emerald-950/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line Item</span>
            </Button>
          </div>

          <div className="overflow-x-auto border border-zinc-800 rounded-md">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-950/90 text-zinc-400 uppercase font-semibold text-[10px] border-b border-zinc-800">
                <tr>
                  <th className="py-2 px-2 text-center w-8">#</th>
                  <th className="py-2 px-2 w-48">Fabric Variety (کپڑے کی قسم)</th>
                  <th className="py-2 px-2 w-40">Yarn Count (دھاگہ)</th>
                  <th className="py-2 px-2 text-right w-24">Rolls (رول)</th>
                  <th className="py-2 px-2 text-right w-32 text-emerald-400">Net Weight (ویٹ Kg)*</th>
                  <th className="py-2 px-2">Line Remarks</th>
                  <th className="py-2 px-2 text-center w-14">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-1.5 px-2 text-center font-mono text-zinc-500 font-bold">
                      {idx + 1}
                    </td>

                    {/* Fabric Variety */}
                    <td className="py-1.5 px-1">
                      <input
                        type="text"
                        list={`knit_fabrics_${row.id}`}
                        value={row.fabricType}
                        onChange={(e) => handleRowChange(row.id, 'fabricType', e.target.value)}
                        placeholder="e.g. لاٹ سیڈو / Single Jersey"
                        className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-medium focus:border-emerald-500 focus:outline-none"
                      />
                      <datalist id={`knit_fabrics_${row.id}`}>
                        {COMMON_FABRICS.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </td>

                    {/* Yarn Spec */}
                    <td className="py-1.5 px-1">
                      <input
                        type="text"
                        list={`knit_specs_${row.id}`}
                        value={row.yarnSpec}
                        onChange={(e) => handleRowChange(row.id, 'yarnSpec', e.target.value)}
                        placeholder="e.g. 75/36"
                        className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                      <datalist id={`knit_specs_${row.id}`}>
                        {availableSpecs.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </td>

                    {/* Rolls */}
                    <td className="py-1.5 px-1">
                      <input
                        type="number"
                        min="1"
                        value={row.rollsCount}
                        onChange={(e) => handleRowChange(row.id, 'rollsCount', e.target.value)}
                        className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-mono text-right focus:border-emerald-500 focus:outline-none"
                      />
                    </td>

                    {/* Weight (Kg) */}
                    <td className="py-1.5 px-1">
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={row.weightKg}
                        onChange={(e) => handleRowChange(row.id, 'weightKg', e.target.value)}
                        placeholder="249.50"
                        className="w-full px-2 py-1 bg-zinc-950 border border-emerald-600/80 rounded text-xs text-emerald-300 font-mono font-bold text-right focus:border-emerald-500 focus:outline-none"
                      />
                    </td>

                    {/* Remarks */}
                    <td className="py-1.5 px-1">
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => handleRowChange(row.id, 'remarks', e.target.value)}
                        placeholder="e.g. Lot Sedo 75/36"
                        className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
                      />
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-md text-xs font-mono">
            <div className="flex items-center gap-4 text-zinc-400">
              <span>
                Total Lines: <strong className="text-zinc-200">{totals.count}</strong>
              </span>
              <span>
                Total Rolls: <strong className="text-zinc-200">{totals.totalRolls}</strong>
              </span>
            </div>

            <div>
              <span className="text-emerald-400">
                Total Weight:{' '}
                <strong className="text-sm font-bold">{totals.totalWeightKg} kg</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="text-[11px] text-zinc-500">
            Fabric will deposit into RAW_ECRU stock at ZR Godown. Knitter yarn balance will reconcile FIFO if active.
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <span>
                Save Inward Challan ({totals.totalRolls} Rolls - {totals.totalWeightKg} Kg)
              </span>
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
