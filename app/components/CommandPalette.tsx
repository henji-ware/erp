"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon, IconName } from "./icons";

interface NavItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Ações Rápidas" | "Módulos" | "IA & Assistentes";
  icon: IconName | "ai" | "bolt";
  href?: string;
  action?: () => void;
  keywords?: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultItems: NavItem[] = [
    // IA & Assistentes
    {
      id: "copilot",
      title: "Abrir Copilot de IA",
      subtitle: "Assistente conversacional com inteligência do ERP",
      category: "IA & Assistentes",
      icon: "ai",
      action: () => {
        window.dispatchEvent(new CustomEvent("open-drr-copilot"));
      },
      keywords: "ia chat copilot assistente gemini claude gpt inteligência",
    },
    {
      id: "ai-settings",
      title: "Configurações de IA e Modelos",
      subtitle: "Anthropic, Gemini, OpenAI, DeepSeek, Groq, Mistral, Ollama",
      category: "IA & Assistentes",
      icon: "ai",
      href: "/settings",
      keywords: "ia modelos chaves api settings claude gpt deepseek groq",
    },

    // Ações Rápidas
    {
      id: "new-lead",
      title: "Novo Orçamento / Lead",
      subtitle: "Criar novo orçamento no funil",
      category: "Ações Rápidas",
      icon: "leads",
      href: "/leads",
      keywords: "novo lead criar orçamento proposta venda",
    },
    {
      id: "new-customer",
      title: "Novo Cliente",
      subtitle: "Cadastrar nova empresa ou cliente",
      category: "Ações Rápidas",
      icon: "customers",
      href: "/customers",
      keywords: "novo cliente cadastrar empresa pessoa",
    },
    {
      id: "new-inspection",
      title: "Nova Inspeção / Laudo",
      subtitle: "Agendar vistoria técnica com ART",
      category: "Ações Rápidas",
      icon: "inspection",
      href: "/inspections",
      keywords: "inspeção laudo art vistoria técnica norma nr12",
    },
    {
      id: "new-order",
      title: "Novo Pedido / Venda",
      subtitle: "Lançar pedido com baixa de estoque",
      category: "Ações Rápidas",
      icon: "orders",
      href: "/orders",
      keywords: "pedido venda faturamento",
    },

    // Módulos
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
    { id: "mod-set", title: "Configurações & Temas", category: "Módulos", icon: "settings", href: "/settings", keywords: "aparência tema cores" },
  ];

  // Escuta atalho Ctrl+K / Cmd+K e evento customizado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
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

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredItems = defaultItems.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const searchString = `${item.title} ${item.subtitle || ""} ${item.keywords || ""} ${item.category}`.toLowerCase();
    return searchString.includes(q);
  });

  const handleSelect = (item: NavItem) => {
    setIsOpen(false);
    setQuery("");
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleAskAIWithQuery = () => {
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent("open-drr-copilot", { detail: { prompt: query } })
    );
    setQuery("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev - 1 < 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      } else if (query.trim()) {
        handleAskAIWithQuery();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <span className="text-slate-400">
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
            placeholder="Buscar por módulo, ação rápida ou pergunte à IA..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {query.trim() && (
            <div
              onClick={handleAskAIWithQuery}
              className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 cursor-pointer transition-colors border border-indigo-500/20 mb-2"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold">
                ✨
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  Perguntar ao Copilot de IA: &quot;{query}&quot;
                </p>
                <p className="text-[11px] opacity-80">
                  Pressione Enter para consultar usando o modelo ativo
                </p>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500 text-white font-mono">
                IA
              </span>
            </div>
          )}

          {filteredItems.length === 0 && !query.trim() ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Digite algo para buscar ações ou navegue pelos atalhos.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                    {item.icon === "ai" ? "✨" : <Icon name={item.icon as IconName} size={15} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>Navegar: <kbd className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">↑</kbd> <kbd className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">↓</kbd></span>
            <span>Executar: <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">↵ Enter</kbd></span>
          </div>
          <span className="text-slate-400 font-medium">DRR Spotlight</span>
        </div>
      </div>
      <div className="fixed inset-0 -z-10" onClick={() => setIsOpen(false)} />
    </div>
  );
}
