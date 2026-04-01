export default function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] bg-surface-2 rounded-lg" />
      <div className="mt-2 h-3 bg-surface-2 rounded w-3/4" />
      <div className="mt-1 h-2 bg-surface-2 rounded w-1/2" />
    </div>
  )
}
