import { ThemedSpinner } from './ThemedSpinner.js';
import { cn } from '../../lib/cn.js';

export interface LoadingStateProps {
  message?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  isTableRow?: boolean;
  colSpan?: number;
  className?: string;
}

export function LoadingState({
  message = 'Loading records...',
  description,
  size = 'md',
  isTableRow = false,
  colSpan = 6,
  className
}: LoadingStateProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 py-12 px-4 text-center select-none',
        className
      )}
    >
      <ThemedSpinner size={size} variant="emerald" />
      <div className="space-y-0.5">
        <div className="text-xs font-semibold text-zinc-300 tracking-wide">
          {message}
        </div>
        {description && (
          <div className="text-[11px] text-zinc-500 font-mono">
            {description}
          </div>
        )}
      </div>
    </div>
  );

  if (isTableRow) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-0 border-none bg-transparent">
          {content}
        </td>
      </tr>
    );
  }

  return content;
}
