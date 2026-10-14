import { SelectHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/cn.js';
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string; options: { label: string; value: string }[]; }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const generated = useId();
    const inputId = id || generated;
    return (
      <div className="w-full min-w-0 space-y-1.5">
        {label && <label htmlFor={inputId} className="block text-xs font-medium text-ink">{label}</label>}
        <select {...props} id={inputId} ref={ref} aria-invalid={Boolean(error)} aria-describedby={error ? inputId + '-error' : props['aria-describedby']}
          className={cn('flex h-10 w-full min-w-0 rounded-lg border border-control bg-surface px-3 py-2 text-sm text-strong transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60', error && 'border-danger', className)}>
          {options.map((option) => <option key={option.value} value={option.value} className="bg-surface text-strong">{option.label}</option>)}
        </select>
        {error && <p id={inputId + '-error'} className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
