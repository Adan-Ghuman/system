import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-zinc-800/60 border border-zinc-800/30',
        className
      )}
      {...props}
    />
  );
}
