import { Link } from "react-router-dom";
import { useOperatorProfile } from "@/hooks/useOperatorProfile";
import { PILLARS, getLevelInfo } from "@/lib/pillars";
import { ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  studentId: string | null | undefined;
  /** When set, becomes a link (typical: '/student/operator') */
  linkTo?: string;
  className?: string;
  title?: string;
};

export const OperatorProfileMini = ({ studentId, linkTo, className, title = "Operator Profile" }: Props) => {
  const { data, isLoading } = useOperatorProfile(studentId);

  const Inner = (
    <div className={cn("tactical-card p-4", linkTo && "hover:border-primary/40 transition", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-stencil text-sm font-bold uppercase tracking-wider">{title}</h3>
        </div>
        {linkTo && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-stencil text-3xl font-bold text-primary leading-none">
          {data?.taclinkScore ?? 0}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          TacLink Score
        </span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-primary/15 text-primary border border-primary/30">
          {data?.rankLabel ?? "Civilian"}
        </span>
      </div>

      <div className="space-y-1.5">
        {PILLARS.map((p) => {
          const xp = data?.pillarTotals[p.id] ?? 0;
          const info = getLevelInfo(xp);
          return (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-5 text-sm leading-none">{p.emoji}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20 truncate">
                {p.short}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className={cn("h-full transition-all", info.level === 5 ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${info.toNext == null ? 100 : info.pctToNext}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-foreground/80 w-10 text-right">
                {xp}
              </span>
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="text-[10px] text-muted-foreground text-center mt-2">Loading…</div>
      )}
    </div>
  );

  return linkTo ? <Link to={linkTo}>{Inner}</Link> : Inner;
};
