import { loadAllRecords } from '../../../lib/pagedResources.js';
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { FileSpreadsheet, Printer, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { downloadExcelReport } from '../../../lib/reportExport.js';
import { PartyItem } from '../../parties/types/party.types.js';
import { DyeingUnitItem, DyeingBatchItem } from '../../dyeing/types/dyeing.types.js';
import { GatePassRegisterDocument } from './GatePassRegisterDocument.js';
import { FormFeedback } from '../../../components/ui/WorkflowForm.js';

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
  const [isPrinting, setIsPrinting] = useState(false);
  const [printRows, setPrintRows] = useState<DyeingBatchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrintRows(null);
  }, [passType, selectedPartyId, selectedMill, dateFrom, dateTo]);

  useEffect(() => {
    if (!isOpen || !printRows) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, printRows]);

  // Fetch parties for selector
  const { data: partiesData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['party-options', 'all'],
    queryFn: async () => {
      return loadAllRecords<PartyItem>('/parties', { });
    },
    enabled: isOpen
  });

  const parties = partiesData?.items || [];

  const sortedParties = useMemo(() => {
    return [...parties].sort((a, b) => a.name.localeCompare(b.name));
  }, [parties]);

  const { data: unitsData = [] } = useQuery<DyeingUnitItem[]>({
    queryKey: ['dyeing-units'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DyeingUnitItem[] }>('/dyeing/units');
      return res.data.data;
    },
    enabled: isOpen
  });

  const millOptions = useMemo(() => {
    const activeMills = unitsData.filter((u) => u.isActive && u.type === 'DYEING_MILL');
    if (activeMills.length > 0) {
      return [
        ...activeMills.map((u) => ({
          label: `${u.name} (${u.shortName})`,
          value: u.code
        })),
        { label: 'All Units', value: 'ALL' }
      ];
    }
    return [
      { label: 'Ghumman Dyeing (Default)', value: 'GHUMMAN_DYEING' },
      { label: 'Rajput Dyeing', value: 'RAJPUT_DYEING' },
      { label: 'Hafiz Saad Dyeing', value: 'HAFIZ_SAAD_DYEING' },
      { label: 'HB Dyeing', value: 'HB_DYEING' },
      { label: 'All Units', value: 'ALL' }
    ];
  }, [unitsData]);

  async function handleExportExcel() {
    if (isExporting) return;
    setError(null);
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
      setError(err instanceof Error ? err.message : 'The register could not be exported. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handlePrintRegister() {
    if (isPrinting) return;
    setIsPrinting(true);
    setError(null);
    try {
      const rows: DyeingBatchItem[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await api.get<{ success: boolean; data: { items: DyeingBatchItem[]; totalPages: number } }>('/dyeing/batches', {
          params: { page, limit: 100, sortOrder: 'asc', ...(selectedMill !== 'ALL' ? { millName: selectedMill } : {}) }
        });
        rows.push(...response.data.data.items);
        totalPages = response.data.data.totalPages;
        page++;
      } while (page <= totalPages);
      const start = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const endDate = dateTo ? new Date(dateTo) : null;
      endDate?.setHours(23, 59, 59, 999);
      const end = endDate?.getTime() ?? Infinity;
      setPrintRows(rows.filter(row => {
        const issuedDate = new Date(row.dateIssued).getTime();
        return (selectedPartyId === 'ALL' || row.allocatedCustomerId?._id === selectedPartyId)
          && issuedDate >= start && issuedDate <= end;
      }));
    } catch {
      setError('The printable register could not be loaded. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog
      footer={<div className="flex items-center justify-between pt-2 border-t border-line">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintRegister}
              isLoading={isPrinting}
              className="gap-1.5 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleExportExcel}
              isLoading={isExporting}
              className="gap-1.5 text-xs bg-primary hover:bg-emerald-800 text-white"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {`Export ${passType} (.xlsx)`}
            </Button>
          </div>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title="Gate Pass Register Generator (OGP & IGP)"
      description="Generate formatted Excel workbooks and printable registers matching official unit delivery records."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <FormFeedback error={error} success={null} />
        <fieldset disabled={isPrinting} className="space-y-4">
        {/* Register Type Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-canvas border border-line rounded-lg">
          <button
            type="button"
            onClick={() => setPassType('OGP')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
              passType === 'OGP'
                ? 'bg-primary text-white shadow-xs'
                : 'text-soft hover:text-strong hover:bg-surface'
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
                : 'text-soft hover:text-strong hover:bg-surface'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Inward Gate Pass (IGP) Register</span>
          </button>
        </div>

        {/* Filter Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-surface/60 border border-line rounded-lg">
          <div>
            <label className="block text-xs font-semibold text-soft mb-1">Party / Client</label>
            <Select
              aria-label="Party / Client" value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="text-xs"
              options={[
                { label: 'All Parties (Combined)', value: 'ALL' },
                ...sortedParties.map((p) => {
                  let roleTag = '';
                  if (p.tags?.isFabricBuyer) roleTag = ' [Client]';
                  else if (p.tags?.isDyeingMill) roleTag = ' [Dyeing Unit]';
                  else if (p.tags?.isKnitter) roleTag = ' [Knitter]';
                  else if (p.tags?.isYarnClient) roleTag = ' [Yarn Supplier]';
                  return {
                    label: `${p.name} (${p.code})${roleTag}`,
                    value: p._id
                  };
                })
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-soft mb-1">Dyeing Unit Location</label>
            <Select
              aria-label="Dyeing Unit Location" value={selectedMill}
              onChange={(e) => setSelectedMill(e.target.value)}
              className="text-xs"
              options={millOptions}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-soft mb-1">From Date</label>
            <Input
              aria-label="From Date" type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-soft mb-1">To Date</label>
            <Input
              aria-label="To Date" type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        </fieldset>
      </div>
      {printRows && <GatePassRegisterDocument rows={printRows} type={passType} partyName={parties.find(party => party._id === selectedPartyId)?.name || 'All parties'} millName={unitsData.find(unit => unit.code === selectedMill)?.name || (selectedMill === 'ALL' ? 'All units' : selectedMill)} dateFrom={dateFrom} dateTo={dateTo} />}
    </Dialog>
  );
}
