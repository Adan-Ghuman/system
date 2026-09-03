import { DispatchItem } from '../../dispatch/types/dispatch.types.js';
import { OgpChallanDocument } from './OgpChallanDocument.js';
import { TaxInvoiceDocument } from './TaxInvoiceDocument.js';
import { Button } from '../../../components/ui/Button.js';
import { Printer, X } from 'lucide-react';

export interface PrintDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'OGP' | 'INVOICE';
  dispatch: DispatchItem | null;
}

export function PrintDocumentModal({ isOpen, onClose, type, dispatch }: PrintDocumentModalProps) {
  if (!isOpen || !dispatch) return null;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:h-auto print:max-h-none print:bg-white print:rounded-none">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80 print:hidden">
          <div>
            <h2 className="text-sm font-bold text-white">
              {type === 'OGP' ? `Outward Gate Pass: ${dispatch.ogpNo}` : `Commercial Invoice: ${dispatch.invoice?.invoiceNo || 'DRAFT'}`}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Standardized A4 business document layout optimized for direct thermal/laser printing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </Button>

            <Button variant="outline" size="sm" onClick={onClose} className="p-1.5 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div id="print-area" className="flex-1 overflow-y-auto p-4 bg-zinc-950 print:p-0 print:overflow-visible print:bg-white">
          {type === 'OGP' ? (
            <OgpChallanDocument dispatch={dispatch} />
          ) : (
            <TaxInvoiceDocument dispatch={dispatch} />
          )}
        </div>
      </div>
    </div>
  );
}
