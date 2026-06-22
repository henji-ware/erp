// Gráficos leves — sem dependências externas.

// Gráfico de área ("montanha") em SVG para séries temporais.
export function AreaChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  const W = 600;
  const H = 220;
  const padX = 14;
  const padTop = 26;
  const padBottom = 26;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));

  const innerW = W - padX * 2;
  const baseY = H - padBottom;
  const xFor = (i: number) => (n > 1 ? padX + (i * innerW) / (n - 1) : W / 2);
  const yFor = (v: number) => padTop + (1 - v / max) * (baseY - padTop);

  const pts = data.map((d, i) => ({ x: xFor(i), y: yFor(d.value), ...d }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = n > 1 ? `${line} L ${xFor(n - 1)} ${baseY} L ${xFor(0)} ${baseY} Z` : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full text-brand-500"
      style={{ height: "210px" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* linha de base */}
      <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} className="stroke-slate-200" strokeWidth="1" />

      {area && <path d={area} fill="url(#areaGrad)" />}
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {pts.map((p, i) => (
        <g key={i}>
          {p.value > 0 && <circle cx={p.x} cy={p.y} r="3.5" fill="currentColor" />}
          {p.value > 0 && (
            <text
              x={p.x}
              y={p.y - 9}
              fontSize="11"
              fontWeight="600"
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              className="fill-slate-600"
            >
              {formatValue(p.value)}
            </text>
          )}
          <text
            x={p.x}
            y={H - 8}
            fontSize="11"
            textAnchor="middle"
            className="fill-slate-400"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function HBarList({
  data,
  formatValue,
}: {
  data: { label: string; value: number; sub?: string }[];
  formatValue: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Sem dados.</p>;
  }
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm text-slate-600">
                {d.label}
                {d.sub && <span className="ml-1 text-xs text-slate-400">· {d.sub}</span>}
              </span>
              <span className="shrink-0 text-sm font-medium text-slate-800">
                {formatValue(d.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
