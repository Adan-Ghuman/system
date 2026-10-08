import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { FormSection, OptionalDetails, EntryCard, FormFeedback, FormFooter } from '../../../components/ui/WorkflowForm.js';
import { PartyCombobox } from '../../../components/ui/PartyCombobox.js';
import { formatWeight } from '../../../lib/formatters.js';
import { Plus } from 'lucide-react';
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
    boxCount: '',
    netWeightPerBox: '',
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
  const [items, setItems] = useState<YarnGatePassLineItem[]>([createDefaultItem()]);

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


  // Row Manipulation Handlers
  function handleAddItem() {
    const defaultSpec = items[items.length - 1]?.yarnSpec || '';
    setItems((prev) => [...prev, createDefaultItem(defaultSpec)]);
  }

  function handleDuplicateItem(index: number) {
    const source = items[index];
    if (!source) return;
    const duplicated: YarnGatePassLineItem = {
      ...source,
      id: generateRowId(),
      boxCount: '',
      netWeightPerBox: ''
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
      setItems([createDefaultItem()]);
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
      onClose={() => { if (!isLoading) onClose(); }}
      title={isReceive ? 'Receive yarn from a client' : 'Send yarn to a knitter'}
      description={isReceive ? 'Record the yarn delivered by a supplier or job-work client.' : 'Choose the knitter, then enter the yarn you are sending.'}
      className="max-w-2xl"
      footer={
        <FormFooter formId="yarn-entry-form" onClose={onClose} isLoading={isLoading} isSaved={Boolean(success)}
          submitLabel={isReceive ? 'Save yarn receipt' : 'Save yarn delivery'}
          summary={<><strong className="text-zinc-200">{summary.totalBoxes} boxes</strong> · {formatWeight(summary.totalGrossKg)}</>} />
      }
    >
      <form id="yarn-entry-form" onSubmit={handleSubmit}>
        <fieldset disabled={isLoading || Boolean(success)} className="space-y-6">
          <FormFeedback error={error} success={success} />
          <FormSection step={1} title={isReceive ? 'Who sent the yarn?' : 'Where is the yarn going?'}>
            <PartyCombobox id="yarn-party" label={isReceive ? 'Supplier or client' : 'Knitter'} value={partyId} parties={parties}
              placeholder={isReceive ? 'Choose or type the supplier name' : 'Choose or type the knitter name'}
              onChange={setPartyId} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="yarn-challan" label="Challan number" value={gatePassNo} onChange={(e) => setGatePassNo(e.target.value)} placeholder="Number on the delivery slip" required />
              <Input id="yarn-date" type="date" label="Delivery date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </FormSection>
          <FormSection step={2} title="What yarn is on this delivery?" description="Add one item for each yarn count. Total weight is calculated from boxes and weight per box.">
            {items.map((item, index) => (
              <EntryCard key={item.id} title={'Yarn item ' + (index + 1)} onCopy={() => handleDuplicateItem(index)}
                onRemove={() => handleRemoveItem(item.id)} canRemove={items.length > 1}>
                <Select id={'yarn-spec-' + item.id} label="Yarn count" value={item.yarnSpec} required
                  onChange={(e) => handleItemChange(item.id, 'yarnSpec', e.target.value)}
                  options={[{ label: 'Choose yarn count', value: '' }, ...availableSpecs.map((name) => ({ label: name, value: name })), { label: 'Other yarn count', value: 'OTHER' }]} />
                {item.yarnSpec === 'OTHER' && <Input id={'yarn-custom-' + item.id} label="Custom yarn count" value={item.customSpec || ''}
                  onChange={(e) => handleItemChange(item.id, 'customSpec', e.target.value)} placeholder="e.g. 40/1 Cotton" required />}
                <div className="grid grid-cols-2 gap-4">
                  <Input id={'yarn-boxes-' + item.id} label="Number of boxes / bags" type="number" min="1" step="1" value={item.boxCount}
                    onChange={(e) => handleItemChange(item.id, 'boxCount', e.target.value)} placeholder="e.g. 10" required />
                  <Input id={'yarn-weight-' + item.id} label="Weight per box (kg)" type="number" min="0.01" step="0.01" value={item.netWeightPerBox}
                    onChange={(e) => handleItemChange(item.id, 'netWeightPerBox', e.target.value)} placeholder="e.g. 33.33" required />
                </div>
                <p className="text-right text-xs text-zinc-400">Item total: <strong className="font-mono text-emerald-400">{formatWeight((parseInt(item.boxCount, 10) || 0) * (parseFloat(item.netWeightPerBox) || 0))}</strong></p>
                <OptionalDetails title="Item note (optional)">
                  <Input id={'yarn-note-' + item.id} label="Note for this yarn" value={item.remarks || ''} onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)} />
                </OptionalDetails>
              </EntryCard>
            ))}
            <Button type="button" variant="outline" onClick={handleAddItem}><Plus className="h-4 w-4" /> Add another yarn count</Button>
            {!isReceive && <p className="text-xs leading-relaxed text-zinc-400">The standard 1% yarn wastage is calculated automatically.</p>}
          </FormSection>
          <OptionalDetails title="Driver, vehicle or delivery note (optional)">
            <Input id="yarn-remarks" label="Delivery note" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Driver, vehicle, bilty or other details" />
          </OptionalDetails>
        </fieldset>
      </form>
    </Dialog>
  );
}
