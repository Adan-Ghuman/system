import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { FormSection, OptionalDetails, EntryCard, FormFeedback, FormFooter } from '../../../components/ui/WorkflowForm.js';
import { getLocalDateInput, formatWeight } from '../../../lib/formatters.js';
import { Plus } from 'lucide-react';
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
  const [dateIssued, setDateIssued] = useState(getLocalDateInput());
  const [millName, setMillName] = useState<DyeingMillType>(initialMill);
  const [customMillName, setCustomMillName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Gate Pass Line Items
  const [entries, setEntries] = useState<GatePassEntryItem[]>([
    {
      id: generateRowId(),
      machineNo: '',
      fabricType: '',
      yarnSpec: '',
      targetColor: '',
      width: '',
      gsm: '',
      ecruRollsCount: '',
      ecruWeightKg: '',
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
        ecruRollsCount: '',
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
      id: generateRowId(),
      ecruRollsCount: '',
      ecruWeightKg: ''
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

  function handleRowChange(id: string, field: keyof GatePassEntryItem, value: string) {
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
    <Dialog isOpen={isOpen} onClose={() => { if (!isLoading) onClose(); }} title="Send fabric for dyeing"
      description="Choose the mill, then enter the fabric and colors on this outgoing challan." className="max-w-2xl"
      footer={<FormFooter formId="send-dyeing-form" onClose={onClose} isLoading={isLoading} isSaved={Boolean(success)}
        submitLabel="Save fabric delivery" summary={<><strong className="text-zinc-200">{totals.totalRolls} rolls</strong> · {formatWeight(totals.totalWeightKg)}</>} />}>
      <form id="send-dyeing-form" onSubmit={handleSubmit}>
        <fieldset disabled={isLoading || Boolean(success)} className="space-y-6">
          <FormFeedback error={error} success={success} />
          <FormSection step={1} title="Where is the fabric going?">
            <Select id="send-dyeing-mill" label="Dyeing mill" value={millName}
              onChange={(e) => setMillName(e.target.value as DyeingMillType)}
              options={[...activeMills.map((mill) => ({ label: mill.shortName, value: mill.code })), { label: 'Another mill', value: 'OTHER' }]} />
            {millName === 'OTHER' && <Input id="send-dyeing-custom-mill" label="Mill name" value={customMillName}
              onChange={(e) => setCustomMillName(e.target.value)} required />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="send-dyeing-challan" label="Challan number" value={ogpNo} onChange={(e) => setOgpNo(e.target.value)} placeholder="Outgoing slip number (OGP)" required />
              <Input id="send-dyeing-date" label="Sent date" type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} required />
            </div>
          </FormSection>
          <FormSection step={2} title="What fabric are you sending?" description="One item per fabric and color. You can add several items to the same challan.">
            {entries.map((entry, index) => (
              <EntryCard key={entry.id} title={'Fabric item ' + (index + 1)} onCopy={() => handleDuplicateRow(index)}
                onRemove={() => handleRemoveRow(entry.id)} canRemove={entries.length > 1}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input id={'send-fabric-' + entry.id} label="Fabric type" list="send-fabric-types" value={entry.fabricType}
                    onChange={(e) => handleRowChange(entry.id, 'fabricType', e.target.value)} placeholder="e.g. Interlock" required />
                  <Input id={'send-yarn-' + entry.id} label="Yarn count" list="send-yarn-counts" value={entry.yarnSpec}
                    onChange={(e) => handleRowChange(entry.id, 'yarnSpec', e.target.value)} placeholder="e.g. 75/72 or 75/72 + 150/48" required />
                </div>
                <Input id={'send-color-' + entry.id} label="Color to dye" list="send-dyeing-colors" value={entry.targetColor}
                  onChange={(e) => handleRowChange(entry.id, 'targetColor', e.target.value)} placeholder="e.g. Navy blue" required />
                <div className="grid grid-cols-2 gap-4">
                  <Input id={'send-rolls-' + entry.id} label="Rolls sent" type="number" min="1" step="1" value={entry.ecruRollsCount}
                    onChange={(e) => handleRowChange(entry.id, 'ecruRollsCount', e.target.value)} placeholder="e.g. 10" required />
                  <Input id={'send-weight-' + entry.id} label="Raw weight sent (kg)" type="number" min="0.01" step="0.01" value={entry.ecruWeightKg}
                    onChange={(e) => handleRowChange(entry.id, 'ecruWeightKg', e.target.value)} placeholder="Actual weight before dyeing" required />
                </div>
                <OptionalDetails title="Machine, fabric specifications and buyer (optional)">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input id={'send-machine-' + entry.id} label="Machine number" value={entry.machineNo} onChange={(e) => handleRowChange(entry.id, 'machineNo', e.target.value)} />
                    <Input id={'send-width-' + entry.id} label="Fabric width" value={entry.width || ''} onChange={(e) => handleRowChange(entry.id, 'width', e.target.value)} placeholder='e.g. 60 inches' />
                    <Input id={'send-gsm-' + entry.id} label="GSM (fabric density)" value={entry.gsm || ''} onChange={(e) => handleRowChange(entry.id, 'gsm', e.target.value)} />
                  </div>
                  <Select id={'send-buyer-' + entry.id} label="Fabric reserved for" value={entry.allocatedCustomerId || ''}
                    onChange={(e) => handleRowChange(entry.id, 'allocatedCustomerId', e.target.value)}
                    options={[{ label: 'No buyer assigned', value: '' }, ...buyers.map((buyer) => ({ label: buyer.name, value: buyer._id }))]} />
                  <Input id={'send-note-' + entry.id} label="Note for this fabric" value={entry.remarks || ''} onChange={(e) => handleRowChange(entry.id, 'remarks', e.target.value)} />
                </OptionalDetails>
              </EntryCard>
            ))}
            <Button type="button" variant="outline" onClick={handleAddRow}><Plus className="h-4 w-4" /> Add another fabric</Button>
          </FormSection>
          <OptionalDetails title="Driver, vehicle and delivery note (optional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="send-driver" label="Driver" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
              <Input id="send-vehicle" label="Vehicle number" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            </div>
            <Input id="send-remarks" label="Delivery note" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </OptionalDetails>
          <datalist id="send-fabric-types">{COMMON_FABRIC_TYPES.map((name) => <option key={name} value={name} />)}</datalist>
          <datalist id="send-yarn-counts">{COMMON_YARN_SPECS.map((name) => <option key={name} value={name} />)}</datalist>
          <datalist id="send-dyeing-colors">{COMMON_COLORS.map((name) => <option key={name} value={name} />)}</datalist>
        </fieldset>
      </form>
    </Dialog>
  );
}
