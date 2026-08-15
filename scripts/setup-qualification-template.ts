import { createDecipheriv, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

function decryptSecret(ciphertext: string, encodedKey: string) {
  const [ivEncoded, tagEncoded, payloadEncoded] = ciphertext.split(".");
  if (!ivEncoded || !tagEncoded || !payloadEncoded) throw new Error("Token de canal inválido.");
  const key = Buffer.from(encodedKey, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payloadEncoded, "base64")), decipher.final()]).toString("utf8");
}

type ChannelRow = {
  id: string;
  tenant_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  access_token_ciphertext: string;
};

type TemplateItem = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: any[];
  rejected_reason?: string;
};

async function main() {
  console.log("=== Configuração & Envio de Teste de Template WhatsApp Meta ===");

  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL / SUPABASE_DB_URL é obrigatório.");

  const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });

  try {
    const [channel] = await sql<ChannelRow[]>`
      SELECT id, tenant_id, waba_id, phone_number_id, display_phone_number, access_token_ciphertext
      FROM communication_channels
      WHERE provider = 'meta_cloud'
        AND status = 'active'
        AND branch_id IS NULL
      LIMIT 1
    `;

    if (!channel || !channel.waba_id || !channel.access_token_ciphertext) {
      throw new Error("Nenhum canal corporativo oficial ativo do WhatsApp encontrado.");
    }

    const tenantId = channel.tenant_id;
    const encryptionKey =
      process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim() ||
      process.env.INVITATION_TOKEN_ENCRYPTION_KEY?.trim() ||
      "";
    if (!encryptionKey) throw new Error("Chave de criptografia do token não configurada em env.");

    const accessToken = decryptSecret(channel.access_token_ciphertext, encryptionKey);
    const graphVersion = process.env.META_GRAPH_VERSION?.trim() || "v22.0";

    console.log(`📌 Tenant ID: ${tenantId}`);
    console.log(`📌 WABA ID: ${channel.waba_id}`);
    console.log(`📌 Phone Number ID: ${channel.phone_number_id}`);

    const templateName = "lead_qualification_start";
    const language = "pt_BR";

    // 1. Fetch templates from Meta Graph API
    console.log("\n1. Consultando templates cadastrados na Meta...");
    const listRes = await fetch(
      `https://graph.facebook.com/${graphVersion}/${channel.waba_id}/message_templates?fields=id,name,language,status,category,components,rejected_reason&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const listData = (await listRes.json()) as { data: TemplateItem[]; error?: any };
    if (!listRes.ok || listData.error) {
      throw new Error(`Erro ao listar templates na Meta: ${listData.error?.message || listRes.statusText}`);
    }

    let existing = listData.data?.find((t) => t.name === templateName && t.language === language);

    if (existing) {
      console.log(`✅ Template "${templateName}" já existe na Meta. Status atual: ${existing.status}`);
      if (existing.rejected_reason) console.log(`   Motivo rejeição: ${existing.rejected_reason}`);
    } else {
      console.log(`\n2. Submetendo novo template "${templateName}" para aprovação da Meta...`);
      const bodyText =
        "Olá, *{{1}}*!😀\nRecebemos sua solicitação de atendimento sobre planos de saúde pela {{2}}.⚓\nPara encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui.⚡\nComo deseja continuar?";

      const payload = {
        name: templateName,
        language,
        category: "MARKETING",
        components: [
          {
            type: "BODY",
            text: bodyText,
            example: {
              body_text: [["Ana", "Âncora Saúde"]],
            },
          },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Iniciar Atendimento" },
              { type: "QUICK_REPLY", text: "Falar com atendente" },
              { type: "QUICK_REPLY", text: "Não tenho interesse" },
            ],
          },
        ],
      };

      const createRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/${channel.waba_id}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const createData = (await createRes.json()) as { id?: string; status?: string; error?: any };
      if (!createRes.ok || createData.error) {
        console.error("⚠️ Resposta de erro da Meta:", createData.error);
        throw new Error(`Falha ao criar template: ${createData.error?.message || createRes.statusText}`);
      }

      console.log(`🎉 Template submetido com sucesso à Meta! ID: ${createData.id}, Status: ${createData.status ?? "PENDING"}`);
    }

    // 2. Poll status until APPROVED
    console.log("\n3. Monitorando aprovação em tempo real na Meta API (aguardando status APPROVED)...");
    let attempts = 0;
    let currentStatus = existing?.status || "PENDING";
    let templateMetaId = existing?.id || "";

    while (attempts < 40 && currentStatus !== "APPROVED" && currentStatus !== "REJECTED") {
      attempts++;
      console.log(`   [Tentativa ${attempts}/40] Status atual na Meta: ${currentStatus}`);
      await new Promise((r) => setTimeout(r, 6000));

      const pollRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/${channel.waba_id}/message_templates?fields=id,name,language,status,rejected_reason&limit=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const pollData = (await pollRes.json()) as { data: TemplateItem[] };
      const item = pollData.data?.find((t) => t.name === templateName && t.language === language);
      if (item) {
        currentStatus = item.status;
        templateMetaId = item.id;
        if (item.rejected_reason) {
          console.log(`   Motivo de rejeição: ${item.rejected_reason}`);
        }
      }
    }

    console.log(`\n📌 Status final obtido da Meta: ${currentStatus}`);

    // 3. Upsert into local database meta_whatsapp_templates table
    const now = new Date();
    await sql`
      INSERT INTO meta_whatsapp_templates (
        id, tenant_id, waba_id, meta_template_id, name, language, category, status,
        quality_rating, components_json, header_type, body_text, footer_text, variables_json, buttons_json,
        origin, last_synced_at, created_at, updated_at
      ) VALUES (
        ${randomUUID()},
        ${tenantId},
        ${channel.waba_id},
        ${templateMetaId || "pending_id"},
        ${templateName},
        ${language},
        ${"MARKETING"},
        ${currentStatus},
        ${"UNKNOWN"},
        ${JSON.stringify([
          {
            type: "BODY",
            text: "Olá, *{{1}}*!😀\nRecebemos sua solicitação de atendimento sobre planos de saúde pela {{2}}.⚓\nPara encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui.⚡\nComo deseja continuar?",
          },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Iniciar Atendimento" },
              { type: "QUICK_REPLY", text: "Falar com atendente" },
              { type: "QUICK_REPLY", text: "Não tenho interesse" },
            ],
          },
        ])},
        ${"NONE"},
        ${"Olá, *{{1}}*!😀\nRecebemos sua solicitação de atendimento sobre planos de saúde pela {{2}}.⚓\nPara encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui.⚡\nComo deseja continuar?"},
        ${""},
        ${JSON.stringify(["1", "2"])},
        ${JSON.stringify([
          { type: "QUICK_REPLY", text: "Iniciar Atendimento" },
          { type: "QUICK_REPLY", text: "Falar com atendente" },
          { type: "QUICK_REPLY", text: "Não tenho interesse" },
        ])},
        ${"CRM"},
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT (tenant_id, waba_id, name, language) DO UPDATE SET
        status = EXCLUDED.status,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = EXCLUDED.updated_at
    `;

    const targetPhone = "5521959307782";

    if (currentStatus === "APPROVED") {
      console.log(`\n4. 🎉 TEMPLATE APROVADO! Enviando mensagem de teste para o WhatsApp: ${targetPhone}...`);
      const msgPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: targetPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: "Ana" },
                { type: "text", text: "Âncora Saúde" },
              ],
            },
          ],
        },
      };

      const sendRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/${channel.phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(msgPayload),
        },
      );

      const sendData = (await sendRes.json()) as { messages?: Array<{ id: string }>; error?: any };

      if (sendRes.ok && sendData.messages?.[0]?.id) {
        console.log(`\n🚀 MENSAGEM DE TESTE ENVIADA COM SUCESSO AO SEU WHATSAPP (${targetPhone})!`);
        console.log(`   WAMID: ${sendData.messages[0].id}`);
      } else {
        console.log(`\n⚠️ Retorno no envio da Meta:`, sendData.error || sendData);
      }
    } else {
      console.log(`\n⏳ O template ainda está em análise pela Meta (Status atual: ${currentStatus}). Nenhuma mensagem pode ser disparada até que a Meta altere o status para APPROVED.`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("FALHA:", err.message || err);
  process.exit(1);
});
