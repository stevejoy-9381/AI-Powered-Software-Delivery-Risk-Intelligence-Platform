/**
 * SkeletonTable Component
 * Loading placeholder for table components with shimmer rows.
 */

interface Props {
  rows?: number;
  cols?: number;
}

export default function SkeletonTable({ rows = 5, cols = 6 }: Props) {
  return (
    <div className="rounded-xl bg-surface-700/50 border border-white/5 overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex gap-4 px-6 py-4 border-b border-white/5">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-white/10 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-6 py-4 border-b border-white/[.03]">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 bg-white/5 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
