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
import { Icon } from "../components/icons";
import Appearance from "./Appearance";
import AnimationsToggle from "./AnimationsToggle";
import AISettings from "./AISettings";
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
    <div className="max-w-4xl">
      <PageHeader
        title="Configurações"
        subtitle="Aparência, Inteligência Artificial, preferências e informações do sistema"
      />

      {/* Inteligência Artificial & Modelos */}
      <section className="card mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            ✨
          </span>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">
              Inteligência Artificial & Provedores
            </h2>
            <p className="text-xs text-slate-400">
              Configure múltiplos modelos (Anthropic Claude, Google Gemini, OpenAI, DeepSeek, Groq, Mistral, Ollama)
            </p>
          </div>
        </div>
        <AISettings initialSettings={aiSettings} />
      </section>

      {/* Aparência: modo + tema */}
      <section className="card mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-slate-500">
            <Icon name="appearance" size={18} />
          </span>
          <h2 className="font-semibold text-slate-800">Aparência</h2>
          <span className="ml-auto text-xs text-slate-400">
            Tema atual: {currentName}
          </span>
        </div>
        <Appearance currentTheme={current} currentMode={currentMode} />
      </section>

      {/* Animações */}
      <section className="card mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-slate-500">
            <Icon name="settings" size={18} />
          </span>
          <h2 className="font-semibold text-slate-800">Preferências</h2>
        </div>
        <AnimationsToggle initialOn={animOn} />
      </section>

      {/* Sistema (antigas "dev tools") */}
      <section className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-slate-500">
            <Icon name="reports" size={18} />
          </span>
          <h2 className="font-semibold text-slate-800">Sistema</h2>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
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

        <p className="mt-5 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
          Dica: as ferramentas de desenvolvimento (gerar/recriar dados) ficam no
          terminal via <code className="font-mono">npm run db:reset</code>.
        </p>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  );
}
