import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { PartyCombobox } from '../../../components/ui/PartyCombobox.js';
import { formatWeight } from '../../../lib/formatters.js';
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Copy,
  Layers,
  ArrowRight,
  PackagePlus,
  PackageCheck
} from 'lucide-react';
import {
  YarnTransactionType,
  YarnGatePassLineItem,
  BulkCreateYarnTransactionPayload,
  YarnSpecsResponseData
} from '../types/knitting.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

export interface IssueYarnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: YarnTransactionType;
}

const DEFAULT_YARN_SPECS = [
  '75/72 Sim',
  '100/36 Sim',
  '150/48 Rotto',
  '100/144 Micro',
  '150/144 Micro',
  '30/1 Cotton',
  '20/1 Cotton',
  '50D Spandex'
];

function generateRowId(): string {
  return 'item_' + Math.random().toString(36).substring(2, 9);
}

function createDefaultItem(defaultSpec = ''): YarnGatePassLineItem {
  return {
    id: generateRowId(),
    yarnSpec: defaultSpec,
    customSpec: '',
    boxCount: '10',
    netWeightPerBox: '33.33',
    remarks: ''
  };
}

export function IssueYarnModal({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'OUTWARD_TO_KNITTER'
}: IssueYarnModalProps) {
  const [transactionType, setTransactionType] = useState<YarnTransactionType>(initialType);
  const [partyId, setPartyId] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Multi-yarn line items state
  const [items, setItems] = useState<YarnGatePassLineItem[]>([createDefaultItem(DEFAULT_YARN_SPECS[0])]);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch active yarn specifications catalog
  const { data: specsData } = useQuery<YarnSpecsResponseData>({
    queryKey: ['yarn-specs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: YarnSpecsResponseData }>('/knitting/yarn-specs');
      return res.data.data;
    },
    enabled: isOpen
  });

  const availableSpecs = useMemo(() => {
    if (specsData?.catalog && specsData.catalog.length > 0) {
      return specsData.catalog.filter((s) => s.isActive).map((s) => s.name);
    }
    return DEFAULT_YARN_SPECS;
  }, [specsData]);

  // Synchronize initial item specification when specs load
  useEffect(() => {
    if (availableSpecs.length > 0) {
      setItems((prev) =>
        prev.map((item) =>
          !item.yarnSpec ? { ...item, yarnSpec: availableSpecs[0] } : item
        )
      );
    }
  }, [availableSpecs]);

  // Reset or set transaction type when modal reopens
  useEffect(() => {
    setTransactionType(initialType);
  }, [initialType, isOpen]);

  const targetTag = transactionType === 'OUTWARD_TO_KNITTER' ? 'isKnitter' : 'isYarnClient';

  // Fetch relevant parties (Knitters or Yarn Suppliers/Clients)
  const { data: partiesData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', targetTag],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: targetTag, limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const parties = partiesData?.items || [];

  useEffect(() => {
    if (parties.length > 0 && !partyId) {
      setPartyId(parties[0]._id);
    }
  }, [parties, partyId]);

  // Row Manipulation Handlers
  function handleAddItem() {
    const defaultSpec = availableSpecs[0] || DEFAULT_YARN_SPECS[0];
    setItems((prev) => [...prev, createDefaultItem(defaultSpec)]);
  }

  function handleDuplicateItem(index: number) {
    const source = items[index];
    if (!source) return;
    const duplicated: YarnGatePassLineItem = {
      ...source,
      id: generateRowId()
    };
    setItems((prev) => [
      ...prev.slice(0, index + 1),
      duplicated,
      ...prev.slice(index + 1)
    ]);
  }

  function handleRemoveItem(id: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleItemChange(
    id: string,
    field: keyof YarnGatePassLineItem,
    value: string
  ) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  // Summary Metrics Aggregation
  const summary = useMemo(() => {
    let totalBoxes = 0;
    let totalGrossKg = 0;

    items.forEach((item) => {
      const boxes = parseInt(item.boxCount, 10) || 0;
      const netPerBox = parseFloat(item.netWeightPerBox) || 0;
      totalBoxes += boxes;
      totalGrossKg += boxes * netPerBox;
    });

    return {
      itemCount: items.length,
      totalBoxes,
      totalGrossKg: Math.round(totalGrossKg * 100) / 100
    };
  }, [items]);

  // Form Submission
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!partyId) {
      setError(
        transactionType === 'OUTWARD_TO_KNITTER'
          ? 'Please select a contract knitter'
          : 'Please select a supplier or job-work client'
      );
      return;
    }

    if (!gatePassNo.trim()) {
      setError('Please enter Gate Pass / Challan #');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one yarn specification');
      return;
    }

    // Validate each line item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const activeSpec = item.yarnSpec === 'OTHER' ? item.customSpec?.trim() : item.yarnSpec;
      if (!activeSpec) {
        setError(`Row #${i + 1}: Please specify a valid yarn count/specification`);
        return;
      }
      const boxes = parseInt(item.boxCount, 10);
      if (isNaN(boxes) || boxes < 1) {
        setError(`Row #${i + 1} (${activeSpec}): Box count must be at least 1`);
        return;
      }
      const netPerBox = parseFloat(item.netWeightPerBox);
      if (isNaN(netPerBox) || netPerBox <= 0) {
        setError(`Row #${i + 1} (${activeSpec}): Net weight per box must be greater than 0`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: BulkCreateYarnTransactionPayload = {
        transactionType,
        partyId,
        gatePassNo: gatePassNo.trim(),
        date: new Date(date).toISOString(),
        remarks: remarks.trim() || undefined,
        items: items.map((item) => {
          const spec = item.yarnSpec === 'OTHER' ? item.customSpec?.trim() || '' : item.yarnSpec;
          return {
            yarnSpec: spec,
            boxCount: parseInt(item.boxCount, 10),
            netWeightPerBox: parseFloat(item.netWeightPerBox),
            remarks: item.remarks?.trim() || undefined
          };
        })
      };

      await api.post('/knitting/transactions/bulk', payload);

      const successMsg =
        transactionType === 'INWARD_FROM_CLIENT'
          ? `Inward Gate Pass ${gatePassNo.trim()} saved. ${items.length} yarn ${items.length === 1 ? 'item' : 'items'} received from supplier.`
          : `Outward Gate Pass ${gatePassNo.trim()} saved. ${items.length} yarn ${items.length === 1 ? 'item' : 'items'} dispatched to knitter.`;

      setSuccess(successMsg);
      setGatePassNo('');
      setRemarks('');
      setItems([createDefaultItem(availableSpecs[0] || DEFAULT_YARN_SPECS[0])]);
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1100);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to save yarn gate pass');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  const isReceive = transactionType === 'INWARD_FROM_CLIENT';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        isReceive
          ? 'Receive Outside Yarn from Supplier (Gate Pass / IGP)'
          : 'Send Yarn to Knitter (Outward Gate Pass / OGP)'
      }
      description={
        isReceive
          ? 'Record multiple yarn specifications under one Inward Delivery Gate Pass / Challan.'
          : 'Record multiple yarn specifications issued to a contract knitter under one Gate Pass.'
      }
      className="max-w-4xl w-full"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 1. Transaction Type Toggle */}
        <div className="flex items-center gap-2 p-1 rounded-md bg-zinc-950 border border-zinc-800">
          <button
            type="button"
            onClick={() => setTransactionType('INWARD_FROM_CLIENT')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 ${
              transactionType === 'INWARD_FROM_CLIENT'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Inward from Supplier / Client</span>
          </button>
          <button
            type="button"
            onClick={() => setTransactionType('OUTWARD_TO_KNITTER')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 ${
              transactionType === 'OUTWARD_TO_KNITTER'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>Outward to Contract Knitter</span>
          </button>
        </div>

        {/* 2. Gate Pass Header Card */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>{isReceive ? 'Inward Gate Pass (IGP) Header' : 'Outward Gate Pass (OGP) Header'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PartyCombobox
              id="partySelect"
              label={isReceive ? 'Supplier / Client' : 'Contract Knitter'}
              value={partyId}
              parties={parties}
              placeholder={isReceive ? 'Select supplier or type name (e.g. M.S Sweet Flowers)...' : 'Select knitter or type name...'}
              onChange={(val) => setPartyId(val)}
              className="text-xs"
            />

            <Input
              id="gatePassNo"
              label={isReceive ? 'Inward Pass / Challan #' : 'Outward Pass / Challan #'}
              value={gatePassNo}
              onChange={(e) => setGatePassNo(e.target.value)}
              required
              placeholder={isReceive ? 'e.g. IGP-YARN-4501' : 'e.g. OGP-YARN-8802'}
              className="font-mono font-bold text-emerald-400 text-xs"
            />

            <Input
              id="txDate"
              type="date"
              label="Gate Pass Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="text-xs"
            />
          </div>

          <Input
            id="remarks"
            label="Common Remarks / Driver / Vehicle #"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Driver Faraz / Suzuki Pickup, Lot details, Bilty #"
            className="text-xs"
          />
        </div>

        {/* 3. Multi-Yarn Line Items Section */}
        <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Yarn Specifications / Line Items ({items.length})</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1 text-xs text-emerald-400 border-emerald-800/60 hover:bg-emerald-950/40 h-7 px-2.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Yarn</span>
            </Button>
          </div>

          {/* Table Header */}
          <div className="space-y-2">
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 py-1 bg-zinc-950/80 rounded border border-zinc-800/60 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <div className="sm:col-span-4">Yarn Specification / Count</div>
              <div className="sm:col-span-2 text-right">Boxes/Bags</div>
              <div className="sm:col-span-2 text-right">Net Wt/Box (Kg)</div>
              <div className="sm:col-span-2 text-right">Total Wt (Kg)</div>
              <div className="sm:col-span-2 text-center">Actions</div>
            </div>

            {/* Dynamic Items */}
            {items.map((item, idx) => {
              const boxes = parseInt(item.boxCount, 10) || 0;
              const netWt = parseFloat(item.netWeightPerBox) || 0;
              const rowTotal = Math.round(boxes * netWt * 100) / 100;

              return (
                <div
                  key={item.id}
                  className="p-2 sm:p-1.5 rounded-md bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 transition-colors space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center"
                >
                  {/* Yarn Spec */}
                  <div className="sm:col-span-4 space-y-1">
                    <Select
                      id={`spec_${item.id}`}
                      value={item.yarnSpec}
                      onChange={(e) => handleItemChange(item.id, 'yarnSpec', e.target.value)}
                      options={[
                        ...availableSpecs.map((s) => ({ label: s, value: s })),
                        { label: 'Other / Custom Count...', value: 'OTHER' }
                      ]}
                      className="text-xs h-8"
                    />
                    {item.yarnSpec === 'OTHER' && (
                      <Input
                        id={`custom_${item.id}`}
                        value={item.customSpec || ''}
                        onChange={(e) => handleItemChange(item.id, 'customSpec', e.target.value)}
                        placeholder="e.g. 40/1 Carded Cotton"
                        required
                        className="text-xs h-7 mt-1 border-amber-500/50"
                      />
                    )}
                  </div>

                  {/* Box Count */}
                  <div className="sm:col-span-2">
                    <div className="sm:hidden text-[10px] font-semibold text-zinc-400 mb-0.5">Boxes / Bags</div>
                    <Input
                      id={`boxes_${item.id}`}
                      type="number"
                      min="1"
                      value={item.boxCount}
                      onChange={(e) => handleItemChange(item.id, 'boxCount', e.target.value)}
                      required
                      placeholder="10"
                      className="text-xs text-right font-mono h-8"
                    />
                  </div>

                  {/* Net Wt per Box */}
                  <div className="sm:col-span-2">
                    <div className="sm:hidden text-[10px] font-semibold text-zinc-400 mb-0.5">Net Wt/Box (Kg)</div>
                    <Input
                      id={`net_${item.id}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.netWeightPerBox}
                      onChange={(e) => handleItemChange(item.id, 'netWeightPerBox', e.target.value)}
                      required
                      placeholder="33.33"
                      className="text-xs text-right font-mono h-8"
                    />
                  </div>

                  {/* Calculated Row Gross Weight */}
                  <div className="sm:col-span-2 text-right">
                    <div className="sm:hidden text-[10px] font-semibold text-zinc-400 mb-0.5">Line Total Weight</div>
                    <div className="font-mono font-bold text-xs text-emerald-400 px-2 py-1 bg-emerald-950/20 border border-emerald-900/30 rounded inline-block sm:block text-right">
                      {formatWeight(rowTotal)}
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="sm:col-span-2 flex items-center justify-end sm:justify-center gap-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => handleDuplicateItem(idx)}
                      title="Duplicate row"
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length <= 1}
                      title={items.length <= 1 ? 'Gate Pass requires at least one yarn item' : 'Remove row'}
                      className="p-1.5 text-red-400/70 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-start pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1.5 text-xs text-zinc-300 hover:text-white border-dashed border-zinc-700 hover:border-zinc-500 h-8"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Another Yarn Item</span>
            </Button>
          </div>
        </div>

        {/* 4. Live Summary Bar */}
        <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-zinc-300">
            <div>
              <span className="text-zinc-500">Yarn Items:</span>{' '}
              <strong className="text-white font-mono">{summary.itemCount}</strong>
            </div>
            <div>
              <span className="text-zinc-500">Total Boxes:</span>{' '}
              <strong className="text-white font-mono">{summary.totalBoxes}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Total Gate Pass Weight:</span>
            <span className="text-base font-bold font-mono text-emerald-400">
              {formatWeight(summary.totalGrossKg)}
            </span>
          </div>
        </div>

        {/* 5. Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5 font-bold">
            <span>
              {isReceive
                ? `Receive Outside Yarn (${items.length} ${items.length === 1 ? 'Spec' : 'Specs'})`
                : `Issue Yarn Gate Pass (${items.length} ${items.length === 1 ? 'Spec' : 'Specs'})`}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
