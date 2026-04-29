import { cn } from '@/lib/utils';
import iconMark from '@/assets/taclink-icon.png';
import fullLogo from '@/assets/taclink-logo.jpg';

/**
 * Official TacLink mark.
 *
 * Two artworks:
 *  - Icon: hexagon + scope reticle + amber location pin on dark background.
 *    Used for favicon, app icon, mobile header, any compact mark.
 *  - Full lockup: dark hexagon w/ compass rose + TACLINK stencil +
 *    FIND. BOOK. TRAIN. tagline on a white background. Used for splash,
 *    auth screens, sidebar, emails, and hero areas.
 *
 * Props:
 *  - showTagline=false → render the dark icon mark.
 *  - showTagline=true  → render the full brand lockup.
 *  - widthPx           → override the rendered width of the full lockup.
 *  - onLight=true      → opt out of inversion (use on white/PDF/email).
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
    const w = widthPx ?? dim * 2.4;
    return (
      <img
        src={fullLogo}
        alt="TacLink — Find. Book. Train."
        className={cn(
          'h-auto object-contain',
          // Invert dark-on-white artwork so it reads on dark UI surfaces.
          !onLight && 'invert',
          className,
        )}
        style={{ width: w }}
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
