import { getLocalDateInput } from '../../../lib/formatters.js';
import { BusinessItem } from '../../../business/types.js';
import { useBusinessStore } from '../../../business/store.js';
import { DocumentPreview } from '../../../business/DocumentPreview.js';
import { OperationDocument } from '../../../business/types.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useQueryPagination } from '../../../hooks/useQueryPagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { QueryError } from '../../../components/ui/QueryError.js';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { formatCurrency, formatDate, formatDateTime } from '../../../lib/formatters.js';
import { exportToCsv } from '../../../lib/csvExport.js';
import { downloadExcelReport } from '../../../lib/reportExport.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { LedgerStatementResponse, PartyLedgerEntryItem } from '../types/accounts.types.js';
import { BookOpen, Calendar, Printer, Download, Edit2, Trash2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';

export interface PartyLedgerModalProps {
  partyId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PartyLedgerModal({ partyId, isOpen, onClose, onSuccess }: PartyLedgerModalProps) {
  const businessId = useBusinessStore(state => state.id);const businesses = useQuery({ queryKey: ['businesses'], queryFn: async () => (await api.get<{ data: BusinessItem[] }>('/businesses')).data.data });const companyName = businesses.data?.find(item => item._id === businessId)?.name || 'Rozain Textile';const [sourceDocument, setSourceDocument] = useState<OperationDocument | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printEntries, setPrintEntries] = useState<PartyLedgerEntryItem[] | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_30'>('ALL');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [editingEntry, setEditingEntry] = useState<PartyLedgerEntryItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [deletingEntry, setDeletingEntry] = useState<PartyLedgerEntryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { page, limit, setPage, setLimit } = useQueryPagination([partyId, dateFilter, debouncedSearch]);
  useEffect(() => { setPrintEntries(null); }, [dateFilter, debouncedSearch, limit, page]);
  useEffect(() => {
    if (!printEntries) return;
    const clear = () => setPrintEntries(null);
    window.addEventListener('afterprint', clear);
    const frame = requestAnimationFrame(() => window.print());
    return () => { cancelAnimationFrame(frame); window.removeEventListener('afterprint', clear); };
  }, [printEntries]);

  function statementParams() {
    const params: Record<string, string> = {};
    if (dateFilter === 'THIS_MONTH') { const now = new Date(); params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); }
    if (dateFilter === 'LAST_30') params.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    return params;
  }

  const { data, isLoading, isError, refetch } = useQuery<LedgerStatementResponse>({
    queryKey: ['party-ledger-statement', partyId, dateFilter, debouncedSearch, page, limit],
    queryFn: async () => {
      const params = { ...statementParams(), page, limit };

      const res = await api.get<{ success: boolean; data: LedgerStatementResponse }>(
        `/accounts/ledger/${partyId}`,
        { params }
      );
      return res.data.data;
    },
    enabled: Boolean(partyId) && isOpen
  });

  const party = data?.party;
  const entries = data?.entries || [];

  async function allEntries() {
    const response = await api.get<{ data: LedgerStatementResponse }>(`/accounts/ledger/${partyId}`, { params: statementParams() });
    return response.data.data.entries;
  }

  async function handlePrint() {
    if (isPrinting) return;
    setIsPrinting(true); setExportError(null);
    try { setPrintEntries(await allEntries()); }
    catch (error) { setExportError(error instanceof Error ? error.message : 'The statement could not be printed.'); }
    finally { setIsPrinting(false); }
  }

  async function handleExportCsv() {
    if (!party || isExportingCsv) return;
    setIsExportingCsv(true); setExportError(null);
    try {
      const completeEntries = await allEntries();
      exportToCsv<PartyLedgerEntryItem>(
      `statement_${party.code}_${getLocalDateInput()}`,
      [
        { header: 'Bill / Voucher #', accessor: (e) => e.referenceNo || '—' },
        { header: 'Date', accessor: (e) => formatDate(e.date) },
        { header: 'Description', accessor: (e) => e.description || '—' },
        { header: 'They Owe Us (+)', accessor: (e) => (e.entryType === 'DEBIT' ? e.amount : 0) },
        { header: 'We Owe Them (-)', accessor: (e) => (e.entryType === 'CREDIT' ? e.amount : 0) },
        { header: 'Running Balance', accessor: (e) => e.runningBalance }
      ],
      completeEntries
      );
    } catch (error) { setExportError(error instanceof Error ? error.message : 'The CSV could not be downloaded.'); }
    finally { setIsExportingCsv(false); }
  }

  async function handleExportExcel() {
    if (!party) return;
    if (isExportingExcel) return;
    setIsExportingExcel(true); setExportError(null);
    try {
      let url = `/reports/party-ledger/${party._id}/excel`;
      if (dateFilter === 'THIS_MONTH') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        url += `?from=${start}`;
      } else if (dateFilter === 'LAST_30') {
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        url += `?from=${start}`;
      }
      await downloadExcelReport(url, `${party.name}_Ledger.xlsx`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'The Excel report could not be downloaded.');
    } finally {
      setIsExportingExcel(false);
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingEntry || isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await api.put(`/accounts/ledger/entry/${editingEntry._id}`, {
        amount: parseFloat(editAmount),
        date: new Date(editDate).toISOString(),
        description: editDescription.trim()
      });

      setFeedback({ type: 'success', message: 'Ledger entry updated and balance recalculated' });
      await refetch();
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setEditingEntry(null);
        setFeedback(null);
      }, 700);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setFeedback({ type: 'error', message: anyErr.response?.data?.error || anyErr.message || 'Failed to update entry' });
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }

  async function handleDeleteEntry() {
    if (!deletingEntry || isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await api.delete(`/accounts/ledger/entry/${deletingEntry._id}`);

      setFeedback({ type: 'success', message: 'Ledger entry deleted and balance recalculated' });
      await refetch();
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setDeletingEntry(null);
        setFeedback(null);
      }, 700);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setFeedback({ type: 'error', message: anyErr.response?.data?.error || anyErr.message || 'Failed to delete entry' });
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog
      footer={<div className="flex items-center justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title={party ? `Account Statement (Ledger) • ${party.name}` : 'Party Account Statement'}
      description="Complete transaction history with bills, payments received, and running account balance."
      className="max-w-4xl"
    >
      <div className="space-y-4">
        {feedback && (
          <div
            className={`p-3 rounded-md flex items-center gap-2 text-xs ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-brand'
                : 'bg-red-500/10 border border-red-500/30 text-danger'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Delete Confirmation Banner */}
        {deletingEntry && (
          <div className="p-3.5 bg-danger-soft border border-line rounded-lg space-y-2">
            <div className="text-xs font-semibold text-danger flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-danger" />
              Confirm Ledger Entry Deletion
            </div>
            <p className="text-xs text-ink">
              Are you sure you want to delete entry <strong className="text-strong font-mono">{deletingEntry.referenceNo || 'Record'}</strong> for{' '}
              <strong className="text-brand font-mono">{formatCurrency(deletingEntry.amount)}</strong>?
              {deletingEntry.referenceType === 'PAYMENT' && ' (This will also remove the linked payment voucher).'}{' '}
              This will automatically recalculate subsequent running balances and the party closing balance.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteEntry}
                isLoading={isSubmitting}
                className="h-7 text-xs"
              >
                Yes, Delete Entry
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingEntry(null)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Inline Edit Form */}
        {editingEntry && (
          <form onSubmit={handleSaveEdit} className="p-3.5 bg-canvas border border-line rounded-lg space-y-3">
            <div className="text-xs font-semibold text-brand flex items-center gap-1.5">
              <Edit2 className="w-4 h-4" />
              Edit Ledger Entry • {editingEntry.referenceNo || 'Adjustment'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs text-soft mb-1">Date</label>
                <Input
                  aria-label="Date" type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="text-xs h-8"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-soft mb-1">Amount (PKR)</label>
                <Input
                  aria-label="Amount (PKR)" type="number"
                  step="0.01"
                  min="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="text-xs h-8 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-soft mb-1">Description</label>
                <Input
                  aria-label="Description" value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingEntry(null)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={isSubmitting}
                className="h-7 text-xs"
              >
                Save & Recalculate
              </Button>
            </div>
          </form>
        )}

        {isError && <QueryError onRetry={() => { refetch(); }} />}
        {exportError && <p role="alert" className="rounded-lg border border-line p-3 text-sm text-danger">{exportError}</p>}
        <div id="print-area" className="ledger-print space-y-4">
<h2 className="hidden print:block text-lg font-semibold">{companyName} · Account statement</h2>
{party && (
          <div className="p-3 rounded-lg bg-canvas border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="text-base font-bold text-strong flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                {party.name}
              </div>
              <div className="text-soft mt-0.5 font-mono">
                {party.code} • {party.phone || 'No phone'} • {party.address || '—'}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs normal-case text-soft font-semibold">Net Closing Balance</div>
                <div className="text-sm font-bold font-mono text-brand mt-0.5">
                  {formatCurrency(party.currentBalance)}
                </div>
              </div>
              <Badge
                variant={party.currentBalance > 0 ? 'default' : party.currentBalance < 0 ? 'destructive' : 'outline'}
                className="text-xs"
              >
                {party.currentBalance > 0 ? 'They Owe Us' : party.currentBalance < 0 ? 'We Owe Them' : 'Settled (Zero)'}
              </Badge>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-semibold text-soft mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Range:
            </span>
            <span className="hidden print:inline">{dateFilter === 'ALL' ? 'All time' : dateFilter === 'THIS_MONTH' ? 'This month' : 'Last 30 days'}</span>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'LAST_30', label: 'Last 30 Days' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id as typeof dateFilter)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  dateFilter === f.id
                    ? 'bg-primary text-white font-semibold'
                    : 'bg-canvas text-soft hover:text-strong border border-line'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              isLoading={isExportingExcel}
              className="gap-1.5 text-xs h-7 bg-brand-soft border-line text-brand hover:bg-brand-soft hover:text-strong"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-brand" />
              Export Excel (.xlsx)
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportCsv} isLoading={isExportingCsv} className="gap-1.5 text-xs h-7">
              <Download className="w-3 h-3" />
              Export CSV
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrint} isLoading={isPrinting} className="gap-1.5 text-xs h-7">
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </Button>
          </div>
        </div>

        <div className="print:hidden"><Input label="Find a ledger entry" placeholder="e.g. 1234" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="border border-line rounded-lg overflow-hidden bg-canvas/60 max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface sticky top-0 border-b border-line text-soft normal-case font-semibold z-20">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Bill / Voucher #</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Description / Details</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">They Owe Us (+)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">We Owe Them (-)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Current Balance</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-surface z-20 border-l border-line shadow-sm">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {isLoading ? (
                <LoadingState isTableRow colSpan={7} message="Loading account statement entries..." />
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-soft">
                    No ledger entries found for this party.
                  </td>
                </tr>
              ) : (
                (printEntries || entries).map((e) => (
                  <tr key={e._id} className="group hover:bg-surface/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-semibold text-brand whitespace-nowrap">
                      {businessId && e.referenceId ? <button className="text-left text-brand hover:underline" onClick={async () => { try { setSourceDocument((await api.get<{ data: OperationDocument }>('/sources/bill/' + e.referenceId)).data.data); } catch { setExportError('This entry is a standalone voucher. Open Payments to review it.'); } }}>{e.referenceNo || '—'}</button> : e.referenceNo || '—'}{businessId && e.referenceId && <span className="hidden print:inline">{e.referenceNo || '—'}</span>}
                    </td>

                    <td className="py-2 px-3 font-mono text-ink whitespace-nowrap">
                      {formatDateTime(e.date, true)}
                    </td>

                    <td className="py-2 px-3 text-ink whitespace-nowrap truncate max-w-xs">
                      {e.description || '—'}
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-medium text-strong whitespace-nowrap">
                      {e.entryType === 'DEBIT' ? formatCurrency(e.amount) : '—'}
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-medium text-brand whitespace-nowrap">
                      {e.entryType === 'CREDIT' ? formatCurrency(e.amount) : '—'}
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-bold text-strong whitespace-nowrap">
                      {formatCurrency(e.runningBalance)}
                    </td>

                    <td className="py-2 px-3 text-center whitespace-nowrap sticky right-0 bg-canvas group-hover:bg-surface z-10 border-l border-line shadow-sm">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          disabled={Boolean(businessId) && e.referenceType !== "ADJUSTMENT"}
                          type="button"
                          onClick={() => {
                            setEditingEntry(e);
                            setEditAmount(e.amount.toString());
                            setEditDate(e.date ? e.date.split('T')[0] : '');
                            setEditDescription(e.description || '');
                            setDeletingEntry(null);
                            setFeedback(null);
                          }}
                          className="p-1 rounded text-soft hover:text-brand hover:bg-subtle transition-colors"
                          title="Edit ledger entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeletingEntry(e);
                            setEditingEntry(null);
                            setFeedback(null);
                          }}
                          className="p-1 rounded text-soft hover:text-danger hover:bg-subtle transition-colors"
                          title="Delete ledger entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="print:hidden"><PaginationControls page={page} limit={limit} total={data?.total || 0} totalPages={data?.totalPages || 1} onPageChange={setPage} onLimitChange={setLimit} /></div>
        {data && (
          <div className="p-3 rounded-lg bg-canvas border border-line grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <div className="text-xs text-soft normal-case">Total Billed / Added (+)</div>
              <div className="font-bold text-strong mt-0.5">{formatCurrency(data.totalDebits)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-soft normal-case">Total Paid / Received (-)</div>
              <div className="font-bold text-brand mt-0.5">{formatCurrency(data.totalCredits)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-soft normal-case">Final Balance</div>
              <div className="font-bold text-strong mt-0.5">{formatCurrency(data.closingBalance)}</div>
            </div>
          </div>
        )}
</div>


      </div>
    {sourceDocument && <DocumentPreview document={sourceDocument} onClose={() => setSourceDocument(null)} />}</Dialog>
  );
}
