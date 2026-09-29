import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '../../lib/cn.js';
import { Search, ChevronDown, Check, Plus, X } from 'lucide-react';

export interface ComboboxOption {
  _id: string;
  name: string;
  code?: string;
  phone?: string;
}

export interface PartyComboboxProps {
  id?: string;
  label?: string;
  value: string; // either party._id or custom party name
  onChange: (value: string, selectedParty?: ComboboxOption) => void;
  parties: ComboboxOption[];
  placeholder?: string;
  allowCustom?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
}

export function PartyCombobox({
  id,
  label,
  value,
  onChange,
  parties = [],
  placeholder = 'Select or type party name...',
  allowCustom = true,
  required = false,
  error,
  className
}: PartyComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently selected party if value is an _id or matching name
  const selectedParty = useMemo(() => {
    return parties.find((p) => p._id === value || p.name.toLowerCase() === value.toLowerCase());
  }, [parties, value]);

  // Sync search input with selected party or custom value
  useEffect(() => {
    if (selectedParty) {
      setSearch(selectedParty.name);
    } else {
      setSearch(value || '');
    }
  }, [value, selectedParty]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredParties = useMemo(() => {
    if (!search.trim()) return parties;
    const q = search.toLowerCase().trim();
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q))
    );
  }, [parties, search]);

  const exactMatchExists = useMemo(() => {
    if (!search.trim()) return false;
    return parties.some((p) => p.name.toLowerCase() === search.toLowerCase().trim());
  }, [parties, search]);

  function handleSelect(p: ComboboxOption) {
    onChange(p._id, p);
    setSearch(p.name);
    setIsOpen(false);
  }

  function handleUseCustom() {
    if (!search.trim()) return;
    onChange(search.trim(), undefined);
    setIsOpen(false);
  }

  function handleClear() {
    onChange('', undefined);
    setSearch('');
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="w-full space-y-1.5 relative">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-zinc-300">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={search}
            placeholder={placeholder}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
              if (allowCustom) {
                // If user clears input or types custom directly
                onChange(e.target.value, undefined);
              }
            }}
            className={cn(
              'flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900/90 pl-8 pr-14 py-1 text-sm text-zinc-100 transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
              error && 'border-red-500',
              className
            )}
          />

          <div className="absolute right-2 flex items-center gap-1">
            {search && (
              <button
                type="button"
                onClick={handleClear}
                className="text-zinc-500 hover:text-zinc-300 p-0.5"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5"
              tabIndex={-1}
            >
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-xl py-1 text-xs">
            {filteredParties.length > 0 ? (
              filteredParties.map((p) => {
                const isSelected = selectedParty?._id === p._id;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-emerald-950/60 text-emerald-300 font-semibold'
                        : 'text-zinc-200 hover:bg-zinc-800'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{p.name}</span>
                      {p.code && (
                        <span className="text-[10px] text-zinc-500 font-mono">({p.code})</span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-zinc-500 text-center text-[11px]">
                No matching parties found in database
              </div>
            )}

            {allowCustom && search.trim() && !exactMatchExists && (
              <button
                type="button"
                onClick={handleUseCustom}
                className="w-full flex items-center gap-2 px-3 py-2 text-left border-t border-zinc-800/80 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Use &quot;{search.trim()}&quot; (Custom Party)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
}
