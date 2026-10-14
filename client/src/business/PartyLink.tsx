import { Link } from 'react-router-dom';

export function PartyLink({ party }: { party?: { _id: string; name: string } | null }) {
  if (!party) return <>—</>;
  return <Link className="font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2" to={`/accounts/parties/${party._id}/ledger`}>{party.name}</Link>;
}
