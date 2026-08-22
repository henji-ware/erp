import {
  SkeletonHeader,
  SkeletonStats,
  SkeletonTable,
  SkeletonBlock,
} from "./components/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader action={false} />

      {/* Painel “Precisa de atenção” */}
      <div className="mb-6 rounded-xl border border-slate-200 p-4">
        <SkeletonBlock className="mb-3 h-4 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="card flex items-center gap-3 p-3">
              <SkeletonBlock className="h-5 w-5 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-3 w-full" />
                <SkeletonBlock className="mt-1.5 h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <SkeletonStats count={4} />
      <SkeletonStats count={3} cols="lg:grid-cols-3" className="mt-4" />
      <SkeletonStats count={4} className="mt-4" />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonTable rows={5} cols={4} />
        <SkeletonTable rows={5} cols={3} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonTable rows={5} cols={3} />
        <SkeletonTable rows={5} cols={3} />
      </div>
    </div>
  );
}
