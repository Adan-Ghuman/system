import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { formatCurrency } from '../../../lib/formatters.js';
import { AlertCircle, CheckCircle2, DollarSign, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { VoucherType, PaymentMode, CreateVoucherPayload } from '../types/accounts.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

export interface CreateVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedPartyId?: string;
  initialType?: VoucherType;
}

const PAYMENT_MODES: { label: string; value: PaymentMode }[] = [
  { label: 'Cash Payment', value: 'CASH' },
  { label: 'Bank Transfer / Online RTGS', value: 'BANK_TRANSFER' },
  { label: 'Cheque / Pay Order', value: 'CHEQUE' },
  { label: 'Online / Digital Wallet', value: 'ONLINE' }
];

export function CreateVoucherModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedPartyId,
  initialType = 'RECEIPT'
}: CreateVoucherModalProps) {
  const [voucherType, setVoucherType] = useState<VoucherType>(initialType);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('50000');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankName, setBankName] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setVoucherType(initialType);
  }, [initialType]);

  const { data: partiesData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties-for-vouchers'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const parties = partiesData?.items || [];

  useEffect(() => {
    if (preselectedPartyId) {
      setPartyId(preselectedPartyId);
    } else if (parties.length > 0 && !partyId) {
      setPartyId(parties[0]._id);
    }
  }, [preselectedPartyId, parties, partyId]);

  const selectedParty = parties.find((p) => p._id === partyId);

  const balancePreview = useMemo(() => {
    if (!selectedParty) return { current: 0, delta: 0, projected: 0 };
    const current = selectedParty.currentBalance;
    const numAmount = parseFloat(amount) || 0;
    const delta = voucherType === 'RECEIPT' ? -numAmount : numAmount;
    const projected = Math.round((current + delta) * 100) / 100;
    return { current, delta, projected };
  }, [selectedParty, amount, voucherType]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: CreateVoucherPayload = {
        voucherType,
        paymentMode,
        partyId,
        amount: parseFloat(amount),
        date: new Date(date).toISOString(),
        bankName: bankName.trim(),
        chequeNo: chequeNo.trim(),
        chequeDate: chequeDate ? new Date(chequeDate).toISOString() : undefined,
        transactionRef: transactionRef.trim(),
        remarks: remarks.trim()
      };

      await api.post('/accounts/vouchers', payload);

      setSuccess('Payment voucher recorded and party ledger balance updated');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to record voucher');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={voucherType === 'RECEIPT' ? 'Record Customer Receipt Voucher' : 'Record Supplier Payment Voucher'}
      description="Post cash, bank, or cheque vouchers with instant party balance updates."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex items-center gap-2 p-1 rounded-md bg-zinc-950 border border-zinc-800">
          <button
            type="button"
            onClick={() => setVoucherType('RECEIPT')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded transition-colors ${
              voucherType === 'RECEIPT'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Inward Receipt (From Buyer)</span>
          </button>
          <button
            type="button"
            onClick={() => setVoucherType('PAYMENT')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded transition-colors ${
              voucherType === 'PAYMENT'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Outward Payment (To Supplier / Mill)</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="voucherParty"
            label="Party Account"
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            options={parties.map((p) => ({
              label: `${p.code} - ${p.name} (${formatCurrency(p.currentBalance)})`,
              value: p._id
            }))}
          />

          <Select
            id="paymentModeSelect"
            label="Payment Mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            options={PAYMENT_MODES}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="voucherAmount"
            type="number"
            step="0.01"
            min="0.01"
            label="Voucher Amount (PKR)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />

          <Input
            id="voucherDate"
            type="date"
            label="Voucher Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {(paymentMode === 'BANK_TRANSFER' || paymentMode === 'CHEQUE' || paymentMode === 'ONLINE') && (
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="text-xs font-semibold text-zinc-300">Bank / Instrument Information</div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="bankName"
                label="Bank Name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Meezan Bank / HBL"
              />

              <Input
                id="chequeNo"
                label={paymentMode === 'CHEQUE' ? 'Cheque / Pay Order #' : 'Transaction / Reference #'}
                value={paymentMode === 'CHEQUE' ? chequeNo : transactionRef}
                onChange={(e) => {
                  if (paymentMode === 'CHEQUE') {
                    setChequeNo(e.target.value);
                  } else {
                    setTransactionRef(e.target.value);
                  }
                }}
                placeholder="e.g. 10928371"
              />
            </div>

            {paymentMode === 'CHEQUE' && (
              <Input
                id="chequeDate"
                type="date"
                label="Cheque Clearance Date"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
              />
            )}
          </div>
        )}

        <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono">
          <div>
            <div className="text-zinc-500 text-[10px] uppercase">Current Balance:</div>
            <div className="font-bold text-zinc-200 mt-0.5">{formatCurrency(balancePreview.current)}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-500 text-[10px] uppercase">Voucher Effect:</div>
            <div className={`font-bold mt-0.5 ${voucherType === 'RECEIPT' ? 'text-emerald-400' : 'text-zinc-200'}`}>
              {voucherType === 'RECEIPT' ? '-' : '+'}{formatCurrency(parseFloat(amount) || 0)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-zinc-500 text-[10px] uppercase">Projected Balance:</div>
            <div className="font-bold text-white mt-0.5">{formatCurrency(balancePreview.projected)}</div>
          </div>
        </div>

        <Input
          id="voucherRemarks"
          label="Remarks / Narrative"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Payment for invoice INV-GST-001 received via online transfer"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5">
            <DollarSign className="w-4 h-4" />
            <span>Post Voucher to Ledger</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
