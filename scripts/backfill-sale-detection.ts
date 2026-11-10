import { loadEnvConfig } from "@next/env";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getDatabase, schema } from "@/shared/db";
import { runGateway } from "@/features/ai-gateway/gateway";
import { conversationMessageBody } from "@/features/conversations/message-media-text";
import { getAiStageMode } from "@/features/conversation-intelligence/stage-mode";
import {
  aiSaleMarkerStatus,
  mergeSaleCompletedWithExplicitEvidence,
  readSaleCompleted,
  readValidatedPaymentEvidence,
  normalizeEvidenceText,
  saleEvidenceProven,
  selectSaleDetectionTranscript,
  validateSaleEvidence,
  SaleCompletedSchema,
} from "@/features/conversation-intelligence/sale-detection-core";
import { applyAiSaleDetection, notifyAiSaleDetected, notifyAiSaleSuggested } from "@/features/conversation-intelligence/sale-detection";
import { recentlyUndoneAiMove, type AiAutoMove } from "@/features/conversation-intelligence/ai-move";
import { maskPersonalData } from "@/features/ai-gateway/privacy";

loadEnvConfig(process.cwd());

const CLOSING_STATUSES = ["documentation_pending", "under_analysis"] as const;
const RECENT_MESSAGE_COUNT = 12;
const EVIDENCE_WINDOW_DAYS = 30;

type Candidate = {
  id: string;
  tenantId: string;
  name: string;
  status: string;
  version: number;
  brokerId: string | null;
  brokerName: string | null;
  qualificationDetails: unknown;
};

const prompt = `Classifique apenas se a venda foi concluída, com prudência. Responda JSON no schema fornecido.
confirmed exige trecho literal que exista na transcrição e prova forte: pagamento feito, proposta transmitida, entrevista médica ou videochamada da operadora concluída (sinal interview), ou número de proposta/carteirinha emitido. O sinal interview vale quando cliente ou corretor afirma a conclusão como fato. Não conte pergunta, negativa, tentativa ou ação futura. Normalizar erros comuns como "videio chamanda" para videochamada.
medical_interview_approved significa aprovação explícita, mas sozinha não prova venda. contrato assinado também não basta sozinho. likely é indício não concluído. no é ausência de indício.
Copie no máximo 5 evidências literalmente, com prefixo Cliente: ou Corretor:. Não invente, não resuma, não inclua mensagens do sistema. `;

function parseArgs(args: string[]) {
  const apply = args.includes("--apply");
  const leadIdArg = args.find((arg) => arg.startsWith("--lead-id="))?.slice("--lead-id=".length);
  const leadIdIndex = args.indexOf("--lead-id");
  const leadId = leadIdArg ?? (leadIdIndex >= 0 ? args[leadIdIndex + 1] : undefined);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Uso: npx tsx scripts/backfill-sale-detection.ts [--lead-id UUID] [--transcript-only] [--apply]");
    console.log("Padrão: dry-run. --apply aplica somente resultados confirmed pelo fluxo normal de venda.");
    console.log("PowerShell: defina NODE_PATH=node_modules/next/dist/compiled e NODE_OPTIONS=--conditions=react-server antes de chamar tsx.");
    process.exit(0);
  }
  if (leadId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(leadId)) {
    throw new Error("--lead-id precisa ser um UUID válido.");
  }
  return { apply, leadId, transcriptOnly: args.includes("--transcript-only") };
}

function formatMessageDate(timestamp: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(timestamp).replace(",", "");
}

function evidenceTimestamp(quote: string, sender: "customer" | "broker", transcript: Awaited<ReturnType<typeof loadTranscript>>) {
  const quoteText = quote.replace(/^(cliente|corretora?)\s*:\s*/i, "");
  const normalizedQuote = normalizeEvidenceText(quoteText);
  const exact = transcript.find((message) => message.sender === sender && normalizeEvidenceText(message.text).includes(normalizedQuote));
  if (exact) return formatMessageDate(exact.timestamp);
  const tokens = normalizedQuote.split(" ").filter(Boolean);
  const close = transcript.find((message) => {
    if (message.sender !== sender || tokens.length < 3) return false;
    const messageTokens = new Set(normalizeEvidenceText(message.text).split(" "));
    return tokens.filter((token) => messageTokens.has(token)).length / tokens.length >= 0.8;
  });
  return close ? formatMessageDate(close.timestamp) : "data não localizada";
}

