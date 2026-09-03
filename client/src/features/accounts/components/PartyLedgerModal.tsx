import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { formatCurrency, formatDate } from '../../../lib/formatters.js';
import { exportToCsv } from '../../../lib/csvExport.js';
import { LedgerStatementResponse } from '../types/accounts.types.js';
import { BookOpen, Calendar, Printer, Download } from 'lucide-react';

export interface PartyLedgerModalProps {
  partyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PartyLedgerModal({ partyId, isOpen, onClose }: PartyLedgerModalProps) {
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_30'>('ALL');

  const { data, isLoading } = useQuery<LedgerStatementResponse>({
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
    enabled: isOpen && Boolean(partyId)
  });

  if (!partyId) return null;

  const party = data?.party;
  const entries = data?.entries || [];

  function handleExportCsv() {
    if (!party) return;
    exportToCsv(
      `statement_${party.code}_${new Date().toISOString().split('T')[0]}`,
      [
        { header: 'Date', accessor: (e) => formatDate(e.date) },
        { header: 'Reference No', accessor: (e) => e.referenceNo || '' },
        { header: 'Particulars', accessor: (e) => e.description || '' },
        { header: 'Debit (Rs)', accessor: (e) => (e.entryType === 'DEBIT' ? e.amount : 0) },
        { header: 'Credit (Rs)', accessor: (e) => (e.entryType === 'CREDIT' ? e.amount : 0) },
        { header: 'Running Balance (Rs)', accessor: (e) => e.runningBalance }
      ],
      entries
    );
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={party ? `Statement of Account • ${party.code}` : 'Party Statement of Account'}
      description="Chronological running balance ledger statement with all debit invoices and credit payments."
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {party && (
          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
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
                {party.currentBalance > 0 ? 'Dr (Receivable)' : party.currentBalance < 0 ? 'Cr (Payable)' : 'Settled'}
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
            <thead className="bg-zinc-900 sticky top-0 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Reference #</th>
                <th className="py-2.5 px-3">Particulars / Narrative</th>
                <th className="py-2.5 px-3 text-right">Debit (Rs.)</th>
                <th className="py-2.5 px-3 text-right">Credit (Rs.)</th>
                <th className="py-2.5 px-3 text-right">Running Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading statement entries...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No ledger entries found for this party.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e._id} className="hover:bg-zinc-900/40">
                    <td className="py-2 px-3 font-mono text-zinc-400 whitespace-nowrap">
                      {formatDate(e.date)}
                    </td>

                    <td className="py-2 px-3 font-mono font-semibold text-emerald-400 whitespace-nowrap">
                      {e.referenceNo || '—'}
                    </td>

                    <td className="py-2 px-3 text-zinc-300">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 grid grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase">Total Debits (+)</div>
              <div className="font-bold text-zinc-200 mt-0.5">{formatCurrency(data.totalDebits)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Total Credits (-)</div>
              <div className="font-bold text-emerald-400 mt-0.5">{formatCurrency(data.totalCredits)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-500 uppercase">Net Closing Balance</div>
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
