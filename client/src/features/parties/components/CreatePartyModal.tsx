import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { PartyTags, CreatePartyPayload } from '../types/party.types.js';

export interface CreatePartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePartyModal({ isOpen, onClose, onSuccess }: CreatePartyModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [mlNo, setMlNo] = useState('');
  const [tags, setTags] = useState<PartyTags>({
    isFabricBuyer: true,
    isKnitter: false,
    isYarnClient: false,
    isDyeingMill: false
  });
  const [openingBalanceRaw, setOpeningBalanceRaw] = useState<string>('0');
  const [balanceType, setBalanceType] = useState<'Dr' | 'Cr'>('Dr');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.get<{ success: boolean; data: { nextCode: string } }>('/parties/next-code')
        .then((res) => {
          if (res.data?.data?.nextCode) {
            setCode(res.data.data.nextCode);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  function handleTagToggle(key: keyof PartyTags) {
    setTags((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const numBalance = parseFloat(openingBalanceRaw) || 0;
      const finalBalance = balanceType === 'Dr' ? Math.abs(numBalance) : -Math.abs(numBalance);

      const payload: CreatePartyPayload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        address: address.trim(),
        mlNo: mlNo.trim(),
        tags,
        openingBalance: finalBalance
      };

      await api.post('/parties', payload);

      setSuccess(`Party ${name} created with code ${code}`);
      setName('');
      setContactPerson('');
      setPhone('');
      setAddress('');
      setMlNo('');
      setOpeningBalanceRaw('0');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } } };
      setError(anyErr.response?.data?.error || 'Failed to create party profile');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add Customer, Knitter or Unit"
      description="Register a customer, outside knitter, yarn client, or dyeing unit."
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

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="code"
            label="Party Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            placeholder="PRT-001"
          />

          <div className="col-span-2">
            <Input
              id="name"
              label="Party / Business Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Al-Madina Fabrics"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="contactPerson"
            label="Contact Person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Tariq Mehmood"
          />

          <Input
            id="phone"
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0300-1234567"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="address"
            label="Physical Address / City"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Sialkot / Lahore"
          />

          <Input
            id="mlNo"
            label="ML / STRN / NTN Number"
            value={mlNo}
            onChange={(e) => setMlNo(e.target.value)}
            placeholder="e.g. 1234567-8"
          />
        </div>

        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="text-xs font-semibold text-zinc-300">Who is this party? (Select all that apply)</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isFabricBuyer}
                onChange={() => handleTagToggle('isFabricBuyer')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Customer (Buys fabric from us)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isKnitter}
                onChange={() => handleTagToggle('isKnitter')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Knitter (Knits yarn into fabric)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isYarnClient}
                onChange={() => handleTagToggle('isYarnClient')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Yarn Supplier / Client (Provides yarn)</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isDyeingMill}
                onChange={() => handleTagToggle('isDyeingMill')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Dyeing Unit (Dyes raw fabric)</span>
            </label>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-800">
          <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Starting Balance (Rs.)</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                id="openingBalance"
                type="number"
                step="any"
                value={openingBalanceRaw}
                onChange={(e) => setOpeningBalanceRaw(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-900 p-0.5">
              <button
                type="button"
                onClick={() => setBalanceType('Dr')}
                className={`px-3 py-1 text-xs font-semibold rounded ${
                  balanceType === 'Dr' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                They Owe Us (Debit)
              </button>
              <button
                type="button"
                onClick={() => setBalanceType('Cr')}
                className={`px-3 py-1 text-xs font-semibold rounded ${
                  balanceType === 'Cr' ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                We Owe Them (Credit)
              </button>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Select &quot;They Owe Us&quot; if this customer has an unpaid balance. Select &quot;We Owe Them&quot; if we have to pay this supplier.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            <span>Save Party</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
