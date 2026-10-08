import { LucideIcon, ArrowRight } from 'lucide-react';

interface WorkflowAction {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}

export function WorkflowActions({ actions }: { actions: WorkflowAction[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map(({ title, description, icon: Icon, onClick }) => (
        <button
          key={title}
          type="button"
          onClick={onClick}
          className="group flex min-w-0 items-center gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-left transition-colors hover:border-emerald-500/60 hover:bg-emerald-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:p-5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-100">{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{description}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-emerald-400" />
        </button>
      ))}
    </div>
  );
}
