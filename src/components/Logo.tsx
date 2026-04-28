import { cn } from '@/lib/utils';
import logo from '@/assets/taclink-logo.png';

/**
 * The official TacLink mark — hexagonal badge with compass + crosshair,
 * pistol and knife. The mark already includes "TACLINK / FIND. BOOK. TRAIN."
 * lockup, so when `showTagline` is false we crop to just the hex badge by
 * showing only the upper portion of the artwork via aspect ratio.
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
  const heightClass = {
    sm: 'h-6',
    md: 'h-9',
    lg: 'h-14',
    xl: 'h-24',
  }[size];

  // The full artwork is roughly square. If we don't want the wordmark + tagline
  // we clip to the top ~62% which contains just the hex badge.
  if (!showTagline) {
    return (
      <div
        className={cn(heightClass, 'aspect-square overflow-hidden', className)}
        aria-label="TacLink"
      >
        <img
          src={logo}
          alt="TacLink"
          className="h-[160%] w-auto object-contain object-top -mt-[2%] invert brightness-0 contrast-100"
          style={{ filter: 'invert(72%) sepia(83%) saturate(1352%) hue-rotate(360deg) brightness(101%) contrast(95%)' }}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <img
        src={logo}
        alt="TacLink — Find. Book. Train."
        className={cn(heightClass, 'w-auto object-contain')}
        style={{ filter: 'invert(1)' }}
      />
    </div>
  );
};
