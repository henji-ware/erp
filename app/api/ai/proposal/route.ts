import { NextRequest, NextResponse } from "next/server";
import { executeAICompletion } from "@/lib/ai/client";
import { errorMessage, requireUser } from "@/lib/ai/guard";
import { isAdmin } from "@/lib/auth";
import { AIProviderId } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

type GenerationType = "scope" | "commercial" | "findings" | "full";

const SYSTEM_PROMPT = `Você é um engenheiro sênior e consultor técnico comercial da DRR Projetos e Equipamentos, especializado em estruturas de armazenagem logística (porta-paletes, mezaninos, gradil NR12, wire deck, inspeções periódicas conforme ABNT NBR 15524, montagem e locação de plataformas PTA).

Redija textos técnicos claros, profissionais e persuasivos, com rigor às normas de engenharia e segurança.

Regras de saída:
- Escreva em Português do Brasil.
- Entregue apenas o texto final, pronto para colar na proposta. Sem preâmbulo, sem "Aqui está...", sem comentários sobre o que você fez.
- Não invente prazos, preços, garantias ou números que não estejam nos dados fornecidos.`;

function buildPrompt(type: GenerationType, data: Record<string, any>): string {
  const itemsSummary = (Array.isArray(data.items) ? data.items : [])
    .map((it: any) => `- ${it?.quantity ?? "?"}x ${it?.description ?? "item sem descrição"}`)
    .join("\n");

  const extra = data.customInstructions
    ? `\n- Instruções adicionais do vendedor: ${data.customInstructions}`
    : "";

  if (type === "scope") {
    return `Elabore um ESCOPO TÉCNICO DETALHADO para uma proposta comercial da DRR:
- Tipo de serviço: ${data.proposalType}
- Cliente: ${data.clientName}
- Título da proposta: ${data.title}
- Itens/componentes envolvidos:
${itemsSummary || "Serviço técnico geral"}${data.currentScope ? `\n- Escopo base atual:\n${data.currentScope}` : ""}${extra}

REQUISITOS:
1. Divida em etapas numeradas (Mobilização, Execução Técnica, Normas de Segurança, Inspeção Final, Entrega Técnica).
2. Se envolver porta-paletes, cite as boas práticas e o alinhamento com a ABNT NBR 15524.
3. Se envolver proteção ou gradil, cite a adequação à NR12.
4. Texto limpo, pronto para o campo de Escopo da proposta.`;
  }

  if (type === "commercial") {
    return `Elabore as CONDIÇÕES E JUSTIFICATIVAS COMERCIAIS desta proposta:
- Tipo: ${data.proposalType}
- Cliente: ${data.clientName}
- Título: ${data.title}${extra}

Gere:
1. Justificativa comercial destacando a experiência da DRR, equipe de engenharia habilitada e segurança operacional.
2. Cláusulas claras de Garantia e Responsabilidade.`;
  }

  if (type === "findings") {
    return `Analise as NÃO CONFORMIDADES identificadas em vistoria técnica de estruturas de armazenagem:
${data.findings || data.customInstructions || "Nenhuma não conformidade informada."}

Para cada item, indique:
1. Gravidade do risco (Verde: baixo/monitorar; Amarelo: médio/corrigir em até 4 semanas; Vermelho: alto/descarregar imediatamente).
2. Ação corretiva recomendada (substituição de montante, troca de longarina, trava de segurança, reforço de chapa de base).
3. Componentes e serviços sugeridos para o orçamento de recuperação.

Apresente como lista categorizada por gravidade.`;
  }

  return `Revise e aprimore o texto abaixo para deixá-lo altamente profissional, mantendo todos os fatos, números e compromissos exatamente como estão:

${data.customInstructions || data.currentScope || "(nenhum texto informado)"}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const type: GenerationType = ["scope", "commercial", "findings", "full"].includes(body.type)
      ? body.type
      : "full";

    const completion = await executeAICompletion({
      provider: (body.provider as AIProviderId) || undefined,
      model: typeof body.model === "string" ? body.model : undefined,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      messages: [{ role: "user", content: buildPrompt(type, body) }],
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 2500,
      signal: req.signal,
      isAdmin: isAdmin(auth.user),
    });

    return NextResponse.json({
      ok: true,
      text: completion.text,
      provider: completion.provider,
      model: completion.model,
      latencyMs: completion.latencyMs,
    });
  } catch (error) {
    console.error("[API Proposal AI Error]:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Falha ao gerar texto com IA para a proposta.") },
      { status: 500 }
    );
  }
}
