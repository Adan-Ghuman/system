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

    const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none rounded-md';

    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-xs',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-600',
      outline: 'border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800 hover:text-white',
      ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white',
      destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
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
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
