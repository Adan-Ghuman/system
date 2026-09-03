import { DispatchItem } from '../../dispatch/types/dispatch.types.js';
import { formatWeight, formatDate } from '../../../lib/formatters.js';

export interface OgpChallanDocumentProps {
  dispatch: DispatchItem;
}

export function OgpChallanDocument({ dispatch }: OgpChallanDocumentProps) {
  const rolls = dispatch.rolls || [];
  const chunkSize = Math.ceil(rolls.length / 3) || 1;
  const col1 = rolls.slice(0, chunkSize);
  const col2 = rolls.slice(chunkSize, chunkSize * 2);
  const col3 = rolls.slice(chunkSize * 2);

  return (
    <div className="bg-white text-zinc-950 p-8 max-w-4xl mx-auto font-sans leading-relaxed border border-zinc-200 shadow-xs print:border-none print:shadow-none print:p-0">
      <div className="border-b-2 border-zinc-950 pb-4 mb-4 text-center">
        <h1 className="text-2xl font-black tracking-wider uppercase text-zinc-950">
          Ghumman Textile & Knitting Mills
        </h1>
        <p className="text-xs font-semibold text-zinc-700 mt-0.5 tracking-wide">
          Manufacturers & Job-Work Processors • Sambrial Road, Sialkot, Pakistan
        </p>
        <p className="text-[11px] text-zinc-600">
          Phone: +92-300-1234567 • NTN: 3918204-7 • STRN: 3277876123456
        </p>

        <div className="inline-block mt-3 px-4 py-1 bg-zinc-950 text-white text-xs font-bold uppercase tracking-widest rounded-sm">
          Outward Gate Pass (OGP) • Delivery Challan
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-4 p-3 bg-zinc-50 border border-zinc-300 rounded-sm">
        <div>
          <div className="text-[10px] uppercase font-bold text-zinc-500">Consignee / Destination</div>
          <div className="font-bold text-sm text-zinc-950 mt-0.5">{dispatch.customerId?.name}</div>
          <div className="text-zinc-700 font-mono mt-0.5">Code: {dispatch.customerId?.code}</div>
          <div className="text-zinc-700">Phone: {dispatch.customerId?.phone || '—'}</div>
        </div>

        <div className="text-right space-y-1">
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">OGP Number:</span>
            <span className="font-mono font-black text-sm text-zinc-950">{dispatch.ogpNo}</span>
          </div>
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">Dispatch Ref:</span>
            <span className="font-mono font-semibold text-zinc-800">{dispatch.dispatchNo}</span>
          </div>
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">Date:</span>
            <span className="font-mono text-zinc-800">{formatDate(dispatch.date)}</span>
          </div>
          <div>
            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px]">Dispatch Location:</span>
            <span className="font-semibold text-zinc-900">{dispatch.fromLocation}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs mb-4 p-2.5 border border-zinc-300 rounded-sm">
        <div>
          <span className="text-[10px] uppercase font-bold text-zinc-500 block">Fabric Variety</span>
          <span className="font-bold text-zinc-950">{dispatch.fabricType}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-zinc-500 block">Yarn Specification</span>
          <span className="font-mono text-zinc-800">{dispatch.yarnSpec}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-zinc-500 block">Color / Shade</span>
          <span className="font-black text-zinc-950 uppercase">{dispatch.color}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-zinc-800 border-b border-zinc-400 pb-1 flex items-center justify-between">
          <span>Itemized Roll Weight Breakdown</span>
          <span className="font-normal text-[10px] text-zinc-600">Total Rolls: {dispatch.totalRolls}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[col1, col2, col3].map((column, colIdx) => (
            <div key={colIdx} className="border border-zinc-300 rounded-sm overflow-hidden">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-bold uppercase text-[9px]">
                  <tr>
                    <th className="py-1 px-2 text-center w-14">Roll #</th>
                    <th className="py-1 px-2 text-right">Net Wt (Kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-mono">
                  {column.map((r, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-zinc-50' : ''}>
                      <td className="py-0.5 px-2 text-center text-zinc-600">#{r.rollNumber}</td>
                      <td className="py-0.5 px-2 text-right font-bold text-zinc-950">{r.netWeightKg.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-zinc-950 p-3 rounded-sm mb-4 bg-zinc-100 flex items-center justify-between text-xs font-mono">
        <div>
          <span className="text-zinc-600 font-sans text-[10px] uppercase block font-bold">Total Dispatched Rolls</span>
          <span className="text-base font-black text-zinc-950">{dispatch.totalRolls} Rolls</span>
        </div>

        <div className="text-center">
          <span className="text-zinc-600 font-sans text-[10px] uppercase block font-bold">Driver / Transport Vehicle</span>
          <span className="text-xs font-bold text-zinc-800">
            {dispatch.driverName || 'Self'} {dispatch.vehicleNo ? `(${dispatch.vehicleNo})` : ''}
          </span>
        </div>

        <div className="text-right">
          <span className="text-zinc-600 font-sans text-[10px] uppercase block font-bold">Net Total Weight</span>
          <span className="text-lg font-black text-zinc-950">{formatWeight(dispatch.totalNetWeightKg)}</span>
        </div>
      </div>

      {dispatch.remarks && (
        <div className="text-[11px] text-zinc-600 mb-6 italic border-l-2 border-zinc-400 pl-2">
          Note: {dispatch.remarks}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 text-center text-[10px] pt-12 border-t border-zinc-400 mt-8">
        <div>
          <div className="border-t border-zinc-400 pt-1.5 font-bold text-zinc-800 uppercase">
            Prepared By
          </div>
          <div className="text-zinc-500 mt-0.5">Dispatch Clerk</div>
        </div>

        <div>
          <div className="border-t border-zinc-400 pt-1.5 font-bold text-zinc-800 uppercase">
            Checked By
          </div>
          <div className="text-zinc-500 mt-0.5">Warehouse Supervisor</div>
        </div>

        <div>
          <div className="border-t border-zinc-400 pt-1.5 font-bold text-zinc-800 uppercase">
            Security Incharge
          </div>
          <div className="text-zinc-500 mt-0.5">Main Gate Clearance</div>
        </div>

        <div>
          <div className="border-t border-zinc-400 pt-1.5 font-bold text-zinc-800 uppercase">
            Driver / Consignee
          </div>
          <div className="text-zinc-500 mt-0.5">Receiver Signature</div>
        </div>
      </div>
    </div>
  );
}
