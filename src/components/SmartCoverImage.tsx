import { useEffect, useRef, useState } from 'react';

/**
 * SmartCoverImage
 * ---------------
 * Renders a cover photo so the **entire image is always visible** inside its
 * container (no cropping), regardless of aspect ratio mismatch.
 *
 * How it works:
 *  1. Loads the image off-DOM to measure its natural aspect ratio.
 *  2. Compares it with the container's aspect ratio.
 *  3. If they roughly match → uses `object-cover` (fills nicely).
 *     Otherwise → uses `object-contain` and paints a blurred copy of the
 *     same image behind it as a letterbox/pillarbox fill.
 *
 * The container must define its own dimensions (the component fills it
 * absolutely). Pass through `className` for the wrapper sizing.
 */
type Props = {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  /** Tolerance for aspect ratio mismatch before letterboxing kicks in. */
  tolerance?: number;
  /** Optional overlay (e.g. gradient) rendered above the image. */
  overlay?: React.ReactNode;
};

export const SmartCoverImage = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  tolerance = 0.12,
  overlay,
}: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const [boxRatio, setBoxRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!src) return;
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) {
        setImgRatio(probe.naturalWidth / probe.naturalHeight);
      }
    };
    probe.src = src;
  }, [src]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setBoxRatio(r.width / r.height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fits =
    imgRatio !== null &&
    boxRatio !== null &&
    Math.abs(imgRatio - boxRatio) / boxRatio <= tolerance;

  return (
    <div ref={wrapRef} className={`relative overflow-hidden bg-surface ${className}`}>
      {src && !fits && (
        // Blurred background so the whole photo can be shown without
        // ugly empty bars when ratios don't match.
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60"
        />
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          className={`absolute inset-0 h-full w-full ${fits ? 'object-cover' : 'object-contain'}`}
        />
      )}
      {overlay}
    </div>
  );
};

export default SmartCoverImage;
