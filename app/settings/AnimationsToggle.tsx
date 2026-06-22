"use client";

import { useState } from "react";
import { ANIM_COOKIE } from "@/lib/theme";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function AnimationsToggle({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);

  function toggle() {
    const next = !on;
    setOn(next);
    setCookie(ANIM_COOKIE, next ? "on" : "off");
    document.documentElement.classList.toggle("no-anim", !next);
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-slate-800">Animações fluidas</p>
        <p className="text-xs text-slate-500">
          Transições e efeitos de entrada nas telas.
        </p>
      </div>
      <button
        onClick={toggle}
        role="switch"
        aria-checked={on}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
          on ? "bg-brand-600" : "bg-slate-400"
        }`}
      >
        <span
          style={{ backgroundColor: "#ffffff" }}
          className={`inline-block h-5 w-5 transform rounded-full shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
