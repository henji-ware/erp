import { formatCurrency } from "@/lib/format";
import {
  COMPANY,
  NORMAS_TABLE,
  currencyInWords,
  longDate,
  proposalNumber,
} from "@/lib/proposals";

type Item = { description: string; quantity: number; unitPrice: number };

type Doc = {
  revision: number;
  type: string;
  title: string;
  treatment: string;
  clientName: string;
  clientCity: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  siteLocation: string | null;
  showNorms: boolean;
  intro: string;
  scope: string;
  included: string | null;
  notes: string | null;
  amount: number;
  amountLabel: string | null;
  deadline: string | null;
  schedule: string | null;
  paymentTerms: string | null;
  taxes: string | null;
  colors: string | null;
  floorNote: string | null;
  warranty: string | null;
  purchaseConfirmation: string | null;
  ncm: string | null;
  validityDays: number;
  signedBy: string | null;
  signerPhone: string | null;
  signerEmail: string | null;
  createdAt: Date;
};

// Quebra texto em linhas, ignorando vazias (usado nas listas com marcador).
const lines = (s: string | null) =>
  (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

// Bloco "RÓTULO: conteúdo" das condições gerais.
function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mb-2.5">
      <p className="text-[10.5pt] font-bold text-slate-900">{label}:</p>
      <p className="whitespace-pre-line text-[10.5pt] leading-relaxed">{value}</p>
    </div>
  );
}

