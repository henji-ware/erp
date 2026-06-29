import Link from "next/link";
import Logo from "../components/Logo";
import { Icon } from "../components/icons";
import { requestReset } from "./actions";

export const dynamic = "force-dynamic";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Esqueci minha senha</h1>
          <p className="mt-1 text-sm text-slate-500">
            Informe seu e-mail e enviaremos um código para criar uma nova senha.
          </p>
        </div>

        <div className="card p-6">
          <form action={requestReset} className="space-y-4">
            {error === "notfound" && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
                Este e-mail não está cadastrado em nenhum usuário.
              </p>
            )}
            {error === "noemail" && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                O envio de e-mail ainda não está configurado. Fale com um administrador.
              </p>
            )}
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="mail" size={17} />
                </span>
                <input name="email" type="email" required autoFocus defaultValue={email ?? ""} className="input pl-10" placeholder="voce@empresa.com" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5">Enviar código</button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-600 hover:underline">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
