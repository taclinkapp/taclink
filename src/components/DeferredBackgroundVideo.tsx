import { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  className?: string;
};

/**
 * Background video that does NOT block initial page load.
 * - Renders nothing on first paint (no network request, no decode work)
 * - Waits until the browser is idle + 1.5s before mounting
 * - Skips entirely on slow connections, data-saver, or reduced-motion
 * - Uses preload="none" so it never speculatively downloads the file
 *
 * Massively improves LCP / Lighthouse scores when used in place of an
 * always-mounted <video> tag with a multi-MB asset.
 */
export const DeferredBackgroundVideo = ({ src, className }: Props) => {
  const [show, setShow] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Respect reduced motion
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    // Respect data-saver / slow networks
    const conn = (navigator as any).connection;
    if (conn) {
      if (conn.saveData) return;
      if (typeof conn.effectiveType === 'string' && /(^|-)2g$/.test(conn.effectiveType)) return;
      if (typeof conn.effectiveType === 'string' && conn.effectiveType === '3g') return;
    }

    let cancelled = false;
    const trigger = () => {
      if (cancelled) return;
      // Extra delay so we don't compete with the LCP paint
      window.setTimeout(() => {
        if (!cancelled) setShow(true);
      }, 1500);
    };

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => number)
      | undefined;

    if (ric) {
      ric(trigger, { timeout: 4000 });
    } else {
      window.setTimeout(trigger, 2500);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (show && videoRef.current) {
      // Try to play; ignore errors (autoplay policy, etc.)
      videoRef.current.play?.().catch(() => {});
    }
  }, [show]);

  if (!show) return null;

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="none"
      aria-hidden
      className={className}
    />
  );
};

export default DeferredBackgroundVideo;
