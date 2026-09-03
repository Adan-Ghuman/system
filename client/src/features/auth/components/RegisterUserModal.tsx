import { useState, FormEvent } from 'react';
import { api } from '../../../lib/api.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Button } from '../../../components/ui/Button.js';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface RegisterUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated?: () => void;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'parties:read', label: 'Parties: View Directory' },
  { id: 'parties:write', label: 'Parties: Create/Edit Parties' },
  { id: 'knitting:read', label: 'Knitting: View Transactions & Balances' },
  { id: 'knitting:write', label: 'Knitting: Record Yarn Outward/Inward' },
  { id: 'dyeing:read', label: 'Dyeing: View Batches & Mill Progress' },
  { id: 'dyeing:write', label: 'Dyeing: Issue & Settle Batches' },
  { id: 'inventory:read', label: 'Inventory: View Multi-Location Stock' },
  { id: 'inventory:write', label: 'Inventory: Stock Adjustment' },
  { id: 'dispatch:read', label: 'Dispatch: View Gate Passes & Invoices' },
  { id: 'dispatch:write', label: 'Dispatch: Create OGP & GST Invoices' },
  { id: 'accounts:read', label: 'Accounts: View Ledgers & Balances' },
  { id: 'accounts:write', label: 'Accounts: Record Payment Vouchers' },
  { id: 'export:generate', label: 'Exports: Generate PDFs & Excel' }
];

export function RegisterUserModal({ isOpen, onClose, onUserCreated }: RegisterUserModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'operator' | 'viewer' | 'admin'>('operator');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'parties:read',
    'parties:write',
    'knitting:read',
    'knitting:write',
    'dyeing:read',
    'dyeing:write',
    'inventory:read',
    'dispatch:read',
    'dispatch:write',
    'accounts:read',
    'accounts:write',
    'export:generate'
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function togglePermission(permId: string) {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  }

  function handleSelectAllPermissions() {
    if (selectedPermissions.length === AVAILABLE_PERMISSIONS.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(AVAILABLE_PERMISSIONS.map((p) => p.id));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await api.post('/users', {
        fullName,
        email,
        password,
        role,
        permissions: role === 'admin' ? AVAILABLE_PERMISSIONS.map((p) => p.id) : selectedPermissions
      });

      setSuccess(`User ${email} created successfully`);
      setFullName('');
      setEmail('');
      setPassword('');
      if (onUserCreated) onUserCreated();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } } };
      setError(anyErr.response?.data?.error || 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Provision New Operator / User"
      description="Create credentials and grant granular permissions for new staff members."
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
          <Input
            id="fullName"
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="e.g. Asim Raza"
          />

          <Input
            id="userEmail"
            type="email"
            label="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="asim@domain.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="userPassword"
            type="password"
            label="Temporary Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Minimum 6 characters"
          />

          <Select
            id="role"
            label="System Role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'operator' | 'viewer' | 'admin')}
            options={[
              { label: 'Operator (Standard Operations)', value: 'operator' },
              { label: 'Viewer (Read Only)', value: 'viewer' },
              { label: 'Administrator (Full Access)', value: 'admin' }
            ]}
          />
        </div>

        {role !== 'admin' && (
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Granular Permissions</label>
              <button
                type="button"
                onClick={handleSelectAllPermissions}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
              >
                {selectedPermissions.length === AVAILABLE_PERMISSIONS.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create User
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
