import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Alert } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { AttachmentsCard } from "../../components/AttachmentsCard";
import DocumentInput from "../../components/DocumentInput";
import LeadStageLossFields from "../LeadStageLossFields";
import { LeadItemsCard } from "../LeadItemsCard";
import { Icon } from "../../components/icons";
import { updateLead, closeDeal, duplicateLead } from "../actions";
import { createProposal } from "../../proposals/actions";
import { PROPOSAL_TYPES, PROPOSAL_TYPE_LABELS } from "@/lib/proposals";
import { formatDate } from "@/lib/format";
import { getCurrentUser, canSee, crmScope } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attach?: string; deal?: string }>;
}) {
  const { id } = await params;
  const { attach, deal } = await searchParams;
  const [lead, user] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: Number(id) },
      include: {
        attachments: { orderBy: { createdAt: "desc" } },
        items: { orderBy: { createdAt: "asc" } },
        proposals: { orderBy: { revision: "desc" } },
      },
    }),
    getCurrentUser(),
  ]);
  if (!lead) notFound();
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null, ...crmScope(user) },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  // Usuário comum só acessa os próprios orçamentos (ou compartilhados).
  if (!canSee(user, lead)) notFound();

  const hasItems = lead.items.length > 0;

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
            <div>
              <label className="label">Cliente vinculado</label>
              <select name="customerId" defaultValue={lead.customerId ?? ""} className="input">
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DocumentInput defaultValue={lead.document ?? ""} />
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
              <input
                name="value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lead.value}
                disabled={hasItems}
                className={`input ${hasItems ? "cursor-not-allowed opacity-60" : ""}`}
              />
              {hasItems && (
                <p className="mt-1 text-xs text-slate-400">
                  Calculado a partir dos itens ({lead.items.length}).
                </p>
              )}
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

          <form action={duplicateLead} className="mt-3 border-t border-slate-100 pt-3">
            <input type="hidden" name="id" value={lead.id} />
            <button className="btn-ghost text-xs" title="Cria um novo orçamento com os mesmos dados e itens">
              <Icon name="file" size={14} /> Duplicar orçamento
            </button>
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

        {/* Itens do orçamento */}
        <LeadItemsCard leadId={lead.id} items={lead.items} products={products} />

        {/* Propostas geradas */}
        <div className="card h-fit p-6">
          <h2 className="mb-1 font-semibold text-slate-800">Proposta comercial</h2>
          <p className="mb-4 text-xs text-slate-400">
            Gera o documento no padrão DRR (com o nº {lead.number ?? "do orçamento"}), pronto
            para imprimir ou salvar em PDF. Cada geração cria uma revisão (R0, R1…).
          </p>

          <form action={createProposal} className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <div className="min-w-[200px] flex-1">
              <label className="label">Tipo de serviço</label>
              <select name="type" className="input" defaultValue="INSPECAO">
                {PROPOSAL_TYPES.map((t) => (
                  <option key={t} value={t}>{PROPOSAL_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <SubmitButton>
              <Icon name="file" size={15} /> Gerar proposta
            </SubmitButton>
          </form>

          {lead.proposals.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">
              Nenhuma proposta gerada ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {lead.proposals.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/proposals/${p.id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span className="text-slate-400">
                      <Icon name="file" size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        R{p.revision} · {p.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {PROPOSAL_TYPE_LABELS[p.type]} · {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <Icon name="arrowRight" size={14} className="text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fechar negócio */}
        <div className="card h-fit p-6">
          <h2 className="mb-1 font-semibold text-slate-800">Fechar negócio</h2>
          <p className="mb-4 text-xs text-slate-400">
            Gera o registro operacional já preenchido (cliente, valor e código{" "}
            {lead.number ? `${lead.number}`: "do orçamento"}) e marca como Vendido.
          </p>

          {deal === "noitems" && (
            <Alert tone="warn" size="sm" className="mb-3">
              Para gerar um pedido, adicione itens do catálogo (produtos/serviços) ao orçamento.
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <form action={closeDeal}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="target" value="project" />
              <SubmitButton className="btn-primary">
                <Icon name="projects" size={15} /> Gerar projeto
              </SubmitButton>
            </form>
            <form action={closeDeal}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="target" value="order" />
              <SubmitButton className="btn-ghost">
                <Icon name="orders" size={15} /> Gerar pedido
              </SubmitButton>
            </form>
          </div>
          {lead.stage === "WON" && (
            <p className="mt-3 text-xs text-green-600">Este orçamento já está marcado como Vendido.</p>
          )}
        </div>
      </div>
    </div>
  );
}
