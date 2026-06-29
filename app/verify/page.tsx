import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import Logo from "../components/Logo";
import { Icon } from "../components/icons";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;
  if (token) {
    const userId = await consumeToken("VERIFY", token);
    if (userId) {
      await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
      ok = true;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mb-4 flex justify-center">
          <Logo size={48} />
        </div>
        {ok ? (
          <>
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Icon name="check" size={24} />
            </span>
            <h1 className="text-xl font-bold text-slate-900">E-mail confirmado!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sua conta está liberada. Você já pode entrar no sistema.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="close" size={24} />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Link inválido ou expirado</h1>
            <p className="mt-2 text-sm text-slate-500">
              Peça a um administrador para reenviar a confirmação.
            </p>
          </>
        )}
        <Link href="/login" className="btn-primary mt-6 inline-flex w-full justify-center">
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
