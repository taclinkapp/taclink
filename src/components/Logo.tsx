import { cn } from '@/lib/utils';
import iconMark from '@/assets/taclink-icon.png';
import fullLogo from '@/assets/taclink-logo.png';

/**
 * Official TacLink mark.
 *
 * - showTagline=false → compact icon mark (hexagon + scope + amber pin).
 * - showTagline=true  → full brand lockup, white-on-transparent.
 *
 * Sizing for the full lockup:
 *   • Pass `widthPx` to pin width (e.g. 180 for auth screens).
 *   • Pass a Tailwind sizing className (e.g. "h-9 w-auto") to fit headers.
 *   • Default: h-10 w-auto.
 *
 * `onLight` flips colors back to dark ink for use on white backgrounds (emails/PDFs).
 */
export const Logo = ({
  size = 'md',
  showTagline = false,
  widthPx,
  onLight = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  widthPx?: number;
  onLight?: boolean;
  className?: string;
}) => {
  const dim = { sm: 24, md: 36, lg: 56, xl: 96 }[size];

  if (showTagline) {
    return (
      <span className="relative inline-flex items-start">
        <img
          src={fullLogo}
          alt="TacLink™ — Find. Book. Train."
          className={cn(
            'object-contain',
            // Default size when caller hasn't pinned width or passed sizing classes.
            widthPx == null && !className && 'h-10 w-auto',
            onLight && 'invert',
            className,
          )}
          style={widthPx != null ? { width: widthPx } : undefined}
        />
        <span
          aria-hidden
          className={cn(
            'ml-1 mt-0.5 text-[0.85em] font-semibold leading-none tracking-normal',
            onLight ? 'text-foreground/80' : 'text-foreground/90',
          )}
        >
          ™
        </span>
      </span>
    );
  }

  return (
    <img
      src={iconMark}
      alt="TacLink™"
      className={cn('object-contain inline-block', className)}
      style={{ width: dim, height: dim }}
    />
  );
};
