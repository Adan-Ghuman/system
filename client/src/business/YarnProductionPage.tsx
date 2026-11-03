import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { saveBlob } from '../lib/fileDownload.js';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Dialog } from '../components/ui/Dialog.js';
import { Input } from '../components/ui/Input.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { QueryError } from '../components/ui/QueryError.js';
import { ScrollableTable } from '../components/ui/ScrollableTable.js';
import { Select } from '../components/ui/Select.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { useBusinessStore } from './store.js';
import { MachineForm, ProductionReasonForm, ProductionRunForm, ProductionStockForm } from './YarnProductionForms.js';
import {
  YarnMachine, YarnRun, processNames, productionToday, productionUrl, stockStatusNames
} from './yarn-production.types.js';

interface MachineSummary { _id: string; code: string; name: string; runs: number; usableKg: number; wasteKg: number; awaiting: number; }
interface Report { items: YarnRun[]; total: number; totalPages: number; summary: MachineSummary[]; }
type Action = { kind: 'record' } | { kind: 'correct' | 'stock' | 'undo' | 'void'; run: YarnRun } | { kind: 'machine'; machine?: YarnMachine };

const kg = (value: number) => value.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const shiftName = (shift: YarnRun['shift']) => shift === 'DAY' ? 'Day shift' : 'Night shift';

