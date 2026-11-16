/**
 * Recupera a sessão quebrada (FAILED) do WhatsApp de corretores e manda para cada um um tutorial e o código de
 * pareamento pronto para copiar (16/11/2026, sessões que a correção de /reconnect deixou em erro).
 *
 * Por padrão só SIMULA: mostra quem seria atendido e a mensagem, sem mexer em nada.
 *
 *   npx tsx --conditions=react-server scripts/whatsapp-recuperar-e-avisar.ts <userId> [userId...]
 *   npx tsx --conditions=react-server scripts/whatsapp-recuperar-e-avisar.ts --enviar <userId> [userId...]
 *
 * Com --enviar, para cada corretor: recria a sessão no servidor (/recover), espera ela pedir pareamento, gera o
 * código para o telefone do perfil, marca a conexão como "conectando" (para o CRM não recriar por cima e invalidar o
 * código), envia duas mensagens pelo número da empresa (tutorial e, em seguida, só o código) e grava auditoria.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const ENVIAR = process.argv.includes("--enviar");
const USER_IDS = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
/** Quem aparece como autor na fila e na auditoria (Vinicios, diretor). Sobrescreva com --por=<userId>. */
const POR = process.argv.find((arg) => arg.startsWith("--por="))?.slice(6) ?? null;

