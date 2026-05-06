import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Crumb = { label: string; to?: string };

export const Breadcrumbs = ({ items, className }: { items: Crumb[]; className?: string }) => (
  <nav aria-label="Breadcrumb" className={cn('flex items-center flex-wrap gap-1 text-[11px] text-muted-foreground', className)}>
    {items.map((c, i) => {
      const last = i === items.length - 1;
      return (
        <span key={i} className="flex items-center gap-1 min-w-0">
          {c.to && !last ? (
            <Link to={c.to} className="hover:text-foreground hover:underline truncate">{c.label}</Link>
          ) : (
            <span className={cn('truncate', last && 'text-foreground font-semibold')} aria-current={last ? 'page' : undefined}>{c.label}</span>
          )}
          {!last && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
        </span>
      );
    })}
  </nav>
);
