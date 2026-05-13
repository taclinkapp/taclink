import { CSSProperties, HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * SafeAreaTop
 * -----------
 * Reusable helper that applies the iPhone (and any other notched device)
 * safe-area inset to the top of an element via `padding-top`.
 *
 * - `extra`     — additional padding (in px or any CSS length) added on top of
 *                 the OS-reported safe-area inset. Useful for fine-tuning a
 *                 sticky header so the title doesn't kiss the status bar.
 * - `as`        — element tag to render (defaults to <div>). Use "header" when
 *                 wrapping a sticky header.
 *
 * Example:
 *   <SafeAreaTop as="header" className="sticky top-0 z-30 bg-background/95
 *                 backdrop-blur border-b border-border" extra={2}>
 *     ...header content...
 *   </SafeAreaTop>
 */
type Props = HTMLAttributes<HTMLElement> & {
  as?: keyof JSX.IntrinsicElements;
  extra?: number | string;
};

export const SafeAreaTop = forwardRef<HTMLElement, Props>(function SafeAreaTop(
  { as = "div", extra = 0, className, style, children, ...rest },
  ref,
) {
  const Tag = as as any;
  const extraValue = typeof extra === "number" ? `${extra}px` : extra;
  const merged: CSSProperties = {
    paddingTop: `calc(env(safe-area-inset-top) + ${extraValue})`,
    ...style,
  };
  return (
    <Tag ref={ref as any} className={cn(className)} style={merged} {...rest}>
      {children}
    </Tag>
  );
});

/**
 * Inline class helper for cases where wrapping in a component isn't ideal
 * (e.g., the existing sticky header element already has many props).
 *
 *   <header className="sticky top-0 ..." style={safeAreaTopStyle(2)}>
 */
export const safeAreaTopStyle = (extra: number | string = 0): CSSProperties => ({
  paddingTop: `calc(env(safe-area-inset-top) + ${typeof extra === "number" ? `${extra}px` : extra})`,
});
