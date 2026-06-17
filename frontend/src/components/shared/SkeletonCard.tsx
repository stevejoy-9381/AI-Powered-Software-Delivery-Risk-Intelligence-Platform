/**
 * SkeletonCard Component
 * Loading placeholder for card elements with shimmer animation.
 */

interface Props {
  count?: number;
  className?: string;
}

export default function SkeletonCard({ count = 1, className = '' }: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-xl bg-surface-700/50 border border-white/5 p-6 animate-pulse ${className}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="h-3 w-20 bg-white/10 rounded" />
            <div className="h-8 w-8 bg-white/10 rounded-lg" />
          </div>
          <div className="h-8 w-24 bg-white/10 rounded mb-2" />
          <div className="h-3 w-16 bg-white/5 rounded" />
        </div>
      ))}
    </>
  );
}
