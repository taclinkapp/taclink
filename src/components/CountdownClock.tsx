import { useEffect, useState } from 'react';

/**
 * Pre-launch countdown clock. Target launch date is configurable via
 * VITE_LAUNCH_DATE (ISO string). Defaults to 60 days from first render
 * if not set, so the UI always has something to show in dev.
 */
const LAUNCH_ISO =
  (import.meta.env.VITE_LAUNCH_DATE as string | undefined) ||
  // Fixed default so the countdown is stable across refreshes
  '2026-07-04T12:00:00Z';

type Parts = { days: number; hours: number; minutes: number; seconds: number };

const diff = (target: Date): Parts => {
  const ms = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds };
};

const Cell = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="neu-inset px-3 py-2 min-w-[3.25rem] text-center">
      <span className="font-stencil text-2xl font-bold text-primary tabular-nums">
        {value.toString().padStart(2, '0')}
      </span>
    </div>
    <span className="mt-1.5 text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">
      {label}
    </span>
  </div>
);

export const CountdownClock = () => {
  const target = new Date(LAUNCH_ISO);
  const [parts, setParts] = useState<Parts>(() => diff(target));

  useEffect(() => {
    const id = setInterval(() => setParts(diff(target)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const launched = parts.days + parts.hours + parts.minutes + parts.seconds === 0;

  return (
    <div className="w-full max-w-sm mx-auto">
      <p className="text-center text-[0.625rem] font-bold uppercase tracking-[0.25em] text-primary mb-3">
        Launching In
      </p>
      {launched ? (
        <p className="text-center font-stencil text-xl text-primary">WE'RE LIVE</p>
      ) : (
        <div className="flex items-start justify-center gap-2">
          <Cell value={parts.days} label="Days" />
          <Cell value={parts.hours} label="Hrs" />
          <Cell value={parts.minutes} label="Min" />
          <Cell value={parts.seconds} label="Sec" />
        </div>
      )}
    </div>
  );
};
