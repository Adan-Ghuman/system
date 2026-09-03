import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
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
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LOCATIONS: { label: string; value: InventoryLocation }[] = [
  { label: 'ZR Godown (Main Dispatch Depot)', value: 'ZR_GODOWN' },
  { label: 'Ghumman Dyeing Mill (Direct Mill Dispatch)', value: 'GHUMMAN_DYEING' },
  { label: 'Rajput Dyeing Mill (Direct Mill Dispatch)', value: 'RAJPUT_DYEING' }
];

export function CreateDispatchModal({ isOpen, onClose, onSuccess }: CreateDispatchModalProps) {
  const [customerId, setCustomerId] = useState('');
  const [fromLocation, setFromLocation] = useState<InventoryLocation>('ZR_GODOWN');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [ratePerKg, setRatePerKg] = useState('850');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('TAX_18_PERCENT');
  const [rolls, setRolls] = useState<DispatchRollItem[]>([
    { rollNumber: 1, grossWeightKg: 22.5, tareKg: 0, netWeightKg: 22.5 }
  ]);
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: buyersData } = useQuery<{ items: PartyItem[] }>({
    queryKey: ['parties', 'isFabricBuyer'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PartyItem[] } }>('/parties', {
        params: { tag: 'isFabricBuyer', limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const buyers = buyersData?.items || [];

  const { data: stockData } = useQuery<{ items: FabricInventoryItem[] }>({
    queryKey: ['inventory-items-for-dispatch', fromLocation],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: FabricInventoryItem[] } }>('/inventory/items', {
        params: { location: fromLocation, state: 'FINISHED_DYED', limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const availableStock = stockData?.items || [];

  useEffect(() => {
    if (buyers.length > 0 && !customerId) {
      setCustomerId(buyers[0]._id);
    }
  }, [buyers, customerId]);

  useEffect(() => {
    if (availableStock.length > 0 && !selectedStockId) {
      setSelectedStockId(availableStock[0]._id);
    }
  }, [availableStock, selectedStockId]);

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
    if (!activeStock) {
      setError('Please select a finished dyed fabric stock item to dispatch');
      return;
    }

    if (rolls.length === 0) {
      setError('At least one roll must be specified');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: CreateDispatchPayload = {
        customerId,
        fromLocation,
        fabricType: activeStock.fabricType,
        yarnSpec: activeStock.yarnSpec,
        color: activeStock.color,
        rolls,
        ratePerKg: parseFloat(ratePerKg),
        invoiceType,
        driverName: driverName.trim(),
        vehicleNo: vehicleNo.trim().toUpperCase(),
        date: new Date(date).toISOString(),
        remarks: remarks.trim()
      };

      await api.post('/dispatch', payload);

      setSuccess('Dispatch logged, commercial invoice created, and ledger debited');
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
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create Fabric Dispatch & Dual Invoice"
      description="Select dispatch location, weigh rolls via RapidGridEntry, configure 18% GST vs Non-GST, and post atomic ledger debit."
      className="max-w-2xl"
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

        <div className="grid grid-cols-2 gap-3">
          <Select
            id="dispatchCustomer"
            label="Customer (Buyer)"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={buyers.map((b) => ({
              label: `${b.code} - ${b.name} (Bal: ${formatCurrency(b.currentBalance)})`,
              value: b._id
            }))}
          />

          <Select
            id="fromLocationSelect"
            label="Pick-From Dispatch Location"
            value={fromLocation}
            onChange={(e) => {
              setFromLocation(e.target.value as InventoryLocation);
              setSelectedStockId('');
            }}
            options={LOCATIONS}
          />
        </div>

        <Select
          id="stockSelect"
          label="Select Finished Dyed Fabric at Location"
          value={selectedStockId}
          onChange={(e) => setSelectedStockId(e.target.value)}
          options={
            availableStock.length === 0
              ? [{ label: '— No finished dyed stock available at this location —', value: '' }]
              : availableStock.map((s) => ({
                  label: `${s.fabricType} [${s.color}] (${s.yarnSpec}) - ${s.totalRolls} rolls (${formatWeight(s.totalWeightKg)} available)`,
                  value: s._id
                }))
          }
        />

        <RapidGridEntry rolls={rolls} onChange={setRolls} />

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="ratePerKg"
            type="number"
            step="0.01"
            min="0.01"
            label="Sale Rate / Kg (PKR)"
            value={ratePerKg}
            onChange={(e) => setRatePerKg(e.target.value)}
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Invoice Type</label>
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-zinc-950 border border-zinc-800">
              <button
                type="button"
                onClick={() => setInvoiceType('TAX_18_PERCENT')}
                className={`flex-1 py-1 text-[11px] font-semibold rounded transition-colors ${
                  invoiceType === 'TAX_18_PERCENT'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                18% GST Tax
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType('NON_GST')}
                className={`flex-1 py-1 text-[11px] font-semibold rounded transition-colors ${
                  invoiceType === 'NON_GST'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Non-GST
              </button>
            </div>
          </div>

          <Input
            id="dispatchDate"
            type="date"
            label="Dispatch Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Automated Commercial Invoice Calculation
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {invoiceType === 'TAX_18_PERCENT' ? 'Standard Sales Tax (18%)' : 'Non-GST Commercial Bill (0%)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Base Amount</div>
              <div className="text-sm font-bold font-mono text-zinc-100 mt-0.5">
                {formatCurrency(financials.baseAmount)}
              </div>
            </div>

            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">18% Sales Tax (GST)</div>
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                {formatCurrency(financials.taxAmount)}
              </div>
            </div>

            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Grand Total (Receivable)</div>
              <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                {formatCurrency(financials.grandTotal)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="driverName"
            label="Driver / Loader Name"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="e.g. Shafiq"
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
          label="Dispatch & Transport Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Goods delivered at buyer warehouse in Kotli Behram"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5">
            <Truck className="w-4 h-4" />
            <span>Generate OGP & Post Invoice</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
