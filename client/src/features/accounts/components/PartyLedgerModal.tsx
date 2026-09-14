import { useState, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { formatCurrency, formatDate, formatDateTime } from '../../../lib/formatters.js';
import { exportToCsv } from '../../../lib/csvExport.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { LedgerStatementResponse, PartyLedgerEntryItem } from '../types/accounts.types.js';
import { BookOpen, Calendar, Printer, Download, Edit2, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface PartyLedgerModalProps {
  partyId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PartyLedgerModal({ partyId, isOpen, onClose, onSuccess }: PartyLedgerModalProps) {
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_30'>('ALL');

  const [editingEntry, setEditingEntry] = useState<PartyLedgerEntryItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [deletingEntry, setDeletingEntry] = useState<PartyLedgerEntryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data, isLoading, refetch } = useQuery<LedgerStatementResponse>({
    queryKey: ['party-ledger-statement', partyId, dateFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFilter === 'THIS_MONTH') {
        const now = new Date();
        params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (dateFilter === 'LAST_30') {
        params.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

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

  function handleExportCsv() {
    if (!party || !entries.length) return;

    exportToCsv(
      `statement_${party.code}_${new Date().toISOString().split('T')[0]}`,
      [
        { header: 'Bill / Voucher #', accessor: (e) => e.referenceNo || '—' },
        { header: 'Date', accessor: (e) => formatDate(e.date) },
        { header: 'Description', accessor: (e) => e.description || '—' },
        { header: 'They Owe Us (+)', accessor: (e) => (e.entryType === 'DEBIT' ? e.amount : 0) },
        { header: 'We Owe Them (-)', accessor: (e) => (e.entryType === 'CREDIT' ? e.amount : 0) },
        { header: 'Running Balance', accessor: (e) => e.runningBalance }
      ],
      entries
    );
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
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
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
          <div className="p-3.5 bg-red-950/40 border border-red-800 rounded-lg space-y-2">
            <div className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-red-400" />
              Confirm Ledger Entry Deletion
            </div>
            <p className="text-[11px] text-zinc-300">
              Are you sure you want to delete entry <strong className="text-white font-mono">{deletingEntry.referenceNo || 'Record'}</strong> for{' '}
              <strong className="text-emerald-400 font-mono">{formatCurrency(deletingEntry.amount)}</strong>?
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
          <form onSubmit={handleSaveEdit} className="p-3.5 bg-zinc-950 border border-emerald-800/60 rounded-lg space-y-3">
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4" />
              Edit Ledger Entry • {editingEntry.referenceNo || 'Adjustment'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="text-xs h-8"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Amount (PKR)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="text-xs h-8 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Description</label>
                <Input
                  value={editDescription}
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

        {party && (
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                {party.name}
              </div>
              <div className="text-zinc-400 mt-0.5 font-mono">
                {party.code} • {party.phone || 'No phone'} • {party.address || 'Sialkot'}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase text-zinc-500 font-semibold">Net Closing Balance</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(party.currentBalance)}
                </div>
              </div>
              <Badge
                variant={party.currentBalance > 0 ? 'default' : party.currentBalance < 0 ? 'destructive' : 'outline'}
                className="text-[10px]"
              >
                {party.currentBalance > 0 ? 'They Owe Us' : party.currentBalance < 0 ? 'We Owe Them' : 'Settled (Zero)'}
              </Badge>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-zinc-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Range:
            </span>
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
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5 text-xs h-7">
              <Download className="w-3 h-3" />
              Export CSV
            </Button>

            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs h-7">
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </Button>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/60 max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 sticky top-0 border-b border-zinc-800 text-zinc-400 uppercase font-semibold z-20">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Bill / Voucher #</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Description / Details</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">They Owe Us (+)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">We Owe Them (-)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Current Balance</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-900 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {isLoading ? (
                <LoadingState isTableRow colSpan={7} message="Loading account statement entries..." />
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No ledger entries found for this party.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e._id} className="group hover:bg-zinc-900/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-semibold text-emerald-400 whitespace-nowrap">
                      {e.referenceNo || '—'}
                    </td>

                    <td className="py-2 px-3 font-mono text-zinc-300 whitespace-nowrap">
                      {formatDateTime(e.date, true)}
                    </td>

                    <td className="py-2 px-3 text-zinc-300 whitespace-nowrap truncate max-w-xs">
                      {e.description || '—'}
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-medium text-zinc-200 whitespace-nowrap">
                      {e.entryType === 'DEBIT' ? formatCurrency(e.amount) : '—'}
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-medium text-emerald-400 whitespace-nowrap">
                      {e.entryType === 'CREDIT' ? formatCurrency(e.amount) : '—'}
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatCurrency(e.runningBalance)}
                    </td>

                    <td className="py-2 px-3 text-center whitespace-nowrap sticky right-0 bg-zinc-950 group-hover:bg-zinc-900 z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntry(e);
                            setEditAmount(e.amount.toString());
                            setEditDate(e.date ? e.date.split('T')[0] : '');
                            setEditDescription(e.description || '');
                            setDeletingEntry(null);
                            setFeedback(null);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
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
                          className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
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

        {data && (
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 grid grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase">Total Billed / Added (+)</div>
              <div className="font-bold text-zinc-200 mt-0.5">{formatCurrency(data.totalDebits)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Total Paid / Received (-)</div>
              <div className="font-bold text-emerald-400 mt-0.5">{formatCurrency(data.totalCredits)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-500 uppercase">Final Balance</div>
              <div className="font-bold text-white mt-0.5">{formatCurrency(data.closingBalance)}</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
