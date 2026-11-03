import { FormEvent, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.js';
import { CatalogField } from '../components/ui/CatalogField.js';
import { Dialog } from '../components/ui/Dialog.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useBusinessStore } from './store.js';
import {
  YarnMachine, YarnMeasurement, YarnProcess, YarnRun, processNames, productionError, productionToday, productionUrl
} from './yarn-production.types.js';

type Saved = (message: string) => void;

function useProductionSubmit() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(productionError(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

export function MachineForm({ machine, close, saved }: { machine?: YarnMachine; close: () => void; saved: Saved }) {
  const [code, setCode] = useState(machine?.code || '');
  const [name, setName] = useState(machine?.name || '');
  const [process, setProcess] = useState<YarnProcess>(machine?.process || 'SPINNING');
  const [location, setLocation] = useState(machine?.location || '');
  const [active, setActive] = useState(machine?.active ?? true);
  const [requestId] = useState(() => crypto.randomUUID());
  const { busy, error, submit } = useProductionSubmit();

  function save(event: FormEvent) {
    event.preventDefault();
    void submit(async () => {
      const fields = { requestId, name, process, location };
      if (machine) await api.put(productionUrl + '/machines/' + machine._id, { ...fields, active });
      else await api.post(productionUrl + '/machines', { ...fields, code });
      saved(machine ? 'Machine updated.' : 'Machine added.');
      close();
    });
  }

  return <Dialog isOpen onClose={() => { if (!busy) close(); }} title={machine ? 'Edit machine' : 'Add machine'}
    footer={<Button form="machine-setup" type="submit" isLoading={busy}>Save Machine</Button>}>
    <form id="machine-setup" className="space-y-4" onSubmit={save}>
      <FormFeedback error={error} success={null} />
      <Input label="Machine code" value={code} onChange={e => setCode(e.target.value)} readOnly={Boolean(machine)} required maxLength={40} />
      <Input label="Machine name" value={name} onChange={e => setName(e.target.value)} required maxLength={100} />
      <Select label="Process" value={process} onChange={e => setProcess(e.target.value as YarnProcess)}
        options={Object.entries(processNames).map(([value, label]) => ({ value, label }))} />
      <Input label="Production location" value={location} onChange={e => setLocation(e.target.value)} required maxLength={100} placeholder="e.g. Spinning floor" />
      {machine && <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Available for new runs</label>}
    </form>
  </Dialog>;
}

const emptyYarn = { yarnSpec: '', packageUnit: 'cones', quantity: '', weightKg: '' };
const units = ['cones', 'cartons', 'bags', 'packages'].map(value => ({ value, label: value }));
type MeasurementFields = typeof emptyYarn;
const asFields = (value?: YarnMeasurement) => value ? {
  ...value, quantity: String(value.quantity), weightKg: String(value.weightKg)
} : emptyYarn;
const asNumbers = (value: MeasurementFields) => ({
  ...value, quantity: Number(value.quantity), weightKg: Number(value.weightKg)
});

function MeasurementForm({ input, value, onChange }: {
  input?: boolean; value: MeasurementFields; onChange: (value: MeasurementFields) => void
}) {
  return <fieldset className="space-y-3 rounded-lg border border-line p-3">
    <legend className="px-1 text-sm font-medium">{input ? 'Yarn consumed' : 'Usable yarn produced'}</legend>
    <CatalogField kind="YARN" label={input ? 'Input yarn count' : 'Output yarn count'} value={value.yarnSpec} required
      onChange={yarnSpec => onChange({ ...value, yarnSpec })} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Input label={input ? 'Input kg' : 'Usable kg'} type="number" min="0.001" step="0.001" required
        value={value.weightKg} onChange={e => onChange({ ...value, weightKg: e.target.value })} />
      <Input label={input ? 'Input packages' : 'Output packages'} type="number" min={input ? '0' : '1'} step="1" required
        value={value.quantity} onChange={e => onChange({ ...value, quantity: e.target.value })} />
      <Select label={input ? 'Input package unit' : 'Output package unit'} value={value.packageUnit}
        onChange={e => onChange({ ...value, packageUnit: e.target.value })} options={units} />
    </div>
  </fieldset>;
}

export function ProductionRunForm({ machines, run, close, saved }: {
  machines: YarnMachine[]; run?: YarnRun; close: () => void; saved: Saved
}) {
  const [machineId, setMachineId] = useState(run?.machineId || '');
  const [productionDate, setDate] = useState(run?.productionDate || productionToday());
  const [shift, setShift] = useState<YarnRun['shift']>(run?.shift || 'DAY');
  const [reference, setReference] = useState(run?.reference || '');
  const [output, setOutput] = useState(asFields(run?.output));
  const [input, setInput] = useState(asFields(run?.input));
  const [wasteKg, setWaste] = useState(run ? String(run.wasteKg) : '');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState('');
  const { busy, error, submit } = useProductionSubmit();

  const originalMachine = run && machineId === run.machineId ? run : undefined;
  const machine = machines.find(item => item._id === machineId);
  const location = originalMachine?.location || machine?.location;
  const process = originalMachine?.process || machine?.process;
  const options = machines.filter(item => item.active || item._id === run?.machineId)
    .map(item => ({ value: item._id, label: item.code + ' · ' + item.name }));

  const businessId = useBusinessStore(state => state.id);
  const normalizedReference = useDebounce(reference.trim().toUpperCase(), 300);
  const duplicates = useQuery({
    queryKey: ['yarn-production-duplicate', businessId, machineId, productionDate, shift, normalizedReference],
    queryFn: async () => (await api.get<{ data: { items: YarnRun[] } }>(productionUrl + '/runs', {
      params: { machineId, from: productionDate, to: productionDate, shift, reference: normalizedReference, limit: 2 }
    })).data.data.items,
    enabled: Boolean(businessId && machineId && productionDate && normalizedReference)
  });
  const duplicate = normalizedReference === reference.trim().toUpperCase() && duplicates.data?.some(item => item._id !== run?._id);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const another = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'another';
    setNotice('');
    void submit(async () => {
      const body = {
        requestId, machineId, productionDate, shift, reference, output: asNumbers(output),
        input: process === 'REWINDING' ? asNumbers(input) : undefined, wasteKg: Number(wasteKg)
      };
      if (run) await api.post(productionUrl + '/runs/' + run._id + '/correct', { ...body, reason });
      else await api.post(productionUrl + '/runs', body);
      const message = run ? 'Production entry corrected.' : 'Production entry saved.';
      saved(message);
      if (!another) return close();
      setNotice(message);
      setMachineId('');
      setReference('');
      setOutput(emptyYarn);
      setInput(emptyYarn);
      setWaste('');
      setRequestId(crypto.randomUUID());
    });
  }

  return <Dialog isOpen onClose={() => { if (!busy) close(); }} title={run ? 'Correct production' : 'Record Production'}
    description="Use the date the shift started. Record one entry per machine, shift and run."
    footer={<>
      <Button form="production-entry" type="submit" isLoading={busy} disabled={Boolean(duplicate)}>{run ? 'Save Correction' : 'Save Production'}</Button>
      {!run && <Button form="production-entry" type="submit" variant="outline" value="another" disabled={busy || Boolean(duplicate)}>Save & Add Another</Button>}
    </>}>
    <form id="production-entry" className="space-y-4" onSubmit={save}>
      <FormFeedback error={error} success={notice || null} />
      <Select label="Machine" value={machineId} onChange={e => setMachineId(e.target.value)} required
        options={[{ value: '', label: 'Choose machine' }, ...options]} />
      {process && <p className="text-sm text-soft">{processNames[process]} · {location}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Production date" type="date" max={productionToday()} value={productionDate}
          onChange={e => setDate(e.target.value)} required />
        <Select label="Shift" value={shift} onChange={e => setShift(e.target.value as YarnRun['shift'])}
          options={[{ value: 'DAY', label: 'Day shift' }, { value: 'NIGHT', label: 'Night shift' }]} />
      </div>
      <Input label="Batch or run reference" value={reference} onChange={e => setReference(e.target.value)}
        placeholder="e.g. SHIFT-12 / RUN-02" required maxLength={100} />
      {duplicate && <p role="alert" className="text-sm text-danger">This machine, date, shift and run reference are already recorded.</p>}
      <MeasurementForm value={output} onChange={setOutput} />
      <Input label="Waste kg" type="number" min="0" step="0.001" value={wasteKg} onChange={e => setWaste(e.target.value)}
        required placeholder="Enter 0 if there was no waste" />
      {process === 'REWINDING' && <>
        <MeasurementForm input value={input} onChange={setInput} />
        <p className="text-xs text-soft">Input kg must equal usable kg plus waste kg.</p>
      </>}
      {run && <Input label="Correction reason" value={reason} onChange={e => setReason(e.target.value)} required minLength={3} maxLength={500} />}
    </form>
  </Dialog>;
}

interface ReceiptOption { id: string; reference: string; number: string; date: string; }
export function ProductionStockForm({ run, close, saved }: { run: YarnRun; close: () => void; saved: Saved }) {
  const [choice, setChoice] = useState<'POST' | 'LINK'>();
  const [date, setDate] = useState(productionToday());
  const [receiptId, setReceiptId] = useState('');
  const [distinctReceiptReason, setDistinctReason] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const { busy, error, submit } = useProductionSubmit();
  const path = productionUrl + '/runs/' + run._id;
  const rewinding = run.process === 'REWINDING';
  const receipts = useQuery({
    queryKey: ['yarn-production-receipts', run._id],
    queryFn: async () => (await api.get<{ data: ReceiptOption[] }>(path + '/receipts')).data.data,
    enabled: !rewinding
  });
  const candidates = receipts.data || [];
  const mode = choice || (candidates.length ? 'LINK' : 'POST');
  const ready = rewinding || receipts.isSuccess;
  function save(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    void submit(async () => {
      await api.post(path + '/stock', mode === 'LINK'
        ? { requestId, mode, receiptId }
        : { requestId, mode, date, distinctReceiptReason: distinctReceiptReason.trim() || undefined });
      saved(mode === 'LINK' ? 'Existing stock receipt linked.' : 'Yarn stock updated.');
      close();
    });
  }

  return <Dialog isOpen onClose={() => { if (!busy) close(); }} title="Receive Production into Stock"
    description={run.reference + ' · ' + run.output.yarnSpec + ' · ' + run.output.weightKg.toFixed(3) + ' kg'}
    footer={<Button form="production-stock" type="submit" isLoading={busy} disabled={!ready}>
      {mode === 'LINK' ? 'Link Receipt' : 'Post Stock Receipt'}
    </Button>}>
    <form id="production-stock" className="space-y-4" onSubmit={save}>
      <FormFeedback error={error || (receipts.isError ? 'Could not check existing receipts. Please retry.' : null)} success={null} />
      {receipts.isError && <Button type="button" variant="outline" onClick={() => void receipts.refetch()}>Retry receipt check</Button>}
      {!ready && !receipts.isError && <p>Checking existing receipts…</p>}
      {ready && candidates.length > 0 && <Select label="Stock handoff" value={mode} onChange={e => setChoice(e.target.value as 'POST' | 'LINK')}
        options={[{ value: 'LINK', label: 'Link an existing receipt' }, { value: 'POST', label: 'Post a separate receipt' }]} />}
      {ready && mode === 'LINK' && <Select label="Matching receipt" value={receiptId} onChange={e => setReceiptId(e.target.value)} required
        options={[{ value: '', label: 'Choose receipt' }, ...candidates.map(item => ({
          value: item.id, label: item.number + (item.reference ? ' · ' + item.reference : '') + ' · ' + item.date.slice(0, 10)
        }))]} />}
      {ready && mode === 'POST' && <>
        <Input label="Stock date" type="date" min={run.productionDate} max={productionToday()} required
          value={date} onChange={e => setDate(e.target.value)} />
        <p className="text-sm text-soft">Usable yarn will be received into the main yarn store.
          {run.input && ' The measured rewinding input will be deducted at the same time.'}</p>
        {candidates.length > 0 && <Input label="Why is this a separate receipt?" value={distinctReceiptReason}
          onChange={e => setDistinctReason(e.target.value)} required minLength={3} maxLength={500} />}
      </>}
    </form>
  </Dialog>;
}

export function ProductionReasonForm({ run, action, close, saved }: {
  run: YarnRun; action: 'void' | 'stock/undo'; close: () => void; saved: Saved
}) {
  const [reason, setReason] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const { busy, error, submit } = useProductionSubmit();
  const title = action === 'void' ? 'Void Production Entry' : run.stockStatus === 'LINKED' ? 'Unlink Stock Receipt' : 'Reverse Stock Receipt';
  function save(event: FormEvent) {
    event.preventDefault();
    void submit(async () => {
      await api.post(productionUrl + '/runs/' + run._id + '/' + action, { requestId, reason });
      saved(action === 'void' ? 'Production entry voided.' : 'Run is awaiting a stock receipt again.');
      close();
    });
  }
  return <Dialog isOpen onClose={() => { if (!busy) close(); }} title={title} description={run.reference}
    footer={<Button form="production-reason" type="submit" variant="destructive" isLoading={busy}>{title}</Button>}>
    <form id="production-reason" className="space-y-4" onSubmit={save}>
      <FormFeedback error={error} success={null} />
      <Input label="Reason" value={reason} onChange={e => setReason(e.target.value)} required minLength={3} maxLength={500} />
    </form>
  </Dialog>;
}
