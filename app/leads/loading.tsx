import {
  SkeletonHeader,
  SkeletonForm,
  SkeletonBlock,
} from "../components/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonForm fields={8} />

      {/* Colunas do funil */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, col) => (
          <div key={col} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 - (col % 2) }, (_, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="mt-2 h-3 w-1/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