export function YarnProductionPage() {
  const user = useAuthStore(state => state.user);
  const businessId = useBusinessStore(state => state.id);
  const admin = user?.role === 'admin';
  const canWrite = admin || Boolean(user?.permissions.includes('knitting:write'));
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const runId = params.get('run');
  const [action, setAction] = useState<Action | null>(null);
  const [setup, setSetup] = useState(false);
  const [from, setFrom] = useState(productionToday);
  const [to, setTo] = useState(productionToday);
  const [shift, setShift] = useState('');
  const [machineId, setMachineId] = useState('');
  const [yarn, setYarn] = useState('');
  const [location, setLocation] = useState('');
  const [history, setHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debouncedYarn = useDebounce(yarn, 250);

  const filters = {
    from: from || undefined, to: to || undefined, shift: shift || undefined, machineId: machineId || undefined,
    yarnSpec: debouncedYarn || undefined, location: location || undefined, history: history ? 'true' : undefined
  };
  const { page, limit, setPage, setLimit } = useQueryPagination([from, to, shift, machineId, debouncedYarn, location, history]);
  const machines = useQuery({
    queryKey: ['yarn-machines', businessId],
    queryFn: async () => (await api.get<{ data: { machines: YarnMachine[]; locations: string[] } }>(productionUrl + '/machines')).data.data,
    enabled: Boolean(businessId)
  });
  const report = useQuery({
    queryKey: ['yarn-production', businessId, filters, page, limit],
    queryFn: async () => (await api.get<{ data: Report }>(productionUrl + '/runs', { params: { ...filters, page, limit } })).data.data,
    enabled: Boolean(businessId) && !(from && to && from > to)
  });
  const detail = useQuery({
    queryKey: ['yarn-production-run', businessId, runId],
    queryFn: async () => (await api.get<{ data: YarnRun }>(productionUrl + '/runs/' + runId)).data.data,
    enabled: Boolean(businessId && runId)
  });

  const machineList = machines.data?.machines || [];
  const locations = [...new Set([...(machines.data?.locations || []), ...machineList.map(machine => machine.location)])].sort();
  const summary = report.data?.summary || [];
  const today = from === productionToday() && to === from;
  function showRun(id?: string) {
    setParams(id ? { tab: 'production', run: id } : { tab: 'production' }, { replace: true });
  }
  function saved(message: string) {
    setNotice(message);
    void client.invalidateQueries();
  }
  async function download() {
    setExporting(true);
    setError(null);
    try {
      const response = await api.get(productionUrl + '/runs', { params: { ...filters, yarnSpec: yarn.trim() || undefined, format: 'xlsx' }, responseType: 'blob' });
      saveBlob(response.data, 'Yarn machine production.xlsx');
    } catch {
      setError('Could not export this production report.');
    } finally {
      setExporting(false);
    }
  }

  return <section className="space-y-5">
    <PageHeader title="Machine Production" description="Record usable yarn from each machine and review production by shift or batch.">
      {admin && <Button variant="outline" onClick={() => setSetup(true)}>Machine Setup</Button>}
      {canWrite && <Button disabled={!machineList.some(machine => machine.active)} onClick={() => setAction({ kind: 'record' })}>
        Record Production
      </Button>}
    </PageHeader>
    <FormFeedback error={error || (from && to && from > to ? 'The end date must follow the start date.' : null)} success={notice || null} />
    {machines.isError && <QueryError onRetry={() => machines.refetch()} />}
    {machines.isSuccess && !machineList.some(machine => machine.active) &&
      <p className="rounded-lg border border-line p-3 text-sm text-soft">Add an active machine in Machine Setup to record production.</p>}

    <Card className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <Input label="To date" type="date" value={to} onChange={e => setTo(e.target.value)} />
        <Select label="Shift" value={shift} onChange={e => setShift(e.target.value)}
          options={[{ value: '', label: 'All shifts' }, { value: 'DAY', label: 'Day shift' }, { value: 'NIGHT', label: 'Night shift' }]} />
        <Select label="Machine" value={machineId} onChange={e => setMachineId(e.target.value)}
          options={[{ value: '', label: 'All machines' }, ...machineList.map(machine => ({ value: machine._id, label: machine.code + ' · ' + machine.name }))]} />
        <Input label="Yarn count" value={yarn} onChange={e => setYarn(e.target.value)} placeholder="e.g. 30/1" />
        <Select label="Location" value={location} onChange={e => setLocation(e.target.value)}
          options={[{ value: '', label: 'All locations' }, ...locations.map(value => ({ value, label: value }))]} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => { setFrom(productionToday()); setTo(productionToday()); }}>Today</Button>
        <Button size="sm" variant="outline" onClick={() => { setFrom(''); setTo(''); }}>All dates</Button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} /> Include corrected and voided entries</label>
        <Button size="sm" variant="outline" isLoading={exporting} disabled={Boolean(from && to && from > to)} onClick={() => void download()}>Export Excel</Button>
      </div>
    </Card>

    {report.isError && <QueryError onRetry={() => report.refetch()} />}
    {report.isLoading && <p>Loading machine production…</p>}
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">{today ? 'Today’s Production' : 'Machine Totals'}</h2>
      <p className="text-sm text-soft">{kg(summary.reduce((sum, row) => sum + row.usableKg, 0))} usable kg · {kg(summary.reduce((sum, row) => sum + row.wasteKg, 0))} waste kg</p>
      <ScrollableTable>
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead><tr className="border-b border-line">
            <th className="p-2">Machine</th><th className="p-2 text-right">Usable kg</th><th className="p-2 text-right">Waste kg</th>
            <th className="p-2 text-right">Runs</th><th className="p-2 text-right">Awaiting receipt</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {summary.map(row => <tr key={row._id}>
              <td className="p-2"><button type="button" className="font-medium text-brand hover:underline"
                onClick={() => setMachineId(row._id)}>{row.code} · {row.name}</button></td>
              <td className="p-2 text-right">{kg(row.usableKg)}</td><td className="p-2 text-right">{kg(row.wasteKg)}</td>
              <td className="p-2 text-right">{row.runs}</td><td className="p-2 text-right">{row.awaiting}</td>
            </tr>)}
          </tbody>
        </table>
      </ScrollableTable>
      {report.isSuccess && !summary.length && <p className="text-sm text-soft">No active runs match these filters.</p>}
    </Card>
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">Production Entries</h2>
      <ScrollableTable>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-line">
            <th className="p-2">Date / shift</th><th className="p-2">Machine / run</th><th className="p-2">Yarn</th>
            <th className="p-2 text-right">Usable kg</th><th className="p-2 text-right">Waste kg</th><th className="p-2">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {report.data?.items.map(row => <tr key={row._id}>
              <td className="p-2">{row.productionDate}<p className="text-soft">{shiftName(row.shift)}</p></td>
              <td className="p-2">{row.machineCode}<br /><button type="button" className="text-brand hover:underline"
                onClick={() => showRun(row._id)}>{row.reference}</button></td>
              <td className="p-2">{row.output.yarnSpec}<p className="text-soft">{row.output.quantity} {row.output.packageUnit}</p></td>
              <td className="p-2 text-right">{kg(row.output.weightKg)}</td><td className="p-2 text-right">{kg(row.wasteKg)}</td>
              <td className="p-2">{row.status === 'REVERSED' ? (row.replacedById ? 'Corrected' : 'Voided') : stockStatusNames[row.stockStatus]}</td>
            </tr>)}
          </tbody>
        </table>
      </ScrollableTable>
      <PaginationControls page={page} limit={limit} total={report.data?.total || 0} totalPages={report.data?.totalPages || 1}
        onPageChange={setPage} onLimitChange={setLimit} />
    </Card>

    {setup && !action && <Dialog isOpen onClose={() => setSetup(false)} title="Machine Setup"
      footer={<Button onClick={() => setAction({ kind: 'machine' })}>Add Machine</Button>}>
      <ul className="divide-y divide-line">
        {machineList.map(machine => <li key={machine._id} className="flex items-center justify-between gap-2 py-2">
          <div><p className="font-medium">{machine.code} · {machine.name}</p>
            <p className="text-sm text-soft">{processNames[machine.process]} · {machine.location}{machine.active ? '' : ' · Retired'}</p></div>
          <Button variant="outline" size="sm" onClick={() => setAction({ kind: 'machine', machine })}>Edit</Button>
        </li>)}
      </ul>
      {!machineList.length && <p className="text-sm text-soft">Add your first production machine.</p>}
    </Dialog>}
    {runId && !action && <Dialog isOpen onClose={() => showRun()} title="Production Details">
      {detail.isError && <QueryError onRetry={() => detail.refetch()} />}
      {detail.isLoading && <p>Loading production entry…</p>}
      {detail.data && <RunDetails run={detail.data} canWrite={canWrite} showRun={showRun} setAction={setAction} />}
    </Dialog>}
    {action?.kind === 'machine' && <MachineForm machine={action.machine} close={() => setAction(null)} saved={saved} />}
    {(action?.kind === 'record' || action?.kind === 'correct') && <ProductionRunForm machines={machineList}
      run={action.kind === 'correct' ? action.run : undefined} close={() => setAction(null)} saved={saved} />}
    {action?.kind === 'stock' && <ProductionStockForm run={action.run} close={() => setAction(null)} saved={saved} />}
    {(action?.kind === 'undo' || action?.kind === 'void') && <ProductionReasonForm run={action.run}
      action={action.kind === 'undo' ? 'stock/undo' : 'void'} close={() => setAction(null)} saved={saved} />}
  </section>;
}

