import Link from "next/link";
import Logo from "../components/Logo";
import { Icon } from "../components/icons";
import { requestReset } from "./actions";
import { Alert } from "../components/ui";

export const dynamic = "force-dynamic";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string }>;
}) {
  const { sent, email } = await searchParams;

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
            {sent && (
              <Alert tone="success" size="sm">
                Se o e-mail estiver cadastrado e ativo, enviaremos um código. Verifique também a pasta de spam.
              </Alert>
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
            {sent && email && (
              <Link href={`/reset?email=${encodeURIComponent(email)}`} className="block text-center text-sm text-brand-600 hover:underline">
                Já tenho o código
              </Link>
            )}
          </form>
        </div>

        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-600 hover:underline">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
