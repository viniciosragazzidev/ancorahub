import { NextRequest, NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { getTenantPlaybooks } from "@/features/ai-qualification/playbooks-storage";
import {
  matchBestPlaybook,
  buildSituationalPromptSection,
} from "@/features/ai-qualification/situational-response-engine";
import { interpolatePlaybookVariables } from "@/features/ai-qualification/situations-catalog";
import { createAiRouter } from "@/features/ai-agent/model-router";

export const runtime = "nodejs";

/**
 * POST /api/qualificacao/simulador
 *
 * Rota do simulador web de atendimento e qualificação da IA.
 * Executa chamada aos LLMs configurados com suporte aos roteiros situacionais e
 * fallback inteligente de alta resiliência.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getRequiredTenantContext();

    const body = (await req.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      memory: Record<string, string>;
    };

    const { messages, memory = {} } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content ?? "";

    // Load tenant config and playbooks
    let assistantName = "Ana";
    let customInstructions = "";
    let tenantBusinessContext = "Corretora especializada em planos de saúde individuais, familiares e empresariais. Trabalha com operadoras como Amil, SulAmérica, Bradesco Saúde, Porto Seguro e outras. Atende em todo o Brasil.";

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

    const playbooks = await getTenantPlaybooks(tenantId);

    const fieldOrder = ["nome", "plano", "vidas", "idade", "cidade", "email"] as const;
    const fieldLabels: Record<string, string> = {
      nome: "nome completo ou primeiro nome",
      plano: "tipo de plano (Individual, Familiar ou PME/Empresarial)",
      vidas: "quantidade de pessoas a incluir no plano",
      idade: "faixa etária das pessoas",
      cidade: "cidade e estado para contratação",
      email: "e-mail para envio da cotação comparativa",
    };

    const collected = Object.entries(memory).filter(([, v]) => Boolean(v));
    const missing = fieldOrder.filter((f) => !memory[f]);
    const nextField = missing[0];

    const collectedBlock = collected.length > 0
      ? `\nCAMPOS JÁ COLETADOS (NÃO pergunte novamente):\n${collected.map(([k, v]) => `• ${fieldLabels[k] ?? k}: ${v}`).join("\n")}`
      : "";

    const nextHint = nextField
      ? `\nPRÓXIMA AÇÃO: Cumprimente e pergunte sobre "${fieldLabels[nextField]}" de forma empática.`
      : `\nPRÓXIMA AÇÃO: Todos os campos coletados. Agradeça e avise que um corretor especialista entrará em contato.`;

    const situationalSection = buildSituationalPromptSection({
      playbooks,
      variables: {
        assistente_nome: assistantName,
        corretora_nome: "Âncora Corretora",
        cliente_nome: memory.nome,
      },
    });

    const systemPrompt = `Você é ${assistantName}, atendente virtual consultiva da Âncora Corretora especialista em planos de saúde.
Sua missão é atender leads de forma acolhedora, humana e fluida no WhatsApp.

═══════════════════════════════════════════════
DIRETRIZES FUNDAMENTAIS
═══════════════════════════════════════════════
- Ao iniciar uma conversa direta, NUNCA faça perguntas secas como "Qual seu nome completo?". Apresente-se cordialmente e pergunte com carinho como pode chamar o cliente.
- Se o cliente fizer perguntas sobre preços, explique educadamente que o valor depende de idade/cidade e pergunte a quantidade de pessoas.
- Responda em no máximo 2 frases por mensagem.
${collectedBlock}${nextHint}

${situationalSection}

${customInstructions ? `\n\nINSTRUÇÕES ADICIONAIS:\n${customInstructions}` : ""}`;

    // Roteador automático entre Groq e OpenRouter
    let router: Awaited<ReturnType<typeof createAiRouter>> | null = null;
    try {
      router = await createAiRouter(tenantId);
    } catch {
      router = null;
    }

    if (router && router.providers.length > 0) {
      try {
        const result = await router.call({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(-15),
          ],
          temperature: 0.7,
          maxTokens: 180,
        });

        const data = (await result.response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          model?: string;
        };

        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          return NextResponse.json({
            reply,
            modelUsed: data.model ?? result.model,
            latencyMs: 0,
            shouldTransferToHuman: false,
          });
        }
      } catch (aiError) {
        console.warn("[simulador-api] Provedores externos indisponíveis, ativando fallback situacional:", aiError);
      }
    }

    // Fallback inteligente baseado em Roteiros Situacionais e Memória Contextual
    const matched = matchBestPlaybook(lastUserMsg, playbooks);
    let fallbackReply = "";

    if (matched) {
      fallbackReply = interpolatePlaybookVariables(matched.recommendedResponse, {
        assistente_nome: assistantName,
        cliente_nome: memory.nome || "cliente",
        corretora_nome: "Âncora Corretora",
      });
    } else if (!memory.nome) {
      fallbackReply = `Olá! Tudo bem? Sou a ${assistantName} da Âncora Corretora. Que ótimo falar com você! Para eu te passar as melhores opções de planos e valores, como posso te chamar?`;
    } else if (!memory.plano) {
      fallbackReply = `Perfeito, ${memory.nome}! Você busca um plano Individual, Familiar ou Empresarial (CNPJ)?`;
    } else if (!memory.vidas) {
      fallbackReply = `Entendido! Quantas pessoas no total utilizarão o plano?`;
    } else if (!memory.idade) {
      fallbackReply = `E quais seriam as idades aproximadas de cada pessoa?`;
    } else if (!memory.cidade) {
      fallbackReply = `Em qual cidade você busca atendimento para verificarmos a rede credenciada de hospitais?`;
    } else {
      fallbackReply = `Excelente, ${memory.nome}! Já anotei todas as informações. Vou conectar você agora com um dos nossos corretores especialistas para te passar a tabela completa!`;
    }

    return NextResponse.json({
      reply: fallbackReply,
      modelUsed: "situational-engine/fallback",
      latencyMs: 10,
      shouldTransferToHuman: false,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[simulador-api] unexpected error", msg);
    return NextResponse.json(
      { reply: "Olá! Tudo bem? Sou a assistente da Âncora Corretora. Como posso te ajudar hoje?" },
      { status: 200 }
    );
  }
}
