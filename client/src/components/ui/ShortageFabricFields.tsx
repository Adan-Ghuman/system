import { Input } from './Input.js';

export interface FabricIdentity {
  fabricType: string;
  yarnSpec: string;
  color: string;
}

export const emptyFabricIdentity: FabricIdentity = { fabricType: '', yarnSpec: '', color: '' };

export function ShortageFabricFields({ value, raw, onChange }: { value: FabricIdentity; raw?: boolean; onChange: (value: FabricIdentity) => void }) {
  return <div className="grid gap-3 sm:grid-cols-3">
    <Input label="Fabric name" value={value.fabricType} onChange={event => onChange({ ...value, fabricType: event.target.value })} required />
    <Input label="Yarn name / count" value={value.yarnSpec} onChange={event => onChange({ ...value, yarnSpec: event.target.value })} required />
    <Input label="Current shade" value={raw ? 'ECRU' : value.color} onChange={event => onChange({ ...value, color: event.target.value })} required readOnly={raw} />
  </div>;
}
