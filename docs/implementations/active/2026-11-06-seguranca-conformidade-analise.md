# Segurança e conformidade: plano de análise e diagnóstico (40 pontos)

Data: 2026-11-06. Branch analisada: `feat/gestor-plantao-unidade` (HEAD `d10f95be`).
Modo: **somente leitura**. Nenhum arquivo de código foi alterado, nenhum banco (nem de produção) foi acessado e nenhuma correção foi feita. Única consulta externa: `npm audit` (registro npm).
Plano de correção: [2026-11-06-seguranca-conformidade-correcao.md](2026-11-06-seguranca-conformidade-correcao.md).

Legenda de status: **Atendido**, **Parcial**, **Ausente**, **N/A** (não se aplica). "NV-repo" = não verificável pelo repositório: depende do painel Coolify, Supabase, Cloudflare, Hostinger, GitHub ou Meta.

---

## 1. Plano de análise

### 1.1 Método

1. **Código:** buscas com `rg`/`grep` e leitura dirigida dos pontos de entrada: `src/proxy.ts`, `src/shared/auth/*`, os 112 `route.ts` de `src/app/api`, os 133 arquivos `"use server"`, `src/shared/db/schema.ts` (204 tabelas), `services/whatsapp-api`, `services/waha-relay`, `apps/browser-extension`.
2. **Amostragem de autorização:** 32 rotas e actions conferidas uma a uma (sessão, tenant, escopo de papel). O resultado está na seção 2.
3. **Infraestrutura no repo:** `Dockerfile`, `next.config.ts`, `docker-compose*.yml`, `.github/workflows/ci.yml`, `docs/runbooks/*`, `docs/adr/0045-*`.
4. **Documentos:** `docs/standards/security.md`, `docs/security/*`, `docs/decision-log.md` (DEC-005, DEC-011), `src/app/termos`, landing (`src/app/page.tsx`).
5. **Dependências:** `npm audit --omit=dev --json`, `npm audit --json` e leitura das licenças em `node_modules/*/package.json`.
6. **Painéis (fase 2, com você):** os itens NV-repo da seção 3 são conferidos nos painéis por você, ou por mim com autorização explícita. Banco de produção, mesmo só leitura, só com autorização sua.

### 1.2 Onde olhar e como verificar, por ponto

