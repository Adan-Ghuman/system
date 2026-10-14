import { ThemedSpinner } from './ThemedSpinner.js';
import { cn } from '../../lib/cn.js';
export interface ThemedLoadingScreenProps { message?: string; subtitle?: string; fullScreen?: boolean; className?: string; }
export function ThemedLoadingScreen({ fullScreen = false, className }: ThemedLoadingScreenProps) {
  return <div data-startup-loader={fullScreen || undefined} className={cn('flex items-center justify-center bg-canvas', fullScreen ? 'fixed inset-0 z-50' : 'min-h-48 w-full', className)}><ThemedSpinner size="lg" /></div>;
}
