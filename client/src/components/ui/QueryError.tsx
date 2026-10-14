import { AlertCircle } from 'lucide-react';
import { Button } from './Button.js';

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-danger-soft p-4 text-sm text-danger">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1"><p className="font-medium">Some records could not be loaded.</p><p className="mt-1 text-xs">Displayed totals may be incomplete. Try loading the records again.</p></div>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}
