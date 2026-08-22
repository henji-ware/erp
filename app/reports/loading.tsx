import {
  SkeletonHeader,
  SkeletonStats,
  SkeletonBlock,
} from "../components/Skeleton";

/** Cartão de gráfico: título + área do desenho. */
function SkeletonChart({ height = "h-52" }: { height?: string }) {
  return (
    <div className="card p-5">
      <SkeletonBlock className="mb-4 h-4 w-40" />
      <SkeletonBlock className={`w-full ${height}`} />
    </div>
  );
}

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonStats count={4} cols="grid-cols-2 lg:grid-cols-4" />

      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ))}
    </div>
  );
}
