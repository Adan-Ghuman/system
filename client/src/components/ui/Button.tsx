import { ButtonHTMLAttributes, forwardRef, useRef } from 'react';
import { cn } from '../../lib/cn.js';
import { ThemedSpinner } from './ThemedSpinner.js';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  preventDoubleClick?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      preventDoubleClick,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const lastClickRef = useRef<number>(0);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const isSubmit = props.type === 'submit';
      const shouldThrottle = preventDoubleClick ?? (isSubmit || isLoading);

      if (disabled || isLoading) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (shouldThrottle) {
        const now = Date.now();
        if (now - lastClickRef.current < 750) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        lastClickRef.current = now;
      }

      onClick?.(e);
    };

    const baseStyles = 'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none';

    const variants = {
      primary: 'bg-primary text-white hover:bg-emerald-800 active:bg-emerald-900',
      secondary: 'bg-subtle text-strong hover:bg-muted active:bg-muted',
      outline: 'border border-control bg-transparent text-strong hover:bg-subtle hover:text-strong',
      ghost: 'bg-transparent text-ink hover:bg-subtle hover:text-strong',
      destructive: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900'
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-11 px-6 text-base gap-2.5'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        onClick={handleClick}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <ThemedSpinner
            size={size === 'lg' ? 'md' : size === 'sm' ? 'xs' : 'sm'}
            variant={variant === 'primary' || variant === 'destructive' ? 'white' : 'emerald'}
          />
        )}
        {isLoading ? <span className="sr-only">{children}</span> : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
