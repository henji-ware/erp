import { SkeletonHeader, SkeletonBlock } from "../components/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader action={false} />

      {/* Abas */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 pb-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-8 w-28 rounded-lg" />
        ))}
      </div>

      <div className="card space-y-5 p-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="mt-2 h-3 w-64 max-w-full" />
            </div>
            <SkeletonBlock className="h-6 w-11 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
