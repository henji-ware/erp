"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, IconName } from "./icons";

interface NavItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Ações Rápidas" | "Módulos" | "IA & Assistentes";
  icon: IconName | "ai";
  href?: string;
  action?: () => void;
  keywords?: string;
}

const ITEMS: NavItem[] = [
  {
    id: "copilot",
    title: "Abrir Copilot de IA",
    subtitle: "Assistente conversacional com os dados do ERP",
    category: "IA & Assistentes",
    icon: "ai",
    action: () => window.dispatchEvent(new CustomEvent("open-drr-copilot")),
    keywords: "ia chat copilot assistente gemini claude gpt inteligencia artificial",
  },
  {
    id: "ai-settings",
    title: "Configurações de IA e Modelos",
    subtitle: "Anthropic, Gemini, OpenAI, DeepSeek, Groq, Mistral, Ollama",
    category: "IA & Assistentes",
    icon: "ai",
    href: "/settings",
    keywords: "ia modelos chaves api settings claude gpt deepseek groq configuracoes",
  },

  { id: "new-lead", title: "Novo Orçamento / Lead", subtitle: "Criar novo orçamento no funil", category: "Ações Rápidas", icon: "leads", href: "/leads", keywords: "novo lead criar orcamento proposta venda" },
  { id: "new-customer", title: "Novo Cliente", subtitle: "Cadastrar nova empresa ou cliente", category: "Ações Rápidas", icon: "customers", href: "/customers", keywords: "novo cliente cadastrar empresa pessoa" },
  { id: "new-inspection", title: "Nova Inspeção / Laudo", subtitle: "Agendar vistoria técnica com ART", category: "Ações Rápidas", icon: "inspection", href: "/inspections", keywords: "inspecao laudo art vistoria tecnica norma nr12" },
  { id: "new-order", title: "Novo Pedido / Venda", subtitle: "Lançar pedido com baixa de estoque", category: "Ações Rápidas", icon: "orders", href: "/orders", keywords: "pedido venda faturamento" },

  { id: "mod-dash", title: "Dashboard", category: "Módulos", icon: "dashboard", href: "/", keywords: "inicio home kpi" },
  { id: "mod-crm", title: "Clientes (CRM)", category: "Módulos", icon: "customers", href: "/customers", keywords: "clientes contatos" },
  { id: "mod-leads", title: "Leads / Orçamentos", category: "Módulos", icon: "leads", href: "/leads", keywords: "funil kanban orcamento" },
  { id: "mod-proj", title: "Projetos / Obras", category: "Módulos", icon: "projects", href: "/projects", keywords: "obras engenharia montagem" },
  { id: "mod-insp", title: "Inspeções / Laudos", category: "Módulos", icon: "inspection", href: "/inspections", keywords: "vistorias laudos art" },
  { id: "mod-maint", title: "Manutenção Recorrente", category: "Módulos", icon: "maintenance", href: "/maintenance", keywords: "contratos preventivo" },
  { id: "mod-prod", title: "Equipamentos & Serviços", category: "Módulos", icon: "products", href: "/products", keywords: "estoque catalogo precos" },
  { id: "mod-rent", title: "Locações de Equipamentos", category: "Módulos", icon: "rental", href: "/rentals", keywords: "aluguel pta plataforma" },
  { id: "mod-fin", title: "Financeiro", category: "Módulos", icon: "finance", href: "/finance", keywords: "contas pagar receber fluxo caixa" },
  { id: "mod-rep", title: "Relatórios & Análise", category: "Módulos", icon: "reports", href: "/reports", keywords: "curva abc kpi comissoes" },
  { id: "mod-set", title: "Configurações & Temas", category: "Módulos", icon: "settings", href: "/settings", keywords: "aparencia tema cores" },
];

/** Busca sem acento: "inspecao" precisa achar "Inspeções". */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return ITEMS;
    const terms = q.split(/\s+/);
    return ITEMS.filter((item) => {
      const haystack = fold(
        `${item.title} ${item.subtitle || ""} ${item.keywords || ""} ${item.category}`
      );
      return terms.every((t) => haystack.includes(t));
    });
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Sem isto, navegar com as setas passa do fim da área visível sem rolar.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, filteredItems.length]);

  const askAI = useCallback(() => {
    const prompt = query.trim();
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent("open-drr-copilot", { detail: { prompt } }));
  }, [query]);

  const handleSelect = useCallback(
    (item: NavItem) => {
      setIsOpen(false);
      if (item.action) item.action();
      else if (item.href) router.push(item.href);
    },
    [router]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    const count = filteredItems.length;
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count) setSelectedIndex((prev) => (prev + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count) setSelectedIndex((prev) => (prev - 1 + count) % count);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) handleSelect(filteredItems[selectedIndex]);
      else if (query.trim()) askAI();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Busca rápida"
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Busca */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200">
          <span className="text-slate-400" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar módulo, ação rápida ou perguntar à IA…"
            aria-label="Buscar no ERP"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Resultados */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {query.trim() && (
            <button
              type="button"
              onClick={askAI}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 transition-colors border border-indigo-500/20 mb-2 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20" aria-hidden>
                <Icon name="ai" size={16} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold truncate">
                  Perguntar ao Copilot: &quot;{query}&quot;
                </span>
                <span className="block text-[11px] opacity-80">
                  Usa o modelo ativo e os dados do ERP
                </span>
              </span>
              <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500 text-white font-mono">
                IA
              </span>
            </button>
          )}

          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Nenhum módulo encontrado. Pressione Enter para perguntar à IA.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                    isSelected ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200/60 text-slate-600">
                    <Icon name={item.icon as IconName} size={15} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-slate-900 truncate">
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span className="block text-[11px] text-slate-400 truncate">{item.subtitle}</span>
                    )}
                  </span>
                  <span className="hidden sm:inline shrink-0 text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Navegar <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">↑</kbd>{" "}
              <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">↓</kbd>
            </span>
            <span>
              Abrir <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Enter</kbd>
            </span>
          </div>
          <span className="font-medium">DRR Spotlight</span>
        </div>
      </div>
    </div>
  );
}
