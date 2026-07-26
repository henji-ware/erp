import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canSee } from "@/lib/auth";
import { PROPOSAL_TYPES, PROPOSAL_TYPE_LABELS, proposalNumber } from "@/lib/proposals";
import { PageHeader } from "../../components/ui";
import { Icon } from "../../components/icons";
import SubmitButton from "../../components/SubmitButton";
import PrintButton from "../../reports/PrintButton";
import { ProposalDoc } from "./ProposalDoc";
import { updateProposal, resetProposalTemplate, deleteProposal } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [proposal, user] = await Promise.all([
    prisma.proposal.findUnique({
      where: { id: Number(id) },
      include: { lead: { include: { items: { orderBy: { createdAt: "asc" } } } } },
    }),
    getCurrentUser(),
  ]);
  if (!proposal) notFound();
  if (!canSee(user, proposal.lead)) notFound();

  const items = proposal.lead.items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
  }));

  return (
    <div className="max-w-6xl">
      <div className="no-print">
        <PageHeader
          title={`Proposta ${proposalNumber(proposal.lead.number, proposal.revision, proposal.type)}`}
          subtitle={`${PROPOSAL_TYPE_LABELS[proposal.type]} · ${proposal.clientName}`}
          action={
            <div className="flex flex-wrap gap-2">
              <PrintButton />
              <Link href={`/leads/${proposal.leadId}`} className="btn-ghost">
                Voltar ao orçamento
              </Link>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Editor */}
        <div className="no-print space-y-4">
          <form action={updateProposal} className="card space-y-3 p-5">
            <input type="hidden" name="id" value={proposal.id} />
            <h2 className="font-semibold text-slate-800">Dados da proposta</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Tipo de serviço</label>
                <select name="type" defaultValue={proposal.type} className="input">
                  {PROPOSAL_TYPES.map((t) => (
                    <option key={t} value={t}>{PROPOSAL_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Título (assunto)</label>
                <input name="title" defaultValue={proposal.title} className="input" />
              </div>
            </div>

            <div className="grid grid-cols-[70px_1fr_1fr] gap-3">
              <div>
                <label className="label">Trat.</label>
                <select name="treatment" defaultValue={proposal.treatment} className="input">
                  <option value="A">A</option>
                  <option value="AO">AO</option>
                  <option value="À">À</option>
                </select>
              </div>
              <div>
                <label className="label">Cliente</label>
                <input name="clientName" defaultValue={proposal.clientName} className="input" />
              </div>
              <div>
                <label className="label">Cidade / UF</label>
                <input name="clientCity" defaultValue={proposal.clientCity ?? ""} className="input" placeholder="Santa Isabel/SP" />
              </div>
            </div>
            <div>
              <label className="label">Local da obra (se diferente)</label>
              <input name="siteLocation" defaultValue={proposal.siteLocation ?? ""} className="input" placeholder="Ex.: Pouso Alegre/MG" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Contato</label>
                <input name="contactName" defaultValue={proposal.contactName ?? ""} className="input" placeholder="Sr(a). Nome" />
              </div>
              <div>
                <label className="label">Fone</label>
                <input name="contactPhone" defaultValue={proposal.contactPhone ?? ""} className="input" />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input name="contactEmail" defaultValue={proposal.contactEmail ?? ""} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Introdução</label>
              <textarea name="intro" rows={3} defaultValue={proposal.intro} className="input" />
            </div>

            <div>
              <label className="label">Escopo dos serviços</label>
              <textarea name="scope" rows={12} defaultValue={proposal.scope} className="input font-mono text-xs" />
            </div>

            <div>
              <label className="label">Incluso no preço (um por linha)</label>
              <textarea name="included" rows={4} defaultValue={proposal.included ?? ""} className="input" />
            </div>

            <div>
              <label className="label">Observações (uma por linha, viram lista numerada)</label>
              <textarea name="notes" rows={4} defaultValue={proposal.notes ?? ""} className="input" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Rótulo do valor</label>
                <input name="amountLabel" defaultValue={proposal.amountLabel ?? ""} className="input" />
              </div>
              <div>
                <label className="label">
                  Valor (R$){proposal.lead.items.length > 0 && " — usa a soma dos itens"}
                </label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={proposal.amount}
                  disabled={proposal.lead.items.length > 0}
                  className={`input ${proposal.lead.items.length > 0 ? "cursor-not-allowed opacity-60" : ""}`}
                />
              </div>
            </div>

            <div>
              <label className="label">Impostos</label>
              <textarea name="taxes" rows={3} defaultValue={proposal.taxes ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Prazo</label>
              <textarea name="deadline" rows={2} defaultValue={proposal.deadline ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Condições de pagamento</label>
              <textarea name="paymentTerms" rows={3} defaultValue={proposal.paymentTerms ?? ""} className="input" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="label">Validade (dias)</label>
                <input name="validityDays" type="number" min="1" defaultValue={proposal.validityDays} className="input" />
              </div>
              <div>
                <label className="label">Assinado por</label>
                <input name="signedBy" defaultValue={proposal.signedBy ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Fone (assinatura)</label>
                <input name="signerPhone" defaultValue={proposal.signerPhone ?? ""} className="input" />
              </div>
              <div>
                <label className="label">E-mail (assinatura)</label>
                <input name="signerEmail" defaultValue={proposal.signerEmail ?? ""} className="input" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="showNorms"
                defaultChecked={proposal.showNorms}
                className="h-4 w-4"
              />
              Incluir tabela de normas aplicadas (AISI, FEM, NBR, RMI…)
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <SubmitButton>Salvar e atualizar prévia</SubmitButton>
            </div>
          </form>

          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <form action={resetProposalTemplate} className="flex items-end gap-2">
              <input type="hidden" name="id" value={proposal.id} />
              <div>
                <label className="label">Aplicar modelo padrão de</label>
                <select name="type" defaultValue={proposal.type} className="input">
                  {PROPOSAL_TYPES.map((t) => (
                    <option key={t} value={t}>{PROPOSAL_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <SubmitButton className="btn-ghost">Aplicar modelo</SubmitButton>
            </form>

            <form action={deleteProposal}>
              <input type="hidden" name="id" value={proposal.id} />
              <button className="btn-danger px-3 py-1.5 text-xs">
                <Icon name="trash" size={14} /> Excluir revisão
              </button>
            </form>
          </div>
          <p className="text-xs text-slate-400">
            O modelo padrão sobrescreve escopo, textos e condições com o padrão do tipo escolhido.
          </p>
        </div>

        {/* Prévia / documento */}
        <div className="proposal-preview">
          <ProposalDoc doc={proposal} leadNumber={proposal.lead.number} items={items} />
        </div>
      </div>
    </div>
  );
}
