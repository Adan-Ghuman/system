import { useState, useEffect, FormEvent } from 'react';
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

const LOCATIONS: { label: string; value: InventoryLocation }[] = [
  { label: 'ZR Godown (Main Depot)', value: 'ZR_GODOWN' },
  { label: 'Ghumman Dyeing Mill', value: 'GHUMMAN_DYEING' },
  { label: 'Rajput Dyeing Mill', value: 'RAJPUT_DYEING' }
];

export function TransferStockModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedItem
}: TransferStockModalProps) {
  const [fromLocation, setFromLocation] = useState<InventoryLocation>('GHUMMAN_DYEING');
  const [toLocation, setToLocation] = useState<InventoryLocation>('ZR_GODOWN');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [rollsCount, setRollsCount] = useState('10');
  const [weightKg, setWeightKg] = useState('220.00');
  const [gatePassNo, setGatePassNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: stockData } = useQuery<{ items: FabricInventoryItem[] }>({
    queryKey: ['inventory-items', fromLocation],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: FabricInventoryItem[] } }>('/inventory/items', {
        params: { location: fromLocation, limit: 100 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const availableItems = stockData?.items || [];

  useEffect(() => {
    if (preselectedItem) {
      setFromLocation(preselectedItem.location);
      setToLocation(preselectedItem.location === 'ZR_GODOWN' ? 'GHUMMAN_DYEING' : 'ZR_GODOWN');
      setSelectedItemId(preselectedItem._id);
      setRollsCount(String(preselectedItem.totalRolls));
      setWeightKg(String(preselectedItem.totalWeightKg));
    } else if (availableItems.length > 0 && !selectedItemId) {
      setSelectedItemId(availableItems[0]._id);
      setRollsCount(String(availableItems[0].totalRolls));
      setWeightKg(String(availableItems[0].totalWeightKg));
    }
  }, [preselectedItem, availableItems, selectedItemId]);

  const activeItem = availableItems.find((i) => i._id === selectedItemId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeItem) {
      setError('Please select a valid fabric holding to transfer');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: CreateTransferPayload = {
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
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Inter-Location Fabric Transfer"
      description="Transfer fabric rolls between ZR Godown and Dyeing Mills with atomic stock updates."
      className="max-w-xl"
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
            options={LOCATIONS}
          />

          <Select
            id="toLocation"
            label="Destination Location (Target)"
            value={toLocation}
            onChange={(e) => setToLocation(e.target.value as InventoryLocation)}
            options={LOCATIONS.filter((l) => l.value !== fromLocation)}
          />
        </div>

        <Select
          id="stockItemSelect"
          label="Select Fabric Lot at Origin"
          value={selectedItemId}
          onChange={(e) => {
            setSelectedItemId(e.target.value);
            const found = availableItems.find((i) => i._id === e.target.value);
            if (found) {
              setRollsCount(String(found.totalRolls));
              setWeightKg(String(found.totalWeightKg));
            }
          }}
          options={
            availableItems.length === 0
              ? [{ label: 'No stock available at source location', value: '' }]
              : availableItems.map((i) => ({
                  label: `${i.fabricType} [${i.color}] (${i.state === 'FINISHED_DYED' ? 'Dyed' : 'Ecru'}) - ${i.totalRolls} rolls (${formatWeight(i.totalWeightKg)})`,
                  value: i._id
                }))
          }
        />

        {activeItem && (
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <div className="text-zinc-400">Current Available at Origin:</div>
              <div className="font-semibold text-zinc-100 mt-0.5">
                {activeItem.fabricType} ({activeItem.color})
              </div>
            </div>
            <div className="text-right">
              <div className="text-zinc-400">Total Rolls / Weight:</div>
              <div className="font-mono font-bold text-emerald-400 mt-0.5">
                {activeItem.totalRolls} rolls • {formatWeight(activeItem.totalWeightKg)}
              </div>
            </div>
          </div>
        )}

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
            placeholder="e.g. OGP-TRF-091"
          />

          <Input
            id="driverName"
            label="Driver / Loader Name"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="e.g. Aslam"
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

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Confirm Transfer</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
