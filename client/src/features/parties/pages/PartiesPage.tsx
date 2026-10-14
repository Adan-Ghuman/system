import { useQueryPagination } from '../../../hooks/useQueryPagination.js';
import { QueryError } from '../../../components/ui/QueryError.js';
import { PageHeader } from '../../../components/ui/PageHeader.js';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { PartyItem } from '../types/party.types.js';
import { Button } from '../../../components/ui/Button.js';
import { Select } from '../../../components/ui/Select.js';
import { Input } from '../../../components/ui/Input.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardContent } from '../../../components/ui/Card.js';
import { PaginationControls } from '../../../components/ui/Pagination.js';
import { useDebounce } from '../../../hooks/useDebounce.js';
import { PartyBalanceBadge } from '../components/PartyBalanceBadge.js';
import { CreatePartyModal } from '../components/CreatePartyModal.js';
import { EditPartyModal } from '../components/EditPartyModal.js';
import { LoadingState } from '../../../components/ui/LoadingState.js';
import { ScrollableTable } from '../../../components/ui/ScrollableTable.js';
import { formatCurrency, formatDateTime } from '../../../lib/formatters.js';
import { UserPlus, RefreshCw, Edit2, ShoppingBag, Scissors, Palette, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

type TagFilter = 'all' | 'isFabricBuyer' | 'isKnitter' | 'isYarnClient' | 'isDyeingMill';
type SortByOption = 'latest' | 'oldest' | 'code' | 'name' | 'balance_desc' | 'balance_asc';
type BalanceFilterOption = 'all' | 'receivable' | 'payable' | 'zero';

export function PartiesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<TagFilter>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('latest');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilterOption>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyItem | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { page: page, limit: limit, setPage: setPage, setLimit: setLimit } = useQueryPagination([activeTag, sortBy, balanceFilter, debouncedSearchTerm]);

  const { isError: hasQueryError1,  data, isLoading, refetch } = useQuery<{
    items: PartyItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['parties', activeTag, sortBy, balanceFilter, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit, sortBy, balanceFilter };
      if (activeTag !== 'all') {
        params.tag = activeTag;
      }
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }
      const res = await api.get<{
        success: boolean;
        data: { items: PartyItem[]; total: number; page: number; limit: number; totalPages: number };
      }>('/parties', {
        params
      });
      return res.data.data;
    }
  });

  const parties = data?.items || [];

  const { data: summary, isError: summaryError, refetch: refetchSummary } = useQuery<{ total: number; buyers: number; knitters: number; mills: number; totalDr: number; totalCr: number }>({
    queryKey: ['parties-summary', activeTag, balanceFilter, debouncedSearchTerm],
    queryFn: async () => {
      const response = await api.get('/parties/summary', { params: { balanceFilter, ...(activeTag !== 'all' ? { tag: activeTag } : {}), ...(debouncedSearchTerm.trim() ? { search: debouncedSearchTerm.trim() } : {}) } });
      return response.data.data;
    }
  });
  const metrics = summary || { total: 0, buyers: 0, knitters: 0, mills: 0, totalDr: 0, totalCr: 0 };
  function refresh() { refetch(); refetchSummary(); }

  return (
    <div className="space-y-6">
      <PageHeader title="Parties" description="Customers, suppliers, knitters and dyeing mills, all in one directory."><div className="flex max-w-full flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} preventDoubleClick title="Refresh directory" className="gap-1 whitespace-nowrap shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 whitespace-nowrap shrink-0">
            <UserPlus className="w-4 h-4" />
            <span>Add Customer / Supplier</span>
          </Button>
        </div></PageHeader>
      {(hasQueryError1 || summaryError) && <QueryError onRetry={refresh} />}


      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-soft normal-case tracking-normal">Total Parties</div>
            <div className="text-lg font-bold text-strong mt-1">{metrics.total}</div>
            <div className="text-xs text-soft mt-0.5">{metrics.buyers} Buyers, {metrics.knitters} Knitters</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-soft normal-case tracking-normal flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 text-brand" />
              Fabric Buyers
            </div>
            <div className="text-lg font-bold text-brand mt-1">{metrics.buyers}</div>
            <div className="text-xs text-soft mt-0.5">Commercial clients</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-soft normal-case tracking-normal flex items-center gap-1">
              <Scissors className="w-3 h-3 text-info" />
              Contract Knitters
            </div>
            <div className="text-lg font-bold text-info mt-1">{metrics.knitters}</div>
            <div className="text-xs text-soft mt-0.5">Outside knitting units</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-brand normal-case tracking-normal flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              They Owe Us (Receivable)
            </div>
            <div className="text-lg font-bold text-brand mt-1">{formatCurrency(metrics.totalDr)}</div>
            <div className="text-xs text-brand mt-0.5">Balance to collect from buyers</div>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-line p-3">
          <CardContent className="p-0">
            <div className="text-xs font-medium text-warning normal-case tracking-normal flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              We Owe Them (Payable)
            </div>
            <div className="text-lg font-bold text-warning mt-1">{formatCurrency(metrics.totalCr)}</div>
            <div className="text-xs text-warning mt-0.5">Balance to pay to units & knitters</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-surface/50 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Select label="Party category" value={activeTag} onChange={event => setActiveTag(event.target.value as TagFilter)} options={[{label:'All parties',value:'all'},{label:'Fabric buyers',value:'isFabricBuyer'},{label:'Knitters',value:'isKnitter'},{label:'Yarn clients',value:'isYarnClient'},{label:'Dyeing units',value:'isDyeingMill'}]} />
        <Select label="Account balance" value={balanceFilter} onChange={event => setBalanceFilter(event.target.value as BalanceFilterOption)} options={[{label:'All balances',value:'all'},{label:'They owe us',value:'receivable'},{label:'We owe them',value:'payable'},{label:'Settled',value:'zero'}]} />
        <Select label="Order" value={sortBy} onChange={event => setSortBy(event.target.value as SortByOption)} options={[{label:'Newest first',value:'latest'},{label:'Oldest first',value:'oldest'},{label:'Code A–Z',value:'code'},{label:'Name A–Z',value:'name'},{label:'Highest receivable',value:'balance_desc'},{label:'Highest payable',value:'balance_asc'}]} />
        <Input label="Find a party" placeholder="e.g. Example Textiles" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
      </div>

      <Card className="border-line bg-surface/80 overflow-hidden">
        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas/90 border-b border-line text-soft normal-case font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Code</th>
                <th className="py-3 px-4 whitespace-nowrap">Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Party / Business Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Contact Person & Phone</th>
                <th className="py-3 px-4 whitespace-nowrap">Address / ML</th>
                <th className="py-3 px-4 whitespace-nowrap">Role Classification</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Opening Bal.</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Current Balance</th>
                <th className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-canvas z-20 border-l border-line shadow-sm">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={9} message="Loading customers & suppliers..." />
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-soft">
                    No parties found matching criteria.
                  </td>
                </tr>
              ) : (
                parties.map((party) => (
                  <tr key={party._id} className="group hover:bg-subtle/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand whitespace-nowrap">{party.code}</td>

                    <td className="py-3 px-4 text-ink font-mono whitespace-nowrap">
                      {formatDateTime(party.updatedAt || party.createdAt, true)}
                    </td>

                    <td className="py-3 px-4 font-semibold text-strong whitespace-nowrap">
                      {party.name}
                    </td>

                    <td className="py-3 px-4 text-ink whitespace-nowrap">
                      <span>{party.contactPerson || '—'}</span>
                      {party.phone && <span className="text-xs font-mono text-soft ml-1.5">({party.phone})</span>}
                    </td>

                    <td className="py-3 px-4 text-ink whitespace-nowrap">
                      <span>{party.address || '—'}</span>
                      {party.mlNo && <span className="text-xs text-soft font-mono ml-1.5">(ML: {party.mlNo})</span>}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {party.tags.isFabricBuyer && <Badge variant="default">Buyer</Badge>}
                        {party.tags.isKnitter && <Badge variant="secondary">Knitter</Badge>}
                        {party.tags.isYarnClient && <Badge variant="outline">Yarn Client</Badge>}
                        {party.tags.isDyeingMill && (
                          <Badge variant="warning" className="gap-1">
                            <Palette className="w-2.5 h-2.5" />
                            Dyeing Unit
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-soft whitespace-nowrap">
                      {formatCurrency(party.openingBalance)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <PartyBalanceBadge balance={party.currentBalance} />
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-surface group-hover:bg-subtle/90 transition-colors z-10 border-l border-line shadow-sm">
                      <button
                        onClick={() => setEditingParty(party)}
                        className="p-1.5 rounded text-soft hover:text-strong hover:bg-subtle transition-colors inline-flex items-center"
                        title="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
        <PaginationControls
          page={page}
          totalPages={data?.totalPages || 1}
          total={data?.total || 0}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </Card>

      {isCreateOpen && <CreatePartyModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refresh}
      />}

      <EditPartyModal
        party={editingParty}
        isOpen={Boolean(editingParty)}
        onClose={() => setEditingParty(null)}
        onSuccess={refresh}
      />
    </div>
  );
}
