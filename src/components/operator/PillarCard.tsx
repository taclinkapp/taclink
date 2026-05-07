import { PillarId, PILLAR_BY_ID, getLevelInfo } from "@/lib/pillars";
import { cn } from "@/lib/utils";

type Props = {
  pillar: PillarId;
  xp: number;
  compact?: boolean;
  onClick?: () => void;
};

export const PillarCard = ({ pillar, xp, compact, onClick }: Props) => {
  const meta = PILLAR_BY_ID[pillar];
  const info = getLevelInfo(xp);
  const isOperator = info.level === 5;
  const isUntrained = info.level === 0;

  const Body = (
    <div
      className={cn(
        "tactical-card transition relative overflow-hidden",
        compact ? "p-3" : "p-4",
        isOperator && "border-amber-500/60 bg-gradient-to-br from-amber-500/10 to-amber-500/0",
        isUntrained && "opacity-70",
        onClick && "cursor-pointer hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none">{meta.emoji}</span>
          <div className="min-w-0">
            <div className="font-stencil text-sm font-bold uppercase tracking-wider truncate">
              {meta.name}
            </div>
            {!compact && (
              <div className="text-[10px] text-muted-foreground truncate">{meta.blurb}</div>
            )}
          </div>
        </div>
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border whitespace-nowrap",
            isOperator
              ? "bg-amber-500/20 text-amber-500 border-amber-500/40"
              : isUntrained
                ? "bg-muted text-muted-foreground border-border"
                : "bg-primary/15 text-primary border-primary/30",
          )}
        >
          L{info.level} · {info.label}
        </span>
      </div>

      <div className="h-2 rounded-full bg-surface overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            isOperator ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${info.toNext == null ? 100 : info.pctToNext}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
        <span>
          {info.toNext == null
            ? `${info.totalXp} XP · MAXED`
            : `${info.current} / ${info.needed} XP`}
        </span>
        <span className="font-bold text-foreground/80">{info.totalXp} XP</span>
      </div>
    </div>
  );

  return onClick ? <button onClick={onClick} className="w-full text-left">{Body}</button> : Body;
};
