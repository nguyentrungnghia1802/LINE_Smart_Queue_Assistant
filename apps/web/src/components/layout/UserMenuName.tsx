interface UserMenuNameProps {
  name: string;
  compact?: boolean;
  className?: string;
}

function textSizeClass(name: string) {
  const length = Array.from(name.trim()).length;

  if (length > 32) return 'text-[10px] leading-3';
  if (length > 20) return 'text-xs leading-4';
  return 'text-sm leading-4';
}

export function UserMenuName({
  name,
  compact = false,
  className = '',
}: Readonly<UserMenuNameProps>) {
  return (
    <span
      title={name}
      className={`line-clamp-2 min-w-0 [overflow-wrap:anywhere] font-semibold text-gray-800 ${
        compact ? 'max-w-24 sm:max-w-36 lg:max-w-44' : 'max-w-32 sm:max-w-44'
      } ${textSizeClass(name)} ${className}`}
    >
      {name}
    </span>
  );
}
