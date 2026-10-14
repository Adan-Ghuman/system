import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { saveBlob } from '../lib/fileDownload.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { QueryError } from '../components/ui/QueryError.js';

export function LegacyReviewPage() {
  const [error, setError] = useState<string | null>(null);const [working, setWorking] = useState('');
  const query = useQuery({ queryKey: ['legacy-review'], queryFn: async () => (await api.get<{ data: { records: Array<{ collection: string; count: number }> } }>('/legacy-review')).data.data });
  async function download(name: string) { setWorking(name);setError(null);try { const response = await api.get('/legacy-review/' + name, { params: { format: 'csv' }, responseType: 'blob' });saveBlob(response.data, `Ownership-review-${name}.csv`); } catch { setError('Could not export these historical records.'); } finally { setWorking(''); } }
  return <div className="space-y-6"><PageHeader title="Historical ownership review" description="Prepare the existing records for business ownership review before migrating stock or balances." /><Card className="space-y-3 p-5"><h2 className="text-sm font-semibold text-strong">Review before cutover</h2><p className="text-sm leading-relaxed text-soft">Each exported row retains its original ID. Fill in the reviewed business, opening balance and review note. Related parties, bills, payments, stock and production sources must be assigned and reconciled together on a protected copy.</p><p className="text-xs text-soft">Exports do not move records, copy balances, or change either business. Unresolved historical data remains read only.</p></Card><FormFeedback error={error} success={null} />{query.isError && <QueryError onRetry={() => query.refetch()} />}<Card className="divide-y divide-line p-4">{query.data?.records.map(row => <div key={row.collection} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium text-strong">{row.collection}</p><p className="mt-1 text-xs text-soft">{row.count} historical records</p></div><Button variant="outline" isLoading={working === row.collection} disabled={Boolean(working)} onClick={() => download(row.collection)}>Export ownership worksheet</Button></div>)}</Card></div>;
}
