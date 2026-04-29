import { Check, X } from 'lucide-react';
import { PASSWORD_RULES, passwordStrength } from '@/lib/passwordRules';
import { cn } from '@/lib/utils';

interface Props {
  password: string;
  className?: string;
}

export const PasswordRequirements = ({ password, className }: Props) => {
  const { score, label } = passwordStrength(password);
  const pct = (score / PASSWORD_RULES.length) * 100;
  const barColor =
    score <= 1 ? 'bg-destructive'
    : score <= 3 ? 'bg-yellow-500'
    : score <= 4 ? 'bg-primary'
    : 'bg-green-500';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full transition-all', barColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold w-20 text-right">
          {password ? label : ''}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li
              key={r.id}
              className={cn(
                'flex items-center gap-2 text-[11px]',
                ok ? 'text-green-500' : 'text-muted-foreground'
              )}
            >
              {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-60" />}
              <span>{r.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
