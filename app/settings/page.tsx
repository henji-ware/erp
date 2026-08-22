import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  DEFAULT_THEME,
  isValidTheme,
  THEME_COOKIE,
  DEFAULT_MODE,
  isValidMode,
  MODE_COOKIE,
  ANIM_COOKIE,
  DEFAULT_DENSITY,
  isValidDensity,
  DENSITY_COOKIE,
  THEMES,
} from "@/lib/theme";
import { PageHeader, Alert } from "../components/ui";
import Appearance from "./Appearance";
import AnimationsToggle from "./AnimationsToggle";
import DensityToggle from "./DensityToggle";
import AISettings from "./AISettings";
import SettingsTabs from "./SettingsTabs";
import { getServerAISettings } from "@/lib/ai/server-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [store, user, aiSettings] = await Promise.all([
    cookies(),
    getCurrentUser(),
    getServerAISettings(),
  ]);
  const admin = isAdmin(user);

  // Contadores do sistema (ignoram a Lixeira) só são exibidos para
  // administradores — então nem são consultados para os demais.
  const counts = admin
    ? await Promise.all([
        prisma.customer.count({ where: { deletedAt: null } }),
        prisma.product.count({ where: { deletedAt: null } }),
        prisma.order.count({ where: { deletedAt: null } }),
        prisma.supplier.count({ where: { deletedAt: null } }),
        prisma.transaction.count({ where: { deletedAt: null } }),
        prisma.employee.count(),
        prisma.appointment.count({ where: { deletedAt: null } }),
        prisma.auditLog.count(),
      ])
    : [0, 0, 0, 0, 0, 0, 0, 0];

  const themeCookie = store.get(THEME_COOKIE)?.value;
  const current = isValidTheme(themeCookie) ? themeCookie! : DEFAULT_THEME;
  const modeCookie = store.get(MODE_COOKIE)?.value;
  const currentMode = isValidMode(modeCookie) ? modeCookie! : DEFAULT_MODE;
  const animOn = store.get(ANIM_COOKIE)?.value !== "off";
  const densityCookie = store.get(DENSITY_COOKIE)?.value;
  const currentDensity = isValidDensity(densityCookie)
    ? densityCookie!
    : DEFAULT_DENSITY;
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
                <AISettings initialSettings={aiSettings} isAdmin={admin} />
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
              <div className="card space-y-5 divide-y divide-slate-100 p-6 [&>*+*]:pt-5">
                <AnimationsToggle initialOn={animOn} />
                <DensityToggle initial={currentDensity} />
              </div>
            ),
          },
          {
            id: "sistema",
            label: "Sistema",
            icon: "reports",
            content: (
              <div className="card p-6">
                {/* Números do sistema inteiro, infraestrutura e comandos de
                    terminal são assunto de administrador. Para os demais fica
                    só a informação da própria conta. */}
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                  <Info label="Usuário" value={user?.name ?? "—"} />
                  <Info label="E-mail" value={user?.email ?? "—"} />
                  <Info label="Perfil" value={admin ? "Administrador" : "Colaborador"} />
                  <Info label="Versão" value="0.6.0" />
                  {admin && (
                    <>
                      <Info label="Banco de dados" value="PostgreSQL (Neon)" />
                      <Info label="Clientes" value={String(customers)} />
                      <Info label="Funcionários" value={String(employees)} />
                      <Info label="Fornecedores" value={String(suppliers)} />
                      <Info label="Produtos/Serviços" value={String(products)} />
                      <Info label="Pedidos" value={String(orders)} />
                      <Info label="Agendamentos" value={String(appointments)} />
                      <Info label="Lançamentos" value={String(transactions)} />
                      <Info label="Eventos de auditoria" value={String(auditLogs)} />
                    </>
                  )}
                </dl>

                {admin && (
                  <Alert tone="neutral" size="sm" className="mt-6">
                    As ferramentas de desenvolvimento (gerar/recriar dados) ficam no terminal, via{" "}
                    <code className="font-mono text-slate-800">npm run db:reset</code>.
                  </Alert>
                )}
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
