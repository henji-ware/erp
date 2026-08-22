"use client";

import { useState } from "react";
import { DENSITIES, DENSITY_COOKIE } from "@/lib/theme";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function DensityToggle({ initial }: { initial: string }) {
  const [density, setDensity] = useState(initial);

  function choose(id: string) {
    setDensity(id);
    setCookie(DENSITY_COOKIE, id);
    document.documentElement.setAttribute("data-density", id);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-medium text-slate-800">Densidade</p>
        <p className="text-xs text-slate-500">
          {DENSITIES.find((d) => d.id === density)?.desc}
        </p>
      </div>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        {DENSITIES.map((d) => {
          const active = density === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => choose(d.id)}
              aria-pressed={active}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