| # | Ponto | Onde olhar | Como verificar (comandos/buscas) |
|---|---|---|---|
| 1 | Autenticação segura | `src/shared/auth/index.ts`, `src/proxy.ts`, `src/features/team/{invites,password-recovery}.ts`, `src/app/primeiro-acesso`, `src/app/(auth)` | `rg -n "betterAuth\|twoFactor\|passkey\|expiresIn" src/shared/auth`; ler os defaults de rate limit em `node_modules/better-auth/dist/context/create-context.mjs`; conferir política de senha em cada caminho de gravação (`rg -n "hashPassword\(" src scripts`) |
| 2 | Controle de acesso | `src/proxy.ts`, layouts `(dashboard)`/`(platform-admin)`, `src/shared/auth/tenant-context.ts`, rotas de API e server actions | `for f in $(find src/app/api -name route.ts); do grep -qE "getRequired(Session\|TenantContext\|PlatformAdmin)\|CRON_SECRET\|timingSafeEqual" "$f" \|\| echo "$f"; done`; idem para `rg -l '^"use server"' src`; `rg -n "\.where\(eq\(schema\.\w+\.id, " ` nas actions (IDOR); `notFound()` em `src/app/dev*` |
| 3 | Criptografia | `src/features/communication-channels/secret-crypto.ts`, `src/shared/db/schema.ts`, `src/shared/storage/r2-storage.ts`, `src/features/ai-gateway` | `rg -n "encrypt\|decrypt\|createCipheriv" src`; `rg -n "(token\|secret\|apiKey\|cpf).*: (text\|varchar\|jsonb)" src/shared/db/schema.ts`; `rg -n "getSignedUrl\|presign\|public" src/shared/storage` |
| 4 | HTTPS/TLS | `next.config.ts` (headers), `src/shared/db/client.ts`, `Dockerfile`, compose, `docs/runbooks/vps.md` | `rg -n "Strict-Transport\|Content-Security-Policy" next.config.ts src`; `rg -n "ssl\|sslmode" src scripts`; `rg -n "http://" src services`; painel: modo SSL Cloudflare, HSTS no Traefik, "Enforce SSL" Supabase |
| 5 | Hashing de senhas | `node_modules/@better-auth/utils/dist/password.node.mjs`, pontos de gravação de senha, tokens | `rg -n "createHash\(\"sha256\"\)" src`; `rg -n "token:" src/shared/db/schema.ts`; conferir parâmetros do scrypt |
| 6 | SQL injection | todo `src`, `scripts`, `services` | `rg -n "sql\.raw\|\.unsafe\(" src scripts services`; `rg -nE "execute\(\s*[\`'\"]" src services`; conferir se a entrada vem do usuário |
| 7 | XSS/CSRF | rotas que devolvem HTML/SVG/mídia, `dangerouslySetInnerHTML`, route handlers POST com cookie, extensão | `rg -n "dangerouslySetInnerHTML\|innerHTML\|insertAdjacentHTML" src apps`; `rg -n "Content-Type\|Content-Disposition" --glob "**/route.ts" src/app/api`; `rg -n "Access-Control-Allow-Origin" src`; checar `Origin` nos POST |
| 8 | Rate limiting | `src/shared/auth/index.ts`, webhooks, rotas públicas, IA | `rg -niE "rateLimit\|RATE_LIMITED\|throttle" src`; listar rotas públicas sem limitador |
| 9 | Proteção de APIs | `src/app/api/webhooks/*`, `src/app/api/internal/*`, `src/app/api/public/*`, `src/app/api/health`, `services/whatsapp-api/src/app.ts` | Ler cada webhook (assinatura, `timingSafeEqual`), `rg -n "CRON_SECRET\|INTERNAL_JOB_SECRET" src/app/api`, rotas do Fastify sem `requireInternalAuth` |
| 10 | Auditoria de dependências | `package.json`, `package-lock.json`, `.github/` | `npm audit --omit=dev`; `npm audit`; `ls .github` (dependabot/renovate); `rg -n "audit" .github/workflows` |
| 11 | Política de privacidade | `src/app/termos`, `src/app/(auth)/login/page.tsx`, landing, wizard de primeiro acesso | `rg -n -i "privacidade\|privacy" src/app`; `ls src/app` (rota `/privacidade`) |
| 12 | Bases legais | schema (`consentimentoLgpd`), criação/importação de leads, `docs/decision-log.md` | `rg -n "consentimentoLgpd\s*[:=]" src`; ler DEC-005 |
| 13 | Minimização | schema de `leads`, `lead_beneficiaries`, `broker_profiles`, `whatsapp_messages`, `src/features/ai-gateway` | `rg -n -i "cpf\|bank\|birth" src/shared/db/schema.ts`; `rg -n "maskPersonalData\|sensitive:" src` |
| 14 | Finalidades | docs de IA, runbook de jobs, CAPI Meta | `rg -n -i "ROPA\|finalidade" docs`; ler `src/features/meta-ads/meta-conversion-events.ts` |
| 15 | Consentimento | opt-out da IA, `waha_suppressions`, `ai_consents` | `rg -n "wahaSuppressions\|optOutAt" src`; `rg -n "insert\(schema.wahaSuppressions" src` |
| 16 | Cookies | `src/app/layout.tsx`, `cookies.set`, scripts de terceiros | `rg -n "cookies\.set\(\|document\.cookie" src`; `rg -n -i "gtag\|fbq\(\|sentry\|posthog\|clarity" src` |
| 17 | Direitos dos titulares | super-admin, purge LGPD, export | `rg -n -i "encarregad\|\bdpo\b" src docs`; ler `src/features/platform-admin/service.ts` |
| 18 | Exclusão de dados | ações de excluir lead/documento, cascatas, R2 | `rg -n "deletedAt: (new Date\|now)" src`; `rg -n "DeleteObject" .`; FKs `onDelete` no schema |
| 19 | Retenção | `docs/runbooks/coolify-scheduled-tasks.md`, jobs de purge | `rg -n -i "retention\|ttl\|purge" src/features src/app/api/internal` |
| 20 | Contratos com operadores | provedores no código, docs | `rg -n -i "suboperador\|DPA" docs`; listar provedores em `src/features/ai-gateway/profiles.ts`, `package.json` |
| 21 | Termos de uso | `src/app/termos`, `terms_acceptances`, `onboarding-actions.ts` | ler versão publicada × versão gravada; conferir IP/UA no insert |
| 22-25 | Preços, cobranças, cancelamento, reembolso (do SaaS) | `src/features/billing`, `/assinatura`, landing | `rg -n -i "stripe\|asaas\|pagar\.me\|mercadopago\|iugu" src package.json` |
| 26 | Identificação do fornecedor | landing, termos, PDF de cotação | `rg -n -i "cnpj\|raz[aã]o social" src/app public` |
| 27 | Publicidade transparente | landing, simulador/chat de cotação, cartão de cotação | `rg -n "(exemplo)" src/features`; `rg -n -i "sujeit\|estimativ" src` |
| 28 | Depoimentos | landing | `rg -n -i "testimonial\|depoiment" src` e leitura de `src/app/page.tsx` |
| 29 | Licenças de uso | `node_modules/*/package.json`, `public/fonts`, fontes de PDF | script Node lendo o lockfile (pacotes de produção) e o campo `license`; `git ls-files public` |
| 30 | Transparência sobre IA | mensagens iniciais, templates turbo, consentimento do corretor, decisões automáticas | `rg -n -i "assistente virtual\|atendente virtual" src/features`; ler `templates-pack.ts`, `consent-card.tsx`, `pairing-copy.ts` |
| 31 | Backups | `docs/runbooks/vps.md`, `docs/database-setup.md`, ADR 0044/0045 | `rg -n -i "backup\|PITR\|restore\|restaur" docs`; painel Supabase/Hostinger/R2 |
| 32 | Logs seguros | `console.*`, `audit_logs`, Fastify logger | `rg -c "console\.(log\|error\|info\|warn)" src`; `rg -nE "console\.(error\|warn)\([^,]+,\s*(error\|err\|e)\s*\)" src`; logs com `phone\|name\|payload` |
| 33 | Monitoramento | `src/shared/observability`, `/api/health`, Sentry | `rg -n -i "sentry\|axiom" src package.json`; ler `src/app/api/health/route.ts` |
| 34 | Resposta a incidentes | `docs/runbooks`, `docs/agent` | `rg -n -i "incidente\|incident" docs` |
| 35 | Notificação de incidentes | docs | `rg -n -i "ANPD\|15/2024\|vazamento" docs` |
| 36 | Testes de segurança | `*.test.ts`, `tests/e2e`, `scripts/agent/check-security.ts` | `git ls-files \| grep -cE '\.(test\|spec)\.tsx?$'`; nomes `*scope*\|*access*\|*tenant*`; ler o check-security |
| 37 | Revisão de código | `.github/workflows/ci.yml`, CODEOWNERS, `docs/standards/delivery-governance.md` | ler gatilhos do CI; `git rev-list --count origin/main..HEAD`; painel GitHub (proteção de branch) |
| 38 | Privilégios administrativos | `src/shared/auth/platform-admin.ts`, `src/app/(platform-admin)`, `scripts/bootstrap-platform-admin.ts`, view-as | `rg -n "isPlatformAdmin: true" src scripts`; `rg -n "getRequiredPlatformAdmin" src`; ler reset de senha por diretor |
| 39 | Gestão de vulnerabilidades | `SECURITY.md`, `Dockerfile` | `ls SECURITY.md .github/SECURITY.md`; ler `FROM`, `USER`, `npm ci` no Dockerfile |
| 40 | Auditoria de conformidade | `docs/security`, `docs/standards/security.md`, `docs/audits`, DEC-005 | `rg -n -i "ROPA\|RIPD\|DPIA\|política de segurança" docs` |
| — | Segredos versionados (transversal) | git, `.gitignore`, `env-recuperados/` | `git ls-files \| rg -i "\.env\|secret\|\.pem\|\.key"`; `git log --all --oneline -- '*.env*'`; varredura de padrões de token (sem copiar valores) |

