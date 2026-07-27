/**
 * Validação de variáveis de ambiente para produção.
 * Executar: node scripts/validate-env.js
 *
 * Retorna exit code 0 se todas as variáveis obrigatórias estiverem presentes,
 * ou exit code 1 listando as variáveis ausentes.
 */

const REQUIRED_ENV_VARS = [
  { key: "SUPABASE_DB_URL", label: "URL do banco de dados (Supabase)", fallback: "DATABASE_URL" },
  { key: "DATABASE_URL", label: "URL do banco de dados (fallback)", optional: true },
  { key: "BETTER_AUTH_URL", label: "URL base de autenticação" },
  { key: "BETTER_AUTH_SECRET", label: "Chave secreta de autenticação" },
  { key: "NEXT_PUBLIC_APP_URL", label: "URL pública da aplicação" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "URL pública do Supabase" },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", label: "Chave pública do Supabase" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Chave de serviço do Supabase" },
  { key: "META_WHATSAPP_APP_ID", label: "ID do app Meta WhatsApp", fallback: "NEXT_PUBLIC_META_WHATSAPP_APP_ID" },
  { key: "META_WHATSAPP_APP_SECRET", label: "App Secret do Meta WhatsApp" },
  { key: "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN", label: "Token de verificação do webhook" },
  { key: "META_WHATSAPP_TOKEN_ENCRYPTION_KEY", label: "Chave de criptografia do token" },
  { key: "INVITATION_TOKEN_ENCRYPTION_KEY", label: "Chave de criptografia de convites", optional: true },
  { key: "CRON_SECRET", label: "Chave secreta para endpoints cron" },
  { key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", label: "Chave pública VAPID", optional: true },
  { key: "VAPID_PRIVATE_KEY", label: "Chave privada VAPID", optional: true },
];

function validate() {
  const missing = [];
  const warnings = [];

  for (const { key, label, fallback, optional } of REQUIRED_ENV_VARS) {
    const value = (process.env[key] || "").trim();
    if (value) continue;

    if (fallback) {
      const fallbackValue = (process.env[fallback] || "").trim();
      if (fallbackValue) continue;
      warnings.push({ key, label, detail: `Nem ${key} nem ${fallback} estão definidos.` });
      continue;
    }

    if (optional) {
      warnings.push({ key, label, detail: "Variável opcional não definida." });
      continue;
    }

    missing.push({ key, label });
  }

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

  console.log(`\n✅ Todas as variáveis de ambiente validadas com sucesso.\n`);
}

validate();
