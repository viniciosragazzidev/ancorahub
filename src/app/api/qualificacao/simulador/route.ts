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
    const lower = lastUserMsg.toLowerCase().trim();

    // Auto-extrair na memória do servidor caso o cliente envie valores diretos
    const mergedMemory: Record<string, string> = { ...memory };
    if (!mergedMemory.nome && !lower.includes("plano") && !lower.includes("quanto") && !lower.includes("hospital") && lower.length >= 2 && lower.length <= 40 && !/\d/.test(lower) && !lower.includes("@")) {
      const nameMatch = lastUserMsg.match(/(?:meu nome e|meu nome é|me chamo|sou o|sou a|eu sou|me chamo de)\s+([A-ZÀ-Úa-zà-ú\s]+)/i);
      mergedMemory.nome = nameMatch?.[1] ? nameMatch[1].trim() : lastUserMsg.trim();
    }
    if (/\b(individual|pf|para mim|so para mim|só para mim)\b/i.test(lower)) {
      mergedMemory.plano = "Individual";
    } else if (/\b(familiar|familia|família)\b/i.test(lower)) {
      mergedMemory.plano = "Familiar";
    } else if (/\b(pme|pj|empresarial|empresa|cnpj)\b/i.test(lower)) {
      mergedMemory.plano = "Empresarial";
    }
    const livesMatch = lastUserMsg.match(/(\d+)\s*(?:pessoas|vidas|dependentes)?/i);
    if (livesMatch?.[1]) {
      mergedMemory.vidas = `${livesMatch[1]} pessoas`;
    }
    const ageMatch = lastUserMsg.match(/(\d+)\s*(?:anos|ano)/i);
    if (ageMatch?.[1]) {
      mergedMemory.idade = `${ageMatch[1]} anos`;
    } else if (!mergedMemory.idade && mergedMemory.vidas && /^\d{1,2}$/.test(lastUserMsg.trim())) {
      mergedMemory.idade = `${lastUserMsg.trim()} anos`;
    }
    const emailMatch = lastUserMsg.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch?.[1]) {
      mergedMemory.email = emailMatch[1].trim();
    }

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

    const collected = Object.entries(mergedMemory).filter(([, v]) => Boolean(v));
    const missing = fieldOrder.filter((f) => !mergedMemory[f]);
    const nextField = missing[0];

    const collectedBlock = collected.length > 0
      ? `\nCAMPOS JÁ COLETADOS (NÃO pergunte novamente):\n${collected.map(([k, v]) => `• ${fieldLabels[k] ?? k}: ${v}`).join("\n")}`
      : "";

    const nextHint = nextField
      ? `\nPRÓXIMA AÇÃO OBRIGATÓRIA: Pergunte sobre "${fieldLabels[nextField]}".`
      : `\nPRÓXIMA AÇÃO OBRIGATÓRIA: Todos os campos coletados. Confirme brevemente e avise que um corretor entrará em contato.`;

    const situationalSection = buildSituationalPromptSection({
      playbooks,
      variables: {
        assistente_nome: assistantName,
        corretora_nome: "Âncora Corretora",
        cliente_nome: mergedMemory.nome,
      },
    });

    const systemPrompt = `Você é ${assistantName}, atendente virtual especialista em planos de saúde da Âncora Corretora.
Sua missão é atender leads de forma acolhedora, humana e fluida no WhatsApp.

═══════════════════════════════════════════════
MODO DE OPERAÇÃO
═══════════════════════════════════════════════

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
- Responda em UMA frase curta usando o contexto da corretora.
- IMEDIATAMENTE depois, retome o roteiro com a próxima pergunta pendente.

## MODO 3 — TRANSFERÊNCIA FLUIDA
Se o cliente pedir para falar com humano ou atendente:
- Responda com empatia e avise que vai transferir agora [SOLICITOU_HUMANO].

REGRAS ABSOLUTAS:
- Máximo 2 frases por resposta
- NUNCA invente preços exatos
- NUNCA repita perguntas já respondidas
- Responda sempre em português brasileiro

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
            shouldTransferToHuman: reply.includes("[SOLICITOU_HUMANO]"),
          });
        }
      } catch (aiError) {
        console.warn("[simulador-api] Provedores externos indisponíveis, ativando fallback situacional:", aiError);
      }
    }

    // Fallback inteligente baseado em Roteiros Situacionais e Memória Contextual
    const matched = matchBestPlaybook(lastUserMsg, playbooks);
    let fallbackReply = "";

    if (matched && (lower.includes("quanto") || lower.includes("hospital") || lower.includes("preco") || lower.includes("preço") || lower.includes("atendente") || lower.includes("humano"))) {
      fallbackReply = interpolatePlaybookVariables(matched.recommendedResponse, {
        assistente_nome: assistantName,
        cliente_nome: mergedMemory.nome || "cliente",
        corretora_nome: "Âncora Corretora",
      });
    } else if (lower.includes("diferen") || lower.includes("como funciona") || lower.includes("o que é") || lower.includes("o que e")) {
      fallbackReply = `O plano Individual é para você (pessoa física), o Familiar inclui dependentes, e o Empresarial (PME) é contratado via CNPJ ou MEI com valores até 30% mais acessíveis! Qual dessas modalidades você gostaria de simular?`;
    } else if (!mergedMemory.nome) {
      fallbackReply = `Olá! Tudo bem? Sou a ${assistantName} da Âncora Corretora. Que ótimo falar com você! Para eu te passar as melhores opções de planos e valores, como posso te chamar?`;
    } else if (!mergedMemory.plano) {
      fallbackReply = `Perfeito, ${mergedMemory.nome}! Você busca um plano Individual, Familiar ou Empresarial (CNPJ)?`;
    } else if (!mergedMemory.vidas) {

      fallbackReply = `Entendido! Quantas pessoas no total utilizarão o plano?`;
    } else if (!mergedMemory.idade) {
      fallbackReply = `E quais seriam as idades aproximadas de cada pessoa?`;
    } else if (!mergedMemory.cidade) {
      fallbackReply = `Em qual cidade você busca atendimento para verificarmos a rede credenciada de hospitais?`;
    } else if (!mergedMemory.email) {
      fallbackReply = `Qual é o seu melhor e-mail para enviarmos a cotação comparativa?`;
    } else {
      fallbackReply = `Excelente, ${mergedMemory.nome}! Já anotei todas as informações. Vou conectar você agora com um dos nossos corretores especialistas para te passar a tabela completa!`;
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
