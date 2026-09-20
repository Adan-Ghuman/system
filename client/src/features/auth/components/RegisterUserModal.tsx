import { useState, useRef, FormEvent } from 'react';
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
  { id: 'parties:read', label: 'Customers & Suppliers: View list' },
  { id: 'parties:write', label: 'Customers & Suppliers: Add & Edit' },
  { id: 'knitting:read', label: 'Knitting & Yarn: View yarn balances' },
  { id: 'knitting:write', label: 'Knitting & Yarn: Send yarn / Receive fabric' },
  { id: 'dyeing:read', label: 'Dyeing Batches: View status & units' },
  { id: 'dyeing:write', label: 'Dyeing Batches: Send to unit & Receive back' },
  { id: 'inventory:read', label: 'Fabric Stock: View warehouse inventory' },
  { id: 'inventory:write', label: 'Fabric Stock: Add stock & Move locations' },
  { id: 'dispatch:read', label: 'Deliveries & Bills: View history' },
  { id: 'dispatch:write', label: 'Deliveries & Bills: Create gate passes & bills' },
  { id: 'accounts:read', label: 'Payments & Ledgers: View accounts & statements' },
  { id: 'accounts:write', label: 'Payments & Ledgers: Record payments in / out' },
  { id: 'export:generate', label: 'Document Printing: Print bills & export reports' }
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
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleRoleChange(newRole: 'operator' | 'viewer' | 'admin') {
    setRole(newRole);
    if (newRole === 'viewer') {
      setSelectedPermissions([
        'parties:read',
        'knitting:read',
        'dyeing:read',
        'inventory:read',
        'dispatch:read',
        'accounts:read'
      ]);
    } else {
      setSelectedPermissions(AVAILABLE_PERMISSIONS.map((p) => p.id));
    }
  }

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
    if (isSubmittingRef.current || isLoading) return;

    isSubmittingRef.current = true;
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
      isSubmittingRef.current = false;
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Staff Account"
      description="Set up login email and password, and choose which features this staff member can access."
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
            label="Login Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Minimum 6 characters"
          />

          <Select
            id="role"
            label="Account Type"
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as 'operator' | 'viewer' | 'admin')}
            options={[
              { label: 'Staff / Operator (Standard daily use)', value: 'operator' },
              { label: 'Viewer (Can only view data, no changes)', value: 'viewer' },
              { label: 'Administrator (Full access to all features)', value: 'admin' }
            ]}
          />
        </div>

        {role !== 'admin' && (
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Feature Access Permissions</label>
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
            Save User Account
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
