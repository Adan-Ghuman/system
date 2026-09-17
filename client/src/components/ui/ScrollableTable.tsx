import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { cn } from '../../lib/cn.js';

export interface ScrollableTableProps {
  children: ReactNode;
  className?: string;
  showScrollHint?: boolean;
}

export function ScrollableTable({
  children,
  className,
  showScrollHint = true
}: ScrollableTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [thumbWidthPercent, setThumbWidthPercent] = useState(100);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const hasOverflow = maxScroll > 4;

    setIsScrollable(hasOverflow);
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < maxScroll - 4);

    if (hasOverflow && maxScroll > 0) {
      const thumbWidth = Math.max(15, Math.min(100, (clientWidth / scrollWidth) * 100));
      setThumbWidthPercent(thumbWidth);
      const trackRange = 100 - thumbWidth;
      const progress = (scrollLeft / maxScroll) * trackRange;
      setScrollPercent(Math.max(0, Math.min(trackRange, progress)));
    } else {
      setThumbWidthPercent(100);
      setScrollPercent(0);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScroll();

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });

    resizeObserver.observe(el);
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  return (
    <div className="relative w-full">
      {/* Top 2px scroll progress track - sleek, ultra-thin, never obstructs any row or action */}
      {showScrollHint && isScrollable && (
        <div className="h-[2px] w-full bg-zinc-800/60 relative overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 h-full bg-emerald-500/80 rounded-full transition-all duration-75"
            style={{
              left: `${scrollPercent}%`,
              width: `${thumbWidthPercent}%`
            }}
          />
        </div>
      )}

      {/* Left overflow soft shadow indicator (non-blocking) */}
      <div
        className={cn(
          'pointer-events-none absolute top-0 bottom-0 left-0 w-4 bg-gradient-to-r from-zinc-950/80 to-transparent z-10 transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Right overflow soft shadow indicator (non-blocking) */}
      <div
        className={cn(
          'pointer-events-none absolute top-0 bottom-0 right-0 w-4 bg-gradient-to-l from-zinc-950/80 to-transparent z-10 transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Scrollable Container with native smooth scrolling */}
      <div
        ref={containerRef}
        className={cn(
          'overflow-x-auto [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
