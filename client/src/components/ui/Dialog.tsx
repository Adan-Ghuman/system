import { useEffect, useId, useRef, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

let openDialogCount = 0;
let previousBodyOverflow = '';

export function Dialog({ isOpen, onClose, title, description, children, footer, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogCount++;

    function visibleControls() {
      return Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]'
      ) || []).filter((element) => element.offsetParent !== null && element.tabIndex >= 0);
    }

    const frame = requestAnimationFrame(() => {
      const controls = visibleControls();
      const firstField = controls.find((element) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName));
      (firstField || dialogRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      const topDialog = Array.from(document.querySelectorAll('[data-erp-dialog]')).at(-1);
      if (topDialog !== dialogRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = visibleControls();
      if (controls.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || active === dialogRef.current || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      openDialogCount--;
      if (openDialogCount === 0) document.body.style.overflow = previousBodyOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          data-erp-dialog
          tabIndex={-1}
          className={cn(
            'relative z-50 flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left shadow-2xl focus:outline-none sm:max-h-[calc(100dvh-2rem)]',
            className
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-zinc-100">{title}</h2>
              {description && <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-zinc-400">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Close dialog">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
          {footer && <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-3 sm:px-6">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
