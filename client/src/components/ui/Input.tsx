import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/cn.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { error?: string; label?: string; }
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, label, id, ...props }, ref) => {
    const generated = useId();
    const inputId = id || generated;
    const errorId = inputId + '-error';
    return (
      <div className="w-full min-w-0 space-y-1.5">
        {label && <label htmlFor={inputId} className="block text-xs font-medium text-ink">{label}</label>}
        <input {...props} id={inputId} type={type} ref={ref} aria-label={props['aria-label'] || (!label ? props.placeholder : undefined)}
          aria-invalid={Boolean(error)} aria-describedby={error ? errorId : props['aria-describedby']}
          className={cn('flex h-10 w-full min-w-0 rounded-lg border border-control bg-surface px-3 py-2 text-sm text-strong placeholder:text-soft transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60', error && 'border-danger focus:border-danger focus:ring-danger/20', className)} />
        {error && <p id={errorId} className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
