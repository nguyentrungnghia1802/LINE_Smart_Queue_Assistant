import type { ReactNode } from 'react';

import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

export function StandalonePageTopBar({
  children,
  contentClassName = 'max-w-6xl',
}: Readonly<{ children?: ReactNode; contentClassName?: string }>) {
  return (
    <div className="w-full border-b border-white/70 bg-white/85 backdrop-blur">
      <div
        className={`mx-auto flex items-center justify-between gap-3 px-4 py-4 ${contentClassName}`}
      >
        <div className="min-w-0 flex-1">{children}</div>
        <LanguageSwitcher compact />
      </div>
    </div>
  );
}
