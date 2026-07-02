import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { AttachmentsCard } from "../../components/AttachmentsCard";
import LeadStageLossFields from "../LeadStageLossFields";
import { updateLead } from "../actions";
import { getCurrentUser, canSee } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attach?: string }>;
}) {
  const { id } = await params;
  const { attach } = await searchParams;
  const [lead, user] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: Number(id) },
      include: { attachments: { orderBy: { createdAt: "desc" } } },
    }),
    getCurrentUser(),
  ]);
  if (!lead) notFound();
  // Usuário comum só acessa os próprios orçamentos (ou compartilhados).
  if (!canSee(user, lead)) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={lead.number ? `Orçamento ${lead.number}` : "Orçamento"}
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
            <div>
              <label className="label">Valor (R$)</label>
              <input name="value" type="number" step="0.01" min="0" defaultValue={lead.value} className="input" />
            </div>
            <LeadStageLossFields
              stage={lead.stage}
              lossReason={lead.lossReason}
              lossNote={lead.lossNote}
            />
            <div className="flex gap-2 pt-2">
              <SubmitButton>Salvar alterações</SubmitButton>
              <Link href="/leads" className="btn-ghost">
                Cancelar
              </Link>
            </div>
          </form>
        </div>

        {/* Proposta / Anexos */}
        <AttachmentsCard
          ownerType="lead"
          ownerId={lead.id}
          attachments={lead.attachments}
          title="Proposta / Anexos"
          hint="Anexe a proposta (PDF ou Word). Qualquer usuário logado pode baixá-la."
          error={attach}
        />
      </div>
    </div>
  );
}
