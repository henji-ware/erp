import { formatCurrency } from "@/lib/format";
import {
  COMPANY,
  longDate,
  proposalNumber,
  currencyInWords,
  NORMAS_TABLE,
} from "@/lib/proposals";

type Item = { description: string; quantity: number; unitPrice: number };

type Doc = {
  revision: number;
  type: string;
  title: string;
  treatment: string;
  clientName: string;
  siteLocation: string | null;
  showNorms: boolean;
  clientCity: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  intro: string;
  scope: string;
  included: string | null;
  notes: string | null;
  amount: number;
  amountLabel: string | null;
  deadline: string | null;
  paymentTerms: string | null;
  taxes: string | null;
  validityDays: number;
  signedBy: string | null;
  signerPhone: string | null;
  signerEmail: string | null;
  createdAt: Date;
};

// Quebra texto em linhas, ignorando vazias (usado nas listas com marcador).
const lines = (s: string | null) =>
  (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

// Documento da proposta no padrão DRR — é o que sai na impressão/PDF.
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
    <article className="proposal-doc mx-auto max-w-[820px] bg-white p-10 text-slate-800 shadow-sm print:p-0 print:shadow-none">
      {/* Cabeçalho da marca */}
      <header className="mb-8 flex items-center justify-between border-b-2 border-slate-300 pb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DRR Projetos" width={64} height={64} className="object-contain" />
          <div>
            <p className="text-lg font-bold text-slate-900">{COMPANY.name}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">{COMPANY.tagline}</p>
          </div>
        </div>
        <p className="text-right text-xs text-slate-500">{longDate(doc.createdAt)}</p>
      </header>

      {/* Destinatário */}
      <section className="mb-6">
        <p className="text-sm text-slate-500">{doc.treatment || "A"}</p>
        <p className="text-lg font-bold text-slate-900">{doc.clientName}</p>
        {doc.clientCity && <p className="text-sm text-slate-600">{doc.clientCity}</p>}
        {doc.contactName && <p className="mt-2 text-sm font-semibold text-slate-800">{doc.contactName}</p>}
        {doc.contactPhone && <p className="text-sm text-slate-600">Fone: {doc.contactPhone}</p>}
        {doc.contactEmail && <p className="text-sm text-slate-600">E-mail: {doc.contactEmail}</p>}
        {doc.siteLocation && (
          <p className="mt-2 text-sm text-slate-600">
            <strong>Local da obra:</strong> {doc.siteLocation}
          </p>
        )}
      </section>

      {/* Assunto */}
      <h1 className="mb-5 text-base font-bold italic text-slate-900">
        Proposta N° {proposalNumber(leadNumber, doc.revision, doc.type)} — {doc.title}
      </h1>

      <p className="mb-3 text-sm font-semibold text-slate-800">Prezados (as) Senhores (as),</p>
      <p className="mb-6 whitespace-pre-line text-sm leading-relaxed">{doc.intro}</p>

      {/* A. Escopo */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-sm font-bold text-slate-900">A. ESCOPO DOS SERVIÇOS</h2>
        <div className="whitespace-pre-line text-sm leading-relaxed">{doc.scope}</div>
      </section>

      {/* Itens (quando o orçamento tem itens) */}
      {items.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-bold text-slate-900">B. RELAÇÃO DE ITENS</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1 text-left font-semibold">Item</th>
                <th className="border border-slate-300 px-2 py-1 text-left font-semibold">Descrição</th>
                <th className="border border-slate-300 px-2 py-1 text-center font-semibold">Qtde</th>
                <th className="border border-slate-300 px-2 py-1 text-right font-semibold">V. unit.</th>
                <th className="border border-slate-300 px-2 py-1 text-right font-semibold">V. total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                  <td className="border border-slate-300 px-2 py-1">{it.description}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{it.quantity}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(it.unitPrice)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">
                    {formatCurrency(it.unitPrice * it.quantity)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="border border-slate-300 px-2 py-1 text-right" colSpan={4}>
                  TOTAL
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(itemsTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Valor */}
      <section className="mb-6 break-inside-avoid text-center">
        <p className="text-base font-bold text-slate-900">
          {doc.amountLabel ?? "VALOR TOTAL"} — {formatCurrency(total)}
        </p>
        <p className="text-xs text-slate-600">({currencyInWords(total)})</p>
        {doc.taxes && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{doc.taxes}</p>}
      </section>

      {/* Incluso no preço */}
      {lines(doc.included).length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Incluso no preço:</h3>
          <ul className="space-y-0.5 text-sm">
            {lines(doc.included).map((l, i) => (
              <li key={i}>✓ {l}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Condições */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-sm font-bold text-slate-900">C. CONDIÇÕES DE FORNECIMENTO</h2>
        {doc.deadline && (
          <p className="mb-2 text-sm">
            <strong>PRAZO:</strong> <span className="whitespace-pre-line">{doc.deadline}</span>
          </p>
        )}
        {doc.paymentTerms && (
          <p className="mb-2 text-sm">
            <strong>CONDIÇÕES DE PAGAMENTO:</strong>{" "}
            <span className="whitespace-pre-line">{doc.paymentTerms}</span>
          </p>
        )}
        <p className="text-sm">
          <strong>VALIDADE DA PROPOSTA:</strong> {doc.validityDays} dias a partir desta data.
        </p>
      </section>

      {/* Observações */}
      {lines(doc.notes).length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Observações:</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {lines(doc.notes).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Normas aplicadas (opcional) */}
      {doc.showNorms && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-bold text-slate-900">NORMAS APLICADAS:</h3>
          <table className="w-full border-collapse text-[10px] leading-tight">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">Nome / Código</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">Título</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">Origem</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">Objetivo</th>
              </tr>
            </thead>
            <tbody>
              {NORMAS_TABLE.map((n) => (
                <tr key={n.code}>
                  <td className="border border-slate-300 px-1.5 py-1 font-medium">{n.code}</td>
                  <td className="border border-slate-300 px-1.5 py-1">{n.title}</td>
                  <td className="border border-slate-300 px-1.5 py-1">{n.origin}</td>
                  <td className="border border-slate-300 px-1.5 py-1">{n.goal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Fecho e assinatura */}
      <section className="mt-10 break-inside-avoid">
        <p className="mb-6 text-sm">
          Sem mais para o momento, colocamo-nos à disposição para os esclarecimentos que se
          fizerem necessários.
        </p>
        <p className="mb-4 text-sm">Atenciosamente,</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={52} height={52} className="mb-1 object-contain" />
        <p className="text-sm font-bold italic text-slate-900">
          {doc.signedBy ?? "DRR Projetos"}
        </p>
        {doc.signerPhone && <p className="text-sm text-slate-600">Fone: {doc.signerPhone}</p>}
        {doc.signerEmail && <p className="text-sm text-slate-600">E-mail: {doc.signerEmail}</p>}
        <p className="mt-4 text-xs font-semibold italic text-green-700">
          Antes de imprimir, pense na responsabilidade com o meio ambiente.
        </p>
      </section>

      {/* Rodapé (repete em todas as páginas impressas) */}
      <div className="report-footer">
        <span>{COMPANY.city} — Fone: {COMPANY.phone}</span>
        <span>{COMPANY.email}</span>
        <span>{COMPANY.site}</span>
      </div>
    </article>
  );
}
