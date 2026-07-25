"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { formatDate } from "@/lib/format";
import { Icon } from "./icons";
import {
  uploadAttachment,
  deleteAttachment,
  registerClientUpload,
} from "../attachments/actions";

type AttachmentItem = {
  id: number;
  fileName: string;
  size: number;
  createdAt: Date;
};

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB (upload direto para o Blob)

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Card de anexos (PDF/Word) reutilizável: orçamentos, projetos e inspeções.
// O arquivo sobe direto do navegador para o Vercel Blob (suporta até 100 MB);
// sem Blob configurado (dev local), cai no envio via servidor (disco).
export function AttachmentsCard({
  ownerType,
  ownerId,
  attachments,
  title = "Anexos",
  hint = "Anexe documentos (PDF ou Word, até 100 MB).",
  accept = ".pdf,.doc,.docx",
  error,
}: {
  ownerType: "lead" | "project" | "inspection" | "transaction";
  ownerId: number;
  attachments: AttachmentItem[];
  title?: string;
  hint?: string;
  accept?: string;
  error?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    error === "noblob"
      ? "O armazenamento de arquivos não está configurado (Vercel Blob)."
      : error === "fail"
        ? "Falha ao enviar o arquivo. Tente novamente."
        : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || busy) return;

    const exts = accept.replace(/\./g, "").split(",").map((s) => s.trim()).join("|");
    if (!new RegExp(`\\.(${exts})$`, "i").test(file.name)) {
      setMsg(`Formato não aceito. Envie: ${accept}`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setMsg(`Arquivo muito grande (${fmtSize(file.size)}). O limite é 100 MB.`);
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      // Caminho principal: navegador → Blob (sem passar pelo servidor).
      // Nome aleatório no storage: evita problemas com acentos/espaços.
      const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? ".pdf";
      const blob = await upload(`anexos/${crypto.randomUUID()}${ext}`, file, {
        access: "private",
        handleUploadUrl: "/api/attachments/upload",
      });
      await registerClientUpload({
        ownerType,
        ownerId,
        fileName: file.name,
        url: blob.url,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      console.error("[anexo] upload direto falhou:", err);
      // Fallback (dev local sem Blob): envia via servidor.
      try {
        const fd = new FormData();
        fd.set("ownerType", ownerType);
        fd.set("ownerId", String(ownerId));
        fd.set("file", file);
        await uploadAttachment(fd);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (err2) {
        // Redirecionamentos do Next (ex.: ?attach=noblob) devem navegar, não virar erro.
        if ((err2 as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err2;
        console.error("[anexo] fallback via servidor falhou:", err2);
        const detail = err instanceof Error ? err.message : String(err);
        setMsg(`Falha ao enviar o arquivo. Detalhe: ${detail}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 font-semibold text-slate-800">{title}</h2>
      <p className="mb-4 text-xs text-slate-400">{hint}</p>

      {msg && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{msg}</p>
      )}

      <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-lg border border-slate-200 p-4">
        <input
          ref={fileRef}
          type="file"
          name="file"
          required
          accept={accept}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        <button type="submit" disabled={busy} className="btn-primary">
          <Icon name="download" size={15} /> {busy ? "Enviando..." : "Anexar arquivo"}
        </button>
      </form>

      {attachments.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Nenhum anexo ainda.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
            >
              <span className="text-slate-400">
                <Icon name="file" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{a.fileName}</p>
                <p className="text-xs text-slate-400">
                  {fmtSize(a.size)} · {formatDate(a.createdAt)}
                </p>
              </div>
              <a
                href={`/api/attachments/${a.id}`}
                className="btn-ghost px-2 py-1 text-xs"
                title="Baixar"
              >
                <Icon name="download" size={14} />
              </a>
              <form action={deleteAttachment}>
                <input type="hidden" name="id" value={a.id} />
                <button className="btn-danger px-2 py-1 text-xs" title="Excluir anexo">
                  <Icon name="trash" size={14} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
