"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ACTION_LABELS,
  FIELD_LABELS,
  type ParsedAction,
} from "@/lib/ai/action-protocol";
import { Icon } from "./icons";

/**
 * Cartão de confirmação de uma ação sugerida pelo DeskHelper AI.
 *
 * O modelo não grava nada: ele descreve o que quer criar, isto aparece como
 * um cartão com os campos à vista, e só o clique em "Criar" chama a API —
 * que valida tudo de novo no servidor. O usuário sempre vê o que vai ser
 * gravado ANTES de gravar.
 */
export type ActionResult = { summary: string; href: string };

export default function AIActionCard({
  action,
  result,
  onDone,
}: {
  action: ParsedAction;
  /**
   * O resultado NÃO pode morar aqui dentro. Todo o painel do Copilot fica
   * atrás de `{isOpen && ...}`, então fechar a janela desmonta este
   * componente e zera o estado local: ao reabrir, o mesmo cartão voltava com
   * o botão "Criar" ativo e um segundo clique duplicava o registro. Quem
   * guarda é o CopilotWidget, que permanece montado.
   */
  result?: ActionResult;
  onDone: (result: ActionResult) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  const fields = Object.entries(action.data).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  async function confirm() {
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/ai/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: action.kind, dados: action.data }),
      });

      // Sessão expirada: o middleware devolve um redirect para /login, o
      // fetch segue e entrega a PÁGINA com status 200. Sem esta checagem,
      // `res.json()` estoura no HTML e o usuário lê "falha de rede" — e
      // tenta de novo em vez de entrar outra vez no sistema.
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.redirected || !isJson) {
        setError("Sua sessão expirou. Entre novamente para criar o registro.");
        setStatus("error");
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Não foi possível criar o registro.");
        setStatus("error");
        return;
      }
      setStatus("idle");
      onDone({ summary: data.summary, href: data.href });
      // A listagem do módulo já está aberta em outra aba do ERP em muitos
      // casos; atualizar aqui evita o usuário achar que não gravou.
      router.refresh();
    } catch {
      setError("Falha de rede ao criar o registro.");
      setStatus("error");
    }
  }

  if (result) {
    return (
      <div className="alert alert-success alert-sm mt-2 w-full">
        <span className="alert-icon">
          <Icon name="check" size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="alert-title">Criado</p>
          <p className="mt-0.5 break-words">{result.summary}</p>
          <Link
            href={result.href}
            className="mt-1 inline-flex items-center gap-1 font-semibold underline"
          >
            Abrir <Icon name="arrowRight" size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="alert alert-accent mt-2 w-full flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="alert-icon">
          <Icon name="ai" size={13} />
        </span>
        <p className="alert-title">{ACTION_LABELS[action.kind]}</p>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Aguardando você
        </span>
      </div>

      <dl className="w-full space-y-1">
        {fields.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="w-28 shrink-0 text-slate-400">
              {FIELD_LABELS[key] ?? key}
            </dt>
            <dd className="min-w-0 flex-1 break-words text-slate-700">
              {renderValue(value)}
            </dd>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-slate-400">Sem campos preenchidos.</p>
        )}
      </dl>

      {status === "error" && (
        <p className="w-full rounded-md bg-red-500/10 px-2 py-1.5 text-red-600">
          {error}
        </p>
      )}

      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={status === "saving"}
          className="btn-primary btn-sm"
        >
          {status === "saving" ? "Criando..." : status === "error" ? "Tentar de novo" : "Criar"}
        </button>
        <span className="text-[11px] text-slate-400">
          Revise antes de confirmar — a IA pode errar.
        </span>
      </div>
    </div>
  );
}

/** Itens de pedido viram uma linha legível; o resto sai como texto. */
function renderValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const it = item as Record<string, unknown>;
          return `produto ${it.produtoId} × ${it.quantidade ?? 1}`;
        }
        return String(item);
      })
      .join(", ");
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat("pt-BR").format(value);
  }
  return String(value);
}
