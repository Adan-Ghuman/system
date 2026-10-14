import { useState } from 'react';
import { PartyCombobox, PartyComboboxProps } from '../components/ui/PartyCombobox.js';
import { Button } from '../components/ui/Button.js';
import { CreatePartyModal } from '../features/parties/components/CreatePartyModal.js';

export function PartySelector(props: PartyComboboxProps) {
  const [creating, setCreating] = useState(false);
  return <div className="space-y-2"><PartyCombobox {...props} allowCustom={false} /><Button size="sm" variant="ghost" onClick={() => setCreating(true)}>Add new party</Button>{creating && <CreatePartyModal isOpen onClose={() => setCreating(false)} onSuccess={() => {}} onCreated={party => { props.onChange(party._id);setCreating(false); }} />}</div>;
}
