"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { logout } from "../login/actions";
import { Icon, type IconName } from "./icons";
import Logo from "./Logo";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/customers", label: "Clientes", icon: "customers" },
  { href: "/leads", label: "Leads / Orçamentos", icon: "leads" },
  { href: "/projects", label: "Projetos / Obras", icon: "projects" },
  { href: "/inspections", label: "Inspeções / Laudos", icon: "inspection" },
  { href: "/products", label: "Equipamentos / Serviços", icon: "products" },
  { href: "/orders", label: "Vendas / Pedidos", icon: "orders" },
  { href: "/appointments", label: "Agendamentos", icon: "calendar" },
  { href: "/suppliers", label: "Fornecedores", icon: "suppliers" },
  { href: "/hr", label: "RH / Equipe", icon: "hr" },
  { href: "/finance", label: "Financeiro", icon: "finance" },
  { href: "/reports", label: "Relatórios", icon: "reports" },
];

export default function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {links.map((link, i) => {
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
      <div className="space-y-1 border-t border-slate-100 px-3 py-3">
        <Link
          href="/settings"
          title={collapsed ? "Configurações" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
            isActive("/settings")
              ? "bg-brand-50 text-brand-700"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Icon name="settings" size={18} className="shrink-0" />
          <span className={`sidebar-label ${collapsed ? "sidebar-label-hidden" : ""}`}>
            Configurações
          </span>
        </Link>

        {userName && !collapsed && (
          <p className="truncate px-3 pt-2 text-xs text-slate-500">
            Olá, <span className="font-medium text-slate-700">{userName}</span>
          </p>
        )}
        <form action={logout}>
          <button
            title={collapsed ? "Sair" : undefined}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-600"
          >
            <Icon name="logout" size={18} className="shrink-0" />
            <span className={`sidebar-label ${collapsed ? "sidebar-label-hidden" : ""}`}>
              Sair
            </span>
          </button>
        </form>
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
        <div className="w-[38px]" /> {/* Spacer to center the logo */}
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
