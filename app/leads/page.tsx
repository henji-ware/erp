import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_LOSS_REASON_LABELS,
} from "@/lib/format";
import { Icon } from "../components/icons";
import { PageHeader, Badge } from "../components/ui";
import { SearchBar } from "../components/SearchBar";
import { ShareToggle } from "../components/ShareToggle";
import { OwnerTag } from "../components/OwnerTag";
import DocumentInput from "../components/DocumentInput";
import SubmitButton from "../components/SubmitButton";
import StageSelect from "./StageSelect";
import { createLead, convertLeadToCustomer, deleteLead } from "./actions";
import { getCurrentUser, crmScope, isAdmin, ownerNames } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const user = await getCurrentUser();
  const scope = crmScope(user);
  const owners = await ownerNames();
  const [leads, customers] = await Promise.all([
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              AND: [
                scope,
                {
                  OR: [
                    { number: { contains: q } },
                    { name: { contains: q } },
                    { email: { contains: q } },
                    { document: { contains: q } },
                    { source: { contains: q } },
                  ],
                },
              ],
            }
          : scope),
      },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...scope }, orderBy: { name: "asc" } }),
  ]);

  const byStage = (stage: string) => leads.filter((l) => l.stage === stage);
  const stageTotal = (stage: string) =>
    byStage(stage).reduce((s, l) => s + l.value, 0);

  return (
    <div>
      <PageHeader
        title="Leads / Orçamentos"
        subtitle={
          isAdmin(user)
            ? "Funil de vendas — você vê os orçamentos de toda a equipe."
            : "Funil de vendas — você vê apenas os seus orçamentos."
        }
        action={<SearchBar placeholder="Buscar por nº, nome, CPF/CNPJ..." defaultValue={q} />}
      />

      {/* Formulário de novo lead */}
      <div className="card mb-6 p-5">
        <form
          action={createLead}
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <div>
            <label className="label">Nome *</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Cliente (se já cadastrado)</label>
            <select name="customerId" className="input" defaultValue="">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <DocumentInput />
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
          <div>
            <label className="label">Valor (R$)</label>
            <input name="value" type="number" step="0.01" min="0" className="input" />
          </div>
          <div className="flex items-end">
            <SubmitButton className="btn-primary w-full xl:w-auto">Adicionar</SubmitButton>
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
                  {l.number && (
                    <p className="font-mono text-[11px] text-slate-400">Nº {l.number}</p>
                  )}
                  <p className="font-medium text-slate-800">{l.name}</p>
                  <p className="text-sm font-semibold text-brand-600">
                    {formatCurrency(l.value)}
                  </p>
                  {l.customer && (
                    <p className="mt-0.5 text-xs text-slate-500">Cliente: {l.customer.name}</p>
                  )}
                  {l.source && (
                    <p className="mt-0.5 text-xs text-slate-400">via {l.source}</p>
                  )}
                  {l.ownerId && owners.get(l.ownerId) && (
                    <p className="text-[11px] text-slate-400">por {owners.get(l.ownerId)}</p>
                  )}
                  {l.stage === "LOST" && l.lossReason && (
                    <Badge className="mt-1 bg-red-100 text-red-700">
                      {LEAD_LOSS_REASON_LABELS[l.lossReason]}
                    </Badge>
                  )}

                  <div className="mt-3 space-y-2">
                    <StageSelect id={l.id} stage={l.stage} />
                    {/* "Cliente" ocupa a linha toda: junto dos ícones ele não
                        cabia na coluna estreita e empurrava o excluir pra fora. */}
                    {stage !== "WON" && (
                      <form action={convertLeadToCustomer}>
                        <input type="hidden" name="id" value={l.id} />
                        <button className="btn-ghost w-full gap-1 px-2 py-1 text-xs" title="Converter em cliente">
                          <Icon name="arrowRight" size={14} /> Cliente
                        </button>
                      </form>
                    )}
                    <div className="flex items-center gap-1">
                      <ShareToggle entity="lead" id={l.id} shared={l.shared} canToggle={isAdmin(user) || l.ownerId === user?.id} />
                      <Link
                        href={`/leads/${l.id}`}
                        className="btn-ghost px-2 py-1 text-xs"
                        title="Editar"
                      >
                        <Icon name="edit" size={14} />
                      </Link>
                      <form action={deleteLead} className="ml-auto">
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
