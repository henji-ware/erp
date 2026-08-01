import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        heading: ["var(--font-outfit)", "Outfit", "sans-serif"],
      },
      colors: {
        // Cores diretas controladas por CSS: o modo define a base neutra e o
        // tema a tinge (via color-mix), então "slate"/"white" mudam por tema.
        white: "var(--c-surface)",
        slate: {
          50: "var(--c-slate-50)",
          100: "var(--c-slate-100)",
          200: "var(--c-slate-200)",
          300: "var(--c-slate-300)",
          400: "var(--c-slate-400)",
          500: "var(--c-slate-500)",
          600: "var(--c-slate-600)",
          700: "var(--c-slate-700)",
          800: "var(--c-slate-800)",
          900: "var(--c-slate-900)",
        },
        brand: {
          50: "var(--c-brand-50)",
          100: "var(--c-brand-100)",
          500: "var(--c-brand-500)",
          600: "var(--c-brand-600)",
          700: "var(--c-brand-700)",
        },
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-6px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in .35s ease both",
        "fade-in-up": "fade-in-up .4s cubic-bezier(.16,1,.3,1) both",
        "scale-in": "scale-in .25s cubic-bezier(.16,1,.3,1) both",
        "slide-in-left": "slide-in-left .3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
