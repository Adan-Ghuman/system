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
import { formatCurrency } from '../../../lib/formatters.js';
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
  ArrowDownLeft
} from 'lucide-react';

type TagFilter = 'all' | 'isFabricBuyer' | 'isKnitter' | 'isYarnClient' | 'isDyeingMill';

export function PartiesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<TagFilter>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyItem | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    setPage(1);
  }, [activeTag, debouncedSearchTerm]);

  const { data, isLoading, refetch } = useQuery<{
    items: PartyItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['parties', activeTag, debouncedSearchTerm, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
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
            <Users className="w-5 h-5 text-emerald-500" />
            Party Directory & Master Accounts
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage fabric buyers, contract knitters, yarn clients, and dyeing mills with live Dr/Cr balance audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh directory">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5">
            <UserPlus className="w-4 h-4" />
            Add Party
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-zinc-900/80 border-zinc-800 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Total Entities</div>
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
            <div className="text-[10px] text-zinc-500 mt-0.5">Outside knitting mills</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-emerald-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Total Receivable (Dr)
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(metrics.totalDr)}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Active customer debt</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-amber-950/40 p-3">
          <CardContent className="p-0">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              Total Payable (Cr)
            </div>
            <div className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(metrics.totalCr)}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Liabilities & deposits</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'All Parties' },
            { id: 'isFabricBuyer', label: 'Fabric Buyers' },
            { id: 'isKnitter', label: 'Contract Knitters' },
            { id: 'isYarnClient', label: 'Yarn Clients' },
            { id: 'isDyeingMill', label: 'Dyeing Mills' }
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

        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search code, name, phone..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Party / Business Name</th>
                <th className="py-3 px-4">Contact Person & Phone</th>
                <th className="py-3 px-4">Address / ML</th>
                <th className="py-3 px-4">Role Classification</th>
                <th className="py-3 px-4 text-right">Opening Bal.</th>
                <th className="py-3 px-4 text-right">Current Balance</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Loading party records...
                  </td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No parties found matching criteria.
                  </td>
                </tr>
              ) : (
                parties.map((party) => (
                  <tr key={party._id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{party.code}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-100">{party.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-200">{party.contactPerson || '—'}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{party.phone || '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-300 truncate max-w-xs">{party.address || '—'}</div>
                      {party.mlNo && <div className="text-[10px] text-zinc-500 font-mono">ML: {party.mlNo}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {party.tags.isFabricBuyer && <Badge variant="default">Buyer</Badge>}
                        {party.tags.isKnitter && <Badge variant="secondary">Knitter</Badge>}
                        {party.tags.isYarnClient && <Badge variant="outline">Yarn Client</Badge>}
                        {party.tags.isDyeingMill && (
                          <Badge variant="warning" className="gap-1">
                            <Palette className="w-2.5 h-2.5" />
                            Dyeing Mill
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400">
                      {formatCurrency(party.openingBalance)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <PartyBalanceBadge balance={party.currentBalance} />
                    </td>
                    <td className="py-3 px-4 text-center">
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
        </div>
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
