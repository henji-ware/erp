import type { AIProviderId } from "@/lib/ai/types";

export default function ProviderLogo({ provider }: { provider: AIProviderId }) {
  const logos: Record<AIProviderId, string | null> = {
    openai: "openai", anthropic: "claude-color", gemini: "gemini-color",
    deepseek: "deepseek-color", groq: "groq", mistral: "mistral-color",
    xai: "grok", cohere: "cohere-color", openrouter: "openrouter",
    ollama: "ollama", custom: null,
  };
  const logo = logos[provider];
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffffff] p-2 shadow-sm ring-1 ring-black/10">
      {logo ? (
        // Local SVG brand assets; no third-party image requests.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/ai-logos/${logo}.svg`} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
      ) : (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#475569" strokeWidth="1.8"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" /></svg>
      )}
    </span>
  );
}
