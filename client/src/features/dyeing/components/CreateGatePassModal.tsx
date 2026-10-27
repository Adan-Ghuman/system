import { ownerOptions, canonicalOwnerKey } from '../../../business/ownership.js';
import { CatalogField } from '../../../components/ui/CatalogField.js';
import { DocumentReferences, useDocumentReferences } from '../../../components/ui/DocumentReferences.js';
import { loadAllRecords } from '../../../lib/pagedResources.js';
import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { StockChoice } from '../../../components/ui/StockChoice.js';
import { QueryError } from '../../../components/ui/QueryError.js';
import { EditStockModal } from '../../inventory/components/EditStockModal.js';
import { FabricInventoryItem } from '../../inventory/types/inventory.types.js';
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
  const [ownerKey, setOwnerKey] = useState('OWN');
  const client = useQueryClient();
  const rawStock = useQuery({ queryKey: ['dyeing-raw-stock'], queryFn: () => loadAllRecords<FabricInventoryItem>('/inventory/items', { location: 'ZR_GODOWN', state: 'RAW_ECRU' }), enabled: isOpen });
  const [correcting, setCorrecting] = useState<FabricInventoryItem | null>(null);
  const owners = useQuery({ queryKey: ['party-options', 'all'], queryFn: () => loadAllRecords<PartyItem>('/parties') });
  const [references, setReferences] = useDocumentReferences();
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
    queryKey: ['party-options', 'isFabricBuyer'],
    queryFn: async () => {
      return loadAllRecords<PartyItem>('/parties', { tag: 'isFabricBuyer' });
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
    setEntries((prev) => [
      ...prev,
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
        allocatedCustomerId: undefined,
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

  const selectedOwner = canonicalOwnerKey(ownerKey, owners.data?.items || []);
  const available = (rawStock.data?.items || []).filter(item => canonicalOwnerKey(item.ownerKey, owners.data?.items || []) === selectedOwner && item.totalRolls > 0 && item.totalWeightKg > 0);

  async function chooseStock(rowId: string, inventoryId: string) {
    try {
      const stock = rawStock.data?.items.find(item => item._id === inventoryId) || (await rawStock.refetch()).data?.items.find(item => item._id === inventoryId);
      setEntries(current => current.map(entry => entry.id === rowId ? { ...entry, inventoryId, fabricType: stock?.fabricType || '', yarnSpec: stock?.yarnSpec || '', ecruRollsCount: '', ecruWeightKg: '' } : entry));
      setError(null);
    } catch { setError('Could not load this stock. Refresh stock and select it again.'); }
  }

  async function shadeCorrected() {
    if (!correcting) return;
    const original = correcting;
    const result = await rawStock.refetch();
    const target = result.data?.items.find(item => item.color === 'ECRU' && item.fabricType === original.fabricType && item.yarnSpec === original.yarnSpec && canonicalOwnerKey(item.ownerKey, owners.data?.items || []) === selectedOwner && item.totalRolls > 0 && item.totalWeightKg > 0);
    if (target) setEntries(current => current.map(entry => entry.inventoryId === original._id ? { ...entry, inventoryId: target._id, fabricType: target.fabricType, yarnSpec: target.yarnSpec } : entry));
    else setError('Shade was corrected. Refresh stock and select the corrected row before sending.');
    await client.invalidateQueries();
  }

  function checkAvailability(stock: FabricInventoryItem[]) {
    const requested = new Map<string, { rolls: number; kg: number }>();
    for (const [index, row] of entries.entries()) {
      const source = stock.find(item => item._id === row.inventoryId && canonicalOwnerKey(item.ownerKey, owners.data?.items || []) === selectedOwner);
      if (!source) throw new Error(`Entry #${index + 1}: Choose raw stock belonging to the selected fabric owner.`);
      if (source.color !== 'ECRU') throw new Error(`Entry #${index + 1}: Confirm this stock is undyed grey and correct its current shade to ECRU first.`);
      const used = requested.get(source._id) || { rolls: 0, kg: 0 };
      used.rolls += Number(row.ecruRollsCount);used.kg = Math.round((used.kg + Number(row.ecruWeightKg)) * 1000) / 1000;requested.set(source._id, used);
      if (used.rolls > source.totalRolls || used.kg > source.totalWeightKg + 0.000001) throw new Error(`${source.fabricType} / ${source.yarnSpec}: Available ${source.totalRolls} rolls / ${formatWeight(source.totalWeightKg)}. All lines together request ${used.rolls} rolls / ${formatWeight(used.kg)}.`);
    }
    for (const [id, used] of requested) {
      const source = stock.find(item => item._id === id)!;
      if ((used.rolls === source.totalRolls) !== (Math.abs(used.kg - source.totalWeightKg) < 0.000001)) throw new Error(`${source.fabricType}: Sending the final rolls must use the full remaining measured kg. For a partial send, leave both rolls and kg in stock.`);
    }
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
      const rolls = Number(row.ecruRollsCount);
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
      if (!Number.isInteger(rolls) || rolls < 1) {
        setError(`Entry #${i + 1}: Roll count must be at least 1`);
        return;
      }
      if (!Number.isFinite(weight) || weight <= 0) {
        setError(`Entry #${i + 1}: Weight (kg) must be a positive number`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const latest = await rawStock.refetch();
      if (latest.isError || !latest.data) throw new Error('Could not verify available stock. Try loading stock again.');
      checkAvailability(latest.data.items);
      const payload: CreateGatePassPayload = { ownerKey: selectedOwner,
        ...references,
        ogpNo: ogpNo.trim(),
        dateIssued: new Date(dateIssued).toISOString(),
        millName,
        customMillName: millName === 'OTHER' ? customMillName.trim() : undefined,
        driverName: driverName.trim(),
        vehicleNo: vehicleNo.trim(),
        remarks: remarks.trim(),
        entries: entries.map((e) => ({
          inventoryId: e.inventoryId,
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
    <><Dialog isOpen={isOpen} onClose={() => { if (!isLoading) onClose(); }} title="Send fabric for dyeing"
      description="Choose available undyed stock, the mill and the target shade for this outgoing gate pass." className="max-w-2xl"
      footer={<FormFooter formId="send-dyeing-form" onClose={onClose} isLoading={isLoading} isSaved={Boolean(success)}
        submitLabel="Save fabric delivery" summary={<><strong className="text-strong">{totals.totalRolls} rolls</strong> · {formatWeight(totals.totalWeightKg)}</>} />}>
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
              <Input id="send-dyeing-challan" label="Gate pass / challan number" value={ogpNo} onChange={(e) => setOgpNo(e.target.value)} placeholder="e.g. 1234" required />
              <Input id="send-dyeing-date" label="Sent date" type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} required />
            </div>
          </FormSection>
          <Select label="Fabric owner" value={canonicalOwnerKey(ownerKey, owners.data?.items || [])} onChange={event => { setOwnerKey(event.target.value);setEntries(current => current.map(entry => ({ ...entry, inventoryId: '', fabricType: '', yarnSpec: '', ecruRollsCount: '', ecruWeightKg: '' }))); }} options={ownerOptions(owners.data?.items || [])} /><DocumentReferences value={references} onChange={setReferences} />
          <FormSection step={2} title="What fabric are you sending?" description="Choose stock at Rozain Textile for this owner. Current shade is ECRU; choose the target shade separately.">
            {rawStock.isError && <QueryError onRetry={() => { void rawStock.refetch(); }} />}
            <Button type="button" variant="ghost" size="sm" disabled={rawStock.isFetching} onClick={() => { void rawStock.refetch(); }}>Refresh stock</Button>
            {entries.map((entry, index) => (
              <EntryCard key={entry.id} title={'Fabric item ' + (index + 1)} onCopy={() => handleDuplicateRow(index)}
                onRemove={() => handleRemoveRow(entry.id)} canRemove={entries.length > 1}>
                <StockChoice id={'send-stock-' + entry.id} label="Raw fabric from stock" required location="ZR_GODOWN" state="RAW_ECRU" ownerKey={selectedOwner} value={entry.inventoryId || ''} onChange={id => { void chooseStock(entry.id, id); }} options={[{ value: '', label: rawStock.isLoading ? 'Loading stock…' : 'Choose available raw fabric' }, ...available.map(item => ({ value: item._id, label: `${item.fabricType} · ${item.yarnSpec} · ${item.totalRolls} rolls / ${formatWeight(item.totalWeightKg)}${item.color !== 'ECRU' ? ' · Correct current shade: ' + item.color : ' · ECRU'}` }))]} />
                {available.find(item => item._id === entry.inventoryId)?.color !== 'ECRU' && entry.inventoryId && <Button type="button" variant="outline" onClick={() => setCorrecting(available.find(item => item._id === entry.inventoryId) || null)}>Correct raw shade to ECRU</Button>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Fabric name" value={entry.fabricType} readOnly required />
                  <Input label="Yarn name / count" value={entry.yarnSpec} readOnly required />
                </div>
                <CatalogField kind="COLOR" id={'send-color-' + entry.id} label="Color / shade to dye" value={entry.targetColor}
                  onChange={value => handleRowChange(entry.id, 'targetColor', value)} placeholder="e.g. Navy blue" required />
                <div className="grid grid-cols-2 gap-4">
                  <Input id={'send-rolls-' + entry.id} label="Rolls sent" type="number" min="1" step="1" value={entry.ecruRollsCount}
                    onChange={(e) => handleRowChange(entry.id, 'ecruRollsCount', e.target.value)} placeholder="e.g. 10" required />
                  <Input id={'send-weight-' + entry.id} label="Raw weight sent (kg)" type="number" min="0.001" step="0.001" value={entry.ecruWeightKg}
                    onChange={(e) => handleRowChange(entry.id, 'ecruWeightKg', e.target.value)} placeholder="e.g. 25.50" required />
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
    </Dialog><EditStockModal isOpen={Boolean(correcting)} item={correcting} initialCorrection onClose={() => setCorrecting(null)} onSuccess={() => { void shadeCorrected(); }} /></>
  );
}
