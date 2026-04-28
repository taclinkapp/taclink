import { useState } from 'react';
import {
  Target, Shield, Crosshair, Building2, Users, Footprints, Moon, Car,
  UserCheck, PersonStanding, Scissors, Plus, Flame, Landmark, Navigation,
  PawPrint, Radio, Mountain, Waves, MoreHorizontal, ChevronDown, ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type Discipline = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export const DISCIPLINES: Discipline[] = [
  { key: 'Pistol', label: 'Pistol Fundamentals', icon: Target },
  { key: 'Defensive Pistol', label: 'Defensive Pistol / CCW', icon: Shield },
  { key: 'Carbine', label: 'Pistol / Carbine', icon: Crosshair },
  { key: 'Sniper', label: 'Sniper / Precision Rifle', icon: Crosshair },
  { key: 'CQB', label: 'CQB / Room Clearing', icon: Building2 },
  { key: 'Small Unit Tactics', label: 'Small Unit Tactics', icon: Users },
  { key: 'Force-on-Force', label: 'Force-on-Force / Scenario', icon: Footprints },
  { key: 'Low-Light', label: 'Low-Light / Night Ops', icon: Moon },
  { key: 'Defensive Driving', label: 'Defensive Driving', icon: Car },
  { key: 'Vehicle Tactics', label: 'Vehicle Tactics', icon: Car },
  { key: 'VIP Protection', label: 'VIP Protection', icon: UserCheck },
  { key: 'Combatives', label: 'Combatives & Defensive Tactics', icon: PersonStanding },
  { key: 'Knife', label: 'Knife Fighting & Defense', icon: Scissors },
  { key: 'Medical', label: 'Emergency Medical / TCCC', icon: Plus },
  { key: 'Survival', label: 'Survival & Preparedness', icon: Flame },
  { key: 'SERE', label: 'Urban Survival / SERE', icon: Landmark },
  { key: 'Land Nav', label: 'Land Navigation', icon: Navigation },
  { key: 'Tracking', label: 'Wilderness & Human Tracking', icon: PawPrint },
  { key: 'Comms', label: 'Communications / HAM Radio', icon: Radio },
  { key: 'Mountaineering', label: 'Mountaineering & Rope Skills', icon: Mountain },
  { key: 'Water Ops', label: 'Water Operations', icon: Waves },
  { key: 'K9', label: 'K9 Handling', icon: PawPrint },
  { key: 'Other', label: 'Other Tactical', icon: MoreHorizontal },
];

type Props = {
  selected: string;
  onSelect: (key: string) => void;
};

export const DisciplineBrowser = ({ selected, onSelect }: Props) => {
  const [open, setOpen] = useState(false);

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
          {selected !== 'All' && (
            <span className="text-primary font-semibold normal-case tracking-normal">
              {DISCIPLINES.find((d) => d.key === selected)?.label ?? selected}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DISCIPLINES.map((d) => {
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
