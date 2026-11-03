import { Input } from './Input.js';

export function ShortageOption({ value, onChange }: { value?: string; onChange: (value: string | undefined) => void }) {
  return <div className="space-y-2 rounded-lg border border-line p-3">
    <label className="flex items-center gap-2 text-sm font-medium text-strong">
      <input type="checkbox" checked={value !== undefined} onChange={event => onChange(event.target.checked ? '' : undefined)} />
      Post with shortage
    </label>
    {value !== undefined && <>
      <p className="text-xs text-soft">Enter what is missing. Any shortage or missing issue will appear in Reconciliation.</p>
      <Input label="Shortage reason" value={value} onChange={event => onChange(event.target.value)} minLength={3} maxLength={500} required />
    </>}
  </div>;
}
