import { useNavigate, useParams } from 'react-router-dom';
import { PartyLedgerModal } from '../features/accounts/components/PartyLedgerModal.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { useBusinessStore } from './store.js';

export function LedgerPage() {
  const { partyId } = useParams();const navigate = useNavigate();const businessId = useBusinessStore(state => state.id);
  return <><PageHeader title="Party ledger" description="Statement for the selected party in the active business." /><PartyLedgerModal partyId={partyId || null} isOpen={Boolean(partyId)} onClose={() => navigate(`${businessId ? '/b/' + businessId : ''}/accounts`)} /></>;
}
