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
    Dr: 'bg-emerald-500/10 text-brand border-emerald-500/30',
    Cr: 'bg-amber-500/10 text-warning border-amber-500/30',
    Nil: 'bg-subtle/40 text-soft border-control/50'
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
        <span className="text-xs text-soft font-medium mt-0.5">
          {labelMap[type]} ({formatted})
        </span>
      )}
    </div>
  );
}
