import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COURSE_CATALOG } from '@/lib/courseCatalog';

type Props = {
  selected: string;
  onSelect: (key: string) => void;
};

export const DisciplineBrowser = ({ selected, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const selectedLabel = COURSE_CATALOG.find((d) => d.key === selected)?.label;

  return (
    <section className="px-4 pb-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 h-12 rounded-md bg-card border border-border text-left hover:border-primary/40 transition"
        aria-expanded={open}
      >
        <span className="font-stencil text-sm font-bold uppercase tracking-wider text-foreground">
          Browse by Discipline
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {selected !== 'All' && selectedLabel && (
            <span className="text-primary font-semibold normal-case tracking-normal">
              {selectedLabel}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {COURSE_CATALOG.map((d) => {
            const Icon = d.icon;
            const active = selected === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  onSelect(d.key);
                  setOpen(false);
                }}
                className={cn(
                  'flex flex-col items-center justify-start gap-1.5 p-3 rounded-md border text-center transition min-h-[88px]',
                  active
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border text-foreground hover:border-primary/40',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span className="text-[11px] font-semibold leading-tight">
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
