interface OwnerParty { _id: string; name: string; }

const ownPartyName = /^\s*roz(?:ain|in)\s+(?:text(?:ile|itle)(?:\s+godown)?|knitting)\s*$/i;

export function ownerOptions(parties: OwnerParty[], includeOwn = true) {
  return [
    ...(includeOwn ? [{ value: 'OWN', label: 'Rozain Textile' }] : []),
    ...parties.filter(party => !ownPartyName.test(party.name)).map(party => ({ value: party._id, label: party.name }))
  ];
}

export function canonicalOwnerKey(value: string | undefined, parties: OwnerParty[]) {
  return !value || value === 'OWN' || parties.some(party => party._id === value && ownPartyName.test(party.name)) ? 'OWN' : value;
}