function RunDetails({ run, canWrite, showRun, setAction }: {
  run: YarnRun; canWrite: boolean; showRun: (id: string) => void; setAction: (action: Action) => void
}) {
  return <div className="space-y-3">
    <p className="font-semibold">{run.machineCode} · {run.machineName} · {run.reference}</p>
    <p>{run.productionDate} · {shiftName(run.shift)} · {processNames[run.process]} · {run.location}</p>
    <p>{run.output.yarnSpec} · {run.output.quantity} {run.output.packageUnit} · {kg(run.output.weightKg)} usable kg · {kg(run.wasteKg)} waste kg</p>
    {run.input && <p>Yarn consumed · {run.input.yarnSpec} · {run.input.quantity} {run.input.packageUnit} · {kg(run.input.weightKg)} kg</p>}
    <p className="font-medium">{run.status === 'REVERSED' ? (run.replacedById ? 'Corrected' : 'Voided') : stockStatusNames[run.stockStatus]}</p>
    {run.correctionReason && <p className="text-sm text-soft">{run.correctionReason}</p>}
    {run.replacesId && <Button variant="outline" size="sm" onClick={() => showRun(run.replacesId!)}>Original Entry</Button>}
    {run.replacedById && <Button variant="outline" size="sm" onClick={() => showRun(run.replacedById!)}>Corrected Entry</Button>}
    {run.stockEvents.length > 0 && <ul className="space-y-1 border-t border-line pt-2 text-sm">
      {run.stockEvents.map(event => <li key={event._id}>
        {event.date} · {event.action === 'UNDONE' ? 'Handoff undone' : stockStatusNames[event.action]}{event.receiptNumber ? ' · ' + event.receiptNumber : ''}{event.reason ? ' · ' + event.reason : ''}
      </li>)}
    </ul>}
    {canWrite && run.status === 'POSTED' && <div className="flex flex-wrap gap-2">
      {run.stockStatus === 'AWAITING' ? <>
        <Button onClick={() => setAction({ kind: 'stock', run })}>Receive into Stock</Button>
        <Button variant="outline" onClick={() => setAction({ kind: 'correct', run })}>Correct Entry</Button>
        <Button variant="ghost" onClick={() => setAction({ kind: 'void', run })}>Void Entry</Button>
      </> : <Button variant="outline" onClick={() => setAction({ kind: 'undo', run })}>
        {run.stockStatus === 'LINKED' ? 'Unlink Receipt' : 'Reverse Stock Receipt'}
      </Button>}
    </div>}
  </div>;
}
