import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
} from "@/lib/format";
import { Icon } from "../components/icons";
import { PageHeader } from "../components/ui";
import { SearchBar } from "../components/SearchBar";
import SubmitButton from "../components/SubmitButton";
import StageSelect from "./StageSelect";
import { createLead, convertLeadToCustomer, deleteLead } from "./actions";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { document: { contains: q } },
              { source: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const byStage = (stage: string) => leads.filter((l) => l.stage === stage);
  const stageTotal = (stage: string) =>
    byStage(stage).reduce((s, l) => s + l.value, 0);

  return (
    <div>
      <PageHeader
        title="Leads / Orçamentos"
        subtitle="Funil de vendas. Anexe a proposta e converta em cliente ao ganhar."
        action={<SearchBar placeholder="Buscar por nome, CPF/CNPJ..." defaultValue={q} />}
      />

      {/* Formulário de novo lead */}
      <div className="card mb-6 p-5">
        <form
          action={createLead}
          className="grid grid-cols-1 gap-3 md:grid-cols-6"
        >
          <div>
            <label className="label">Nome *</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">CPF / CNPJ</label>
            <input name="document" className="input" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Origem</label>
            <input name="source" className="input" placeholder="Site, indicação..." />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">Valor (R$)</label>
              <input name="value" type="number" step="0.01" min="0" className="input" />
            </div>
            <SubmitButton>Adicionar</SubmitButton>
          </div>
        </form>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {LEAD_STAGES.map((stage) => (
          <div key={stage} className="rounded-xl bg-slate-100 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-700">
                {LEAD_STAGE_LABELS[stage]}
              </h3>
              <span className="text-xs text-slate-400">
                {byStage(stage).length}
              </span>
            </div>
            <p className="mb-3 px-1 text-xs font-medium text-slate-500">
              {formatCurrency(stageTotal(stage))}
            </p>

            <div className="space-y-3">
              {byStage(stage).map((l) => (
                <div key={l.id} className="card p-3">
                  <p className="font-medium text-slate-800">{l.name}</p>
                  <p className="text-sm font-semibold text-brand-600">
                    {formatCurrency(l.value)}
                  </p>
                  {l.source && (
                    <p className="mt-0.5 text-xs text-slate-400">via {l.source}</p>
                  )}

                  <div className="mt-3 space-y-2">
                    <StageSelect id={l.id} stage={l.stage} />
                    <div className="flex gap-1">
                      <Link
                        href={`/leads/${l.id}`}
                        className="btn-ghost px-2 py-1 text-xs"
                        title="Editar"
                      >
                        <Icon name="edit" size={14} />
                      </Link>
                      {stage !== "WON" && (
                        <form action={convertLeadToCustomer} className="flex-1">
                          <input type="hidden" name="id" value={l.id} />
                          <button className="btn-ghost w-full px-2 py-1 text-xs" title="Converter em cliente">
                            <Icon name="arrowRight" size={14} /> Cliente
                          </button>
                        </form>
                      )}
                      <form action={deleteLead}>
                        <input type="hidden" name="id" value={l.id} />
                        <button className="btn-danger px-2 py-1 text-xs" title="Excluir">
                          <Icon name="close" size={14} />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
              {byStage(stage).length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-slate-400">
                  Vazio
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