function vps() {
  const raw = (process.env.VPS_API_URL || process.env.WAHA_API_URL || process.env.WAHA_RELAY_URL || "").trim();
  const token = (process.env.WHATSAPP_API_INTERNAL_TOKEN || process.env.VPS_INTERNAL_API_TOKEN || process.env.VPS_API_TOKEN || process.env.WAHA_RELAY_SHARED_SECRET || "").trim();
  if (!raw || !token) throw new Error("VPS_API_URL e o token interno são obrigatórios.");
  const base = new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
  return async <T,>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    const data = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
    if (!response.ok || !data?.ok) throw new Error(`${path}: ${data?.error ?? `HTTP ${response.status}`}`);
    return data;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mask = (phone: string) => `(${phone.slice(0, 2)}) …${phone.slice(-4)}`;

export function tutorial(input: { firstName: string; link: string }) {
  return [
    `Oi, ${input.firstName}! Na sua última tentativa de conectar o WhatsApp ao CRM houve uma falha de conexão naquele momento, e já foi resolvida. Seu código já está pronto, na próxima mensagem.`,
    "",
    "Como conectar (leva 1 minuto):",
    "1. Toque e segure a próxima mensagem e copie o código.",
    "2. No WhatsApp, abra os 3 pontinhos (no iPhone, Configurações).",
    "3. Toque em Dispositivos conectados e depois em Conectar dispositivo.",
    "4. Embaixo da câmera, toque em Conectar com número de telefone.",
    "5. Cole o código.",
    "",
    `O código vale poucos minutos. Se não funcionar, abra o CRM por este link e toque em Gerar código: ${input.link}`,
  ].join("\n");
}

async function main() {
  if (!USER_IDS.length) throw new Error("Informe os userIds dos corretores.");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");
  const { getDatabase, schema } = await import("@/shared/db");
  const db = getDatabase();
  const call = vps();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://crm.ancorasaude.cloud").replace(/\/$/, "");
  const link = `${appUrl}/settings/whatsapp`;

  const rows = await db
    .select({
      userId: schema.user.id,
      name: schema.user.name,
      connectionId: schema.whatsappConnections.id,
      tenantId: schema.whatsappConnections.tenantId,
      sessionName: schema.whatsappConnections.sessionName,
      status: schema.whatsappConnections.status,
      phone: schema.brokerProfiles.phone,
    })
    .from(schema.whatsappConnections)
    .innerJoin(schema.user, eq(schema.user.id, schema.whatsappConnections.userId))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, schema.whatsappConnections.tenantId)))
    .where(inArray(schema.whatsappConnections.userId, USER_IDS));

  console.log(ENVIAR ? "MODO ENVIO\n" : "SIMULAÇÃO (nada é alterado nem enviado; use --enviar)\n");
  const { enqueueMetaTextMessage, processMetaOutboundBatch } = ENVIAR
    ? await import("@/features/communication-channels/outbound-service")
    : { enqueueMetaTextMessage: null, processMetaOutboundBatch: null };

  for (const row of rows) {
    const firstName = row.name?.trim().split(/\s+/)[0] ?? "";
    const phone = (row.phone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    const label = `${row.name} | ${row.sessionName} | ${phone ? mask(phone) : "sem telefone"}`;
    if (!row.sessionName || !row.tenantId || phone.length < 10) {
      console.log(`PULADO  ${label}: falta sessão ou telefone.`);
      continue;
    }
    const before = await call<{ status?: string }>(`/internal/waha/connections/${row.sessionName}/status`).catch((error: Error) => ({ status: `?? ${error.message}` }));
    if (!ENVIAR) {
      console.log(`SERIA ATENDIDO  ${label} | CRM: ${row.status} | servidor: ${before.status}`);
      continue;
    }
    if (before.status === "CONNECTED") {
      console.log(`PULADO  ${label}: já está conectado.`);
      continue;
    }

    try {
      await call(`/internal/waha/connections/${row.sessionName}/recover`, { method: "POST", timeoutMs: 60_000 });
      // Espera a sessão pedir pareamento e o código sair (até ~45 s).
      let code: string | null = null;
      for (let attempt = 0; attempt < 15 && !code; attempt += 1) {
        await sleep(3_000);
        const result = await call<{ code?: string | null }>(`/internal/waha/connections/${row.sessionName}/pairing-code`, {
          method: "POST",
          body: { phoneNumber: `55${phone}` },
        }).catch((error: Error) => (/CODE_NOT_READY|STARTING/.test(error.message) ? { code: null } : Promise.reject(error)));
        code = result.code ?? null;
      }
      if (!code) throw new Error("o código não saiu em 45 s");

      await db.update(schema.whatsappConnections)
        .set({ status: "initializing", qrCode: null, updatedAt: new Date() })
        .where(eq(schema.whatsappConnections.id, row.connectionId));

      const common = { tenantId: row.tenantId, recipientType: "user" as const, recipientId: row.userId, destinationPhone: phone, purpose: "whatsappRecoveryHelp", requestedBy: POR };
      const stamp = Date.now();
      const first = await enqueueMetaTextMessage!({ ...common, body: tutorial({ firstName, link }), idempotencyKey: `whatsapp-recovery:${row.userId}:${stamp}:tutorial` });
      const sentFirst = await processMetaOutboundBatch!(1, row.tenantId, first.id);
      const second = await enqueueMetaTextMessage!({ ...common, body: code, idempotencyKey: `whatsapp-recovery:${row.userId}:${stamp}:code` });
      const sentSecond = await processMetaOutboundBatch!(1, row.tenantId, second.id);

      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: POR ?? row.userId,
        entidade: "whatsapp_connection",
        entidadeId: row.connectionId,
        acao: "whatsapp.recovery.notified",
        metadata: { brokerId: row.userId, sessionName: row.sessionName, phoneLast4: phone.slice(-4), tutorialSent: sentFirst.sent > 0, codeSent: sentSecond.sent > 0 },
      });
      console.log(`OK  ${label} | tutorial: ${sentFirst.sent ? "enviado" : "NA FILA/FALHOU"} | código: ${sentSecond.sent ? "enviado" : "NA FILA/FALHOU"}`);
    } catch (error) {
      console.log(`FALHOU  ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!ENVIAR) {
    console.log("\nMensagem 1 (exemplo):\n");
    console.log(tutorial({ firstName: "Edinaldo", link }));
    console.log("\nMensagem 2: só o código, por exemplo ABCD-1234");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