---

## 2. Diagnóstico (levantamento inicial, só leitura)

Resumo: **1 atendido** (6), **24 parciais**, **11 ausentes**, **4 N/A** (22-25). São **4 achados críticos**.

| # | Ponto | Status | Evidência principal | Maior severidade |
|---|---|---|---|---|
| 1 | Autenticação segura | Parcial | Login só por convite, 2FA/passkey opcionais, sessão de 7 dias (`src/shared/auth/index.ts:45-68`). Primeiro acesso aceita senha de **3 caracteres** (`src/features/team/onboarding-password-policy.ts:1`). Rate limit em memória. `/admin/login` ignora 2FA (`src/app/(auth)/admin/login/page.tsx:52-66`) | Alto |
| 2 | Controle de acesso | Parcial | Layouts e actions checam sessão e tenant (`tenant-context.ts:113-234`); sem IDOR entre tenants na amostra de 32. Supervisor e gestor sem unidade baixam documentos do **tenant inteiro** (`src/app/api/documents/download/route.ts:39-49`). Links públicos sem expiração. Proxy com lista de rotas protegidas desatualizada (`src/proxy.ts:12-20`) | Médio |
| 3 | Criptografia de dados | Parcial | AES-256-GCM para tokens Meta (`secret-crypto.ts:5-24`). Em texto puro: chaves de IA (`src/features/ai-gateway/gateway.ts:17`), `webhook_secret` OpenWA (`schema.ts:1719`), token de reset (`schema.ts:4479`), CPF do corretor (`schema.ts:4357`) | Médio |
| 4 | HTTPS/TLS | Parcial | Sem **HSTS** e sem **CSP** global (`next.config.ts:58-77`). Postgres sem `ssl` forçado no código (`src/shared/db/client.ts:147-148`). Borda Cloudflare/Traefik: NV-repo | Alto |
| 5 | Hashing de senhas | Parcial | scrypt com sal para senhas de login (atendido). Senha de planilha pública em **sha256 sem sal** (`spreadsheet-actions.ts:59-61`). Token de reset sem hash | Médio |
| 6 | SQL injection | **Atendido** | `sql.raw` só com constantes (`broker-performance/queries.ts:65`, `lead-distribution/jobs.ts:433`, `live-status/loaders.ts:433`); `.unsafe` só em scripts de migração | — |
| 7 | XSS/CSRF | Parcial | **XSS refletido** em `/api/avatar/[seed]` (`route.ts:9-42`, `size` sem escape em SVG). Mídia do WhatsApp servida inline com MIME do remetente (`conversation-media.ts:28-33`, `media/[messageId]/route.ts:55-60`). Route handlers com cookie não checam `Origin` | Alto |
| 8 | Rate limiting | Parcial | Só better-auth (memória), extensão e gateway de IA. Webhook de lead com token público na landing sem limite: o código `RATE_LIMITED` existe e nunca é produzido (`lead-webhook.types.ts:33`). `/api/chat` sem limite nem validação | Alto |
| 9 | Proteção de APIs | Parcial | Webhooks Meta com HMAC + `timingSafeEqual`; crons com `CRON_SECRET`. **Fastify `POST /internal/webhooks/waha` sem autenticação, que assina e repassa ao CRM** (`services/whatsapp-api/src/app.ts:1066-1155`). `/api/health` público expõe `lastError` (`src/app/api/health/route.ts:16-60`) | **Crítico** (se o Fastify for alcançável de fora) |
| 10 | Auditoria de dependências | Parcial | Produção: 2 críticas e 7 altas. `next@16.2.10` (bypass do proxy), `better-auth@1.7.1`, `xlsx@0.18.5` sem patch fazendo parse de upload, `sharp@0.34.5`, `zod@4.4.3`. Sem Dependabot; CI sem audit; `npm ci \|\| npm install` (`Dockerfile:13`) | **Crítico** |
| 11 | Política de privacidade | Ausente | O link do login vai para `/termos#privacidade` (`login/page.tsx:250-252`); os termos se dizem provisórios (`src/app/termos/page.tsx:44-45`) | Alto |
| 12 | Bases legais | Ausente | Só o booleano `leads.consentimentoLgpd` (`schema.ts:421`). A importação grava `true` sem evidência (`bulk-import.ts:248,295`, `marketing-import/service.ts:361`). Lead Meta entra `false` e a IA conversa. Dado de saúde sem base do art. 11. DEC-005 pendente (`docs/decision-log.md:588`) | **Crítico** |
| 13 | Minimização | Parcial | Máscara de CPF/e-mail/telefone só para provedores gratuitos (`gateway.ts:217-219`); conversa integral vai sem máscara para OpenAI/Anthropic/OpenRouter pagos. `formData` guarda tudo | Alto |
| 14 | Finalidades documentadas | Parcial | Finalidades espalhadas em docs técnicos; sem ROPA. CAPI Meta (`meta-conversion-events.ts:88-119`) e aprendizado de situações sem finalidade publicada | Médio |
| 15 | Gestão de consentimento | Parcial | "PARE" funciona por conversa (`conversation-state-machine.ts:1942`). `waha_suppressions` é lida em 5 lugares e **nunca gravada**. Sem registro de opt-in WhatsApp/Lead Ads. Consentimento de IA do corretor versionado (`ai_consents`) | Alto |
| 16 | Política de cookies | Parcial | Só cookies próprios e essenciais (sessão, tema, sidebar, modo); sem analytics/pixel no layout. Falta informar na política | Baixo |
| 17 | Direitos dos titulares | Ausente | Sem canal do encarregado; sem export/anonimização de lead. Expurgo de usuário mantém CPF e telefone em `broker_profiles` (`platform-admin/service.ts:235-254`) | Alto |
| 18 | Exclusão de dados | Parcial | Lead só tem soft delete (`src/app/(dashboard)/leads/actions.ts:72-75`). Hard delete só do tenant inteiro. **R2 sem função de delete** (`src/shared/storage/r2-storage.ts`) | Alto |
| 19 | Retenção de dados | Ausente | Só prazos pontuais (situation-learning 90 dias, convites). Mensagens, leads, R2, `audit_logs` sem expurgo | Alto |
| 20 | Contratos com operadores | Ausente no repo | Suboperadores no código: Supabase, Cloudflare R2, Groq, OpenRouter, Google, OpenAI, Anthropic, Meta, WAHA/VPS (Hostinger), web-push. Sem lista, DPA nem mecanismo de transferência internacional | Alto |
| 21 | Termos de uso | Parcial | Aceite grava versão fixa `"v1.0"`, diferente da publicada (16/07/2026). IP e UA não são gravados, embora o wizard diga que sim (`onboarding-actions.ts:331-337`, `onboarding-wizard.tsx:289`). Sem reaceite | Médio |
| 22 | Transparência de preços (SaaS) | N/A | Sem gateway de pagamento; `features/billing` vazio. Ressalva: link "Preços" para `#` na landing (`src/app/page.tsx:654`) | Baixo |
| 23 | Cobranças transparentes | N/A | Não há cobrança no código | — |
| 24 | Cancelamento de assinaturas | N/A | "Gerenciar plano" desabilitado (`subscription-lite.tsx:58-61`) | — |
| 25 | Política de reembolso | N/A | Não há cobrança | — |
| 26 | Identificação do fornecedor | Ausente | Sem razão social, CNPJ, endereço nem contato nas páginas públicas e no PDF de cotação (`src/app/api/quotes/[token]/pdf/route.ts:197`). Marca varia: Âncora Saúde / Âncora Corretora / CorreTop | Médio/Alto |
| 27 | Publicidade transparente | Parcial | O chat de cotação usa **preços de demonstração** e o texto enviado ao lead remove "(exemplo)" (`src/features/broker-workspace/chat/quote-flow.ts:178-179`). O cartão de cotação não diz que o valor é estimado (`quotes/utils.ts:101-130`) e o link `/cotacao/<token>` cai no login. Landing com números sem fonte (`page.tsx:308-311`) | Alto |
| 28 | Depoimentos autênticos | Ausente (risco) | 3 depoimentos com nome, empresa e 5 estrelas, aparentemente fictícios (`src/app/page.tsx:508-528`) | Médio/Alto |
| 29 | Licenças de uso | Parcial | Sem GPL/AGPL/SSPL. **Fonte proprietária `public/fonts/Amil Typeface Bold.ttf` servida publicamente sem licença**. Remix Icon License (não OSI). Inter sem `OFL.txt` | Alto |
| 30 | Transparência sobre IA | Parcial | A mensagem inicial diz "assistente virtual" (`ai-qualification/service.ts:60`), mas os templates turbo não avisam (`templates-pack.ts:38-128`) e o tenant pode editar o aviso. O corretor é bem informado (`pairing-copy.ts:222-223`). Sem canal de revisão de decisão automatizada (art. 20) | Médio |
| 31 | Backups automatizados | Ausente (no repo) | `docs/runbooks/vps.md:456-476` só diz "conforme o plano". Sem PITR, sem backup de R2 e do volume WAHA, sem teste de restauração. Painéis: NV-repo | Alto |
| 32 | Logs seguros | Parcial | 421 `console.*`; o ingest Meta loga nome e telefone (`meta-lead-ads.ts:382,447,464`); 95 logs de erro cru (erro do Drizzle carrega os parâmetros da query). `audit_logs` sem tenant/IP | Médio |
| 33 | Monitoramento de ameaças | Parcial | Sem Sentry nem alertas (variáveis só reservadas no `.env.example:11-13`); métricas em memória; login falho não auditado | Alto |
| 34 | Resposta a incidentes | Ausente | Sem playbook de incidente de segurança, rotação de segredos ou contenção | Alto |
| 35 | Notificação de incidentes | Ausente | Sem procedimento ANPD (3 dias úteis, Res. CD/ANPD 15/2024), registro de incidentes nem encarregado | Alto |
| 36 | Testes de segurança | Parcial | 771 testes, 58 de escopo/autorização, 22 com outro tenant. Só 2 specs e2e, fora do CI. `check-security.ts` com 3 regex e nunca falha. Sem SAST nem pentest | Médio |
| 37 | Revisão de código | Parcial | CI só dispara em `main` (`ci.yml:3-7`), parada desde 2026-08-28; a branch de produção está 1.511 commits à frente. **Nada em produção passou pelo CI.** Lint não bloqueia; type-check pulado no Docker; sem CODEOWNERS; Node 20 no CI × 22 em produção | Alto |
| 38 | Privilégios administrativos | Parcial | Ações de admin checam `isPlatformAdmin` no banco; view-as auditado e só leitura. **E-mail e senha do platform admin no código e no git** (`scripts/bootstrap-platform-admin.ts:12-19`). Diretor gera e lê link de reset de qualquer membro, inclusive de outro diretor e do admin (`password-recovery-scope.ts:10`, `password-recovery.ts:236,432`). Admin sem 2FA obrigatório | **Crítico** |
| 39 | Gestão de vulnerabilidades | Ausente | Sem `SECURITY.md`/SLA/triagem. Imagem `node:22-alpine` sem digest nem scan. Positivo: container roda como não-root (`Dockerfile:53-61`) | Médio |
| 40 | Auditoria de conformidade | Parcial | Existem `docs/standards/security.md` e matriz RBAC. Faltam ROPA, RIPD, política formal e auditoria periódica; DEC-005 pendente | Alto |
| — | Segredos versionados | Atendido | Nenhum `.env` real no git. `env-recuperados/` fica fora só por `.git/info/exclude` (local), com valores vazios ou mascarados | Baixo |

