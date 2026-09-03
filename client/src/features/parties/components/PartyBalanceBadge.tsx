import { formatBalance } from '../../../lib/formatters.js';
import { cn } from '../../../lib/cn.js';

export interface PartyBalanceBadgeProps {
  balance: number;
  className?: string;
  showSubtext?: boolean;
}

export function PartyBalanceBadge({ balance, className, showSubtext = false }: PartyBalanceBadgeProps) {
  const { text, type, formatted } = formatBalance(balance);

  const styleMap = {
    Dr: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Cr: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    Nil: 'bg-zinc-800/40 text-zinc-400 border-zinc-700/50'
  };

  const labelMap = {
    Dr: 'Receivable',
    Cr: 'Payable',
    Nil: 'Settled'
  };

  return (
    <div className={cn('inline-flex flex-col items-end', className)}>
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border select-none',
          styleMap[type]
        )}
      >
        {text}
      </span>
      {showSubtext && (
        <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
          {labelMap[type]} ({formatted})
        </span>
      )}
    </div>
  );
}
