import { useState, useRef, useEffect, ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { cn } from '../../lib/cn.js';
export interface ScrollableTableProps { children: ReactNode; className?: string; showScrollHint?: boolean; }
export function ScrollableTable({ children, className, showScrollHint = true }: ScrollableTableProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => setOverflow(element.scrollWidth > element.clientWidth + 2);
    const observer = new ResizeObserver(check);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    check();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="min-w-0">
      <div ref={ref} role="region" aria-label="Scrollable data table" tabIndex={overflow ? 0 : -1} className={cn('max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40', className)}>{children}</div>
      {showScrollHint && overflow && <p className="flex items-center gap-2 border-t border-line bg-subtle px-4 py-2 text-xs text-soft"><ArrowLeftRight className="h-3.5 w-3.5" />Scroll sideways to see all columns.</p>}
    </div>
  );
}
