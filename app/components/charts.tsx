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

/**
 * Sparkline: a mesma série do KPI, em miniatura, dentro do cartão.
 * Sem eixo, sem rótulo — serve só para mostrar o formato da curva
 * (subindo, caindo, estável) ao lado do número.
 */
export function Sparkline({
  id,
  data,
  className = "text-brand-500",
  height = 34,
}: {
  /**
   * Identificador único na página. O gradiente é um elemento com `id`, e
   * `currentColor` dentro dele resolve pela cor do SVG que o DEFINE — com
   * dois sparklines de mesmo id, o segundo pinta com a cor do primeiro.
   */
  id: string;
  data: number[];
  className?: string;
  height?: number;
}) {
  const n = data.length;
  if (n < 2) return null;

  const W = 100;
  const H = 32;
  const pad = 3;
  const max = Math.max(...data);
  const min = Math.min(...data);
  // Série constante viraria uma divisão por zero: nesse caso a linha fica no
  // meio da caixa, que é a leitura correta ("não mudou").
  const span = max - min || 1;

  const xFor = (i: number) => (i * W) / (n - 1);
  const yFor = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);

  const pts = data.map((v, i) => `${xFor(i)},${yFor(v)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const lastX = xFor(n - 1);
  const lastY = yFor(data[n - 1]);

  const gradId = `spark-${id}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Barras pareadas por período — entradas x saídas do caixa, mês a mês.
 * Duas séries lado a lado leem melhor que duas linhas sobrepostas quando o
 * que interessa é a diferença entre elas.
 */
export function GroupedBars({
  data,
  labelA,
  labelB,
  formatValue,
}: {
  data: { label: string; a: number; b: number }[];
  labelA: string;
  labelB: string;
  formatValue: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Sem dados.</p>;
  }
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-slate-500">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          {labelA}
        </span>
        <span className="flex items-center gap-1.5 text-slate-500">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
          {labelB}
        </span>
      </div>

      <div className="flex h-44 items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1.5">
            <div className="flex h-full items-end justify-center gap-1">
              <div
                className="w-1/2 max-w-5 rounded-t bg-emerald-500 transition-all duration-500"
                style={{ height: `${Math.max((d.a / max) * 100, d.a > 0 ? 2 : 0)}%` }}
                title={`${d.label} · ${labelA}: ${formatValue(d.a)}`}
              />
              <div
                className="w-1/2 max-w-5 rounded-t bg-red-500 transition-all duration-500"
                style={{ height: `${Math.max((d.b / max) * 100, d.b > 0 ? 2 : 0)}%` }}
                title={`${d.label} · ${labelB}: ${formatValue(d.b)}`}
              />
            </div>
            <span className="truncate text-center text-[11px] text-slate-400">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
