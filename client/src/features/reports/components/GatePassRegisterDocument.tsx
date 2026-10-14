import { DyeingBatchItem } from '../../dyeing/types/dyeing.types.js';
import { formatDate, formatWeight } from '../../../lib/formatters.js';

export function GatePassRegisterDocument({ rows, type, partyName, millName, dateFrom, dateTo }: {
  rows: DyeingBatchItem[];
  type: 'OGP' | 'IGP';
  partyName: string;
  millName: string;
  dateFrom: string;
  dateTo: string;
}) {
  return (
    <div id="print-area" className="hidden bg-white text-slate-900 print:block">
      <h1 className="text-xl font-semibold">Rozain Textile · {type} register</h1>
      <p className="my-2 text-xs">{partyName} · {millName} · {dateFrom ? formatDate(dateFrom) : 'Beginning'} to {dateTo ? formatDate(dateTo) : 'Today'}</p>
      <table className="w-full text-left text-xs">
        <thead><tr><th>Date</th><th>Pass / lot</th><th>Fabric / yarn</th><th>Color</th><th>Rolls</th><th>Raw kg</th><th>Weight kg</th><th>Remarks</th></tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row._id}>
              <td className="py-2 pr-2">{formatDate(type === 'OGP' ? row.dateReceived || row.dateIssued : row.dateIssued)}</td>
              <td className="py-2 pr-2">{(type === 'OGP' ? row.ogpNo : row.igpNo) || row.batchNo}<br />{row.batchNo}</td>
              <td className="py-2 pr-2">{row.fabricType}<br />{row.yarnSpec}</td>
              <td className="py-2 pr-2">{row.targetColor}</td>
              <td className="py-2 pr-2">{type === 'OGP' ? row.finishRollsCount || row.ecruRollsCount || 1 : row.ecruRollsCount || 1}</td>
              <td className="py-2 pr-2">{formatWeight(row.ecruWeightKg)}</td>
              <td className="py-2 pr-2">{formatWeight(type === 'OGP' ? row.finishWeightKg || row.ecruWeightKg : row.ecruWeightKg)}</td>
              <td className="py-2">{row.remarks || '—'}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} className="py-4">No records match these filters.</td></tr>}
        </tbody>
      </table>
      <p className="mt-4 text-xs">{rows.length} records</p>
    </div>
  );
}
