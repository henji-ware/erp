"use client";

import { useState } from "react";

// Usa o arquivo /public/logo.png (igual ao seu PNG). Se o arquivo não existir,
// cai para o desenho SVG de reserva — assim o app nunca fica sem logo.
export default function Logo({ size = 36 }: { size?: number }) {
  const [ok, setOk] = useState(true);

  if (ok) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.png"
        alt="Logo"
        width={size}
        height={size}
        onError={() => setOk(false)}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Logo"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="erpLogoGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="0.45" stopColor="#f97316" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill="#141a28" />
      <g
        fill="none"
        stroke="url(#erpLogoGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 13 v12 a8 8 0 0 0 16 0 v-2" />
        <path d="M32 13 v18 a8 8 0 0 1 -12 6.5" />
      </g>
    </svg>
  );
}