### 2.1 Os 4 críticos

1. **Credencial do platform admin no código** (`scripts/bootstrap-platform-admin.ts:12-19`, commits `e1a17978`, `c8c00e7e`). Se o script rodou em produção e a senha não foi trocada, quem tem acesso ao repositório entra como super admin.
2. **`next@16.2.10` com bypass do proxy** (GHSA-6gpp-xcg3-4w24). O build usa Turbopack e o `src/proxy.ts` é o gate. Os layouts revalidam a sessão, o que reduz o impacto.
3. **Webhook WAHA do Fastify sem autenticação** (`services/whatsapp-api/src/app.ts:1066-1155`). A rota assina qualquer corpo com `WAHA_RELAY_SHARED_SECRET` e repassa ao CRM. Se o serviço for alcançável fora da rede interna, qualquer um forja mensagens e eventos. A exposição é NV-repo.
4. **Dado de saúde sem base legal registrada** (art. 11 LGPD) e consentimento falso na importação (`consentimentoLgpd: true` sem evidência).

### 2.2 Amostra de autorização (32 itens)

Conferidos: export de comissões, mark-read, unread-count, vps-health, purge, rotas da extensão, mídia de conversa, download de documento, export de conversa, export de leads do corretor, relatórios, logos e avatares, materiais de operadora, PDF de cotação, planilha pública, confirmação de plantão, os 4 webhooks, view-as, notificações de plugin, conexão WAHA, cargos, investigação, conversation-intelligence, canais, propostas, checklist, edição de membro, recuperação de senha e as 39 ações do super-admin. Falharam ou ficaram parciais: download de documento (escopo), PDF de cotação e planilha (token fraco sem expiração) e recuperação de senha (alvo sem limite). Detalhe por item em `audit-A-auth-acesso.md` (notas da sessão, fora do repo).

