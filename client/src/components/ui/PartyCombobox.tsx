import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { cn } from '../../lib/cn.js';
import { Search, ChevronDown, Check, Plus, X } from 'lucide-react';

export interface ComboboxOption { _id: string; name: string; code?: string; phone?: string; }
export interface PartyComboboxProps {
  id?: string; label?: string; value: string; onChange: (value: string, selectedParty?: ComboboxOption) => void;
  parties: ComboboxOption[]; placeholder?: string; allowCustom?: boolean; required?: boolean; error?: string; className?: string;
}

export function PartyCombobox({ id, label, value, onChange, parties = [], placeholder = 'Search or enter a name', allowCustom = true, required = false, error, className }: PartyComboboxProps) {
  const generated = useId();
  const inputId = id || generated;
  const listId = inputId + '-options';
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedParty = useMemo(() => parties.find((party) => party._id === value || party.name.toLowerCase() === value.toLowerCase()), [parties, value]);
  useEffect(() => {
    if (selectedParty) setSearch(selectedParty.name);
    else if (document.activeElement !== inputRef.current) setSearch(value || '');
  }, [value, selectedParty]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return parties.filter((party) => !query || party.name.toLowerCase().includes(query) || party.code?.toLowerCase().includes(query) || party.phone?.includes(query));
  }, [parties, search]);
  const canUseCustom = allowCustom && Boolean(search.trim()) && !parties.some((party) => party.name.toLowerCase() === search.toLowerCase().trim());
  const optionCount = filtered.length + (canUseCustom ? 1 : 0);
  useEffect(() => {
    if (isOpen && activeIndex >= 0) document.getElementById(listId + '-' + activeIndex)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen, listId]);
  function select(party?: ComboboxOption) {
    if (party) { onChange(party._id, party); setSearch(party.name); }
    else if (canUseCustom) { onChange(search.trim()); setSearch(search.trim()); }
    setIsOpen(false);
    inputRef.current?.focus();
  }
  return (
    <div ref={containerRef} className="relative w-full min-w-0 space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-xs font-medium text-ink">{label}{required && <span className="ml-1 text-soft" aria-hidden="true">*</span>}</label>}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-soft" aria-hidden="true" />
        <input id={inputId} ref={inputRef} type="text" value={search} placeholder={placeholder} required={required} role="combobox" aria-expanded={isOpen} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={isOpen && optionCount && activeIndex >= 0 ? listId + '-' + Math.min(activeIndex, optionCount - 1) : undefined}
          aria-invalid={Boolean(error)} aria-describedby={error ? inputId + '-error' : undefined} autoComplete="off"
          onClick={() => setIsOpen(true)}
          onBlur={(event) => { if (!containerRef.current?.contains(event.relatedTarget as Node)) setIsOpen(false); }}
          onChange={(event) => { setSearch(event.target.value); setIsOpen(true); setActiveIndex(-1); onChange(allowCustom ? event.target.value : ''); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setIsOpen(true); setActiveIndex((current) => Math.max(0, Math.min(optionCount - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))); }
            if (event.key === 'Enter' && isOpen && optionCount) { event.preventDefault(); select(filtered[Math.max(0, Math.min(activeIndex, optionCount - 1))]); }
            if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); setIsOpen(false); }
          }}
          className={cn('h-10 w-full rounded-lg border border-control bg-surface py-2 pl-10 pr-16 text-sm text-strong placeholder:text-soft focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand', error && 'border-danger', className)} />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
          {search && <button type="button" aria-label="Clear selection" onClick={() => { onChange(''); setSearch(''); inputRef.current?.focus(); }} className="rounded-md p-2 text-soft hover:text-strong"><X className="h-3.5 w-3.5" /></button>}
          <button type="button" aria-label="Show parties" tabIndex={-1} onClick={() => { setIsOpen((open) => !open); inputRef.current?.focus(); }} className="rounded-md p-2 text-soft"><ChevronDown className="h-3.5 w-3.5" /></button>
        </div>
        {isOpen && (
          <div id={listId} role="listbox" aria-label={(label || 'Parties') + ' choices'} className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
            {filtered.map((party, index) => (
              <button type="button" role="option" tabIndex={-1} aria-selected={selectedParty?._id === party._id} id={listId + '-' + index} key={party._id} onMouseDown={(event) => event.preventDefault()} onClick={() => select(party)}
                className={cn('flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-xs', index === activeIndex ? 'bg-subtle text-strong' : 'text-ink hover:bg-subtle')}>
                <span className="min-w-0 truncate">{party.name}{party.code && <span className="ml-2 text-soft">({party.code})</span>}</span>{selectedParty?._id === party._id && <Check className="h-4 w-4 shrink-0 text-brand" />}
              </button>
            ))}
            {!optionCount && <p className="px-3 py-4 text-xs text-soft">No matching parties.</p>}
            {canUseCustom && <button type="button" role="option" tabIndex={-1} aria-selected={false} id={listId + '-' + filtered.length} onMouseDown={(event) => event.preventDefault()} onClick={() => select()} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs text-brand hover:bg-brand-soft"><Plus className="h-4 w-4 shrink-0" /><span className="truncate">Use “{search.trim()}”</span></button>}
          </div>
        )}
      </div>
      {error && <p id={inputId + '-error'} className="text-xs text-danger">{error}</p>}
    </div>
  );
}
