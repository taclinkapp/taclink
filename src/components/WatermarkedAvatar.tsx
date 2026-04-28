import { cn } from '@/lib/utils';

type Props = {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  /** Visual size in pixels — used to scale the watermark text. */
  size?: number;
  /** Render as a circular avatar (default true). */
  rounded?: boolean;
  /** Override the watermark text. */
  watermarkText?: string;
};

/**
 * WatermarkedAvatar overlays a tiled, semi-transparent "TacLink" mark over an
 * instructor's photo to discourage reverse image searches and off-platform
 * contact. The watermark sits in a separate layer above the image with
 * pointer-events disabled so interaction (taps, long-press → save image) on
 * the underlying photo behaves naturally, while still embedding the mark
 * in any screenshot.
 */
export const WatermarkedAvatar = ({
  src,
  alt = '',
  className,
  size = 96,
  rounded = true,
  watermarkText = 'TacLink',
}: Props) => {
  // Scale the repeating text relative to the avatar so it stays legible.
  const fontSize = Math.max(8, Math.round(size / 9));
  const tileW = Math.max(60, Math.round(size * 0.9));
  const tileH = Math.max(28, Math.round(size * 0.45));

  // Inline SVG used as a repeating mask — works on any background and survives
  // CSS transforms / Tailwind utility overrides on the wrapper.
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${tileW}' height='${tileH}' viewBox='0 0 ${tileW} ${tileH}'>
      <g transform='rotate(-28 ${tileW / 2} ${tileH / 2})'>
        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
          font-family='ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
          font-weight='800' font-size='${fontSize}'
          fill='white' fill-opacity='0.55'
          stroke='black' stroke-opacity='0.35' stroke-width='0.6'
          letter-spacing='1.2'>${watermarkText}</text>
      </g>
    </svg>`,
  );

  return (
    <span
      className={cn(
        'relative inline-block overflow-hidden bg-muted',
        rounded ? 'rounded-full' : 'rounded-md',
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={alt || undefined}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          draggable={false}
          loading="lazy"
        />
      ) : (
        <span className="h-full w-full block" />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,${svg}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${tileW}px ${tileH}px`,
          mixBlendMode: 'overlay',
        }}
      />
    </span>
  );
};

export default WatermarkedAvatar;
