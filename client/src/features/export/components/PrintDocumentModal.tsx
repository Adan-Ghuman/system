import { DispatchItem } from '../../dispatch/types/dispatch.types.js';
import { OgpChallanDocument } from './OgpChallanDocument.js';
import { TaxInvoiceDocument } from './TaxInvoiceDocument.js';
import { Button } from '../../../components/ui/Button.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Printer } from 'lucide-react';
export interface PrintDocumentModalProps { isOpen: boolean; onClose: () => void; type: 'OGP' | 'INVOICE'; dispatch: DispatchItem | null; }
export function PrintDocumentModal({ isOpen, onClose, type, dispatch }: PrintDocumentModalProps) {
  if (!dispatch) return null;
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={type === 'OGP' ? 'Delivery gate pass · ' + dispatch.ogpNo : 'Invoice · ' + (dispatch.invoice?.invoiceNo || 'Draft')}
      description="Review the document, then print it or save it as a PDF." className="max-w-4xl"
      footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-soft">A4 document · print or save as PDF</p><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" />Print document</Button></div></div>}>
      <div id="print-area" className="overflow-x-auto rounded-lg bg-white"><div className="min-w-[700px]">{type === 'OGP' ? <OgpChallanDocument dispatch={dispatch} /> : <TaxInvoiceDocument dispatch={dispatch} />}</div></div>
    </Dialog>
  );
}
