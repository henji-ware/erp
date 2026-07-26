import { formatCurrency } from "@/lib/format";
import {
  COMPANY,
  FINDING_COLUMNS,
  GREETING_PADRAO,
  NORMAS_TABLE,
  currencyInWords,
  damageClass,
  longDate,
  parseFindings,
  proposalNumber,
  proposalPrice,
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
  greeting: string | null;
  intro: string;
  scope: string;
  findings: string | null;
  included: string | null;
  notes: string | null;
  amount: number;
  amountLabel: string | null;
  laborLabel: string | null;
  laborAmount: number;
  equipmentLabel: string | null;
  equipmentAmount: number;
  freightAmount: number;
  deadline: string | null;
  fabricationDeadline: string | null;
  schedule: string | null;
  paymentTerms: string | null;
  taxes: string | null;
  unloading: string | null;
  surfaceTreatment: string | null;
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

// Linha "Rótulo — R$ 0,00" da composição do preço.
function PriceLine({ label, value }: { label: string; value: number }) {
  return (
    <p className="text-[10.5pt]">
      <span className="font-semibold">{label}</span> — {formatCurrency(value)}
    </p>
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
  const price = proposalPrice(doc, itemsTotal, items.length > 0);
  const findings = parseFindings(doc.findings);

  // Colunas opcionais só aparecem quando alguma linha as preenche, para não
  // deixar colunas vazias na tabela impressa.
  const showCol = FINDING_COLUMNS.map((_, i) =>
    findings.some((f) => [f.aisle, f.location, f.level, f.maker, f.component, f.damage, f.action][i]),
  );

  // O preço é detalhado quando tem mais de uma parcela (mão de obra, PTA,
  // frete, componentes); com uma só, mostra apenas o total.
  const parts = [price.labor, price.equipment, price.freight, price.components].filter(
    (v) => v > 0,
  );
  const showBreakdown = parts.length > 1;

  // Letras das seções (A, B, C…) conforme os blocos que a proposta usa.
  let letters = 0;
  const nextLetter = () => String.fromCharCode(65 + letters++);
  const scopeLetter = nextLetter();
  const findingsLetter = findings.length > 0 ? nextLetter() : null;
  const itemsLetter = items.length > 0 ? nextLetter() : null;
  const priceLetter = nextLetter();
  const conditionsLetter = nextLetter();

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

        <p className="mb-3 text-[10.5pt] font-bold text-slate-900">
          {doc.greeting || GREETING_PADRAO}
        </p>
        <p className="mb-6 whitespace-pre-line text-justify text-[10.5pt] leading-relaxed">
          {doc.intro}
        </p>

        {doc.siteLocation && (
          <p className="mb-5 text-[10.5pt]">
            <strong>Local da obra:</strong> {doc.siteLocation}
          </p>
        )}

        {/* Escopo — pode ser longo, então quebra livremente entre páginas */}
        <section className="mb-6">
          <h2 className="mb-2 text-[11pt] font-bold text-slate-900">
            {scopeLetter}. DESCRIÇÃO DOS SERVIÇOS
          </h2>
          <div className="whitespace-pre-line text-justify text-[10.5pt] leading-relaxed">
            {doc.scope}
          </div>
        </section>

        {/* Não conformidades levantadas na inspeção */}
        {findingsLetter && (
          <section className="mb-6">
            <h2 className="mb-2 text-[11pt] font-bold text-slate-900">
              {findingsLetter}. RELAÇÃO DE NÃO CONFORMIDADES
            </h2>
            <table className="proposal-table">
              <thead>
                <tr>
                  {FINDING_COLUMNS.map((c, i) =>
                    showCol[i] ? <th key={c}>{c}</th> : null,
                  )}
                </tr>
              </thead>
              <tbody>
                {findings.map((f, i) => {
                  const cells = [
                    f.aisle,
                    f.location,
                    f.level,
                    f.maker,
                    f.component,
                    f.damage,
                    f.action,
                  ];
                  return (
                    <tr key={i}>
                      {cells.map((v, c) =>
                        showCol[c] ? (
                          <td
                            key={c}
                            className={`text-center ${c === 5 ? damageClass(v) : ""}`}
                          >
                            {v}
                          </td>
                        ) : null,
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-[9pt] text-slate-600">
              Total de {findings.length}{" "}
              {findings.length === 1 ? "não conformidade" : "não conformidades"} relacionadas.
            </p>
          </section>
        )}

        {/* Itens — a tabela quebra entre páginas repetindo o cabeçalho */}
        {itemsLetter && (
          <section className="mb-6">
            <h2 className="mb-2 text-[11pt] font-bold text-slate-900">
              {itemsLetter}. LISTA DE COMPONENTES
            </h2>
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
                  <td colSpan={4} className="text-right">TOTAL DOS COMPONENTES</td>
                  <td className="text-right">{formatCurrency(itemsTotal)}</td>
                </tr>
              </tbody>
            </table>
            {doc.ncm && <p className="mt-1 text-[9pt] text-slate-600">NCM: {doc.ncm}</p>}
          </section>
        )}

        {/* Composição do preço */}
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-[11pt] font-bold text-slate-900">
            {priceLetter}. VALOR DOS SERVIÇOS
          </h2>
          {showBreakdown && (
            <div className="mb-3 space-y-1">
              {price.labor > 0 && (
                <PriceLine label={doc.laborLabel ?? "Mão de obra"} value={price.labor} />
              )}
              {price.equipment > 0 && (
                <PriceLine
                  label={doc.equipmentLabel ?? "Locação de equipamento"}
                  value={price.equipment}
                />
              )}
              {price.freight > 0 && <PriceLine label="Frete" value={price.freight} />}
              {price.components > 0 && (
                <PriceLine label="Fornecimento de componentes" value={price.components} />
              )}
            </div>
          )}
          <div className="text-center">
            <p className="text-[12pt] font-bold text-slate-900">
              {doc.amountLabel ?? "VALOR TOTAL"} — {formatCurrency(price.total)}
            </p>
            <p className="text-[10pt] font-semibold">({currencyInWords(price.total)})</p>
            {/* Os impostos são detalhados em CONDIÇÕES GERAIS, sem repetir aqui. */}
          </div>
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
          <h2 className="mb-2 text-[11pt] font-bold text-slate-900">
            {conditionsLetter}. CONDIÇÕES DE FORNECIMENTO
          </h2>
          <Field label="IMPOSTOS" value={doc.taxes} />
          <Field label="CONDIÇÕES DE PAGAMENTO" value={doc.paymentTerms} />
          <Field label="PRAZO PARA FABRICAÇÃO" value={doc.fabricationDeadline} />
          <Field label="PRAZO PARA EXECUÇÃO DOS SERVIÇOS" value={doc.deadline} />
          <Field label="CRONOGRAMA" value={doc.schedule} />
          <Field label="DESCARGA DO MATERIAL" value={doc.unloading} />
          <Field label="GARANTIA" value={doc.warranty} />
          <Field label="PISO" value={doc.floorNote} />
          <Field label="TRATAMENTO DE SUPERFÍCIE E PINTURA" value={doc.surfaceTreatment} />
          <Field label="CORES" value={doc.colors} />
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
