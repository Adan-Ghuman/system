import { DispatchItem } from '../../dispatch/types/dispatch.types.js';
import { formatCurrency, formatWeight, formatDate } from '../../../lib/formatters.js';
import { numberToWords } from '../../../lib/numberToWords.js';

export interface TaxInvoiceDocumentProps {
  dispatch: DispatchItem;
}

export function TaxInvoiceDocument({ dispatch }: TaxInvoiceDocumentProps) {
  const invoice = dispatch.invoice;
  const isGst = invoice?.invoiceType === 'TAX_18_PERCENT';
  const grandTotal = invoice?.grandTotal || 0;

  return (
    <div className="bg-white text-zinc-950 p-8 max-w-4xl mx-auto font-sans leading-relaxed border border-zinc-200 shadow-xs print:border-none print:shadow-none print:p-0">
      <div className="border-b-2 border-zinc-950 pb-4 mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-wider uppercase text-zinc-950">
            Ghumman Textile & Knitting Mills
          </h1>
          <p className="text-xs font-semibold text-zinc-700 mt-0.5 tracking-wide">
            Manufacturers & Processors • Sambrial Road, Sialkot, Pakistan
          </p>
          <div className="text-[11px] text-zinc-600 mt-1 space-x-3">
            <span>NTN: <strong>3918204-7</strong></span>
            <span>STRN: <strong>3277876123456</strong></span>
            <span>Phone: <strong>+92-300-1234567</strong></span>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block px-3 py-1 bg-zinc-950 text-white text-xs font-bold uppercase tracking-widest rounded-sm mb-2">
            {isGst ? 'Sales Tax Invoice (18% GST)' : 'Commercial Delivery Bill'}
          </div>
          <div className="text-xs font-mono font-black text-sm text-zinc-950">
            Invoice: {invoice?.invoiceNo || 'INV-DRAFT'}
          </div>
          <div className="text-xs font-mono text-zinc-600 mt-0.5">
            Date: {formatDate(invoice?.date || dispatch.date)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-5 p-3 bg-zinc-50 border border-zinc-300 rounded-sm">
        <div>
          <div className="text-[10px] uppercase font-bold text-zinc-500">Bill To (Buyer)</div>
          <div className="font-bold text-base text-zinc-950 mt-0.5">{dispatch.customerId?.name}</div>
          <div className="text-zinc-700 font-mono mt-0.5">Party Code: {dispatch.customerId?.code}</div>
          <div className="text-zinc-700">Phone: {dispatch.customerId?.phone || '—'}</div>
        </div>

        <div className="text-right space-y-1 text-xs">
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">Dispatch Note Ref:</span>
            <span className="font-mono font-semibold text-zinc-900">{dispatch.dispatchNo}</span>
          </div>
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">Outward Gate Pass:</span>
            <span className="font-mono font-semibold text-zinc-900">{dispatch.ogpNo}</span>
          </div>
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">Payment Terms:</span>
            <span className="font-semibold text-zinc-900">Immediate / Current Account</span>
          </div>
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">Dispatch Location:</span>
            <span className="font-semibold text-zinc-900">{dispatch.fromLocation}</span>
          </div>
        </div>
      </div>

      <div className="border border-zinc-300 rounded-sm overflow-hidden mb-5">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-100 border-b border-zinc-300 text-zinc-800 font-bold uppercase text-[10px]">
            <tr>
              <th className="py-2 px-3 w-10 text-center">#</th>
              <th className="py-2 px-3">Description of Goods</th>
              <th className="py-2 px-3 text-center">Rolls</th>
              <th className="py-2 px-3 text-right">Net Weight (Kg)</th>
              <th className="py-2 px-3 text-right">Rate / Kg</th>
              <th className="py-2 px-3 text-right">Base Amount (PKR)</th>
              {isGst && (
                <>
                  <th className="py-2 px-3 text-right">GST (18%)</th>
                  <th className="py-2 px-3 text-right">Total Payable</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            <tr>
              <td className="py-3 px-3 text-center font-mono text-zinc-500">1</td>
              <td className="py-3 px-3">
                <div className="font-bold text-zinc-950 text-sm">{dispatch.fabricType}</div>
                <div className="text-[11px] text-zinc-600 font-mono mt-0.5">
                  Color: <strong>{dispatch.color}</strong> • Spec: {dispatch.yarnSpec}
                </div>
              </td>
              <td className="py-3 px-3 text-center font-mono font-bold text-zinc-800">
                {dispatch.totalRolls}
              </td>
              <td className="py-3 px-3 text-right font-mono font-bold text-zinc-950">
                {formatWeight(dispatch.totalNetWeightKg)}
              </td>
              <td className="py-3 px-3 text-right font-mono text-zinc-800">
                {formatCurrency(invoice?.ratePerKg || 0)}
              </td>
              <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-900">
                {formatCurrency(invoice?.baseAmount || 0)}
              </td>
              {isGst && (
                <>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">
                    {formatCurrency(invoice?.taxAmount || 0)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-zinc-950">
                    {formatCurrency(grandTotal)}
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2 text-xs">
          <div className="p-3 bg-zinc-50 border border-zinc-300 rounded-sm">
            <span className="font-bold uppercase text-[10px] text-zinc-500 block mb-0.5">Amount in Words</span>
            <span className="font-bold text-zinc-950 italic text-xs">
              {numberToWords(grandTotal)}
            </span>
          </div>

          <div className="p-2.5 border border-zinc-200 rounded-sm text-[11px] text-zinc-600">
            <span className="font-bold uppercase text-[9px] text-zinc-500 block mb-1">Bank Wire Transfer Account</span>
            <div>Bank: <strong>Meezan Bank Ltd, Sialkot Branch</strong></div>
            <div>Account Title: <strong>Ghuman Textile & Knitting Mills</strong></div>
            <div>IBAN: <strong className="font-mono">PK92MEZN0001092837123401</strong></div>
          </div>
        </div>

        <div className="border border-zinc-950 rounded-sm p-3.5 bg-zinc-100 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-zinc-700">
            <span>Subtotal (Base Value):</span>
            <span className="font-bold">{formatCurrency(invoice?.baseAmount || 0)}</span>
          </div>

          {isGst && (
            <div className="flex justify-between text-amber-700">
              <span>Sales Tax (18% FBR Rate):</span>
              <span className="font-bold">+{formatCurrency(invoice?.taxAmount || 0)}</span>
            </div>
          )}

          <div className="border-t-2 border-zinc-950 pt-2 flex justify-between text-base font-black text-zinc-950">
            <span>Total Payable:</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 text-center text-[11px] pt-14 border-t border-zinc-400 mt-8">
        <div>
          <div className="border-t border-zinc-400 pt-1.5 font-bold text-zinc-800 uppercase">
            Customer / Receiver Signature
          </div>
          <div className="text-zinc-500 text-[10px] mt-0.5">Acknowledgement of Goods Received in Good Condition</div>
        </div>

        <div>
          <div className="border-t border-zinc-400 pt-1.5 font-bold text-zinc-800 uppercase">
            For Ghumman Textile & Knitting Mills
          </div>
          <div className="text-zinc-500 text-[10px] mt-0.5">Authorized Signatory & Stamp</div>
        </div>
      </div>
    </div>
  );
}
