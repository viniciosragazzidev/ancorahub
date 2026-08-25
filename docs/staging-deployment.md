# Homologação isolada no Coolify

## Objetivo

Validar o CRM Next.js em `https://staging.crm.ancorasaude.cloud` sem alterar a
produção hospedada na Vercel. A aplicação de staging é um ambiente de homologação,
nunca uma réplica operacional com dados ou canais reais.

## Isolamento obrigatório

| Ambiente | Hospedagem | Banco | Dados | Integrações externas |
|---|---|---|---|---|
| Desenvolvimento | local | local ou isolado | sintéticos | simuladas ou ausentes |
| Staging | Coolify | projeto vazio ou branch integralmente sanitizada | sintéticos | desativadas inicialmente |
| Produção | Vercel | banco de produção | reais | ativas |

Staging não recebe cópia do banco de produção e não recebe segredos de Meta, WAHA,
relay, VPS ou R2. Quando uma branch de banco criada a partir da produção for usada
para conter custo, ela precisa ser sanitizada integralmente antes de qualquer conexão
do CRM. Webhooks continuam configurados somente para
`https://crm.ancorasaude.cloud` durante este teste.

## Configuração do Coolify

- Repositório: `viniciosragazzidev/ancorahub`.
- Branch: `codex/coolify-staging`.
- Estratégia: Dockerfile em `/Dockerfile`.
- Porta interna: `3000`, sem port mapping público.
- Domínio: `https://staging.crm.ancorasaude.cloud`, marcado como não indexável.
- Healthcheck: `GET /api/health`.
- Pre-deployment e post-deployment: vazios.

## Variáveis do primeiro deploy

Cadastre em Coolify somente os valores do ambiente de staging:

```env
BETTER_AUTH_URL=https://staging.crm.ancorasaude.cloud
NEXT_PUBLIC_APP_URL=https://staging.crm.ancorasaude.cloud
BETTER_AUTH_SECRET=
SUPABASE_DB_URL=
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

As variáveis `NEXT_PUBLIC_*` acima devem estar habilitadas para build e runtime,
porque o Next.js as incorpora no bundle do navegador. As outras ficam somente em
runtime. Os valores nunca são versionados nem incluídos no Dockerfile.

Não cadastrar nesta fase: `META_*`, `WAHA_*`, `VPS_*`, `OPENWA_*`, credenciais R2 ou
tokens de produção.

## Sanitização de uma branch copiada

Execute este comando apenas na branch de staging, com uma URL de conexão fornecida
explicitamente para a sessão. O script não carrega `.env.local`, exige a referência
do projeto e uma confirmação específica da branch antes de apagar dados.

```powershell
$env:SUPABASE_DB_URL = "CONNECTION_STRING_DA_BRANCH"
$env:STAGING_DATABASE_REF = "REFERENCIA_DE_20_CARACTERES"
$env:STAGING_SANITIZATION_CONFIRMATION = "SANITIZE_REFERENCIA_DE_20_CARACTERES"
npm run sanitize:staging
```

Ele remove registros de todas as tabelas da aplicação, objetos do Supabase Storage e
reinicia identidades, preservando somente o schema e o histórico de migrations. Nunca
execute o comando com uma URL de produção.

## Sequência controlada

1. Publicar a branch de staging e configurar a aplicação no Coolify, sem deploy
   automático de produção.
2. Cadastrar somente as variáveis listadas acima e realizar o primeiro deploy.
3. Confirmar `GET /api/health`, `/login` e ausência de chamadas a canais externos.
4. Executar `npm run db:migrate` exatamente uma vez contra o banco de staging, fora
   do build e com as credenciais desse banco apenas.
5. Criar dados sintéticos com o bootstrap controlado e validar login, dashboard e
   isolamento entre dois tenants de teste.
6. Para rollback, parar a aplicação no Coolify. A Vercel e todos os webhooks de
   produção permanecem inalterados.
