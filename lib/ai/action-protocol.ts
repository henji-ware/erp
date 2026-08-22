// Protocolo das ações do DeskHelper AI — parte pura, sem banco.
//
// Como funciona: o modelo NÃO executa nada. Quando o usuário pede para criar
// algo, o modelo devolve um bloco cercado ```drr-acao com um JSON. A tela lê
// esse bloco, mostra um cartão de confirmação, e só depois do clique o
// servidor valida e grava.
//
// A cerca exata é parte da segurança: um JSON solto no meio de uma resposta
// (ou colado pelo usuário numa pergunta) nunca vira ação, porque não está
// dentro de ```drr-acao. E o bloco sozinho não escreve nada — quem escreve é
// /api/ai/action, que revalida tudo do zero.

/**
 * ATENÇÃO: se mudar isto, mude também as regexes lá embaixo — elas são
 * literais (`/```drr-acao.../`) e não interpolam a constante. É de propósito:
 * montar a regex por concatenação exige escapar barras duas vezes, e um `\\s`
 * que vira `\s` no caminho produz uma regex que casa a letra "s" e nunca o
 * bloco — falha silenciosa, sem erro de compilação.
 */
export const ACTION_FENCE = "drr-acao";

export const AI_ACTION_KINDS = [
  "criar_cliente",
  "criar_orcamento",
  "criar_inspecao",
  "criar_agendamento",
  "criar_lancamento",
  "criar_pedido",
] as const;

export type AIActionKind = (typeof AI_ACTION_KINDS)[number];

export function isActionKind(v: unknown): v is AIActionKind {
  return typeof v === "string" && (AI_ACTION_KINDS as readonly string[]).includes(v);
}

export const ACTION_LABELS: Record<AIActionKind, string> = {
  criar_cliente: "Criar cliente",
  criar_orcamento: "Criar orçamento",
  criar_inspecao: "Agendar inspeção",
  criar_agendamento: "Criar agendamento",
  criar_lancamento: "Criar lançamento financeiro",
  criar_pedido: "Criar pedido (rascunho)",
};

/** Como cada campo aparece no cartão de confirmação. */
export const FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  email: "E-mail",
  telefone: "Telefone",
  empresa: "Empresa",
  documento: "CPF/CNPJ",
  endereco: "Endereço",
  observacoes: "Observações",
  origem: "Origem",
  valor: "Valor",
  clienteId: "Cliente",
  fornecedorId: "Fornecedor",
  funcionarioId: "Responsável",
  titulo: "Título",
  tipo: "Tipo",
  inicio: "Início",
  local: "Local",
  engenheiro: "Engenheiro",
  art: "ART",
  nivelRisco: "Nível de risco",
  constatacoes: "Constatações",
  descricao: "Descrição",
  vencimento: "Vencimento",
  parcelas: "Parcelas",
  itens: "Itens",
  referencia: "Referência",
};

export interface ParsedAction {
  kind: AIActionKind;
  data: Record<string, unknown>;
}

/**
 * Separa o texto conversável dos blocos de ação.
 *
 * Devolve o texto já SEM os blocos: eles viram cartão, não código na tela.
 * Blocos malformados são descartados em silêncio — um JSON quebrado é falha
 * do modelo, e mostrar o erro cru para o usuário não ajuda em nada.
 */
export function extractActions(text: string): {
  text: string;
  actions: ParsedAction[];
} {
  // Literal de regex de propósito: montar isto com `new RegExp("...")` exige
  // escapar as barras duas vezes, e um `\\s` que vira `\s` no meio do
  // caminho produz uma regex que casa a letra "s" e nunca o bloco.
  const pattern = /```drr-acao\s*([\s\S]*?)```/g;
  const actions: ParsedAction[] = [];

  const cleaned = text.replace(pattern, (_full, body: string) => {
    try {
      const parsed = JSON.parse(body.trim());
      const kind = parsed?.acao;
      const data = parsed?.dados;
      if (isActionKind(kind) && data && typeof data === "object" && !Array.isArray(data)) {
        actions.push({ kind, data: data as Record<string, unknown> });
      }
    } catch {
      /* bloco inválido: some da tela, não vira ação */
    }
    return "";
  });

  return { text: cleaned.trim(), actions };
}

/**
 * Bloco ainda aberto durante o streaming. Enquanto a resposta chega em
 * pedaços, uma cerca sem fechamento apareceria como JSON cru rolando na
 * tela — isto detecta o caso para a UI esconder o trecho.
 */
export function hasUnclosedAction(text: string): boolean {
  const opens = text.split("```" + ACTION_FENCE).length - 1;
  if (opens === 0) return false;
  const closed = (text.match(/```drr-acao[\s\S]*?```/g) ?? []).length;
  return opens > closed;
}

/** Corta o bloco aberto do fim do texto, para o streaming não mostrar JSON. */
export function stripUnclosedAction(text: string): string {
  const idx = text.lastIndexOf("```" + ACTION_FENCE);
  return idx === -1 ? text : text.slice(0, idx).trimEnd();
}
