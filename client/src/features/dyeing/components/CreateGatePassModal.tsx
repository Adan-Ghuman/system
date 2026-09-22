import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
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
  Plus,
  Trash2,
  Copy,
  Truck,
  FileSpreadsheet,
  Layers,
  Scale
} from 'lucide-react';
import { DyeingMillType, CreateGatePassPayload, GatePassEntryItem, DyeingUnitItem } from '../types/dyeing.types.js';
import { PartyItem } from '../../parties/types/party.types.js';
import { COMMON_COLORS } from '../../common/constants/colors.js';

export interface CreateGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMill?: DyeingMillType;
}

const COMMON_FABRIC_TYPES = [
  'Single Strips',
  'Single Jersey',
  'Interlock',
  'Interlock Heavy',
  'Interlock Light',
  'Fleece 3-Thread',
  '1 Tak Mesh',
  'Rib 1x1',
  'Rib 2x2',
  'Popcorn Pique',
  'Terry Fleece'
];

const COMMON_YARN_SPECS = [
  '75/72',
  '75/36',
  '100/36',
  '100-75/36',
  '150/48 Rotto',
  '100/144 Micro',
  '150/144 Micro',
  '30/1 Cotton',
  '20/1 Cotton',
  '50D Spandex'
];

function generateRowId() {
  return 'row_' + Math.random().toString(36).substring(2, 9);
}

