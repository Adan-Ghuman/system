import { StockChoice } from '../../../components/ui/StockChoice.js';
import { DocumentReferences, useDocumentReferences } from '../../../components/ui/DocumentReferences.js';
import { getLocalDateInput } from '../../../lib/formatters.js';
import { useLocations } from '../../../business/useLocations.js';
import { loadAllRecords } from '../../../lib/pagedResources.js';
import { FormSection } from '../../../components/ui/WorkflowForm.js';
import { useState, useRef, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { formatWeight } from '../../../lib/formatters.js';
import { AlertCircle, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import {
  InventoryLocation,
  FabricInventoryItem,
  CreateTransferPayload
} from '../types/inventory.types.js';

export interface TransferStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedItem?: FabricInventoryItem | null;
}



export function TransferStockModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedItem
}: TransferStockModalProps) {
  const [references, setReferences] = useDocumentReferences();
  const locations = useLocations();
  const [fromLocation, setFromLocation] = useState<InventoryLocation>(preselectedItem?.location || 'GHUMMAN_DYEING');
  const [toLocation, setToLocation] = useState<InventoryLocation>(preselectedItem?.location === 'ZR_GODOWN' ? 'GHUMMAN_DYEING' : 'ZR_GODOWN');
  const [selectedItemId, setSelectedItemId] = useState<string>(preselectedItem?._id || '');
  const [rollsCount, setRollsCount] = useState(preselectedItem ? String(preselectedItem.totalRolls) : '');
  const [weightKg, setWeightKg] = useState(preselectedItem ? String(preselectedItem.totalWeightKg) : '');
  const [gatePassNo, setGatePassNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [date, setDate] = useState(getLocalDateInput());
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: stockData } = useQuery<{ items: FabricInventoryItem[] }>({
    queryKey: ['inventory-items', fromLocation],
    queryFn: async () => {
      return loadAllRecords<FabricInventoryItem>('/inventory/items', { location: fromLocation });
    },
    enabled: isOpen
  });

  const availableItems = stockData?.items || [];
  const owners = useQuery({ queryKey: ['party-options', 'all'], queryFn: () => loadAllRecords<{ _id: string; name: string }>('/parties'), enabled: isOpen });



  const activeItem = availableItems.find((i) => i._id === selectedItemId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (!activeItem) {
      setError('Please select a valid fabric holding to transfer');
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: CreateTransferPayload = { ...references, ownerKey: activeItem.ownerKey || 'OWN',
        fromLocation,
        toLocation,
        fabricType: activeItem.fabricType,
        yarnSpec: activeItem.yarnSpec,
        state: activeItem.state,
        color: activeItem.color,
        rollsCount: parseInt(rollsCount, 10),
        weightKg: parseFloat(weightKg),
        gatePassNo: gatePassNo.trim(),
        driverName: driverName.trim(),
        vehicleNo: vehicleNo.trim().toUpperCase(),
        date: new Date(date).toISOString(),
        remarks: remarks.trim()
      };

      await api.post('/inventory/transfers', payload);

      setSuccess('Stock transferred successfully and locations updated');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
      setError(anyErr.response?.data?.error || anyErr.message || 'Failed to transfer stock');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-stock-modal-form" isLoading={isLoading} className="gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Confirm & Move Stock</span>
          </Button>
        </div>}
      isOpen={isOpen}
      onClose={onClose}
      title="Move Fabric Between Locations"
      description="Transfer physically available fabric between the selected godown or mill locations."
      className="max-w-xl"
    >
      <form id="transfer-stock-modal-form" onSubmit={handleSubmit} className="space-y-4"><DocumentReferences value={references} onChange={setReferences} />
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

        <FormSection step={1} title="Choose fabric">
<div className="grid grid-cols-2 gap-3">
          <Select
            id="fromLocation"
            label="Source Location (Origin)"
            value={fromLocation}
            onChange={(e) => {
              const newFrom = e.target.value as InventoryLocation;
              setFromLocation(newFrom);
              if (newFrom === toLocation) {
                setToLocation(newFrom === 'ZR_GODOWN' ? 'GHUMMAN_DYEING' : 'ZR_GODOWN');
              }
              setSelectedItemId('');
            }}
            options={locations}
          />

          <Select
            id="toLocation"
            label="Destination Location (Target)"
            value={toLocation}
            onChange={(e) => setToLocation(e.target.value as InventoryLocation)}
            options={locations.filter((l) => l.value !== fromLocation)}
          />
        </div>

        <StockChoice location={fromLocation}
          id="stockItemSelect"
          label="Select Fabric Lot at Origin"
          value={selectedItemId}
          onChange={(selectedId) => {
            setError(null);setSelectedItemId(selectedId);
            const found = availableItems.find((i) => i._id === selectedId);
            if (found) {
              setRollsCount(String(found.totalRolls));
              setWeightKg(String(found.totalWeightKg));
            }
          }}
          options={
            availableItems.length === 0
              ? [{ label: 'No stock available at source location', value: '' }]
              : [{ value: '', label: 'Choose fabric from stock' }, ...availableItems.map((i) => ({
                  label: `${i.fabricType} [${i.color}] (${i.state === 'FINISHED_DYED' ? 'Dyed' : 'Ecru'}) - ${i.totalRolls} rolls (${formatWeight(i.totalWeightKg)}) · ${i.ownerKey && i.ownerKey !== 'OWN' ? owners.data?.items.find(party => party._id === i.ownerKey)?.name || 'Client-owned' : 'Business-owned'}`,
                  value: i._id
                }))]
          }
        />

        {activeItem && (
          <div className="p-3 rounded-lg bg-canvas border border-line flex items-center justify-between text-xs">
            <div>
              <div className="text-soft">Current Available at Origin:</div>
              <div className="font-semibold text-strong mt-0.5">
                {activeItem.fabricType} ({activeItem.color})
              </div>
            </div>
            <div className="text-right">
              <div className="text-soft">Total Rolls / Weight:</div>
              <div className="font-mono font-bold text-brand mt-0.5">
                {activeItem.totalRolls} rolls • {formatWeight(activeItem.totalWeightKg)}
              </div>
            </div>
          </div>
        )}
</FormSection>

        <FormSection step={2} title="Quantities and delivery">
<div className="grid grid-cols-3 gap-3">
          <Input
            id="rollsCount"
            type="number"
            min="1"
            max={activeItem?.totalRolls}
            label="Rolls to Transfer"
            value={rollsCount}
            onChange={(e) => setRollsCount(e.target.value)}
            required
          />

          <Input
            id="weightKg"
            type="number"
            step="0.01"
            min="0.01"
            max={activeItem?.totalWeightKg}
            label="Weight (Kg)"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
          />

          <Input
            id="transferDate"
            type="date"
            label="Dispatch Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="gatePassNo"
            label="Gate Pass / OGP No."
            value={gatePassNo}
            onChange={(e) => setGatePassNo(e.target.value)}
            placeholder="e.g. 1234"
          />

          <Input
            id="driverName"
            label="Driver / Loader Name"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="e.g. Alex Smith"
          />

          <Input
            id="vehicleNo"
            label="Vehicle / Rikshaw No."
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
            placeholder="e.g. LE-20-4491"
          />
        </div>

        <Input
          id="transferRemarks"
          label="Remarks / Dispatch Notes"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Shifting finished black fleece rolls to godown"
        />
</FormSection>


      </form>
    </Dialog>
  );
}
