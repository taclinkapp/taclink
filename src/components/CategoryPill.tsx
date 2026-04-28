import { cn } from '@/lib/utils';

export const CategoryPill = ({ category, className }: { category: string; className?: string }) => (
  <span
    className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30',
      className,
    )}
  >
    {category}
  </span>
);