// Documento da proposta no padrão visual da DRR: papel timbrado com logo,
// filete duplo, marca d'água ao fundo e rodapé com os dados da empresa.
export function ProposalDoc({
  doc,
  leadNumber,
  items,
}: {
  doc: Doc;
  leadNumber: string | null;
  items: Item[];
}) {
  const itemsTotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const total = items.length > 0 ? itemsTotal : doc.amount;

  return (
    <article className="proposal-doc">
      {/* Marca d'água (repete em todas as páginas impressas) */}
      <div className="proposal-watermark" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" />
      </div>

      {/* Cabeçalho timbrado */}
      <header className="proposal-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="DRR Projetos" className="proposal-logo" />
        <div className="proposal-rule" />
      </header>

      <div className="proposal-body">
        <p className="mb-6 text-right text-[10.5pt]">{longDate(doc.createdAt)}</p>

        {/* Destinatário */}
        <section className="mb-6">
          <p className="text-[10.5pt]">{doc.treatment || "A"}</p>
          <p className="text-[13pt] font-bold text-slate-900">{doc.clientName}</p>
          {doc.clientCity && <p className="text-[10.5pt]">{doc.clientCity}</p>}
          {doc.contactName && (
            <p className="mt-3 text-[10.5pt] font-bold text-slate-900">{doc.contactName}</p>
          )}
          {doc.contactPhone && <p className="text-[10.5pt]">Fone: {doc.contactPhone}</p>}
          {doc.contactEmail && (
            <p className="text-[10.5pt]">
              E-mail: <span className="text-blue-700 underline">{doc.contactEmail}</span>
            </p>
          )}
        </section>

        {/* Assunto */}
        <h1 className="mb-5 text-[11pt] font-bold italic text-slate-900">
          Proposta N° {proposalNumber(leadNumber, doc.revision, doc.type)}
          {doc.title ? ` – ${doc.title}` : ""}
        </h1>

        <p className="mb-3 text-[10.5pt] font-bold text-slate-900">Prezados (as) Senhores (as)</p>
        <p className="mb-6 whitespace-pre-line text-justify text-[10.5pt] leading-relaxed">
          {doc.intro}
        </p>

        {doc.siteLocation && (
          <p className="mb-5 text-[10.5pt]">
            <strong>Local da obra:</strong> {doc.siteLocation}
          </p>
        )}

        {/* A. Escopo — pode ser longo, então quebra livremente entre páginas */}
        <section className="mb-6">
          <h2 className="mb-2 text-[11pt] font-bold text-slate-900">A. DESCRIÇÃO DOS SERVIÇOS</h2>
          <div className="whitespace-pre-line text-justify text-[10.5pt] leading-relaxed">
            {doc.scope}
          </div>
        </section>

        {/* B. Itens — a tabela quebra entre páginas repetindo o cabeçalho */}
        {items.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[11pt] font-bold text-slate-900">B. LISTA DE COMPONENTES</h2>
            <table className="proposal-table">
              <thead>
                <tr>
                  <th className="w-12 text-center">ITEM</th>
                  <th>DESCRIÇÃO</th>
                  <th className="w-16 text-center">QUANT.</th>
                  <th className="w-24 text-right">V$ UNT.</th>
                  <th className="w-28 text-right">V$ TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{it.description}</td>
                    <td className="text-center">{it.quantity}</td>
                    <td className="text-right">{formatCurrency(it.unitPrice)}</td>
                    <td className="text-right">{formatCurrency(it.unitPrice * it.quantity)}</td>
                  </tr>
                ))}
                <tr className="proposal-total-row">
                  <td colSpan={4} className="text-right">TOTAL</td>
                  <td className="text-right">{formatCurrency(itemsTotal)}</td>
                </tr>
              </tbody>
            </table>
            {doc.ncm && <p className="mt-1 text-[9pt] text-slate-600">NCM: {doc.ncm}</p>}
          </section>
        )}

        {/* Valor */}
        <section className="mb-6 break-inside-avoid text-center">
          <p className="text-[12pt] font-bold text-slate-900">
            {doc.amountLabel ?? "VALOR TOTAL"} — {formatCurrency(total)}
          </p>
          <p className="text-[10pt] font-semibold">({currencyInWords(total)})</p>
          {/* Os impostos são detalhados em CONDIÇÕES GERAIS, sem repetir aqui. */}
        </section>

        {/* Incluso no preço */}
        {lines(doc.included).length > 0 && (
          <section className="mb-6 break-inside-avoid">
            <h3 className="mb-1 text-[10.5pt] font-bold text-slate-900">Incluso no preço:</h3>
            <ul className="space-y-0.5 text-[10.5pt]">
              {lines(doc.included).map((l, i) => (
                <li key={i}>✓ {l}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Condições gerais */}
        <section className="mb-6">
          <h2 className="mb-2 text-[11pt] font-bold text-slate-900">C. CONDIÇÕES GERAIS</h2>
          <Field label="IMPOSTOS" value={doc.taxes} />
          <Field label="PRAZO" value={doc.deadline} />
          <Field label="CRONOGRAMA" value={doc.schedule} />
          <Field label="CONDIÇÕES DE PAGAMENTO" value={doc.paymentTerms} />
          <Field label="CORES" value={doc.colors} />
          <Field label="PISO" value={doc.floorNote} />
          <Field label="GARANTIA" value={doc.warranty} />
          <Field label="CONFIRMAÇÃO DE COMPRA" value={doc.purchaseConfirmation} />
          <div className="mb-2.5">
            <p className="text-[10.5pt] font-bold text-slate-900">VALIDADE DA PROPOSTA:</p>
            <p className="text-[10.5pt]">
              A proposta é válida por {doc.validityDays} dias a partir desta data.
            </p>
          </div>
        </section>

        {/* Observações */}
        {lines(doc.notes).length > 0 && (
          <section className="mb-6">
            <h3 className="mb-1 text-[10.5pt] font-bold underline">OBSERVAÇÕES GERAIS</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-justify text-[10.5pt] leading-relaxed">
              {lines(doc.notes).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </section>
        )}

        {/* Normas aplicadas — tabela longa, quebra livremente */}
        {doc.showNorms && (
          <section className="mb-6">
            <h2 className="mb-2 text-[11pt] font-bold text-slate-900">NORMAS APLICADAS</h2>
            <table className="proposal-table">
              <thead>
                <tr>
                  <th className="w-32">Nome / Código</th>
                  <th>Título</th>
                  <th className="w-24">Origem</th>
                  <th className="w-36">Objetivo</th>
                </tr>
              </thead>
              <tbody>
                {NORMAS_TABLE.map((n) => (
                  <tr key={n.code}>
                    <td>{n.code}</td>
                    <td>{n.title}</td>
                    <td>{n.origin}</td>
                    <td>{n.goal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Fecho e assinatura */}
        <section className="mt-8 break-inside-avoid">
          <p className="mb-5 text-justify text-[10.5pt] leading-relaxed">
            Sem mais para o momento, colocamo-nos à disposição para os esclarecimentos que se
            fizerem necessários.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="mb-1 h-12 object-contain" />
          <p className="text-[10.5pt] font-bold italic text-slate-900">
            {doc.signedBy ?? COMPANY.name}
          </p>
          {doc.signerPhone && <p className="text-[10.5pt]">Fone: {doc.signerPhone}</p>}
          {doc.signerEmail && (
            <p className="text-[10.5pt]">
              E-mail: <span className="text-blue-700 underline">{doc.signerEmail}</span>
            </p>
          )}
          <p className="mt-3 text-[9.5pt] font-bold italic text-green-700">
            Antes de imprimir, pense na responsabilidade com o meio ambiente.
          </p>
        </section>
      </div>

      {/* Rodapé timbrado (repete em todas as páginas impressas) */}
      <footer className="proposal-footer">
        <div className="proposal-rule" />
        <p>{COMPANY.city}</p>
        <p>{COMPANY.site}</p>
      </footer>
    </article>
  );
}
