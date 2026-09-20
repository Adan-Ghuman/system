import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { FileSpreadsheet, Printer, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { downloadExcelReport } from '../../../lib/reportExport.js';

export interface GatePassRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'OGP' | 'IGP';
}

export function GatePassRegisterModal({
  isOpen,
  onClose,
  defaultType = 'OGP'
}: GatePassRegisterModalProps) {
  const [passType, setPassType] = useState<'OGP' | 'IGP'>(defaultType);
  const [selectedPartyId, setSelectedPartyId] = useState('ALL');
  const [selectedMill, setSelectedMill] = useState('GHUMMAN_DYEING');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch parties for selector
  const { data: partiesData } = useQuery({
    queryKey: ['parties-for-register'],
    queryFn: async () => {
      const res = await api.get('/parties?limit=100');
      return res.data?.data?.parties || [];
    },
    enabled: isOpen
  });

  const parties = partiesData || [];

  async function handleExportExcel() {
    setIsExporting(true);
    try {
      let url = `/reports/gate-pass-register/excel?type=${passType}`;
      if (selectedPartyId && selectedPartyId !== 'ALL') url += `&partyId=${selectedPartyId}`;
      if (selectedMill && selectedMill !== 'ALL') url += `&millName=${selectedMill}`;
      if (dateFrom) url += `&from=${dateFrom}`;
      if (dateTo) url += `&to=${dateTo}`;

      const filename = `${passType}_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadExcelReport(url, filename);
    } catch (err) {
      console.error('Failed to export Gate Pass Register:', err);
    } finally {
      setIsExporting(false);
    }
  }

  function handlePrintRegister() {
    window.print();
  }

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Gate Pass Register Generator (OGP & IGP)"
      description="Generate formatted Excel workbooks and printable registers matching official unit delivery records."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Register Type Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
          <button
            type="button"
            onClick={() => setPassType('OGP')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
              passType === 'OGP'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Outward Gate Pass (OGP) Register</span>
          </button>

          <button
            type="button"
            onClick={() => setPassType('IGP')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
              passType === 'IGP'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Inward Gate Pass (IGP) Register</span>
          </button>
        </div>

        {/* Filter Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Party / Client</label>
            <Select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="text-xs"
              options={[
                { label: 'All Parties (Combined)', value: 'ALL' },
                ...parties.map((p: any) => ({
                  label: `${p.name} (${p.code})`,
                  value: p._id
                }))
              ]}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Dyeing Unit Location</label>
            <Select
              value={selectedMill}
              onChange={(e) => setSelectedMill(e.target.value)}
              className="text-xs"
              options={[
                { label: 'Ghumman Dyeing (Default)', value: 'GHUMMAN_DYEING' },
                { label: 'Rajput Dyeing', value: 'RAJPUT_DYEING' },
                { label: 'Hafiz Saad Dyeing', value: 'HAFIZ_SAAD_DYEING' },
                { label: 'HB Dyeing', value: 'HB_DYEING' },
                { label: 'All Units', value: 'ALL' }
              ]}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintRegister}
              className="gap-1.5 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isExporting ? 'Generating...' : `Export ${passType} (.xlsx)`}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
