import { ownerOptions } from '../../../business/ownership.js';
import { CatalogField } from '../../../components/ui/CatalogField.js';
import { yarnLineWeight } from '../../../lib/yarnWeight.js';
import { DocumentReferences, useDocumentReferences } from '../../../components/ui/DocumentReferences.js';
import { loadAllRecords } from '../../../lib/pagedResources.js';
import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { FormSection, OptionalDetails, EntryCard, FormFeedback, FormFooter } from '../../../components/ui/WorkflowForm.js';
import { PartyCombobox } from '../../../components/ui/PartyCombobox.js';
import { getLocalDateInput, formatWeight } from '../../../lib/formatters.js';
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
    totalWeightKg: '',
    packageUnit: 'cartons',
    weightMode: 'TOTAL',
    remarks: ''
  };
}

export function IssueYarnModal({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'OUTWARD_TO_KNITTER'
}: IssueYarnModalProps) {
  const [references, setReferences] = useDocumentReferences();
  const [transactionType, setTransactionType] = useState<YarnTransactionType>(initialType);
  const [partyId, setPartyId] = useState('');
  const [ownership, setOwnership] = useState<'OWN' | 'CLIENT'>('OWN');
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const { data: owners } = useQuery({ queryKey: ['party-options', 'all'], queryFn: () => loadAllRecords<PartyItem>('/parties'), enabled: isOpen });
  const [gatePassNo, setGatePassNo] = useState('');
  const [date, setDate] = useState(getLocalDateInput());
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
    queryKey: ['party-options', targetTag],
    queryFn: async () => {
      return loadAllRecords<PartyItem>('/parties', { tag: targetTag });
    },
    enabled: isOpen
  });

  const parties = partiesData?.items || [];


  // Row Manipulation Handlers
  function handleAddItem() {
    setItems((prev) => [...prev, createDefaultItem()]);
  }

  function handleDuplicateItem(index: number) {
    const source = items[index];
    if (!source) return;
    const duplicated: YarnGatePassLineItem = {
      ...source,
      id: generateRowId(),
      boxCount: '',
      netWeightPerBox: '',
      totalWeightKg: ''
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

      totalBoxes += boxes;
      totalGrossKg += yarnLineWeight(item);
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
      const netPerBox = yarnLineWeight(item);
      if (isNaN(netPerBox) || netPerBox <= 0) {
        setError(`Row #${i + 1} (${activeSpec}): Enter the measured total weight`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: BulkCreateYarnTransactionPayload = {
        ...references,
        transactionType,
        ownership,
        ownerPartyId: ownership === 'CLIENT' ? ownerPartyId : undefined,
        partyId,
        gatePassNo: gatePassNo.trim(),
        date: new Date(date).toISOString(),
        remarks: remarks.trim() || undefined,
        items: items.map((item) => {
          const spec = item.yarnSpec === 'OTHER' ? item.customSpec?.trim() || '' : item.yarnSpec;
          return {
            yarnSpec: spec,
            boxCount: parseInt(item.boxCount, 10),
            netWeightPerBox: yarnLineWeight(item) / Number(item.boxCount),
            totalWeightKg: yarnLineWeight(item),
            packageUnit: item.packageUnit,
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
          summary={<><strong className="text-strong">{summary.totalBoxes} boxes</strong> · {formatWeight(summary.totalGrossKg)}</>} />
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
              <Input id="yarn-challan" label="Gate pass / challan number" value={gatePassNo} onChange={(e) => setGatePassNo(e.target.value)} placeholder="e.g. 1234" required />
              <Input id="yarn-date" type="date" label="Delivery date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </FormSection>
          <div className="space-y-3"><Select label="Who owns this yarn?" value={ownership} onChange={event => setOwnership(event.target.value as 'OWN' | 'CLIENT')} options={[{value:'OWN',label:'Rozain Textile owns the yarn'},{value:'CLIENT',label:'A client owns the yarn'}]} />{ownership === 'CLIENT' && !isReceive && <Select label="Yarn owner" value={ownerPartyId} onChange={event => setOwnerPartyId(event.target.value)} required options={[{value:'',label:'Choose the client'},...ownerOptions(owners?.items || [], false)]} />}</div><DocumentReferences value={references} onChange={setReferences} />
          <FormSection step={2} title="What yarn is on this delivery?" description="Record the package count and actual total weight from the challan. Use the calculator only when the paper gives weight per package.">
            {items.map((item, index) => (
              <EntryCard key={item.id} title={'Yarn item ' + (index + 1)} onCopy={() => handleDuplicateItem(index)}
                onRemove={() => handleRemoveItem(item.id)} canRemove={items.length > 1}>
                <CatalogField kind="YARN" id={'yarn-spec-' + item.id} label="Yarn name / count" value={item.yarnSpec} required suggestions={availableSpecs} onChange={value => handleItemChange(item.id, 'yarnSpec', value)} />
                <div className="grid gap-4 sm:grid-cols-2"><Select label="Package unit" value={item.packageUnit} onChange={event => handleItemChange(item.id, 'packageUnit', event.target.value)} options={['cartons','bags','cones','packages'].map(value => ({value,label:value}))} /><Select label="Weight entry" value={item.weightMode} onChange={event => handleItemChange(item.id, 'weightMode', event.target.value)} options={[{value:'TOTAL',label:'Measured total kg'},{value:'PER_PACKAGE',label:'Calculate from kg per package'}]} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <Input id={'yarn-boxes-' + item.id} label="Number of packages" type="number" min="1" step="1" value={item.boxCount}
                    onChange={(e) => handleItemChange(item.id, 'boxCount', e.target.value)} placeholder="e.g. 10" required />
                  <Input id={'yarn-weight-' + item.id} label={item.weightMode === 'TOTAL' ? 'Total yarn weight (kg)' : 'Weight per package (kg)'} type="number" min="0.001" step="0.001" value={item.weightMode === 'TOTAL' ? item.totalWeightKg : item.netWeightPerBox}
                    onChange={event => handleItemChange(item.id, item.weightMode === 'TOTAL' ? 'totalWeightKg' : 'netWeightPerBox', event.target.value)} placeholder="e.g. 36.000" required />
                </div>
                <p className="text-right text-xs text-soft">Item total: <strong className="font-mono text-brand">{formatWeight(yarnLineWeight(item))}</strong></p>
                <OptionalDetails title="Item note (optional)">
                  <Input id={'yarn-note-' + item.id} label="Note for this yarn" value={item.remarks || ''} onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)} />
                </OptionalDetails>
              </EntryCard>
            ))}
            <Button type="button" variant="outline" onClick={handleAddItem}><Plus className="h-4 w-4" /> Add another yarn count</Button>
            {!isReceive && <p className="text-xs leading-relaxed text-soft">Actual wastage is entered when fabric is received. No percentage is deducted here.</p>}
          </FormSection>
          <OptionalDetails title="Driver, vehicle or delivery note (optional)">
            <Input id="yarn-remarks" label="Delivery note" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Driver, vehicle, bilty or other details" />
          </OptionalDetails>
        </fieldset>
      </form>
    </Dialog>
  );
}
