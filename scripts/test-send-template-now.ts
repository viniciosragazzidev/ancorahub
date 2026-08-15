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
  console.log("=== Sincronização & Disparo do Template lead_qualification_start ===");

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
    const accessToken = decryptSecret(channel.access_token_ciphertext, encryptionKey);
    const graphVersion = process.env.META_GRAPH_VERSION?.trim() || "v22.0";

    console.log(`📌 Tenant ID: ${tenantId}`);
    console.log(`📌 WABA ID: ${channel.waba_id}`);
    console.log(`📌 Phone Number ID: ${channel.phone_number_id}`);

    // List templates
    const listRes = await fetch(
      `https://graph.facebook.com/${graphVersion}/${channel.waba_id}/message_templates?fields=id,name,language,status,category,components,rejected_reason&limit=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const listData = (await listRes.json()) as { data: TemplateItem[]; error?: any };
    if (!listRes.ok || listData.error) {
      throw new Error(`Erro ao listar templates na Meta: ${listData.error?.message || listRes.statusText}`);
    }

    console.log(`\nTemplates encontrados na Meta (${listData.data?.length || 0}):`);
    for (const t of listData.data || []) {
      console.log(` - Name: "${t.name}" | Language: "${t.language}" | Status: "${t.status}" | ID: ${t.id}`);
    }

    // Find lead_qualification_start
    const qualificationTemplates = listData.data?.filter((t) => t.name === "lead_qualification_start") || [];
    if (qualificationTemplates.length === 0) {
      console.log("\n⚠️ Nenhum template lead_qualification_start encontrado!");
      return;
    }

    const now = new Date();
    // Sync all versions to DB
    for (const item of qualificationTemplates) {
      const bodyComponent = item.components?.find((c: any) => c.type === "BODY");
      const buttonComponent = item.components?.find((c: any) => c.type === "BUTTONS");

      await sql`
        INSERT INTO meta_whatsapp_templates (
          id, tenant_id, waba_id, meta_template_id, name, language, category, status,
          quality_rating, components_json, header_type, body_text, footer_text, variables_json, buttons_json,
          origin, last_synced_at, created_at, updated_at
        ) VALUES (
          ${randomUUID()},
          ${tenantId},
          ${channel.waba_id},
          ${item.id},
          ${item.name},
          ${item.language},
          ${item.category || "MARKETING"},
          ${item.status},
          ${"UNKNOWN"},
          ${JSON.stringify(item.components || [])},
          ${"NONE"},
          ${bodyComponent?.text || ""},
          ${""},
          ${JSON.stringify(["1", "2"])},
          ${JSON.stringify(buttonComponent?.buttons || [])},
          ${"META_SYNC"},
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT (tenant_id, waba_id, name, language) DO UPDATE SET
          status = EXCLUDED.status,
          components_json = EXCLUDED.components_json,
          body_text = EXCLUDED.body_text,
          last_synced_at = EXCLUDED.last_synced_at,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("\n✅ Templates sincronizados na tabela meta_whatsapp_templates!");

    // Pick active / approved item
    const activeItem = qualificationTemplates.find((t) => t.status === "APPROVED" || t.status === "ACTIVE") || qualificationTemplates[0];

    console.log("\nDetalhamento dos componentes do template aprovado:");
    console.log(JSON.stringify(activeItem.components, null, 2));

    const targetPhone = "5521959307782";
    console.log(`\n🚀 Disparando mensagem de teste do template "${activeItem.name}" (Idioma: "${activeItem.language}") para ${targetPhone}...`);

    // Test with named parameters (nome e empresa) as created in Meta Manager
    const msgPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: targetPhone,
      type: "template",
      template: {
        name: activeItem.name,
        language: { code: activeItem.language },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", parameter_name: "nome", text: "Ana" },
              { type: "text", parameter_name: "empresa", text: "Âncora Saúde" },
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
      console.log(`\n🎉 MENSAGEM ENVIADA COM SUCESSO AO SEU WHATSAPP!`);
      console.log(`   Telefone: ${targetPhone}`);
      console.log(`   WAMID: ${sendData.messages[0].id}`);
    } else {
      console.error(`\n❌ Falha ou recusa no envio da Meta:`, sendData.error || sendData);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("FALHA:", err.message || err);
  process.exit(1);
});
