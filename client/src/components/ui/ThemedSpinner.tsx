import { cn } from '../../lib/cn.js';
export interface ThemedSpinnerProps { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; variant?: 'emerald' | 'white' | 'zinc'; className?: string; }
const sizes = { xs: 'h-3.5 w-3.5', sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-9 w-9', xl: 'h-12 w-12' };
export function ThemedSpinner({ size = 'md', variant = 'emerald', className }: ThemedSpinnerProps) {
  return <span role="status" aria-label="Loading" className={cn('inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', sizes[size], variant === 'white' ? 'text-white' : variant === 'zinc' ? 'text-soft' : 'text-brand', className)} />;
}
