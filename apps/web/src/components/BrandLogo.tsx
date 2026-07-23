export function BrandLogo({
  className = 'h-9 w-9',
  decorative = false,
}: Readonly<{ className?: string; decorative?: boolean }>) {
  return (
    <img
      src="/logo.svg"
      alt={decorative ? '' : 'LINE Smart Queue Assistant'}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={`shrink-0 select-none ${className}`}
    />
  );
}
