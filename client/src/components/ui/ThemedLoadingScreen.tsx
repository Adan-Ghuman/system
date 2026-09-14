import { ThemedSpinner } from './ThemedSpinner.js';
import { cn } from '../../lib/cn.js';

export interface ThemedLoadingScreenProps {
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
  className?: string;
}

export function ThemedLoadingScreen({
  message = 'Loading Rozain Textile...',
  subtitle = 'Please wait while operations data is synchronized',
  fullScreen = true,
  className
}: ThemedLoadingScreenProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-100 select-none',
        fullScreen ? 'fixed inset-0 h-full w-full overflow-hidden z-50' : 'min-h-[360px] w-full',
        className
      )}
    >
      <div className="flex flex-col items-center max-w-sm text-center space-y-5">
        {/* Brand Monogram with Spinner Halo */}
        <div className="relative flex items-center justify-center">
          <ThemedSpinner size="xl" variant="emerald" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-black tracking-widest text-emerald-400 font-mono">
              RT
            </span>
          </div>
        </div>

        {/* Brand Text */}
        <div>
          <div className="text-base font-bold tracking-wider text-white uppercase">
            Rozain Textile
          </div>
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5">
            Operations & Finance System
          </div>
        </div>

        {/* Message and status */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>{message}</span>
          </div>
          {subtitle && (
            <p className="text-[11px] text-zinc-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
