import { cn } from '@/lib/utils';
import logo from '@/assets/taclink-logo.png';

/**
 * Official TacLink mark — hexagonal badge + stencil wordmark + tagline.
 * The source artwork is black on white; we invert it for our dark theme.
 *
 * - `showTagline=false` (default): shows the hex badge only (top portion).
 * - `showTagline=true`: shows the full lockup with TACLINK + FIND. BOOK. TRAIN.
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

  // Artwork is already white-on-black — render as-is on dark surfaces.
  if (showTagline) {
    return (
      <img
        src={logo}
        alt="TacLink — Find. Book. Train."
        className={cn('w-auto object-contain', className)}
        style={{ height: dim * 2.4 }}
      />
    );
  }

  return (
    <div
      aria-label="TacLink"
      className={cn('overflow-hidden inline-block', className)}
      style={{ width: dim, height: dim }}
    >
      <img
        src={logo}
        alt=""
        className="block object-contain object-top w-full"
        style={{ height: dim * 1.6 }}
      />
    </div>
  );
};
