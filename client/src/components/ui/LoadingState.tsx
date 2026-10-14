import { ThemedSpinner } from './ThemedSpinner.js';
import { cn } from '../../lib/cn.js';
export interface LoadingStateProps { message?: string; description?: string; size?: 'sm' | 'md' | 'lg'; isTableRow?: boolean; colSpan?: number; className?: string; }
export function LoadingState({ size = 'md', isTableRow = false, colSpan = 6, className }: LoadingStateProps) {
  const content = <div className={cn('flex items-center justify-center px-4 py-10', className)}><ThemedSpinner size={size} /></div>;
  return isTableRow ? <tr><td colSpan={colSpan} className="border-none bg-transparent p-0">{content}</td></tr> : content;
}