export function CreateGatePassModal({
  isOpen,
  onClose,
  onSuccess,
  initialMill = 'GHUMMAN_DYEING'
}: CreateGatePassModalProps) {
  // Gate Pass Header Fields
  const [ogpNo, setOgpNo] = useState('');
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0]);
  const [millName, setMillName] = useState<DyeingMillType>(initialMill);
  const [customMillName, setCustomMillName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Gate Pass Line Items
  const [entries, setEntries] = useState<GatePassEntryItem[]>([
    {
      id: generateRowId(),
      machineNo: 'M#13',
      fabricType: 'Single Strips',
      yarnSpec: '75/72',
      targetColor: 'SKIN',
      width: '60"',
      gsm: '140',
      ecruRollsCount: 4,
      ecruWeightKg: 103.80,
      remarks: ''
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMillName(initialMill);
  }, [initialMill]);

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

  // Load Fabric Buyers for customer allocation
  const { data: buyersData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', 'isFabricBuyer'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: 'isFabricBuyer', limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const buyers = buyersData?.items || [];

  // Live Summary Totals
  const totals = useMemo(() => {
    let totalRolls = 0;
    let totalWeightKg = 0;

    entries.forEach((e) => {
      const rolls = parseInt(String(e.ecruRollsCount), 10) || 0;
      const weight = parseFloat(String(e.ecruWeightKg)) || 0;
      totalRolls += rolls;
      totalWeightKg += weight;
    });

    return {
      count: entries.length,
      totalRolls,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100
    };
  }, [entries]);

  function handleAddRow() {
    const lastRow = entries[entries.length - 1];
    setEntries((prev) => [
      ...prev,
      {
        id: generateRowId(),
        machineNo: '',
        fabricType: lastRow ? lastRow.fabricType : 'Single Strips',
        yarnSpec: lastRow ? lastRow.yarnSpec : '75/72',
        targetColor: lastRow ? lastRow.targetColor : 'WHITE',
        width: lastRow ? lastRow.width : '',
        gsm: lastRow ? lastRow.gsm : '',
        ecruRollsCount: 10,
        ecruWeightKg: '',
        allocatedCustomerId: lastRow ? lastRow.allocatedCustomerId : undefined,
        remarks: ''
      }
    ]);
  }

  function handleDuplicateRow(index: number) {
    const target = entries[index];
    if (!target) return;
    const duplicated: GatePassEntryItem = {
      ...target,
      id: generateRowId()
    };
    setEntries((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicated);
      return copy;
    });
  }

  function handleRemoveRow(id: string) {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleRowChange(id: string, field: keyof GatePassEntryItem, value: any) {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!ogpNo.trim()) {
      setError('Please enter the Outward Gate Pass number (OGP #)');
      return;
    }

    if (millName === 'OTHER' && !customMillName.trim()) {
      setError('Please specify the custom dyeing unit name');
      return;
    }

    if (entries.length === 0) {
      setError('Please add at least one line item entry');
      return;
    }

    // Validate entries
    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const rolls = parseInt(String(row.ecruRollsCount), 10);
      const weight = parseFloat(String(row.ecruWeightKg));

      if (!row.fabricType.trim()) {
        setError(`Entry #${i + 1}: Please select or enter a fabric variety`);
        return;
      }
      if (!row.yarnSpec.trim()) {
        setError(`Entry #${i + 1}: Please enter yarn specification (e.g. 75/72)`);
        return;
      }
      if (!row.targetColor.trim()) {
        setError(`Entry #${i + 1}: Please specify target color`);
        return;
      }
      if (isNaN(rolls) || rolls < 1) {
        setError(`Entry #${i + 1}: Roll count must be at least 1`);
        return;
      }
      if (isNaN(weight) || weight <= 0) {
        setError(`Entry #${i + 1}: Weight (kg) must be a positive number`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: CreateGatePassPayload = {
        ogpNo: ogpNo.trim(),
        dateIssued: new Date(dateIssued).toISOString(),
        millName,
        customMillName: millName === 'OTHER' ? customMillName.trim() : undefined,
        driverName: driverName.trim(),
        vehicleNo: vehicleNo.trim(),
        remarks: remarks.trim(),
        entries: entries.map((e) => ({
          machineNo: e.machineNo.trim(),
          fabricType: e.fabricType.trim(),
          yarnSpec: e.yarnSpec.trim(),
          targetColor: e.targetColor.trim().toUpperCase(),
          width: e.width?.trim() || undefined,
          gsm: e.gsm?.trim() || undefined,
          ecruRollsCount: parseInt(String(e.ecruRollsCount), 10),
          ecruWeightKg: parseFloat(String(e.ecruWeightKg)),
          allocatedCustomerId: e.allocatedCustomerId || undefined,
          remarks: e.remarks?.trim() || undefined
        }))
      };

      await api.post('/dyeing/gate-passes', payload);

      setSuccess(`Gate Pass ${ogpNo} saved with ${entries.length} items (${totals.totalRolls} rolls, ${formatWeight(totals.totalWeightKg)}).`);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to save multi-entry gate pass');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create Multi-Entry Gate Pass (OGP)"
      description="Record multi-line knitted fabric delivery slips to dyeing units in a single outward gate pass."
      className="max-w-6xl w-full"
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

        {/* 1. Gate Pass Header Card */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Gate Pass Header Details</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Input
                id="ogpNo"
                label="Gate Pass (OGP) #"
                value={ogpNo}
                onChange={(e) => setOgpNo(e.target.value)}
                placeholder="e.g. 385"
                required
                className="font-mono font-bold text-emerald-400 text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="dateIssued"
                type="date"
                label="Date"
                value={dateIssued}
                onChange={(e) => setDateIssued(e.target.value)}
                required
                className="text-xs h-8"
              />
            </div>

            <div>
              <Select
                id="millName"
                label="Destination Dyeing Mill"
                value={millName}
                onChange={(e) => setMillName(e.target.value as DyeingMillType)}
                options={[
                  ...activeMills.map((u) => ({ label: u.shortName, value: u.code })),
                  { label: 'Other Custom Unit', value: 'OTHER' }
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
                placeholder="e.g. Kashif"
                className="text-xs h-8"
              />
            </div>

            <div>
              <Input
                id="vehicleNo"
                label="Vehicle #"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. Raksha / Truck"
                className="text-xs h-8"
              />
            </div>
          </div>

          {millName === 'OTHER' && (
            <div>
              <Input
                id="customMillName"
                label="Specify Custom Dyeing Unit / Customer"
                value={customMillName}
                onChange={(e) => setCustomMillName(e.target.value)}
                placeholder="e.g. Rozain Textile (ANB Dyg)"
                required
                className="text-xs h-8"
              />
            </div>
          )}
        </div>

        {/* 2. Items Table Card */}
        <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gate Pass Line Items ({entries.length})</span>
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
                  <th className="py-2 px-2 w-24">Machine #</th>
                  <th className="py-2 px-2 w-36">Fabric Variety</th>
                  <th className="py-2 px-2 w-28">Yarn Count</th>
                  <th className="py-2 px-2 w-28">Color</th>
                  <th className="py-2 px-2 w-20">Width</th>
                  <th className="py-2 px-2 w-20">GSM</th>
                  <th className="py-2 px-2 text-right w-20">Rolls</th>
                  <th className="py-2 px-2 text-right w-24">Weight (kg)</th>
                  <th className="py-2 px-2 w-32">Buyer (Opt)</th>
                  <th className="py-2 px-2 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {entries.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-1.5 px-2 text-center font-mono text-zinc-500 font-bold">
                      {idx + 1}
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        type="text"
                        value={row.machineNo}
                        onChange={(e) => handleRowChange(row.id, 'machineNo', e.target.value)}
                        placeholder="e.g. M#13"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        list={`fabric-list-${row.id}`}
                        value={row.fabricType}
                        onChange={(e) => handleRowChange(row.id, 'fabricType', e.target.value)}
                        placeholder="Fabric variety"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-medium"
                      />
                      <datalist id={`fabric-list-${row.id}`}>
                        {COMMON_FABRIC_TYPES.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        list={`yarn-list-${row.id}`}
                        value={row.yarnSpec}
                        onChange={(e) => handleRowChange(row.id, 'yarnSpec', e.target.value)}
                        placeholder="e.g. 75/72"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <datalist id={`yarn-list-${row.id}`}>
                        {COMMON_YARN_SPECS.map((y) => (
                          <option key={y} value={y} />
                        ))}
                      </datalist>
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        list={`color-list-${row.id}`}
                        value={row.targetColor}
                        onChange={(e) => handleRowChange(row.id, 'targetColor', e.target.value.toUpperCase())}
                        placeholder="Color"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 font-bold focus:outline-none focus:border-emerald-500"
                      />
                      <datalist id={`color-list-${row.id}`}>
                        {COMMON_COLORS.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        type="text"
                        value={row.width || ''}
                        onChange={(e) => handleRowChange(row.id, 'width', e.target.value)}
                        placeholder="60&quot;"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-200 text-center font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        type="text"
                        value={row.gsm || ''}
                        onChange={(e) => handleRowChange(row.id, 'gsm', e.target.value)}
                        placeholder="140"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-200 text-center font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        type="number"
                        min="1"
                        value={row.ecruRollsCount}
                        onChange={(e) => handleRowChange(row.id, 'ecruRollsCount', e.target.value)}
                        placeholder="Rolls"
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 text-right font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-1.5 px-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.ecruWeightKg}
                        onChange={(e) => handleRowChange(row.id, 'ecruWeightKg', e.target.value)}
                        placeholder="Weight kg"
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-emerald-400 text-right font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-1.5 px-1">
                      <select
                        value={row.allocatedCustomerId || ''}
                        onChange={(e) => handleRowChange(row.id, 'allocatedCustomerId', e.target.value || undefined)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-emerald-500 truncate"
                      >
                        <option value="">None (Stock)</option>
                        {buyers.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-1.5 px-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(idx)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded"
                          title="Duplicate line item"
                        >
                          <Copy className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          disabled={entries.length <= 1}
                          className={`p-1 rounded ${
                            entries.length <= 1
                              ? 'text-zinc-700 cursor-not-allowed'
                              : 'text-red-400 hover:text-red-300 hover:bg-red-950/40'
                          }`}
                          title="Remove line item"
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

          <div className="flex justify-between items-center pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="text-xs h-7 gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Another Item</span>
            </Button>

            {/* Live Totals Bar */}
            <div className="flex items-center gap-3 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pass Totals:</span>
              </span>

              <span className="text-xs font-mono font-semibold text-zinc-300">
                {totals.count} Item{totals.count > 1 ? 's' : ''}
              </span>

              <span className="text-xs font-mono font-bold text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded">
                {totals.totalRolls} Rolls
              </span>

              <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded">
                {formatWeight(totals.totalWeightKg)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Remarks */}
        <div>
          <Input
            id="gatePassRemarks"
            label="General Gate Pass Remarks (Optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Contract knitting to ANB dyeing for urgent delivery"
            className="text-xs h-8"
          />
        </div>

        {/* 4. Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="text-xs text-zinc-400">
            Verify totals with your physical gate pass slip before saving.
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>

            <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 font-bold">
              {isLoading ? (
                'Saving Gate Pass...'
              ) : (
                <>
                  <Truck className="w-3.5 h-3.5" />
                  <span>Save Gate Pass ({totals.totalRolls}R • {formatWeight(totals.totalWeightKg)})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
