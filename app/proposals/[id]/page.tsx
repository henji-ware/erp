import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canSee } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import {
  FINDING_COLUMNS,
  GREETING_PADRAO,
  MAO_DE_OBRA_LABEL,
  PROPOSAL_TYPES,
  PROPOSAL_TYPE_LABELS,
  PTA_LABEL,
  proposalNumber,
  proposalPrice,
} from "@/lib/proposals";
import { PageHeader, Alert } from "../../components/ui";
import ProposalSection from "./ProposalSection";
import { VERSION_FIELD, versionValue } from "@/lib/concurrency";
import { Icon } from "../../components/icons";
import SubmitButton from "../../components/SubmitButton";
import PrintButton from "../../reports/PrintButton";
import { ProposalDoc } from "./ProposalDoc";
import ProposalAIAssistant from "./ProposalAIAssistant";
import { updateProposal, resetProposalTemplate, deleteProposal } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conflito?: string }>;
}) {
  const [{ id }, { conflito }] = await Promise.all([params, searchParams]);
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
  const itemsTotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const price = proposalPrice(proposal, itemsTotal, items.length > 0);

  return (
    <div className="max-w-6xl">
      <div className="no-print">
        <PageHeader
          title={`Proposta ${proposalNumber(proposal.lead.number, proposal.revision, proposal.type)}`}
          subtitle={`${PROPOSAL_TYPE_LABELS[proposal.type]} · ${proposal.clientName}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ProposalAIAssistant
                proposalType={proposal.type}
                clientName={proposal.clientName}
                title={proposal.title}
                items={items}
                currentScope={proposal.scope}
                findings={proposal.findings ?? undefined}
              />
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
          {conflito && (
            <Alert tone="warn" title="Outra pessoa salvou antes de você">
              Suas alterações NÃO foram gravadas — a proposta já havia mudado
              quando você clicou em salvar. Esta tela está mostrando a versão
              atual: confira o que mudou e refaça o que faltar.
            </Alert>
          )}
          <form action={updateProposal} className="card p-5">
            <input type="hidden" name="id" value={proposal.id} />
            {/* Versão que esta tela carregou. A gravação compara com a do
                banco e recusa se outra pessoa salvou no meio do caminho. */}
            <input
              type="hidden"
              name={VERSION_FIELD}
              value={versionValue(proposal.updatedAt)}
            />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Dados da proposta</h2>
              <span className="text-xs text-slate-400">Revisão R{proposal.revision}</span>
            </div>

            <ProposalSection
              title="Identificação"
              hint="Tipo, título, cliente, local da obra e contato"
              icon="customers"
              defaultOpen
            >
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

            </ProposalSection>

            <ProposalSection
              title="Texto da proposta"
              hint="Vocativo, introdução, escopo, não conformidades e observações"
              icon="pen"
              defaultOpen
            >
            <div>
              <label className="label">Vocativo</label>
              <input
                name="greeting"
                defaultValue={proposal.greeting ?? ""}
                className="input"
                placeholder={GREETING_PADRAO}
              />
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
              <label className="label">
                Não conformidades — {FINDING_COLUMNS.join(" · ")}
              </label>
              <textarea
                name="findings"
                rows={6}
                defaultValue={proposal.findings ?? ""}
                className="input font-mono text-xs"
                placeholder={"A\t25\t7\tMetalshop\tLongarina\tMédia\tReposicionar"}
              />
              <p className="mt-1 text-xs text-slate-400">
                Uma por linha, colunas separadas por TAB (cole direto do Excel) ou por &quot;|&quot;.
                Colunas em branco não aparecem na proposta.
              </p>
            </div>

            <div>
              <label className="label">Incluso no preço (um por linha)</label>
              <textarea name="included" rows={4} defaultValue={proposal.included ?? ""} className="input" />
            </div>

            <div>
              <label className="label">Observações (uma por linha, viram lista numerada)</label>
              <textarea name="notes" rows={4} defaultValue={proposal.notes ?? ""} className="input" />
            </div>

            </ProposalSection>

            <ProposalSection
              title="Preço e impostos"
              hint="Mão de obra, equipamento, componentes, frete e tributos"
              icon="finance"
              defaultOpen
            >
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <div>
                  <label className="label">Rótulo da mão de obra</label>
                  <input name="laborLabel" defaultValue={proposal.laborLabel ?? ""} className="input" placeholder={MAO_DE_OBRA_LABEL} />
                </div>
                <div>
                  <label className="label">Mão de obra (R$)</label>
                  <input name="laborAmount" type="number" step="0.01" min="0" defaultValue={proposal.laborAmount} className="input" />
                </div>
                <div>
                  <label className="label">Rótulo do equipamento</label>
                  <input name="equipmentLabel" defaultValue={proposal.equipmentLabel ?? ""} className="input" placeholder={PTA_LABEL} />
                </div>
                <div>
                  <label className="label">Equipamento (R$)</label>
                  <input name="equipmentAmount" type="number" step="0.01" min="0" defaultValue={proposal.equipmentAmount} className="input" />
                </div>
                <div>
                  <label className="label">
                    Componentes{proposal.lead.items.length > 0 && " — soma dos itens do orçamento"}
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
                <div>
                  <label className="label">Frete (R$)</label>
                  <input name="freightAmount" type="number" step="0.01" min="0" defaultValue={proposal.freightAmount} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Rótulo do preço total</label>
                <input name="amountLabel" defaultValue={proposal.amountLabel ?? ""} className="input" />
              </div>
              <p className="text-xs text-slate-500">
                Preço total: <strong>{formatCurrency(price.total)}</strong> — soma de mão de obra,
                equipamento, componentes e frete.
              </p>
            </div>

            <div>
              <label className="label">Impostos</label>
              <textarea name="taxes" rows={3} defaultValue={proposal.taxes ?? ""} className="input" />
            </div>
            </ProposalSection>

            <ProposalSection
              title="Prazos e pagamento"
              hint="Execução, fabricação, cronograma, condições, descarga e piso"
              icon="calendar"
            >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Prazo de execução</label>
                <textarea name="deadline" rows={2} defaultValue={proposal.deadline ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Prazo de fabricação</label>
                <textarea name="fabricationDeadline" rows={2} defaultValue={proposal.fabricationDeadline ?? ""} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Cronograma (material / montagem)</label>
              <textarea name="schedule" rows={2} defaultValue={proposal.schedule ?? ""} className="input" placeholder="Material — 40 dias… / Montagem — 15 dias…" />
            </div>
            <div>
              <label className="label">Condições de pagamento</label>
              <textarea name="paymentTerms" rows={3} defaultValue={proposal.paymentTerms ?? ""} className="input" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Descarga do material</label>
                <textarea name="unloading" rows={3} defaultValue={proposal.unloading ?? ""} className="input" placeholder="Por conta do cliente…" />
              </div>
              <div>
                <label className="label">Piso</label>
                <textarea name="floorNote" rows={3} defaultValue={proposal.floorNote ?? ""} className="input" placeholder="Resistência e nivelamento…" />
              </div>
            </div>
            </ProposalSection>

            <ProposalSection
              title="Técnico e garantia"
              hint="Tratamento de superfície, cores, garantia, NCM e normas"
              icon="inspection"
            >
            <div>
              <label className="label">Tratamento de superfície e pintura</label>
              <textarea name="surfaceTreatment" rows={3} defaultValue={proposal.surfaceTreatment ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Cores</label>
              <textarea name="colors" rows={3} defaultValue={proposal.colors ?? ""} className="input" placeholder="Montante – azul…" />
            </div>
            <div>
              <label className="label">Garantia</label>
              <textarea name="warranty" rows={3} defaultValue={proposal.warranty ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Confirmação de compra</label>
              <textarea name="purchaseConfirmation" rows={3} defaultValue={proposal.purchaseConfirmation ?? ""} className="input" />
            </div>
            <div>
              <label className="label">NCM</label>
              <input name="ncm" defaultValue={proposal.ncm ?? ""} className="input" placeholder="73.08.90.90" />
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
            </ProposalSection>

            <ProposalSection
              title="Assinatura e validade"
              hint="Prazo de validade e dados de quem assina"
              icon="lock"
            >
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

            </ProposalSection>

            {/* Fica colado no rodapé enquanto rola: com o formulário longo,
                mudar uma linha obrigava a rolar até o fim para salvar. */}
            <div className="proposal-save-bar mt-4 flex flex-wrap items-center gap-3">
              <SubmitButton>Salvar e atualizar prévia</SubmitButton>
              <span className="text-xs text-slate-400">
                A prévia ao lado só muda depois de salvar.
              </span>
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
