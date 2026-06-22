"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size={38} />
        <div>
          <p className="text-sm font-bold leading-tight text-slate-800">
            DRR&nbsp;Projetos
          </p>
          <p className="text-[11px] text-slate-400">Projetos e Equipamentos</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {links.map((link, i) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`animate-slide-in-left flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:translate-x-0.5 ${
                active
                  ? "bg-brand-50 text-brand-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon name={link.icon} size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-slate-100 px-3 py-3">
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
            isActive("/settings")
              ? "bg-brand-50 text-brand-700"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Icon name="settings" size={18} />
          Configurações
        </Link>

        {userName && (
          <p className="truncate px-3 pt-2 text-xs text-slate-500">
            Olá, <span className="font-medium text-slate-700">{userName}</span>
          </p>
        )}
        <form action={logout}>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-600">
            <Icon name="logout" size={18} />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
