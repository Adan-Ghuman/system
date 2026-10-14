import { useNavigate, useParams } from 'react-router-dom';
import { PartyLedgerModal } from '../features/accounts/components/PartyLedgerModal.js';
import { PageHeader } from '../components/ui/PageHeader.js';

export function LedgerPage() {
  const { partyId } = useParams();const navigate = useNavigate();
  return <><PageHeader title="Party ledger" description="Statement for the selected party." /><PartyLedgerModal partyId={partyId || null} isOpen={Boolean(partyId)} onClose={() => navigate('/accounts')} /></>;
}
