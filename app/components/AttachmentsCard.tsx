import { formatDate } from "@/lib/format";
import { Icon } from "./icons";
import SubmitButton from "./SubmitButton";
import { uploadAttachment, deleteAttachment } from "../attachments/actions";

type AttachmentItem = {
  id: number;
  fileName: string;
  size: number;
  createdAt: Date;
};

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Card de anexos (PDF/Word) reutilizável: orçamentos, projetos e inspeções.
export function AttachmentsCard({
  ownerType,
  ownerId,
  attachments,
  title = "Anexos",
  hint = "Anexe documentos (PDF ou Word). Qualquer usuário logado pode baixá-los.",
}: {
  ownerType: "lead" | "project" | "inspection";
  ownerId: number;
  attachments: AttachmentItem[];
  title?: string;
  hint?: string;
}) {
  return (
    <div className="card p-6">
      <h2 className="mb-1 font-semibold text-slate-800">{title}</h2>
      <p className="mb-4 text-xs text-slate-400">{hint}</p>

      <form action={uploadAttachment} className="mb-5 space-y-3 rounded-lg border border-slate-200 p-4">
        <input type="hidden" name="ownerType" value={ownerType} />
        <input type="hidden" name="ownerId" value={ownerId} />
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        <SubmitButton>
          <Icon name="download" size={15} /> Anexar arquivo
        </SubmitButton>
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