async function loadCandidates(leadId?: string): Promise<Candidate[]> {
  const db = getDatabase();
  const conditions = [
    inArray(schema.leads.status, [...CLOSING_STATUSES]),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
  ];
  if (leadId) conditions.push(eq(schema.leads.id, leadId));

  return db.select({
    id: schema.leads.id,
    tenantId: schema.leads.tenantId,
    name: schema.leads.nome,
    status: schema.leads.status,
    version: schema.leads.version,
    brokerId: schema.leads.corretorId,
    brokerName: schema.user.name,
    qualificationDetails: schema.leads.qualificationDetails,
  }).from(schema.leads)
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .where(and(...conditions))
    .orderBy(schema.leads.createdAt) as Promise<Candidate[]>;
}

async function loadTranscript(candidate: Candidate) {
  const since = new Date(Date.now() - EVIDENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await getDatabase().select({
    id: schema.whatsappMessages.id,
    direction: schema.whatsappMessages.direction,
    senderRole: schema.whatsappMessages.senderRole,
    body: schema.whatsappMessages.body,
    mediaKind: schema.whatsappMessages.mediaKind,
    mediaFilename: schema.whatsappMessages.mediaFilename,
    sentAt: schema.whatsappMessages.sentAt,
  }).from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, candidate.tenantId),
      eq(schema.whatsappMessages.leadId, candidate.id),
      gt(schema.whatsappMessages.sentAt, since),
    ))
    .orderBy(desc(schema.whatsappMessages.sentAt));

  const all = rows.reverse().map((row) => ({
    id: row.id,
    sender: row.direction === "incoming" ? "customer" as const : row.senderRole === "assistant" || row.senderRole === "system" ? "system" as const : "broker" as const,
    text: conversationMessageBody(row),
    timestamp: row.sentAt,
  }));
  return selectSaleDetectionTranscript(all, RECENT_MESSAGE_COUNT);
}

