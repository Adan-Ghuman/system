import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { CatalogField } from '../components/ui/CatalogField.js';
import { OptionalDetails } from '../components/ui/WorkflowForm.js';

export interface BlendComponent { yarnSpec: string; weightKg: string; }
export function BlendAllocation({ value, onChange }: { value: BlendComponent[]; onChange: (value: BlendComponent[]) => void }) {
  return <OptionalDetails title="Blended yarn · choose actual component consumption"><p className="text-xs text-soft">Use this when fabric uses more than one yarn. Component kg must add up to fabric kg plus actual wastage. No split is assumed.</p>{value.map((item, index) => <div className="space-y-3 rounded-lg border border-line p-3" key={index}><div className="grid gap-3 sm:grid-cols-2"><CatalogField kind="YARN" label={`Component ${index + 1} yarn`} required value={item.yarnSpec} onChange={yarnSpec => onChange(value.map((component, position) => position === index ? { ...component, yarnSpec } : component))} /><Input label="Actual consumed kg" required type="number" min="0.001" step="0.001" value={item.weightKg} onChange={event => onChange(value.map((component, position) => position === index ? { ...component, weightKg: event.target.value } : component))} placeholder="e.g. 20.000" /></div><Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_component, position) => position !== index))}>Remove component</Button></div>)}<Button variant="outline" size="sm" onClick={() => onChange([...value, { yarnSpec: '', weightKg: '' }])}>Add yarn component</Button></OptionalDetails>;
}
