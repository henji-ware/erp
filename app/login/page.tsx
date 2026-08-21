import { login } from "./actions";
import Logo from "../components/Logo";
import { Icon } from "../components/icons";

export const dynamic = "force-dynamic";

const features = [
  "Projetos, obras e orçamentos",
  "Inspeções e laudos técnicos (ART/NR-11)",
  "Vendas, locação, equipamentos e financeiro",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-50">
      {/* Painel de marca */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-600 p-12 text-on-accent lg:flex">
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #dc2626, transparent 70%)" }}
        />

        <div className="relative flex items-center gap-3 animate-fade-in">
          <Logo size={44} />
          <span className="text-lg font-bold">DRR Projetos</span>
        </div>

        <div className="relative animate-fade-in-up">
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Gestão completa do seu armazém logístico.
          </h2>
          <ul className="mt-8 space-y-3">
            {features.map((f, i) => (
              <li
                key={f}
                style={{ animationDelay: `${150 + i * 90}ms` }}
                className="flex items-center gap-3 text-sm leading-relaxed opacity-90 animate-slide-in-left"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: "rgb(var(--accent-fg) / 0.18)" }}
                >
                  <Icon name="check" size={14} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs opacity-70">
          © {new Date().getFullYear()} DRR Projetos e Equipamentos
        </p>
      </div>

      {/* Formulário */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo size={52} />
            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Bem-vindo de volta
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Entre para acessar o painel
            </p>
          </div>

          <form action={login} className="space-y-4">
            {reset && (
              <p className="animate-fade-in rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">
                Senha alterada! Entre com a nova senha.
              </p>
            )}
            {error && (
              <p className="animate-fade-in rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
                {error === "verify"
                  ? "Confirme seu e-mail antes de entrar. Veja o link enviado para sua caixa de entrada."
                  : error === "inactive"
                    ? "Esta conta está inativa. Fale com um administrador."
                    : error === "rate"
                      ? "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."
                    : "E-mail ou senha inválidos."}
              </p>
            )}
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="mail" size={17} />
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoFocus
                  className="input pl-10"
                  placeholder="voce@empresa.com"
                />
              </div>
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="lock" size={17} />
                </span>
                <input
                  name="password"
                  type="password"
                  required
                  className="input pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-2.5 shadow-sm transition-all hover:shadow-md"
            >
              Entrar
            </button>
            <p className="text-center text-sm">
              <a href="/forgot" className="text-brand-600 hover:underline">
                Esqueci minha senha
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
