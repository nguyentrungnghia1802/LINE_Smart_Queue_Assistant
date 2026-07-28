import { BellRing, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';

type RequestState = 'idle' | 'requesting' | 'incomplete' | 'error';

export function LineFriendshipPrompt() {
  const { t } = useTranslation('customer');
  const { friendshipStatus, requestFriendship } = useLiffRuntime();
  const [requestState, setRequestState] = useState<RequestState>('idle');

  if (friendshipStatus !== 'not_friend') return null;

  async function addFriend() {
    setRequestState('requesting');
    try {
      const isFriend = await requestFriendship();
      setRequestState(isFriend ? 'idle' : 'incomplete');
    } catch {
      setRequestState('error');
    }
  }

  return (
    <section
      aria-labelledby="line-friendship-title"
      className="mx-auto mb-4 flex max-w-2xl flex-col gap-4 rounded-lg border border-line-green/30 bg-emerald-50 p-4 text-emerald-950 shadow-sm sm:flex-row sm:items-center"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-line-green text-white">
        <BellRing className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="line-friendship-title" className="text-sm font-bold">
          {t('friendship.title')}
        </h2>
        <p className="mt-1 text-sm leading-5 text-emerald-800">{t('friendship.description')}</p>
        {requestState === 'incomplete' && (
          <p role="status" className="mt-2 text-xs font-semibold text-amber-700">
            {t('friendship.incomplete')}
          </p>
        )}
        {requestState === 'error' && (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
            {t('friendship.error')}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void addFriend()}
        disabled={requestState === 'requesting'}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-line-green px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {requestState === 'requesting' ? t('friendship.checking') : t('friendship.add')}
      </button>
    </section>
  );
}
