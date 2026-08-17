"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { logout } from "../login/actions";
import { Icon, type IconName } from "./icons";
import Logo from "./Logo";
import NotificationBell, { type BellItem } from "./NotificationBell";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/customers", label: "Clientes", icon: "customers" },
  { href: "/leads", label: "Leads / Orçamentos", icon: "leads" },
  { href: "/projects", label: "Projetos / Obras", icon: "projects" },
  { href: "/inspections", label: "Inspeções / Laudos", icon: "inspection" },
  { href: "/maintenance", label: "Manutenção", icon: "maintenance" },
  { href: "/products", label: "Equipamentos / Serviços", icon: "products" },
  { href: "/orders", label: "Vendas / Pedidos", icon: "orders" },
  { href: "/rentals", label: "Locações", icon: "rental" },
  { href: "/appointments", label: "Agendamentos", icon: "calendar" },
  { href: "/suppliers", label: "Fornecedores", icon: "suppliers" },
  { href: "/hr", label: "RH / Equipe", icon: "hr" },
  { href: "/finance", label: "Financeiro", icon: "finance" },
  { href: "/trash", label: "Lixeira", icon: "trash" },
];

// Itens visíveis só para administradores (gestão e análise).
const adminLinks: { href: string; label: string; icon: IconName }[] = [
  { href: "/reports", label: "Relatórios", icon: "reports" },
  { href: "/users", label: "Usuários", icon: "customers" },
  { href: "/audit", label: "Auditoria", icon: "lock" },
];

export default function Sidebar({
  userName,
  isAdmin = false,
  alerts = [],
}: {
  userName?: string;
  isAdmin?: boolean;
  alerts?: BellItem[];
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Iniciais do usuário para o avatar (ex.: "Gustavo DRR" → "GD").
  const initials =
    (userName ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const navLinks = isAdmin ? [...links, ...adminLinks] : links;

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [mobileOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size={38} />
        <div className={`sidebar-label ${collapsed ? "sidebar-label-hidden" : ""}`}>
          <p className="text-sm font-bold leading-tight text-slate-800">
            DRR&nbsp;Projetos
          </p>
          <p className="text-[11px] text-slate-400">Projetos e Equipamentos</p>
        </div>
      </div>

      {/* Quick Search & AI Trigger */}
      <div className="px-3 pb-2 space-y-1.5">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition-colors border border-slate-200/80 dark:border-slate-700/60"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className={`sidebar-label ${collapsed ? "sidebar-label-hidden" : ""}`}>Buscar...</span>
          </span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 shadow-2xs">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-drr-copilot"))}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-brand-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
        >
          <span className="text-sm">✨</span>
          <span className={`sidebar-label ${collapsed ? "sidebar-label-hidden" : ""}`}>Copilot IA</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navLinks.map((link, i) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`animate-slide-in-left flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:translate-x-0.5 ${
                active
                  ? "bg-brand-50 text-brand-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon name={link.icon} size={18} className="shrink-0" />
              <span className={`sidebar-label ${collapsed ? "sidebar-label-hidden" : ""}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-2 border-t border-slate-200 bg-slate-50 px-3 py-3">
        <Link
          href="/settings"
          title={collapsed ? "Configurações" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
            isActive("/settings")
              ? "bg-brand-50 text-brand-700 shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Icon name="settings" size={18} className="shrink-0" />
          <span className={`sidebar-label ${collapsed ? "sidebar-label-hidden" : ""}`}>
            Configurações
          </span>
        </Link>

        {collapsed ? (
          // Recolhido: só o ícone de sair (avatar não cabe).
          <form action={logout}>
            <button
              title="Sair"
              className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-600"
            >
              <Icon name="logout" size={18} className="shrink-0" />
            </button>
          </form>
        ) : (
          // Expandido: card do usuário com avatar + botão de sair.
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-2">
            <span className="bg-accent text-on-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {initials}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-700">
                {userName ?? "Usuário"}
              </p>
              <p className="truncate text-[11px] text-slate-400">Conectado</p>
            </div>
            <NotificationBell items={alerts} />
            <form action={logout}>
              <button
                title="Sair"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
              >
                <Icon name="logout" size={16} className="shrink-0" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ─── Mobile top bar ─── */}
      <div className="sidebar-mobile-header md:hidden">
        <button
          onClick={toggleMobile}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-label="Abrir menu"
        >
          <Icon name="menu" size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-sm font-bold text-slate-800">DRR&nbsp;Projetos</span>
        </div>
        <NotificationBell items={alerts} />
      </div>

      {/* ─── Mobile overlay ─── */}
      {mobileOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── Sidebar (desktop: always visible; mobile: drawer) ─── */}
      <aside
        className={`sidebar-aside ${
          collapsed ? "sidebar-collapsed" : "sidebar-expanded"
        } ${mobileOpen ? "sidebar-mobile-open" : ""}`}
      >
        {/* Desktop collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="sidebar-collapse-btn hidden md:flex"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={14} strokeWidth={2.2} />
        </button>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden"
          aria-label="Fechar menu"
        >
          <Icon name="close" size={18} />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
