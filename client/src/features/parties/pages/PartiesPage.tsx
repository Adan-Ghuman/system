import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { PartyItem } from '../types/party.types.js';
import { Button } from '../../../components/ui/Button.js';
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
import {
  UserPlus,
  Search,
  RefreshCw,
  Edit2,
  Users,
  ShoppingBag,
  Scissors,
  Palette,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpDown,
  Filter
} from 'lucide-react';

type TagFilter = 'all' | 'isFabricBuyer' | 'isKnitter' | 'isYarnClient' | 'isDyeingMill';
type SortByOption = 'latest' | 'oldest' | 'code' | 'name' | 'balance_desc' | 'balance_asc';
type BalanceFilterOption = 'all' | 'receivable' | 'payable' | 'zero';

export function PartiesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<TagFilter>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('latest');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilterOption>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyItem | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [activeTag, sortBy, balanceFilter, debouncedSearchTerm]);

  const { data, isLoading, refetch } = useQuery<{
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

  const metrics = useMemo(() => {
    let buyers = 0;
    let knitters = 0;
    let mills = 0;
    let totalDr = 0;
    let totalCr = 0;

    parties.forEach((p) => {
      if (p.tags.isFabricBuyer) buyers++;
      if (p.tags.isKnitter) knitters++;
      if (p.tags.isDyeingMill) mills++;

      if (p.currentBalance > 0) {
        totalDr += p.currentBalance;
      } else if (p.currentBalance < 0) {
        totalCr += Math.abs(p.currentBalance);
      }
    });

    return { buyers, knitters, mills, totalDr, totalCr, total: parties.length };
  }, [parties]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>Customers & Suppliers (Parties)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage customers, knitters, yarn suppliers, and dyeing units and view their running balances.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh directory" className="gap-1 whitespace-nowrap shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 whitespace-nowrap shrink-0">
            <UserPlus className="w-4 h-4" />
            <span>Add Customer / Supplier</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Total Parties</div>
            <div className="text-lg font-bold text-white mt-1">{metrics.total}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{metrics.buyers} Buyers, {metrics.knitters} Knitters</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 text-emerald-400" />
              Fabric Buyers
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1">{metrics.buyers}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Commercial clients</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Scissors className="w-3 h-3 text-purple-400" />
              Contract Knitters
            </div>
            <div className="text-lg font-bold text-purple-400 mt-1">{metrics.knitters}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Outside knitting units</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              They Owe Us (Receivable)
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(metrics.totalDr)}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Balance to collect from buyers</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              We Owe Them (Payable)
            </div>
            <div className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(metrics.totalCr)}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Balance to pay to units & knitters</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
        <div className="flex items-center gap-1 overflow-x-auto w-full xl:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: 'all', label: 'All Parties' },
            { id: 'isFabricBuyer', label: 'Fabric Buyers' },
            { id: 'isKnitter', label: 'Contract Knitters' },
            { id: 'isYarnClient', label: 'Yarn Clients' },
            { id: 'isDyeingMill', label: 'Dyeing Units' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTag(tab.id as TagFilter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors select-none ${
                activeTag === tab.id
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:w-auto">
          {/* Balance Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
            <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as BalanceFilterOption)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
              title="Filter by account balance"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">All Balances</option>
              <option value="receivable" className="bg-zinc-900 text-zinc-200">Receivable (Dr)</option>
              <option value="payable" className="bg-zinc-900 text-zinc-200">Payable (Cr)</option>
              <option value="zero" className="bg-zinc-900 text-zinc-200">Zero Balance</option>
            </select>
          </div>

          {/* Sort By Dropdown (Latest First is Default) */}
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-md px-2 py-1 h-9">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOption)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
              title="Sort order"
            >
              <option value="latest" className="bg-zinc-900 text-zinc-200">Sort: Latest First (Default)</option>
              <option value="oldest" className="bg-zinc-900 text-zinc-200">Sort: Oldest First</option>
              <option value="code" className="bg-zinc-900 text-zinc-200">Sort: Code (A-Z)</option>
              <option value="name" className="bg-zinc-900 text-zinc-200">Sort: Name (A-Z)</option>
              <option value="balance_desc" className="bg-zinc-900 text-zinc-200">Sort: Highest Receivable</option>
              <option value="balance_asc" className="bg-zinc-900 text-zinc-200">Sort: Highest Payable</option>
            </select>
          </div>

          {/* Search */}
          <div className="w-full sm:w-60 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code, name..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Code</th>
                <th className="py-3 px-4 whitespace-nowrap">Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Party / Business Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Contact Person & Phone</th>
                <th className="py-3 px-4 whitespace-nowrap">Address / ML</th>
                <th className="py-3 px-4 whitespace-nowrap">Role Classification</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Opening Bal.</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Current Balance</th>
                <th className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-950 z-20 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <LoadingState isTableRow colSpan={9} message="Loading customers & suppliers..." />
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    No parties found matching criteria.
                  </td>
                </tr>
              ) : (
                parties.map((party) => (
                  <tr key={party._id} className="group hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">{party.code}</td>
                    
                    <td className="py-3 px-4 text-zinc-300 font-mono whitespace-nowrap">
                      {formatDateTime(party.updatedAt || party.createdAt, true)}
                    </td>

                    <td className="py-3 px-4 font-semibold text-zinc-100 whitespace-nowrap">
                      {party.name}
                    </td>

                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                      <span>{party.contactPerson || '—'}</span>
                      {party.phone && <span className="text-[11px] font-mono text-zinc-500 ml-1.5">({party.phone})</span>}
                    </td>

                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                      <span>{party.address || '—'}</span>
                      {party.mlNo && <span className="text-[10px] text-zinc-500 font-mono ml-1.5">(ML: {party.mlNo})</span>}
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

                    <td className="py-3 px-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                      {formatCurrency(party.openingBalance)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <PartyBalanceBadge balance={party.currentBalance} />
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/90 transition-colors z-10 border-l border-zinc-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                      <button
                        onClick={() => setEditingParty(party)}
                        className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors inline-flex items-center"
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

      <CreatePartyModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />

      <EditPartyModal
        party={editingParty}
        isOpen={Boolean(editingParty)}
        onClose={() => setEditingParty(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