async function classify(candidate: Candidate, transcript: Awaited<ReturnType<typeof loadTranscript>>) {
  const text = transcript.map((message) => {
    const speaker = message.sender === "customer" ? "Cliente" : message.sender === "broker" ? "Corretor" : "Sistema";
    return `[${message.timestamp.toISOString()}] ${speaker}: ${message.text}`;
  }).join("\n");
  return runGateway({
    profile: "json-structured",
    purpose: "sale_detection_backfill",
    tenantId: candidate.tenantId,
    userId: `sale-detection-backfill:${candidate.id}`,
    leadId: candidate.id,
    sensitive: true,
    maskPersonalData: true,
    temperature: 0,
    maxTokens: 1_000,
    timeoutMs: 35_000,
    schema: SaleCompletedSchema,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Etapa atual: ${candidate.status}.\nTranscrição selecionada:\n${text || "Sem mensagens recentes."}` },
    ],
  });
}

async function applyConfirmed(candidate: Candidate, saleCompleted: ReturnType<typeof readSaleCompleted>) {
  const db = getDatabase();
  const [fresh] = await db.select({
    id: schema.leads.id,
    tenantId: schema.leads.tenantId,
    nome: schema.leads.nome,
    status: schema.leads.status,
    version: schema.leads.version,
    corretorId: schema.leads.corretorId,
    qualificationDetails: schema.leads.qualificationDetails,
  }).from(schema.leads).where(and(
    eq(schema.leads.id, candidate.id),
    eq(schema.leads.tenantId, candidate.tenantId),
    inArray(schema.leads.status, [...CLOSING_STATUSES]),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
  )).limit(1);
  if (!fresh) return "ignorado: lead saiu do fechamento antes da aplicação";

  const details = (fresh.qualificationDetails && typeof fresh.qualificationDetails === "object"
    ? fresh.qualificationDetails
    : {}) as Record<string, unknown>;
  const previousMarker = aiSaleMarkerStatus(details);
  const actorUserId = fresh.corretorId ?? await resolveSystemUserId(fresh.tenantId);
  const validatedEvidence = validateSaleEvidence(saleCompleted.evidence, await loadTranscript(candidate));
  const result = await applyAiSaleDetection({
    lead: { id: fresh.id, tenantId: fresh.tenantId, nome: fresh.nome, status: fresh.status, version: fresh.version, corretorId: fresh.corretorId },
    saleCompleted,
    mode: await getAiStageMode(fresh.tenantId),
    alreadyDetected: previousMarker === "converted",
    alreadySuggested: previousMarker === "suggested",
    recentlyUndone: recentlyUndoneAiMove(details.aiLastAutoMove as AiAutoMove | undefined),
    actorUserId,
    validatedEvidence,
  });
  if (!result.marker) return `não aplicado: ${result.why}`;

  const paymentEvidence = result.marker.paymentEvidence ?? readValidatedPaymentEvidence(details);
  const updatedDetails = {
    ...details,
    aiSaleDetected: result.marker,
    ...(paymentEvidence.length ? { aiSaleEvidence: { paymentEvidence, validatedAt: result.marker.at } } : {}),
  };
  await db.update(schema.leads).set({ qualificationDetails: updatedDetails, updatedAt: new Date() })
    .where(and(eq(schema.leads.id, fresh.id), eq(schema.leads.tenantId, fresh.tenantId)));

  if (result.marker.status === "converted") {
    await notifyAiSaleDetected({ tenantId: fresh.tenantId, leadId: fresh.id, leadName: fresh.nome, brokerId: fresh.corretorId, marker: result.marker });
    return "convertido pelo fluxo normal; notificações solicitadas";
  }
  if (result.marker.status === "suggested") {
    await notifyAiSaleSuggested({ tenantId: fresh.tenantId, leadId: fresh.id, leadName: fresh.nome, brokerId: fresh.corretorId, marker: result.marker });
    return "sugestão registrada pelo fluxo normal";
  }
  return "evidência não validada; sem conversão";
}

async function main() {
  const { apply, leadId, transcriptOnly } = parseArgs(process.argv.slice(2));
  const candidates = await loadCandidates(leadId);
  console.log(`Backfill de venda | ${apply ? "APPLY" : "DRY-RUN"} | candidatos: ${candidates.length}`);
  if (!candidates.length) return;

  for (const candidate of candidates) {
    const transcript = await loadTranscript(candidate);
    if (transcriptOnly) {
      console.log(`${candidate.name} [${candidate.id}] | ${candidate.brokerName ?? "sem corretor"} | mensagens selecionadas: ${transcript.length}`);
      transcript.forEach((message) => {
        const speaker = message.sender === "customer" ? "Cliente" : message.sender === "broker" ? "Corretor" : "Sistema";
        console.log(`  ${formatMessageDate(message.timestamp)} ${speaker}: ${maskPersonalData(message.text)}`);
      });
      continue;
    }
    if (!transcript.length) {
      console.log(`${candidate.name} [${candidate.id}] | ${candidate.brokerName ?? "sem corretor"} | no | sem mensagens para analisar`);
      continue;
    }
    const result = await classify(candidate, transcript);
    if (!result.ok) {
      console.log(`${candidate.name} | ${candidate.brokerName ?? "sem corretor"} | erro (${result.reason})${result.lastError ? `: ${result.lastError}` : ""}`);
      continue;
    }

    const saleCompleted = mergeSaleCompletedWithExplicitEvidence(
      readSaleCompleted(result.value),
      transcript.map(({ sender, text }) => ({ sender, text })),
    );
    const validated = validateSaleEvidence(saleCompleted.evidence, transcript.map(({ sender, text }) => ({ sender, text })));
    const proof = saleEvidenceProven(validated);
    const evidence = validated.length
      ? validated.map((item) => `${item.proves ? "validada" : "sem prova forte"} ${evidenceTimestamp(item.quote, item.sender, transcript)}: ${maskPersonalData(item.quote)}`).join(" · ")
      : saleCompleted.evidence.length ? `não localizada: ${maskPersonalData(saleCompleted.evidence.join(" · "))}` : "sem evidência citada";
    const verdict = saleCompleted.status;
    const action = apply && verdict === "confirmed" && proof
      ? ` | ${await applyConfirmed(candidate, saleCompleted)}`
      : "";
    console.log(`${candidate.name} [${candidate.id}] | ${candidate.brokerName ?? "sem corretor"} | ${verdict} | ${evidence}${action}`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
