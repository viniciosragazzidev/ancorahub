import { NextRequest, NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { createAiRouter } from "@/features/ai-agent/model-router";

export const runtime = "nodejs";

/**
 * POST /api/qualificacao/simulador
 *
 * Chama o OpenRouter diretamente com resposta em TEXTO PURO (sem JSON estruturado).
 * O `generateAiResponse` não é usado aqui porque força o schema do WhatsApp (JSON rígido)
 * que quebra com qualquer campo fora do enum — inadequado para simulação conversacional.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getRequiredTenantContext();

    const body = (await req.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      memory: Record<string, string>;
    };

    const { messages, memory } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    // Roteador automático entre Groq e OpenRouter: se um provedor falhar,
    // o outro assume. Nunca fica sem resposta enquanto houver uma chave.
    const router = await createAiRouter(tenantId);
    if (router.providers.length === 0) {
      return NextResponse.json(
        { reply: "Nenhuma chave de IA configurada. Adicione GROQ_API_KEY ou OPENROUTER_API_KEY no .env.local para usar o simulador com IA real." },
        { status: 200 }
      );
    }

    // Load tenant config for assistant name and custom instructions
    let assistantName = "Assistente Virtual da Âncora Corretora";
    let customInstructions = "";
    let tenantBusinessContext = "Corretora especializada em planos de saúde individuais, familiares e empresariais. Trabalha com operadoras como Amil, SulAmérica, Bradesco Saúde e outras. Atende em todo o Brasil.";
    try {
      const settings = await getQualificationTenantSettings(tenantId);
      if (settings) {
        assistantName = settings.assistantName ?? assistantName;
        customInstructions = settings.customInstructions ?? "";
        if (settings.businessContext) tenantBusinessContext = settings.businessContext;
      }
    } catch {
      // Use defaults if config not found
    }

    const fieldOrder = ["nome", "plano", "vidas", "idade", "cidade", "email"] as const;
    const fieldLabels: Record<string, string> = {
      nome: "nome completo",
      plano: "tipo de plano (Individual, Familiar ou PME/Empresarial)",
      vidas: "quantidade de pessoas a incluir no plano",
      idade: "faixa etária das pessoas",
      cidade: "cidade e estado para contratação",
      email: "e-mail para envio da cotação comparativa",
    };

    // Build collected / missing field summary
    const collected = Object.entries(memory).filter(([, v]) => Boolean(v));
    const missing = fieldOrder.filter((f) => !memory[f]);
    const nextField = missing[0];

    const collectedBlock = collected.length > 0
      ? `\nCAMPOS JÁ COLETADOS (NÃO pergunte novamente):\n${collected.map(([k, v]) => `• ${fieldLabels[k] ?? k}: ${v}`).join("\n")}`
      : "";

    const nextHint = nextField
      ? `\nPRÓXIMA AÇÃO OBRIGATÓRIA: Pergunte sobre "${fieldLabels[nextField]}".`
      : `\nPRÓXIMA AÇÃO OBRIGATÓRIA: Todos os campos coletados. Confirme brevemente e avise que um corretor entrará em contato.`;

    const businessContext = `\nCONTEXTO DA CORRETORA (use para responder perguntas paralelas):\n${tenantBusinessContext}`;

    const systemPrompt = `Você é ${assistantName}, atendente virtual especialista em planos de saúde.
Você opera em 3 modos — alterne automaticamente conforme o contexto:

## MODO 1 — ROTEIRO (padrão)
Colete os campos abaixo em ordem, um por vez, de forma natural e conversacional:
1. nome completo
2. tipo de plano (Individual, Familiar ou PME/Empresarial)
3. quantidade de pessoas a incluir
4. faixa etária das pessoas
5. cidade e estado
6. e-mail para a cotação
${collectedBlock}${nextHint}

## MODO 2 — RESPOSTA LATERAL
Se o cliente fizer uma pergunta paralela (ex: "O que vocês oferecem?", "Qual o preço?", "Atendem onde?"):
- Responda em UMA frase curta usando o contexto da corretora abaixo.
- IMEDIATAMENTE depois, retome o roteiro com a próxima pergunta pendente.
- Se não souber responder (preços exatos, carências, condições específicas) → vá direto para o MODO 3.
${businessContext}

## MODO 3 — TRANSFERÊNCIA FLUIDA
Use quando:
• O cliente pergunta algo que você não sabe (preços, coberturas, carências)
• O cliente faz a mesma pergunta pela 2ª vez
• O cliente pede para falar com humano, corretor, atendente, pessoa

Resposta em 2 frases: (1) empatia + (2) "vou te conectar com um especialista agora".
Inclua [SOLICITOU_HUMANO] ao final (apenas para o sistema, invisível ao cliente).

REGRAS ABSOLUTAS:
- Máximo 2 frases por resposta
- NUNCA invente preços, mensalidades ou coberturas
- NUNCA repita perguntas já respondidas
- NUNCA abandone o roteiro sem razão
- Responda sempre em português brasileiro${customInstructions ? `\n\nINSTRUÇÕES ADICIONAIS:\n${customInstructions}` : ""}`;

    // O roteador tenta todos os provedores; se TODOS falharem, lança um erro.
    // Mantemos a resposta amigável (200) para o cliente, como no comportamento original.
    let result: Awaited<ReturnType<typeof router.call>>;
    try {
      result = await router.call({
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20), // Keep last 20 messages for context
        ],
        temperature: 0.7,
        maxTokens: 150, // Keep responses concise for WhatsApp style
      });
    } catch (aiError) {
      console.error("[simulador-api] todos os provedores de IA falharam", aiError);
      return NextResponse.json(
        { reply: "Não consegui conectar com a IA agora. Tente novamente em instantes." },
        { status: 200 }
      );
    }

    const data = (await result.response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const reply = data.choices?.[0]?.message?.content?.trim() ?? "Desculpe, não consegui gerar uma resposta. Tente novamente.";
    const modelUsed = data.model ?? result.model;

    return NextResponse.json({
      reply,
      modelUsed,
      latencyMs: 0,
      shouldTransferToHuman: false,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[simulador-api] unexpected error", msg);
    return NextResponse.json(
      { reply: "Erro interno no simulador. Verifique o console do servidor para detalhes.", error: msg },
      { status: 500 }
    );
  }
}
