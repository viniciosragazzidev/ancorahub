/**
 * Ativa a capability de notificação "lead_assignment" e o plugin
 * lead.assigned.notify para que push + WhatsApp sejam enviados
 * ao atribuir/rearbuir leads.
 *
 * Uso: npx tsx scripts/enable-lead-assignment-notification.ts
 */
import { loadEnvConfig } from "@next/env";
import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

const ENTRIES = [
  {
    key: "notification_capability_lead_assignment_enabled",
    label: "Capability lead_assignment",
  },
  {
    key: "plugin.lead-assigned-notify.enabled",
    label: "Plugin lead.assigned.notify",
  },
] as const;

async function main() {
  const db = getDatabase();

  for (const entry of ENTRIES) {
    console.log(`Ativando: ${entry.key} → "true"`);
    await db
      .insert(schema.systemSettings)
      .values({
        key: entry.key,
        value: "true",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value: "true", updatedAt: new Date() },
      });
    console.log(`✅ ${entry.label} ativado com sucesso!`);
  }

  console.log("\nAgora push notifications e WhatsApp serão enviados ao atribuir leads.");
}

main().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});
