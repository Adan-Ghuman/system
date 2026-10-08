import { ReactNode, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Copy, Trash2 } from 'lucide-react';
import { Button } from './Button.js';

export function FormSection({ step, title, description, children }: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-400">{step}</span>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          {description && <p className="mt-1 text-xs leading-relaxed text-zinc-400">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function OptionalDetails({ title = 'Optional details', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-zinc-800 bg-zinc-950/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-xs font-medium text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-zinc-800 p-4">{children}</div>
    </details>
  );
}

export function EntryCard({ title, children, onCopy, onRemove, canRemove }: {
  title: string;
  children: ReactNode;
  onCopy: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-zinc-200">{title}</h4>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCopy} aria-label={'Copy details of ' + title}>
            <Copy className="h-3.5 w-3.5" /> Copy details
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove} aria-label={'Remove ' + title}>
            <Trash2 className="h-3.5 w-3.5" /> <span className="sr-only">Remove</span>
          </Button>
        </div>
      </div>
      {children}
    </section>
  );
}

export function FormFeedback({ error, success }: { error: string | null; success: string | null }) {
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  return (
    <>
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 focus:outline-none">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{success}</span>
        </div>
      )}
    </>
  );
}

export function FormFooter({ formId, summary, onClose, isLoading, isSaved, disabled = false, submitLabel }: {
  formId: string;
  summary: ReactNode;
  onClose: () => void;
  isLoading: boolean;
  isSaved: boolean;
  disabled?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs leading-relaxed text-zinc-400">{summary}</div>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button type="submit" form={formId} isLoading={isLoading} disabled={disabled || isSaved}>
          {isSaved ? 'Saved' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
