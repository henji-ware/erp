import Link from "next/link";
import { Icon } from "./components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
        <Icon name="search" size={32} />
      </div>
      <p className="text-4xl font-bold tracking-tight text-slate-300">404</p>
      <h1 className="mt-1 text-xl font-bold text-slate-900">
        Página não encontrada
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        O endereço não existe ou o registro foi removido — verifique a lixeira
        se o item foi excluído há pouco.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className="btn-primary">
          Voltar ao início
        </Link>
        <Link href="/trash" className="btn-ghost">
          Abrir a lixeira
        </Link>
      </div>
    </div>
  );
}
