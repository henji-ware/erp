import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getAlerts, alertText } from "@/lib/alerts";
import {
  DEFAULT_THEME,
  isValidTheme,
  THEME_COOKIE,
  DEFAULT_MODE,
  isValidMode,
  MODE_COOKIE,
  ANIM_COOKIE,
} from "@/lib/theme";

export const metadata: Metadata = {
  title: "DRR Projetos e Equipamentos — Gestão",
  description:
    "Sistema de gestão da DRR Projetos: projetos/obras, inspeções e laudos, vendas, locação, equipamentos e financeiro.",
  icons: { icon: "/logo.png" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, store] = await Promise.all([getCurrentUser(), cookies()]);
  // Avisos de prazo para o sino (mesma regra do e-mail diário).
  const alerts = user
    ? (await getAlerts(user)).map((a) => ({
        section: a.section,
        href: a.href,
        label: a.label,
        when: alertText(a.days),
        overdue: a.days <= 0,
      }))
    : [];
  const themeCookie = store.get(THEME_COOKIE)?.value;
  const theme = isValidTheme(themeCookie) ? themeCookie : DEFAULT_THEME;
  const modeCookie = store.get(MODE_COOKIE)?.value;
  const mode = isValidMode(modeCookie) ? modeCookie : DEFAULT_MODE;
  const animOff = store.get(ANIM_COOKIE)?.value === "off";

  return (
    <html
      lang="pt-BR"
      data-theme={theme}
      data-mode={mode}
      className={animOff ? "no-anim" : ""}
    >
      <body>
        <div id="app-shell" className="flex h-screen flex-col overflow-hidden md:flex-row">
          <Sidebar userName={user?.name} isAdmin={user?.role === "ADMIN"} alerts={alerts} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