---

## 3. Itens não verificáveis pelo repositório (fase 2)

Para conferir nos painéis. Por mim, só com sua autorização explícita.

| Item | Onde | Por que importa |
|---|---|---|
| A senha do platform admin em produção ainda é a do script? Houve login suspeito? | Supabase (tabela `session`/`account`) ou troca direta | Define se o crítico 1 é exploração possível hoje |
| `services/whatsapp-api` (Fastify) é alcançável pela internet? | Coolify/Hostinger, firewall, Traefik | Define a severidade real do crítico 3 |
| HSTS e modo SSL (Full strict) | Cloudflare e Traefik/Coolify | Ponto 4 |
| `sslmode=require` na `DATABASE_URL` e "Enforce SSL" | Coolify (env) e Supabase | Ponto 4 |
| Plano de backup, PITR e retenção | Supabase | Ponto 31 |
| Bucket R2 privado? Versionamento/lifecycle? | Cloudflare | Pontos 3, 18 e 31 |
| Snapshots da VPS e volume das sessões WAHA | Hostinger/Coolify | Ponto 31 |
| `NODE_ENV=production` no container (as páginas `/dev` dependem disso) | Coolify | Ponto 2 |
| Número de réplicas do app | Coolify | Rate limit em memória (ponto 8) |
| Retenção e acesso aos logs | Coolify | Ponto 32 |
| Proteção de branch e repositório privado | GitHub | Pontos 37 e 38 |
| URL de política no formulário Lead Ads e disclaimer | Meta Business | Pontos 11 e 15 |
| Textos dos templates aprovados | Meta (WhatsApp Manager) | Ponto 30 |
| Conteúdo de `public/CRM_HOSTINGER_VPS.pdf` (versionado e servido publicamente; é imagem, sem texto extraível aqui) | Abrir o arquivo | Pode expor dados de infraestrutura |

---

## 4. Relatórios detalhados

Os quatro relatórios completos (comandos, evidências caminho:linha, tabelas de achados) ficaram na pasta de notas da sessão, fora do repo:
- `audit-A-auth-acesso.md`: pontos 1, 2, 5 e 38
- `audit-B-appsec.md`: pontos 3, 4, 6, 7, 8, 9 e 32, com o inventário das rotas públicas de `src/app/api`
- `audit-C-lgpd-cdc.md`: pontos 11 a 30
- `audit-D-operacao.md`: pontos 10, 29, 31, 33 a 37, 39 e 40, e a varredura de segredos

Os IDs de achado citados no plano de correção (ex.: `A-2`, `B:A1`, `D:D3`) remetem a esses relatórios.
