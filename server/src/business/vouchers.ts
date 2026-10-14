import { ClientSession } from 'mongoose';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { Party } from '../models/Party.js';
import { BillPayment } from './commerce.models.js';
import { postCommand, nextDocumentNo, money } from './posting.js';
import { postPartyAmount } from './finance.js';
import { CreateVoucherInput, UpdateVoucherInput } from '../modules/accounts/accounts.schema.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

async function post(input: CreateVoucherInput, session: ClientSession) {
  if (!await Party.findById(input.partyId).session(session)) throw new NotFoundError('Party not found in this business.');
  if (money(input.amount) < 0.01) throw new BadRequestError('Enter an amount of at least 0.01.');
  const number = await nextDocumentNo(input.voucherType === 'PAYMENT' ? 'PAY' : 'RCPT', session);
  const [voucher] = await PaymentVoucher.create([{ ...input, amount: money(input.amount), voucherNo: number, date: new Date(input.date), chequeDate: input.chequeDate ? new Date(input.chequeDate) : undefined }], { session });
  await postPartyAmount(input.partyId, input.voucherType === 'RECEIPT' ? -input.amount : input.amount, voucher._id, number, new Date(input.date), `${input.voucherType} via ${input.paymentMode}: ${input.remarks}`, session);return voucher;
}
async function reverse(id: string, session: ClientSession, reason: string) {
  const voucher = await PaymentVoucher.findOne({ _id: id, status: { $ne: 'REVERSED' } }).session(session);
  if (!voucher) throw new NotFoundError('Posted voucher not found.');
  if (await BillPayment.exists({ voucherId: id }).session(session)) throw new BadRequestError('Open the bill to reverse this payment and its allocation together.');
  await postPartyAmount(voucher.partyId, voucher.voucherType === 'RECEIPT' ? voucher.amount : -voucher.amount, voucher._id, voucher.voucherNo, new Date(), reason, session);
  voucher.status = 'REVERSED';voucher.remarks = `${voucher.remarks || ''} | ${reason}`;await voucher.save({ session });return voucher;
}
export async function postStandaloneVoucher(input: CreateVoucherInput) { return postCommand('STANDALONE_VOUCHER', input, session => post(input, session)); }
export async function correctStandaloneVoucher(id: string, input: UpdateVoucherInput) {
  return postCommand('CORRECT_VOUCHER', { ...input, id }, async session => {
    const original = await reverse(id, session, 'Reversed for corrected voucher');
    return post({ ...input, voucherType: input.voucherType || original.voucherType, paymentMode: input.paymentMode || original.paymentMode, partyId: input.partyId || String(original.partyId), amount: input.amount ?? original.amount, date: input.date || original.date.toISOString(), bankName: input.bankName ?? original.bankName ?? '', chequeNo: input.chequeNo ?? original.chequeNo ?? '', chequeDate: input.chequeDate || original.chequeDate?.toISOString(), transactionRef: input.transactionRef ?? original.transactionRef ?? '', remarks: input.remarks ?? '' }, session);
  });
}
export async function reverseStandaloneVoucher(id: string) { return postCommand('REVERSE_VOUCHER', { id, requestId: `reverse-voucher-${id}` }, session => reverse(id, session, 'Voucher reversed by operator')); }
