import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_THEME,
  isValidTheme,
  THEME_COOKIE,
  DEFAULT_MODE,
  isValidMode,
  MODE_COOKIE,
  ANIM_COOKIE,
  THEMES,
} from "@/lib/theme";
import { PageHeader } from "../components/ui";
import Appearance from "./Appearance";
import AnimationsToggle from "./AnimationsToggle";
import AISettings from "./AISettings";
import SettingsTabs from "./SettingsTabs";
import { getServerAISettings } from "@/lib/ai/server-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [store, user, counts, aiSettings] = await Promise.all([
    cookies(),
    getCurrentUser(),
    Promise.all([
      // Contadores do sistema: ignoram itens arquivados (Lixeira).
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.supplier.count({ where: { deletedAt: null } }),
      prisma.transaction.count({ where: { deletedAt: null } }),
      prisma.employee.count(),
      prisma.appointment.count({ where: { deletedAt: null } }),
      prisma.auditLog.count(),
    ]),
    getServerAISettings(),
  ]);

  const themeCookie = store.get(THEME_COOKIE)?.value;
  const current = isValidTheme(themeCookie) ? themeCookie! : DEFAULT_THEME;
  const modeCookie = store.get(MODE_COOKIE)?.value;
  const currentMode = isValidMode(modeCookie) ? modeCookie! : DEFAULT_MODE;
  const animOn = store.get(ANIM_COOKIE)?.value !== "off";
  const currentName =
    THEMES.find((t) => t.id === current)?.name ?? "Default";
  const [customers, products, orders, suppliers, transactions, employees, appointments, auditLogs] = counts;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Configurações"
        subtitle="Inteligência artificial, aparência, preferências e informações do sistema"
      />

      <SettingsTabs
        tabs={[
          {
            id: "ia",
            label: "Inteligência Artificial",
            icon: "ai",
            hint: "Escolha o provedor e o modelo usados pelo DeskHelper AI e pelo assistente de propostas.",
            content: (
              <div className="card p-6">
                <AISettings initialSettings={aiSettings} />
              </div>
            ),
          },
          {
            id: "aparencia",
            label: "Aparência",
            icon: "appearance",
            hint: `Tema atual: ${currentName}.`,
            content: (
              <div className="card p-6">
                <Appearance currentTheme={current} currentMode={currentMode} />
              </div>
            ),
          },
          {
            id: "preferencias",
            label: "Preferências",
            icon: "settings",
            content: (
              <div className="card p-6">
                <AnimationsToggle initialOn={animOn} />
              </div>
            ),
          },
          {
            id: "sistema",
            label: "Sistema",
            icon: "reports",
            content: (
              <div className="card p-6">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                  <Info label="Usuário" value={user?.name ?? "—"} />
                  <Info label="E-mail" value={user?.email ?? "—"} />
                  <Info label="Versão" value="0.6.0" />
                  <Info label="Banco de dados" value="PostgreSQL (Neon)" />
                  <Info label="Clientes" value={String(customers)} />
                  <Info label="Funcionários" value={String(employees)} />
                  <Info label="Fornecedores" value={String(suppliers)} />
                  <Info label="Produtos/Serviços" value={String(products)} />
                  <Info label="Pedidos" value={String(orders)} />
                  <Info label="Agendamentos" value={String(appointments)} />
                  <Info label="Lançamentos" value={String(transactions)} />
                  <Info label="Eventos de auditoria" value={String(auditLogs)} />
                </dl>

                <p className="mt-6 rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-600">
                  As ferramentas de desenvolvimento (gerar/recriar dados) ficam no terminal, via{" "}
                  <code className="font-mono text-slate-800">npm run db:reset</code>.
                </p>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
