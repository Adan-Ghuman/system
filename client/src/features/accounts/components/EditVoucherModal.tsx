import { loadAllRecords } from '../../../lib/pagedResources.js';
import { FormSection } from '../../../components/ui/WorkflowForm.js';
import { useState, useEffect, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { formatCurrency } from '../../../lib/formatters.js';
import { AlertCircle, CheckCircle2, ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { VoucherType, PaymentMode, PaymentVoucherItem, UpdateVoucherPayload } from '../types/accounts.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

export interface EditVoucherModalProps {
  voucher: PaymentVoucherItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_MODES: { label: string; value: PaymentMode }[] = [
  { label: 'Cash in Hand', value: 'CASH' },
  { label: 'Bank Transfer (Online)', value: 'BANK_TRANSFER' },
  { label: 'Bank Cheque / Pay Order', value: 'CHEQUE' },
  { label: 'Digital Wallet / Other Online', value: 'ONLINE' }
];

export function EditVoucherModal({
  voucher,
  isOpen,
  onClose,
  onSuccess
}: EditVoucherModalProps) {
  const [voucherType, setVoucherType] = useState<VoucherType>('RECEIPT');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (voucher) {
      setVoucherType(voucher.voucherType);
      setPaymentMode(voucher.paymentMode);
      setPartyId(typeof voucher.partyId === 'object' ? voucher.partyId._id : voucher.partyId);
      setAmount(voucher.amount.toString());
      setDate(voucher.date ? voucher.date.split('T')[0] : '');
      setBankName(voucher.bankName || '');
      setChequeNo(voucher.chequeNo || '');
      setChequeDate(voucher.chequeDate ? voucher.chequeDate.split('T')[0] : '');
      setTransactionRef(voucher.transactionRef || '');
      setRemarks(voucher.remarks || '');
      setConfirmDelete(false);
      setError(null);
      setSuccess(null);
    }
  }, [voucher]);

  const { data: partiesData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['party-options', 'all'],
    queryFn: async () => {
      return loadAllRecords<PartyItem>('/parties', { });
    },
    enabled: isOpen
  });

  const parties = partiesData?.items || [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!voucher || isSubmittingRef.current || isLoading || isDeleting) return;
    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: UpdateVoucherPayload = {
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

      await api.put(`/accounts/vouchers/${voucher._id}`, payload);

      setSuccess('Payment voucher updated successfully and ledger recalculated');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 700);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to update voucher');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  async function handleDelete() {
    if (!voucher || isDeletingRef.current || isDeleting || isLoading) return;
    isDeletingRef.current = true;
    setError(null);
    setIsDeleting(true);

    try {
      await api.delete(`/accounts/vouchers/${voucher._id}`);
      setSuccess('Payment voucher deleted and ledger updated');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 700);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to delete voucher');
    } finally {
      setIsDeleting(false);
      isDeletingRef.current = false;
    }
  }

  if (!isOpen || !voucher) return null;

  return (
    <Dialog footer={<div className="  flex flex-wrap items-center justify-between">
          <div>
            {!confirmDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Voucher
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
              Cancel
            </Button>
            <Button type="submit" form="edit-voucher-modal-form" size="sm" isLoading={isLoading} className="text-xs h-8">
              Save Changes
            </Button>
          </div>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Payment Voucher • ${voucher.voucherNo}`}
      description="Update payment details or delete this voucher. Changes will automatically recompute the party ledger."
      className="max-w-xl"
    >
      <form id="edit-voucher-modal-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-md flex items-center gap-2 text-xs text-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md flex items-center gap-2 text-xs text-brand">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {confirmDelete && (
          <div className="p-3.5 bg-danger-soft border border-line rounded-lg space-y-2">
            <div className="text-xs font-semibold text-danger flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-danger" />
              Confirm Voucher Deletion
            </div>
            <p className="text-xs text-ink">
              Are you sure you want to permanently delete <strong className="text-strong font-mono">{voucher.voucherNo}</strong>?
              This will remove this record, delete its ledger entry, and restore the party's account balance.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                isLoading={isDeleting}
                className="h-7 text-xs"
              >
                Yes, Delete Voucher
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <FormSection step={1} title="Payment details">
<div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVoucherType('RECEIPT')}
            className={`p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
              voucherType === 'RECEIPT'
                ? 'bg-brand-soft border-emerald-500/50 text-strong'
                : 'bg-canvas border-line text-soft hover:border-control'
            }`}
          >
            <div className={`p-1.5 rounded-md ${voucherType === 'RECEIPT' ? 'bg-emerald-500 text-strong' : 'bg-subtle text-soft'}`}>
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold">Money Received (Receipt)</div>
              <div className="text-xs text-soft mt-0.5">Customer paid us money</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setVoucherType('PAYMENT')}
            className={`p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
              voucherType === 'PAYMENT'
                ? 'bg-info-soft border-purple-500/50 text-strong'
                : 'bg-canvas border-line text-soft hover:border-control'
            }`}
          >
            <div className={`p-1.5 rounded-md ${voucherType === 'PAYMENT' ? 'bg-purple-500 text-strong' : 'bg-subtle text-soft'}`}>
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold">Money Paid (Payment)</div>
              <div className="text-xs text-soft mt-0.5">We paid vendor or knitter</div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            id="partySelect"
            label="Customer / Supplier"
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            options={parties.map((p) => ({
              label: `${p.code} - ${p.name} (Bal: ${formatCurrency(p.currentBalance)})`,
              value: p._id
            }))}
            required
          />

          <Select
            id="paymentModeSelect"
            label="Payment Method"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            options={PAYMENT_MODES}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            id="voucherAmount"
            type="number"
            step="0.01"
            min="0.01"
            label="Payment Amount (PKR)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <Input
            id="voucherDate"
            type="date"
            label="Payment Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {(paymentMode === 'BANK_TRANSFER' || paymentMode === 'CHEQUE' || paymentMode === 'ONLINE') && (
          <div className="p-3 bg-canvas/80 rounded-lg border border-line space-y-3">
            <div className="text-xs font-semibold text-ink">Bank & Cheque Details</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                id="bankName"
                label="Bank Name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Example Bank"
              />

              <Input
                id="chequeNo"
                label={paymentMode === 'CHEQUE' ? 'Cheque / Pay Order #' : 'Txn Reference #'}
                value={paymentMode === 'CHEQUE' ? chequeNo : transactionRef}
                onChange={(e) =>
                  paymentMode === 'CHEQUE' ? setChequeNo(e.target.value) : setTransactionRef(e.target.value)
                }
                placeholder={paymentMode === 'CHEQUE' ? 'Cheque number' : 'Online transaction ID'}
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
</FormSection>

        <FormSection step={2} title="Notes">
<Input
          id="remarks"
          label="Remarks / Notes"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Cleared bill for Batch #98, payment on account..."
        />
</FormSection>


      </form>
    </Dialog>
  );
}
