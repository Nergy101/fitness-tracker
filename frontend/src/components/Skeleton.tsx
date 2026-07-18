/** Reusable skeleton placeholder with shimmer animation.
 *  Uses theme-aware CSS variables so it works in light and dark modes.
 *  Wrap Skeleton bars inside a container that matches the real content
 *  layout to prevent layout shift when content replaces the skeleton. */
export default function Skeleton({
  width,
  height,
  rounded = "lg",
  className = "",
}: {
  width?: string;
  height?: string;
  rounded?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer shrink-0 rounded-${rounded} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
