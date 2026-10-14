import { useState } from 'react';
import { Input } from './Input.js';
import { OptionalDetails } from './WorkflowForm.js';

interface ReferenceValues { poNo: string; externalReference: string; requestId: string; }
export function useDocumentReferences() { return useState<ReferenceValues>(() => ({ poNo: '', externalReference: '', requestId: crypto.randomUUID() })); }
export function DocumentReferences({ value, onChange }: { value: ReferenceValues; onChange: (value: ReferenceValues) => void }) {
  return <OptionalDetails title="PO and reference numbers (optional)"><div className="grid gap-4 sm:grid-cols-2"><Input label="PO number" value={value.poNo} onChange={event => onChange({ ...value, poNo: event.target.value })} placeholder="e.g. 0033/26" /><Input label="External reference" value={value.externalReference} onChange={event => onChange({ ...value, externalReference: event.target.value })} placeholder="e.g. 1234" /></div></OptionalDetails>;
}
