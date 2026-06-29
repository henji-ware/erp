import Link from "next/link";
import Logo from "../components/Logo";
import { Icon } from "../components/icons";
import { resetPassword } from "../forgot/actions";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Criar nova senha</h1>
          <p className="mt-1 text-sm text-slate-500">
            Digite o código que enviamos para <strong>{email || "seu e-mail"}</strong> e a nova senha.
          </p>
        </div>

        <div className="card p-6">
          <form action={resetPassword} className="space-y-4">
            <input type="hidden" name="email" value={email ?? ""} />
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
                Código inválido ou expirado. Tente novamente.
              </p>
            )}
            <div>
              <label className="label">Código (6 dígitos)</label>
              <input
                name="code"
                required
                inputMode="numeric"
                maxLength={6}
                className="input text-center text-lg tracking-[0.4em]"
                placeholder="000000"
              />
            </div>
            <div>
              <label className="label">Nova senha</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="lock" size={17} />
                </span>
                <input name="password" type="password" required minLength={4} className="input pl-10" placeholder="mín. 4 caracteres" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5">Salvar nova senha</button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm">
          <Link href="/forgot" className="text-brand-600 hover:underline">Reenviar código</Link>
          {" · "}
          <Link href="/login" className="text-brand-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
