import { cn } from '../../lib/cn.js';

export interface ThemedSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'emerald' | 'white' | 'zinc';
  className?: string;
}

const SIZES = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-9 h-9',
  xl: 'w-12 h-12'
};

export function ThemedSpinner({
  size = 'md',
  variant = 'emerald',
  className
}: ThemedSpinnerProps) {
  const sizeClass = SIZES[size] || SIZES.md;

  const colorVariants = {
    emerald: {
      outerTrack: 'stroke-emerald-950/60',
      outerSpinner: 'stroke-emerald-500',
      innerSpinner: 'stroke-emerald-400',
      core: 'fill-emerald-400'
    },
    white: {
      outerTrack: 'stroke-white/20',
      outerSpinner: 'stroke-white',
      innerSpinner: 'stroke-zinc-200',
      core: 'fill-white'
    },
    zinc: {
      outerTrack: 'stroke-zinc-800',
      outerSpinner: 'stroke-zinc-400',
      innerSpinner: 'stroke-zinc-300',
      core: 'fill-zinc-400'
    }
  };

  const colors = colorVariants[variant] || colorVariants.emerald;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('relative inline-flex items-center justify-center shrink-0', sizeClass, className)}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Outer static guide ring */}
        <circle
          cx="24"
          cy="24"
          r="20"
          strokeWidth="3.5"
          className={colors.outerTrack}
        />

        {/* Outer primary rotating spool ring */}
        <circle
          cx="24"
          cy="24"
          r="20"
          strokeWidth="3.5"
          strokeDasharray="65 60"
          strokeLinecap="round"
          className={cn('origin-center animate-spin', colors.outerSpinner)}
          style={{ animationDuration: '1.1s' }}
        />

        {/* Inner counter-rotating thread ring */}
        <circle
          cx="24"
          cy="24"
          r="12"
          strokeWidth="2.5"
          strokeDasharray="25 30"
          strokeLinecap="round"
          className={cn('origin-center animate-spin', colors.innerSpinner)}
          style={{ animationDuration: '0.85s', animationDirection: 'reverse' }}
        />

        {/* Center textile spool core */}
        <circle
          cx="24"
          cy="24"
          r="3"
          className={cn('animate-pulse', colors.core)}
        />
      </svg>
    </div>
  );
}
