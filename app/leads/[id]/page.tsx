import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LEAD_STAGES, LEAD_STAGE_LABELS, formatDate } from "@/lib/format";
import { PageHeader } from "../../components/ui";
import { Icon } from "../../components/icons";
import SubmitButton from "../../components/SubmitButton";
import { updateLead } from "../actions";
import { uploadAttachment, deleteAttachment } from "../attachments";

export const dynamic = "force-dynamic";

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: Number(id) },
    include: { attachments: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Orçamento"
        subtitle={lead.name}
        action={
          <Link href="/leads" className="btn-ghost">
            Voltar
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dados do orçamento */}
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Dados</h2>
          <form action={updateLead} className="space-y-3">
            <input type="hidden" name="id" value={lead.id} />
            <div>
              <label className="label">Nome *</label>
              <input name="name" required defaultValue={lead.name} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">CPF / CNPJ</label>
                <input name="document" defaultValue={lead.document ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Origem</label>
                <input name="source" defaultValue={lead.source ?? ""} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">E-mail</label>
                <input name="email" type="email" defaultValue={lead.email ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input name="phone" defaultValue={lead.phone ?? ""} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Valor (R$)</label>
                <input name="value" type="number" step="0.01" min="0" defaultValue={lead.value} className="input" />
              </div>
              <div>
                <label className="label">Etapa</label>
                <select name="stage" defaultValue={lead.stage} className="input">
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STAGE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <SubmitButton>Salvar alterações</SubmitButton>
              <Link href="/leads" className="btn-ghost">
                Cancelar
              </Link>
            </div>
          </form>
        </div>

        {/* Proposta / Anexos */}
        <div className="card p-6">
          <h2 className="mb-1 font-semibold text-slate-800">Proposta / Anexos</h2>
          <p className="mb-4 text-xs text-slate-400">
            Anexe a proposta (PDF ou Word). Qualquer usuário logado pode baixá-la.
          </p>

          <form action={uploadAttachment} className="mb-5 space-y-3 rounded-lg border border-slate-200 p-4">
            <input type="hidden" name="leadId" value={lead.id} />
            <input
              type="file"
              name="file"
              required
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            <SubmitButton>
              <Icon name="download" size={15} /> Anexar proposta
            </SubmitButton>
          </form>

          {lead.attachments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              Nenhum anexo ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {lead.attachments.map((a) => (
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
      </div>
    </div>
  );
}
