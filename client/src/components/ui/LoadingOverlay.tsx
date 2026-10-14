import { ThemedSpinner } from './ThemedSpinner.js';
import { cn } from '../../lib/cn.js';
export interface LoadingOverlayProps { isLoading: boolean; message?: string; className?: string; }
export function LoadingOverlay({ isLoading, className }: LoadingOverlayProps) {
  return isLoading ? <div className={cn('flex items-center justify-end py-1', className)}><ThemedSpinner size="sm" /></div> : null;
}
