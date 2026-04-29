import { cn } from '@/lib/utils';
import iconMark from '@/assets/taclink-icon.png';
import fullLogo from '@/assets/taclink-logo.png';

/**
 * Official TacLink mark.
 *
 * Two artworks:
 * - Icon (hexagon + scope reticle + amber location pin on dark background) —
 *   used for the favicon, app icon, mobile header, and any compact mark.
 * - Full lockup (dark hexagon w/ compass rose + TACLINK stencil + FIND. BOOK. TRAIN.)
 *   on a white background — used for splash, auth screens, sidebar, emails, hero.
 *
 * Props:
 *  - showTagline=false → render the dark icon mark.
 *  - showTagline=true  → render the full brand lockup. On dark surfaces the
 *    full lockup is auto-inverted so the wordmark reads white-on-dark.
 *  - onLight=true      → opt out of inversion (use on white/PDF/email).
 */
export const Logo = ({
  size = 'md',
  showTagline = false,
  onLight = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  onLight?: boolean;
  className?: string;
}) => {
  const dim = { sm: 24, md: 36, lg: 56, xl: 96 }[size];

  if (showTagline) {
    return (
      <img
        src={fullLogo}
        alt="TacLink — Find. Book. Train."
        className={cn(
          'w-auto object-contain',
          // Invert the dark-on-white artwork to read on dark UI surfaces.
          !onLight && 'invert',
          className,
        )}
        style={{ height: dim * 2.4 }}
      />
    );
  }

  return (
    <img
      src={iconMark}
      alt="TacLink"
      className={cn('object-contain inline-block', className)}
      style={{ width: dim, height: dim }}
    />
  );
};
