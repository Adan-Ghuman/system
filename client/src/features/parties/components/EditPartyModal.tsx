import { useState, useEffect, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { PartyItem, PartyTags, UpdatePartyPayload } from '../types/party.types.js';

export interface EditPartyModalProps {
  party: PartyItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPartyModal({ party, isOpen, onClose, onSuccess }: EditPartyModalProps) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [mlNo, setMlNo] = useState('');
  const [tags, setTags] = useState<PartyTags>({
    isFabricBuyer: false,
    isKnitter: false,
    isYarnClient: false,
    isDyeingMill: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (party) {
      setName(party.name || '');
      setContactPerson(party.contactPerson || '');
      setPhone(party.phone || '');
      setAddress(party.address || '');
      setMlNo(party.mlNo || '');
      setTags({
        isFabricBuyer: party.tags?.isFabricBuyer || false,
        isKnitter: party.tags?.isKnitter || false,
        isYarnClient: party.tags?.isYarnClient || false,
        isDyeingMill: party.tags?.isDyeingMill || false
      });
      setError(null);
      setSuccess(null);
    }
  }, [party]);

  function handleTagToggle(key: keyof PartyTags) {
    setTags((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!party) return;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const payload: UpdatePartyPayload = {
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        address: address.trim(),
        mlNo: mlNo.trim(),
        tags
      };

      await api.put(`/parties/${party._id}`, payload);

      setSuccess('Party profile updated successfully');
      onSuccess();

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 800);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } } };
      setError(anyErr.response?.data?.error || 'Failed to update party profile');
    } finally {
      setIsLoading(false);
    }
  }

  if (!party) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Party: ${party.code}`}
      description="Update profile details and operational role assignments."
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

        <Input
          id="editName"
          label="Party / Business Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="editContactPerson"
            label="Contact Person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />

          <Input
            id="editPhone"
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="editAddress"
            label="Physical Address / City"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <Input
            id="editMlNo"
            label="ML / STRN / NTN Number"
            value={mlNo}
            onChange={(e) => setMlNo(e.target.value)}
          />
        </div>

        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="text-xs font-semibold text-zinc-300">Operational Role Tags</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isFabricBuyer}
                onChange={() => handleTagToggle('isFabricBuyer')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Fabric Buyer</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isKnitter}
                onChange={() => handleTagToggle('isKnitter')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Contract Knitter</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isYarnClient}
                onChange={() => handleTagToggle('isYarnClient')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Yarn Client</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={tags.isDyeingMill}
                onChange={() => handleTagToggle('isDyeingMill')}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Dyeing Processing Mill</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
