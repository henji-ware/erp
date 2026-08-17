import { NextRequest, NextResponse } from "next/server";
import { executeAICompletion } from "@/lib/ai/client";
import { AIProviderId } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type, // 'scope' | 'commercial' | 'findings' | 'full'
      proposalType, // 'INSPECAO' | 'MONTAGEM' | 'REMANEJAMENTO' | 'MATERIAL' | 'LOCACAO' | 'PROJETO'
      clientName,
      title,
      items,
      customInstructions,
      currentScope,
      findings,
      provider,
      model,
      apiKey,
      baseUrl,
    } = body;

    const itemsSummary = (items || [])
      .map((it: any) => `- ${it.quantity}x ${it.description}`)
      .join("\n");

    let prompt = "";
    let systemPrompt = `Você é um engenheiro sênior e consultor técnico comercial especializado em estruturas de armazenagem logística da DRR Projetos e Equipamentos (porta-paletes, mezaninos, gradil NR12, wire deck, inspeções periódicas conforme ABNT NBR 15524, montagem e locações de plataformas PTA).

Seu objetivo é redigir textos técnicos claros, profissionais, persuasivos e com estrito rigor às normas de engenharia e segurança.`;

    if (type === "scope") {
      prompt = `Elabore um ESCOPO TÉCNICO DETALHADO E PROFISSIONAL para uma proposta comercial da DRR:
- Tipo de Serviço: ${proposalType}
- Cliente: ${clientName}
- Título da Proposta: ${title}
- Itens/Componentes Fornecidos ou Envolvidos:
${itemsSummary || "Serviço técnico geral"}
${currentScope ? `\n- Escopo Base Atual:\n${currentScope}` : ""}
${customInstructions ? `\n- Instruções Adicionais do Vendedor: ${customInstructions}` : ""}

REQUISITOS DO ESCOPO:
1. Divida em itens numerados ou etapas claras (Mobilização, Execução Técnica, Normas de Segurança, Inspeção Final/Testes, Entrega Técnica).
2. Se envolver porta-paletes, mencione as boas práticas e alinhamento com a norma ABNT NBR 15524.
3. Se envolver NR12 ou proteção, mencione adequação às normas regulamentadoras.
4. Formate como texto limpo, pronto para ser inserido no campo de Escopo da proposta comercial da DRR.`;
    } else if (type === "commercial") {
      prompt = `Elabore as CONDIÇÕES E JUSTIFICATIVAS COMERCIAIS para a seguinte proposta:
- Tipo: ${proposalType}
- Cliente: ${clientName}
- Título: ${title}
${customInstructions ? `- Instruções Adicionais: ${customInstructions}` : ""}

Gere:
1. Uma justificativa comercial de alto valor destacando a experiência da DRR, equipe de engenharia habilitada e segurança operacional.
2. Sugestão de cláusulas claras de Garantia e Responsabilidade.`;
    } else if (type === "findings") {
      prompt = `Analise as seguintes NÃO CONFORMIDADES identificadas em vistoria técnica de estruturas de armazenagem:
${findings || customInstructions}

Gere uma tabela estruturada ou lista categorizada indicando:
1. Gravidade do Risco (Verde: Baixo/Monitorar, Amarelo: Médio/Corrigir em 4 semanas, Vermelho: Alto/Descarregar Imediatamente conforme norma).
2. Ação Corretiva Recomendada (Substituição de montante, troca de longarina, instalação de trava de segurança, reforço de chapa de base).
3. Componentes e serviços sugeridos para o orçamento de recuperação.`;
    } else {
      prompt = `Aprimore e revise o seguinte texto da proposta comercial para deixá-lo altamente profissional:
${customInstructions || currentScope}`;
    }

    const completion = await executeAICompletion({
      provider: (provider as AIProviderId) || "gemini",
      model,
      apiKey,
      baseUrl,
      messages: [{ role: "user", content: prompt }],
      systemPrompt,
      temperature: 0.4,
      maxTokens: 2500,
    });

    return NextResponse.json({
      ok: true,
      text: completion.text,
      provider: completion.provider,
      model: completion.model,
      latencyMs: completion.latencyMs,
    });
  } catch (error: any) {
    console.error("[API Proposal AI Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Falha ao gerar texto com IA para a proposta." },
      { status: 500 }
    );
  }
}
