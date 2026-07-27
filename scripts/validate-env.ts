/**
 * Validação de variáveis de ambiente para produção.
 * Executar: npx tsx scripts/validate-env.ts
 *
 * Retorna exit code 0 se todas as variáveis obrigatórias estiverem presentes,
 * ou exit code 1 listando as variáveis ausentes.
 */

const REQUIRED_ENV_VARS = [
  // Database
  { key: "SUPABASE_DB_URL", label: "URL do banco de dados (Supabase)", fallback: "DATABASE_URL" },
  { key: "DATABASE_URL", label: "URL do banco de dados (fallback)", optional: true },

  // Auth
  { key: "BETTER_AUTH_URL", label: "URL base de autenticação" },
  { key: "BETTER_AUTH_SECRET", label: "Chave secreta de autenticação" },

  // App
  { key: "NEXT_PUBLIC_APP_URL", label: "URL pública da aplicação" },

  // Supabase
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "URL pública do Supabase" },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", label: "Chave pública do Supabase" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Chave de serviço do Supabase" },

  // WhatsApp - Meta Cloud
  { key: "META_WHATSAPP_APP_ID", label: "ID do app Meta WhatsApp", fallback: "NEXT_PUBLIC_META_WHATSAPP_APP_ID" },
  { key: "META_WHATSAPP_APP_SECRET", label: "App Secret do Meta WhatsApp" },
  { key: "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN", label: "Token de verificação do webhook" },
  { key: "META_WHATSAPP_TOKEN_ENCRYPTION_KEY", label: "Chave de criptografia do token" },
  { key: "INVITATION_TOKEN_ENCRYPTION_KEY", label: "Chave de criptografia de convites", optional: true },

  // OpenWA (legacy WhatsApp)
  { key: "OPENWA_BASE_URL", label: "URL base OpenWA", optional: true },
  { key: "OPENWA_API_KEY", label: "Chave de API OpenWA", optional: true },

  // Security
  { key: "CRON_SECRET", label: "Chave secreta para endpoints cron" },

  // Notifications
  { key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", label: "Chave pública VAPID", optional: true },
  { key: "VAPID_PRIVATE_KEY", label: "Chave privada VAPID", optional: true },
];

const STORAGE_VARS = [
  { key: "SUPABASE_DOCUMENTS_BUCKET", label: "Bucket de documentos Supabase", default: "documents" },
];

function validate() {
  const missing: { key: string; label: string }[] = [];
  const warnings: { key: string; label: string; detail: string }[] = [];

  for (const { key, label, fallback, optional } of REQUIRED_ENV_VARS) {
    const value = process.env[key]?.trim();
    if (value) continue;

    // Check fallback
    if (fallback) {
      const fallbackValue = process.env[fallback]?.trim();
      if (fallbackValue) continue;
      warnings.push({
        key,
        label,
        detail: `Nem ${key} nem ${fallback} estão definidos.`,
      });
      continue;
    }

    if (optional) {
      warnings.push({ key, label, detail: "Variável opcional não definida." });
      continue;
    }

    missing.push({ key, label });
  }

  // Storage bucket validation
  for (const { key, label, default: defaultValue } of STORAGE_VARS) {
    if (!process.env[key]?.trim()) {
      warnings.push({ key, label, detail: `Usando valor padrão: "${defaultValue}"` });
    }
  }

  // Report
  if (missing.length > 0) {
    console.error("\n❌ VARIÁVEIS OBRIGATÓRIAS AUSENTES:\n");
    for (const { key, label } of missing) {
      console.error(`   ${key.padEnd(45)} ${label}`);
    }
  }

  if (warnings.length > 0) {
    console.warn("\n⚠️  ADVERTÊNCIAS:\n");
    for (const { key, label, detail } of warnings) {
      console.warn(`   ${key.padEnd(45)} ${label}`);
      console.warn(`   ${"".padEnd(49)} ${detail}\n`);
    }
  }

  if (missing.length > 0) {
    console.error(`\n🔴 ${missing.length} variável(is) obrigatória(s) ausente(s).\n`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`\n🟡 ${warnings.length} advertência(s).\n`);
  }

  console.log(`\n✅ Todas as ${REQUIRED_ENV_VARS.length} variáveis de ambiente validadas com sucesso.\n`);
}

validate();
