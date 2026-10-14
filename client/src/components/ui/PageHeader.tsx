import { ReactNode } from 'react';

export function PageHeader({ title, description, children }: { title: string; description: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-1">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-strong sm:text-[28px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-soft">{description}</p>
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2 pt-1">{children}</div>}
    </header>
  );
}
