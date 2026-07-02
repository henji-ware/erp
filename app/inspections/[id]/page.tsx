import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  RISK_LEVELS,
  RISK_LABELS,
  INSPECTION_STATUS_LABELS,
} from "@/lib/format";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { AttachmentsCard } from "../../components/AttachmentsCard";
import { updateInspection } from "../actions";
import { getCurrentUser, canSee, crmScope } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toLocalInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export default async function EditInspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attach?: string }>;
}) {
  const { id } = await params;
  const { attach } = await searchParams;
  const user = await getCurrentUser();
  const [insp, customers] = await Promise.all([
    prisma.inspection.findUnique({
      where: { id: Number(id) },
      include: { attachments: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...crmScope(user) }, orderBy: { name: "asc" } }),
  ]);
  if (!insp) notFound();
  if (!canSee(user, insp)) notFound();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Inspeção / Laudo"
        subtitle={INSPECTION_STATUS_LABELS[insp.status]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <form action={updateInspection} className="space-y-3">
          <input type="hidden" name="id" value={insp.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cliente *</label>
              <select name="customerId" required defaultValue={insp.customerId} className="input">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Data e hora *</label>
              <input name="scheduledAt" type="datetime-local" required defaultValue={toLocalInput(insp.scheduledAt)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Local / Endereço</label>
            <input name="location" defaultValue={insp.location ?? ""} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Engenheiro responsável</label>
              <input name="engineer" defaultValue={insp.engineer ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Nº da ART</label>
              <input name="artNumber" defaultValue={insp.artNumber ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Classificação de risco</label>
            <select name="riskLevel" defaultValue={insp.riskLevel ?? ""} className="input">
              <option value="">—</option>
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>{RISK_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Achados / Laudo</label>
            <textarea name="findings" rows={5} defaultValue={insp.findings ?? ""} className="input" placeholder="Anomalias encontradas, recomendações priorizadas, plano de ação..." />
          </div>
          <p className="text-xs text-slate-400">
            O status (agendada / realizada / laudo emitido) é alterado na lista de inspeções.
          </p>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar</SubmitButton>
            <Link href="/inspections" className="btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>

        <AttachmentsCard
          ownerType="inspection"
          ownerId={insp.id}
          attachments={insp.attachments}
          title="Laudos e documentos"
          hint="Laudo técnico, ART, fotos em PDF, relatórios (PDF ou Word)."
          error={attach}
        />
      </div>
    </div>
  );
}
