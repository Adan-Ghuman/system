import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-emerald-600/15 text-emerald-400 border border-emerald-500/30',
    secondary: 'border-transparent bg-zinc-800 text-zinc-300 border border-zinc-700',
    success: 'border-transparent bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    warning: 'border-transparent bg-amber-500/15 text-amber-400 border border-amber-500/30',
    destructive: 'border-transparent bg-red-500/15 text-red-400 border border-red-500/30',
    outline: 'text-zinc-300 border border-zinc-700'
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors select-none',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
