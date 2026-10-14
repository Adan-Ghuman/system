import { Link } from 'react-router-dom';
import { useBusinessStore } from './store.js';

export function PartyLink({ party }: { party?: { _id: string; name: string } | null }) {
  const businessId = useBusinessStore(state => state.id);
  if (!party) return <>—</>;
  return <Link className="font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2" to={`${businessId ? '/b/' + businessId : ''}/accounts/parties/${party._id}/ledger`}>{party.name}</Link>;
}
