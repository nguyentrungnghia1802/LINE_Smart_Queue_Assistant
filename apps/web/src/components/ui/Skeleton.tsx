interface SkeletonProps {
  className?: string;
}

/** Single animated placeholder block. Compose to build page skeletons. */
export function Skeleton({ className = '' }: Readonly<SkeletonProps>) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

// ── Composite skeletons ────────────────────────────────────────────────────

/** Full-card skeleton matching the TicketCard layout. */
export function TicketCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-(--radius-card) border border-gray-200 p-5 space-y-4 animate-pulse"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/** Skeleton for the big ticket-number hero card on TicketStatusPage. */
export function TicketHeroSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-(--radius-card) border border-gray-200 p-8 flex flex-col items-center gap-3 animate-pulse"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-20 w-32" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

/** Skeleton for the QueueJoinPage info card. */
export function QueueInfoSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-(--radius-card) border border-gray-200 p-6 space-y-4 animate-pulse"
    >
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-8 w-12 mx-auto" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-16 mx-auto" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for the Home page profile section. */
export function ProfileSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 animate-pulse">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
