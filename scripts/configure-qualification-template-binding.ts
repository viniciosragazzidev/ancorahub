import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

type TemplateRow = {
  id: string;
  tenant_id: string;
  waba_id: string;
  name: string;
  language: string;
  status: string;
};

async function main() {
  console.log("=== Vinculando Template de Qualificação no Banco de Dados ===");

  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL é obrigatório.");

  const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });

  try {
    const [template] = await sql<TemplateRow[]>`
      SELECT id, tenant_id, waba_id, name, language, status
      FROM meta_whatsapp_templates
      WHERE name = 'lead_qualification_start'
        AND status IN ('APPROVED', 'ACTIVE')
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (!template) {
      throw new Error("Template 'lead_qualification_start' aprovado não foi encontrado no banco de dados local.");
    }

    const tenantId = template.tenant_id;
    console.log(`📌 Tenant ID: ${tenantId}`);
    console.log(`📌 Template ID: ${template.id} (Status: ${template.status})`);

    const now = new Date();

    // 1. Bind to meta_whatsapp_template_usages for LEAD_QUALIFICATION_START
    await sql`
      INSERT INTO meta_whatsapp_template_usages (
        id, tenant_id, event_key, template_id, variable_mappings_json, active, created_at, updated_at
      ) VALUES (
        ${randomUUID()},
        ${tenantId},
        ${"LEAD_QUALIFICATION_START"},
        ${template.id},
        ${JSON.stringify({ nome: "lead_name", empresa: "company_name" })},
        ${true},
        ${now},
        ${now}
      )
      ON CONFLICT (tenant_id, event_key) DO UPDATE SET
        template_id = EXCLUDED.template_id,
        variable_mappings_json = EXCLUDED.variable_mappings_json,
        active = true,
        updated_at = EXCLUDED.updated_at
    `;
    console.log("✅ Evento LEAD_QUALIFICATION_START vinculado ao template na tabela meta_whatsapp_template_usages!");

    // 2. Configure ai_quick_reply_templates for greeting.initial and human.requested
    await sql`
      INSERT INTO ai_quick_reply_templates (
        id, tenant_id, rule_key, template_key, body, active, updated_by, created_at, updated_at
      ) VALUES (
        ${randomUUID()},
        ${tenantId},
        ${"greeting.initial"},
        ${"lead_qualification_start"},
        ${"Olá, *{{nome}}*!😀\nRecebemos sua solicitação de atendimento sobre planos de saúde pela {{empresa}}.⚓\nPara encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui.⚡\nComo deseja continuar?"},
        ${true},
        ${null},
        ${now},
        ${now}
      )
      ON CONFLICT (tenant_id, rule_key) DO UPDATE SET
        template_key = EXCLUDED.template_key,
        body = EXCLUDED.body,
        active = true,
        updated_at = EXCLUDED.updated_at
    `;

    await sql`
      INSERT INTO ai_quick_reply_templates (
        id, tenant_id, rule_key, template_key, body, active, updated_by, created_at, updated_at
      ) VALUES (
        ${randomUUID()},
        ${tenantId},
        ${"human.requested"},
        ${"human.requested"},
        ${"Certo! Estou transferindo seu atendimento para a fila de um corretor especialista agora mesmo. Para agilizar seu atendimento, pode me informar seu nome e para quantas pessoas busca o plano?"},
        ${true},
        ${null},
        ${now},
        ${now}
      )
      ON CONFLICT (tenant_id, rule_key) DO UPDATE SET
        template_key = EXCLUDED.template_key,
        body = EXCLUDED.body,
        active = true,
        updated_at = EXCLUDED.updated_at
    `;
    console.log("✅ Regras greeting.initial e human.requested atualizadas em ai_quick_reply_templates!");

    // 3. Ensure ai_qualification_configs exists and is enabled for this tenant
    const initialMsg = "Olá, *{{nome}}*!😀\nRecebemos sua solicitação de atendimento sobre planos de saúde pela {{empresa}}.⚓\nPara encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui.⚡\nComo deseja continuar?";
    await sql`
      INSERT INTO ai_qualification_configs (
        id, tenant_id, enabled, assistant_name, initial_message,
        created_at, updated_at
      ) VALUES (
        ${randomUUID()},
        ${tenantId},
        ${true},
        ${"Assistente Âncora Corretora"},
        ${initialMsg},
        ${now},
        ${now}
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = true,
        initial_message = ${initialMsg},
        updated_at = EXCLUDED.updated_at
    `;
    console.log("✅ Configuração de Qualificação IA ativada na tabela ai_qualification_configs!");

    console.log("\n🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO! A Qualificação por IA agora usará o template oficial Meta.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("FALHA NA CONFIGURAÇÃO:", err.message || err);
  process.exit(1);
});
