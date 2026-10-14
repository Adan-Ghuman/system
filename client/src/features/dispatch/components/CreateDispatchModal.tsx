import { getLocalDateInput } from '../../../lib/formatters.js';
import { OperationDocument } from '../../../business/types.js';
import { useBusinessStore } from '../../../business/store.js';
import { DyeingUnitItem } from '../../dyeing/types/dyeing.types.js';
import { DocumentReferences, useDocumentReferences } from '../../../components/ui/DocumentReferences.js';
import { loadAllRecords } from '../../../lib/pagedResources.js';
import { FormSection } from '../../../components/ui/WorkflowForm.js';
import { useState, useMemo, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { PartySelector } from '../../../business/PartySelector.js';
import { LoadingOverlay } from '../../../components/ui/LoadingOverlay.js';
import { formatCurrency, formatWeight } from '../../../lib/formatters.js';
import { RapidGridEntry } from './RapidGridEntry.js';
import { AlertCircle, CheckCircle2, Truck, FileText } from 'lucide-react';
import {
  DispatchRollItem,
  InvoiceType,
  CreateDispatchPayload
} from '../types/dispatch.types.js';
import { InventoryLocation, FabricInventoryItem } from '../../inventory/types/inventory.types.js';
import { PartyItem } from '../../parties/types/party.types.js';

export interface CreateDispatchModalProps {
  draft?: OperationDocument;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LOCATIONS: { label: string; value: InventoryLocation }[] = [
  { label: 'ZR Godown (Main Dispatch Depot)', value: 'ZR_GODOWN' },
  { label: 'Ghumman Dyeing Unit (Direct Unit Dispatch)', value: 'GHUMMAN_DYEING' },
  { label: 'Rajput Dyeing Unit (Direct Unit Dispatch)', value: 'RAJPUT_DYEING' },
  { label: 'Hafiz Saad Dyeing Unit (Direct Unit Dispatch)', value: 'HAFIZ_SAAD_DYEING' },
  { label: 'HB Dyeing Unit (Direct Unit Dispatch)', value: 'HB_DYEING' }
];

export function CreateDispatchModal({ isOpen, onClose, onSuccess, draft }: CreateDispatchModalProps) {
  const saved = draft?.draft as Partial<CreateDispatchPayload & { inventoryId: string; poNo: string; externalReference: string; requestId: string }> | undefined;
  const businessId = useBusinessStore(state => state.id);
  const [billNow, setBillNow] = useState(saved?.billNow ?? true);const [condition, setCondition] = useState<'RAW_ECRU' | 'FINISHED_DYED'>(saved?.state || 'FINISHED_DYED');
  const units = useQuery({ queryKey: ['dyeing-units'], queryFn: async () => (await api.get<{ data: DyeingUnitItem[] }>('/dyeing/units')).data.data });
  const [freshReferences] = useDocumentReferences();const [references, setReferences] = useState({ ...freshReferences, poNo: saved?.poNo || '', externalReference: saved?.externalReference || '', requestId: saved?.requestId || freshReferences.requestId });
  const [customerId, setCustomerId] = useState(saved?.customerId || '');
  const [fromLocation, setFromLocation] = useState<InventoryLocation>(saved?.fromLocation || 'ZR_GODOWN');
  const [selectedStockId, setSelectedStockId] = useState(saved?.inventoryId || '');
  const [ratePerKg, setRatePerKg] = useState(saved?.ratePerKg ? String(saved.ratePerKg) : '');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(saved?.invoiceType || 'TAX_18_PERCENT');
  const [rolls, setRolls] = useState<DispatchRollItem[]>(saved?.rolls || [
    { rollNumber: 1, grossWeightKg: 0, tareKg: 0, netWeightKg: 0 }
  ]);
  const [driverName, setDriverName] = useState(saved?.driverName || '');
  const [vehicleNo, setVehicleNo] = useState(saved?.vehicleNo || '');
  const [date, setDate] = useState(saved?.date?.slice(0, 10) || getLocalDateInput());
  const [remarks, setRemarks] = useState(saved?.remarks || '');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: buyersData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['party-options', 'isFabricBuyer'],
    queryFn: async () => {
      return loadAllRecords<PartyItem>('/parties', { tag: 'isFabricBuyer' });
    },
    enabled: isOpen
  });

  const buyers = buyersData?.items || [];

  const { data: stockData } = useQuery<{ items: FabricInventoryItem[] }>({
    queryKey: ['inventory-items-for-dispatch', fromLocation, condition],
    queryFn: async () => {
      return loadAllRecords<FabricInventoryItem>('/inventory/items', { location: fromLocation, state: condition });
    },
    enabled: isOpen
  });

  const availableStock = (stockData?.items || []).filter(item => !(item as FabricInventoryItem & { ownerKey?: string }).ownerKey || (item as FabricInventoryItem & { ownerKey?: string }).ownerKey === 'OWN');

  const activeStock = availableStock.find((s) => s._id === selectedStockId);

  const financials = useMemo(() => {
    const totalNetWeight = Math.round(rolls.reduce((sum, r) => sum + r.netWeightKg, 0) * 100) / 100;
    const rate = parseFloat(ratePerKg) || 0;
    const baseAmount = Math.round(totalNetWeight * rate * 100) / 100;
    const taxPercent = invoiceType === 'TAX_18_PERCENT' ? 18.0 : 0;
    const taxAmount = Math.round(baseAmount * (taxPercent / 100) * 100) / 100;
    const grandTotal = Math.round((baseAmount + taxAmount) * 100) / 100;

    return { totalNetWeight, baseAmount, taxPercent, taxAmount, grandTotal };
  }, [rolls, ratePerKg, invoiceType]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!activeStock) {
      setError('Please select a finished dyed fabric stock item to dispatch');
      return;
    }

    if (rolls.length === 0) {
      setError('At least one roll must be specified');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: CreateDispatchPayload = {
        ...references, draftId: draft?._id,
        billNow, state: condition, customerId,
        fromLocation,
        fabricType: activeStock.fabricType,
        yarnSpec: activeStock.yarnSpec,
        color: activeStock.color,
        rolls,
        ratePerKg: billNow ? parseFloat(ratePerKg) : 1,
        invoiceType,
        driverName: driverName.trim(),
        vehicleNo: vehicleNo.trim().toUpperCase(),
        date: new Date(date).toISOString(),
        remarks: remarks.trim()
      };

      await api.post('/dispatch', payload);

      setSuccess(billNow ? 'Delivery and customer bill saved.' : 'Delivery saved. You can bill it later under Bills & charges.');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to execute dispatch');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  async function saveDraft() { setIsLoading(true);setError(null);try { const body = { ...references, customerId, fromLocation, inventoryId: selectedStockId, fabricType: activeStock?.fabricType, yarnSpec: activeStock?.yarnSpec, color: activeStock?.color, rolls, ratePerKg: Number(ratePerKg), invoiceType, billNow, state: condition, driverName, vehicleNo, date: new Date(date).toISOString(), remarks };if (draft) await api.patch('/dispatch/drafts/' + draft._id, body);else await api.post('/dispatch/drafts', body);onSuccess();onClose(); } catch { setError('Could not save the draft. Your entries are still here.'); } finally { setIsLoading(false); } }
  return (
    <Dialog footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" disabled={isLoading} onClick={saveDraft}>Save draft</Button><Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-dispatch-modal-form" isLoading={isLoading} className="gap-1.5">
            <Truck className="w-4 h-4" />
            <span>{billNow ? 'Save delivery & bill' : 'Save delivery only'}</span>
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title="Create Delivery Gate Pass & Invoice"
      description="Send fabric rolls to a customer, make an Outward Gate Pass (OGP), and generate their bill."
      className="max-w-2xl"
    >
      <form id="create-dispatch-modal-form" onSubmit={handleSubmit} className="space-y-4 relative">
        <LoadingOverlay isLoading={isLoading} message="Creating gate pass & posting invoice..." />
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div role="status" className="flex items-center gap-2 p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-brand">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <FormSection step={1} title="Customer and fabric"><Select label="Fabric condition" value={condition} onChange={event => { setCondition(event.target.value as typeof condition);setSelectedStockId(""); }} options={[{ value: "FINISHED_DYED", label: "Finished / dyed" }, { value: "RAW_ECRU", label: "Raw / undyed" }]} />
<div className="grid gap-3 sm:grid-cols-2">
          <PartySelector
            id="dispatchCustomer"
            label="Customer (Buyer)"
            value={customerId}
            parties={buyers}
            placeholder="Search buyer name or code..."
            onChange={(val) => setCustomerId(val)}
            className="text-xs"
          />

          <Select
            id="fromLocationSelect"
            label="Pick-From Location"
            value={fromLocation}
            onChange={(e) => {
              setFromLocation(e.target.value as InventoryLocation);
              setSelectedStockId('');
            }}
            options={businessId ? [{ value: 'ZR_GODOWN', label: 'Main store' }, ...(units.data || []).filter(unit => unit.isActive).map(unit => ({ value: unit.code as InventoryLocation, label: unit.name }))] : LOCATIONS}
          />
        </div>

        <Select
          id="stockSelect"
          label="Select Fabric from Stock"
          value={selectedStockId}
          onChange={(e) => setSelectedStockId(e.target.value)}
          options={
            availableStock.length === 0
              ? [{ label: '— No finished dyed stock available at this location —', value: '' }]
              : [{ value: '', label: 'Choose fabric from stock' }, ...availableStock.map((s) => ({
                  label: `${s.fabricType} [${s.color}] (${s.yarnSpec}) - ${s.totalRolls} rolls (${formatWeight(s.totalWeightKg)} available)`,
                  value: s._id
                }))]
          }
        />
</FormSection>

        <DocumentReferences value={references} onChange={setReferences} />
          <FormSection step={2} title="Rolls and billing">
<Select label="Posting option" value={billNow ? "BILL" : "DELIVERY"} onChange={event => setBillNow(event.target.value === "BILL")} options={[{ value: "BILL", label: "Deliver & bill together" }, { value: "DELIVERY", label: "Deliver only · bill later" }]} /><RapidGridEntry rolls={rolls} onChange={setRolls} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            id="ratePerKg"
            type="number"
            step="0.01"
            min="0.01"
            label="Sale Rate / Kg (PKR)"
            value={ratePerKg}
            onChange={(e) => setRatePerKg(e.target.value)}
            required={billNow}
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Invoice Type</label>
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-canvas border border-line">
              <button
                type="button"
                onClick={() => setInvoiceType('TAX_18_PERCENT')}
                className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                  invoiceType === 'TAX_18_PERCENT'
                    ? 'bg-primary text-white'
                    : 'text-soft hover:text-strong'
                }`}
              >
                18% GST Tax
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType('NON_GST')}
                className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                  invoiceType === 'NON_GST'
                    ? 'bg-primary text-white'
                    : 'text-soft hover:text-strong'
                }`}
              >
                Non-GST
              </button>
            </div>
          </div>

          <Input
            id="dispatchDate"
            type="date"
            label="Delivery Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="p-3.5 rounded-lg bg-canvas border border-line space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-strong">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand" />
              Calculated Bill & Tax Amount
            </span>
            <span className="text-xs font-mono text-soft">
              {invoiceType === 'TAX_18_PERCENT' ? 'Standard Sales Tax (18%)' : 'Non-GST Bill (0%)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded bg-surface border border-line text-center">
              <div className="text-xs text-soft normal-case">Goods Value (Before Tax)</div>
              <div className="text-sm font-bold font-mono text-strong mt-0.5">
                {formatCurrency(financials.baseAmount)}
              </div>
            </div>

            <div className="p-2 rounded bg-surface border border-line text-center">
              <div className="text-xs text-soft normal-case">18% Sales Tax (GST)</div>
              <div className="text-sm font-bold font-mono text-warning mt-0.5">
                {formatCurrency(financials.taxAmount)}
              </div>
            </div>

            <div className="p-2 rounded bg-surface border border-line text-center">
              <div className="text-xs text-soft normal-case">Total Bill (Customer Owed)</div>
              <div className="text-sm font-bold font-mono text-brand mt-0.5">
                {formatCurrency(financials.grandTotal)}
              </div>
            </div>
          </div>
        </div>
</FormSection>

        <FormSection step={3} title="Delivery details">
<div className="grid grid-cols-2 gap-3">
          <Input
            id="driverName"
            label="Driver / Loader Name"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="e.g. Alex Smith"
          />

          <Input
            id="vehicleNo"
            label="Vehicle / Suzuki / Truck No."
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
            placeholder="e.g. SLK-22-108"
          />
        </div>

        <Input
          id="remarks"
          label="Delivery & Transport Notes"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Deliver to the main warehouse"
        />
</FormSection>


      </form>
    </Dialog>
  );
}
