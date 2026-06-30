// Catálogo de temas (cor de destaque) e modos (claro/escuro/sistema).
// Dados puros — usados no servidor e no cliente.

export type ThemeDef = {
  id: string;
  name: string;
  desc: string;
  accent: string; // cor de destaque principal
  accentSoft: string; // tom mais claro do destaque (para a miniatura)
  tint: string; // tingimento aplicado aos neutros (fundo/superfícies)
};

export const THEMES: ThemeDef[] = [
  { id: "drr", name: "DRR", desc: "Dourado sobre azul-marinho.", accent: "#f0a500", accentSoft: "#ffc947", tint: "#15365e" },
  { id: "default", name: "Default", desc: "Índigo clássico, neutro.", accent: "#6366f1", accentSoft: "#a5b4fc", tint: "#475569" },
  { id: "claude", name: "Claude", desc: "Argila quente sobre papel.", accent: "#c15f3c", accentSoft: "#e0a08a", tint: "#b08968" },
  { id: "tokyo-night", name: "Tokyo Night", desc: "Azul noturno.", accent: "#6a8df5", accentSoft: "#a9b8f0", tint: "#2a2e54" },
  { id: "nord", name: "Nord", desc: "Azul ártico.", accent: "#5b9bb5", accentSoft: "#9cc7d6", tint: "#3b4a63" },
  { id: "tide", name: "Tide", desc: "Teal sobre ardósia.", accent: "#14b8a6", accentSoft: "#6ee0d2", tint: "#0e3b46" },
  { id: "sage", name: "Sage", desc: "Verde floresta suave.", accent: "#6b8f71", accentSoft: "#a7c0ab", tint: "#4b6650" },
  { id: "catppuccin", name: "Catppuccin", desc: "Mauve pastel.", accent: "#a06cf0", accentSoft: "#cbb0f7", tint: "#3a2f5c" },
  { id: "gruvbox", name: "Gruvbox", desc: "Laranja amadeirado.", accent: "#e8731a", accentSoft: "#f6a85a", tint: "#5a4a32" },
  { id: "rose-pine", name: "Rosé Pine", desc: "Rosa e ameixa.", accent: "#c97f8a", accentSoft: "#e6b3ba", tint: "#4a2f47" },
  { id: "caffeine", name: "Caffeine", desc: "Tons de café.", accent: "#8b5e3c", accentSoft: "#c19a78", tint: "#6f4e37" },
  { id: "mono", name: "Monocromático", desc: "Futurista P&B — inverte com o modo.", accent: "#0f172a", accentSoft: "#cbd5e1", tint: "#71717a" },
  { id: "neon", name: "Neon", desc: "Magenta elétrico, vibe cyber.", accent: "#e836c1", accentSoft: "#f48fde", tint: "#3a1060" },
  { id: "rubi", name: "Rubi", desc: "Vermelho rubi elegante.", accent: "#e11d48", accentSoft: "#fb7185", tint: "#4c0f1f" },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const DEFAULT_THEME = "drr";

export function isValidTheme(id: string | undefined | null): boolean {
  return !!id && THEME_IDS.includes(id);
}

// Modos de aparência
export type ModeDef = { id: string; label: string };
export const MODES: ModeDef[] = [
  { id: "light", label: "Claro" },
  { id: "dark", label: "Escuro" },
  { id: "system", label: "Sistema" },
];
export const MODE_IDS = MODES.map((m) => m.id);
export const DEFAULT_MODE = "dark";

export function isValidMode(id: string | undefined | null): boolean {
  return !!id && MODE_IDS.includes(id);
}

// Cores neutras das miniaturas (por modo) — usadas no seletor de temas.
export const SWATCH_NEUTRAL = {
  light: { panel: "#ffffff", bar: "#cbd5e1" },
  dark: { panel: "#182238", bar: "#5b6b85" },
};

export const THEME_COOKIE = "theme";
export const MODE_COOKIE = "mode";
export const ANIM_COOKIE = "anim";
