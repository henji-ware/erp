"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "./components/icons";

/**
 * Tela de erro do App Router. Sem ela, uma query que falha derruba a página
 * para o erro padrão do Next — tela branca, em inglês, sem caminho de volta.
 *
 * A mensagem original NÃO é exibida: em Server Component ela pode carregar
 * SQL, caminho de arquivo ou dado de cliente. O `digest` é o identificador
 * que o Next grava no log do servidor — é o que o usuário informa ao suporte.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-2xl bg-red-500/10 p-4 text-red-600">
        <Icon name="alert" size={32} />
      </div>
      <h1 className="text-xl font-bold text-slate-900">
        Algo deu errado nesta tela
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        O sistema não conseguiu carregar as informações. Tente de novo — se
        continuar, avise o suporte informando o código abaixo.
      </p>
      {error.digest && (
        <code className="mt-3 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">
          {error.digest}
        </code>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button onClick={reset} className="btn-primary">
          Tentar de novo
        </button>
        <Link href="/" className="btn-ghost">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
