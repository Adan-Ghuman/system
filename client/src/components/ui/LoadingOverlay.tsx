import { ThemedSpinner } from './ThemedSpinner.js';
import { cn } from '../../lib/cn.js';

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  message = 'Saving changes...',
  className
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex flex-col items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs rounded-lg transition-opacity duration-200 select-none',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-2xl">
        <ThemedSpinner size="lg" variant="emerald" />
        {message && (
          <span className="text-xs font-semibold text-zinc-200 tracking-wide font-mono">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
