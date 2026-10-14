import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';
export interface BadgeProps extends HTMLAttributes<HTMLDivElement> { variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'; }
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-brand-soft text-brand border-brand/15',
    secondary: 'bg-muted text-ink border-line',
    success: 'bg-brand-soft text-brand border-brand/15',
    warning: 'bg-warning-soft text-warning border-warning/15',
    destructive: 'bg-danger-soft text-danger border-danger/15',
    outline: 'bg-transparent text-soft border-line'
  };
  return <div className={cn('inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium leading-none', variants[variant], className)} {...props} />;
}
