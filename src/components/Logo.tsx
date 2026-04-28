import { cn } from '@/lib/utils';

/**
 * Official TacLink mark — drawn in SVG so it sits cleanly on any background
 * with no opaque box around it. Pure currentColor strokes/fills.
 *
 * - `showTagline=false` (default): hex badge only.
 * - `showTagline=true`: full lockup with TACLINK + FIND. BOOK. TRAIN.
 */
export const Logo = ({
  size = 'md',
  showTagline = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
}) => {
  const dim = { sm: 24, md: 36, lg: 56, xl: 96 }[size];

  if (showTagline) {
    return (
      <div
        aria-label="TacLink — Find. Book. Train."
        className={cn('flex flex-col items-center text-foreground', className)}
        style={{ gap: dim * 0.18 }}
      >
        <Badge size={dim * 1.6} />
        <div
          className="font-black tracking-[0.18em] leading-none"
          style={{ fontSize: dim * 0.7, fontFamily: 'Impact, "Oswald", "Bebas Neue", sans-serif' }}
        >
          TACLINK
        </div>
        <div
          className="text-muted-foreground font-bold tracking-[0.35em] uppercase"
          style={{ fontSize: dim * 0.18 }}
        >
          Find. Book. Train.
        </div>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex text-foreground', className)} aria-label="TacLink">
      <Badge size={dim} />
    </div>
  );
};

const Badge = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Hexagon outline removed for a cleaner mark */}
    {/* North arrow */}
    <path d="M50 6 L46 16 L54 16 Z" fill="currentColor" stroke="none" />
    {/* Compass circle */}
    <circle cx="50" cy="38" r="14" strokeWidth={2.2} />
    {/* Compass star */}
    <path
      d="M50 24 L52.5 36 L62 38 L52.5 40 L50 52 L47.5 40 L38 38 L47.5 36 Z"
      fill="currentColor"
      stroke="none"
    />
    {/* Cardinal letters */}
    <text x="50" y="28" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Impact, sans-serif">N</text>
    <text x="50" y="52" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Impact, sans-serif">S</text>
    <text x="36" y="40" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Impact, sans-serif">W</text>
    <text x="64" y="40" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Impact, sans-serif">E</text>
    {/* Crosshair horizontal */}
    <line x1="18" y1="62" x2="82" y2="62" strokeWidth={1.6} />
    {/* Tick marks */}
    {[26, 34, 42, 58, 66, 74].map((x) => (
      <line key={x} x1={x} y1="60" x2={x} y2="64" strokeWidth={1.4} />
    ))}
    {/* Crosshair vertical */}
    <line x1="50" y1="56" x2="50" y2="86" strokeWidth={1.4} />
    {/* Pistol silhouette (left) */}
    <path
      d="M22 74 L34 74 L36 72 L42 72 L42 76 L40 76 L38 80 L30 80 L28 78 L24 78 Z"
      fill="currentColor"
      stroke="none"
    />
    {/* Knife silhouette (right) */}
    <path
      d="M58 78 L70 70 L74 72 L66 80 L62 82 L58 80 Z M58 80 L56 84 L60 84 Z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);
