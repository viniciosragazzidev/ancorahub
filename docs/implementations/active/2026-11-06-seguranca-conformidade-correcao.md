# Segurança e conformidade: plano de correção

Data: 2026-11-06. Base: [2026-11-06-seguranca-conformidade-analise.md](2026-11-06-seguranca-conformidade-analise.md).
Status: **proposta para aprovação. Nada foi corrigido.**

Legenda:
- **[T]**: técnico, eu implemento.
- **[J]**: jurídico/negócio, você ou o advogado providencia o texto ou a decisão; o código só publica ou registra.
- **[P]**: painel ou processo (Coolify, Supabase, Cloudflare, GitHub, Meta), ação sua ou minha com autorização.
- Esforço: P (até meio dia), M (1 a 3 dias), G (mais de 3 dias). Risco: chance de a correção quebrar algo.

Regras que valem para todos os lotes:
- uma branch por lote, nunca na `main`;
- antes de codar cada lote, apresento o plano por componente;
- cada lote termina com `type-check`, `test` e `build` verdes e com sua revisão visual, quando houver tela;
- migrations usam o **maior número de drizzle entre todas as branches de origin** no dia, e cada tag do journal precisa do seu `.sql`;
- job novo entra em `docs/runbooks/coolify-scheduled-tasks.md`;
- tela nova segue `docs/design-system.md`, com densidade no padrão de `/equipe`.

---

## 1. Problemas por prioridade

### Crítico

| ID | Problema | O que mudar | Arquivos | Migration | Esforço | Risco | Tipo |
|---|---|---|---|---|---|---|---|
| CR-1 | Credencial do platform admin no código e no git | **Já:** trocar a senha da conta em produção, ativar 2FA ou passkey e revisar as sessões e logins dessa conta. **Código:** o script passa a ler `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` do ambiente (mínimo 12) e para de criar membership de diretor para o admin | `scripts/bootstrap-platform-admin.ts`, `package.json:19` | Não | P | Baixo | [P] + [T] |
| CR-2 | `next@16.2.10` com bypass do proxy | Subir para `next@16.4.5`+ e `eslint-config-next` | `package.json`, `package-lock.json` | Não | P | Médio (regressão de framework) | [T] |
| CR-3 | Fastify `POST /internal/webhooks/waha` assina corpo sem autenticar | Configurar HMAC nativo do WAHA (`webhooks[].hmac.key`) e validar `X-Webhook-Hmac` antes de assinar; restringir a rota à rede Docker interna. As sessões WAHA existentes precisam ser atualizadas | `services/whatsapp-api/src/app.ts:1066-1155`, `services/whatsapp-api/src/integrations/waha/client.ts:255-266` | Não | P/M | Médio (webhooks param se a chave não for aplicada a todas as sessões) | [T] + [P] |
| CR-4 | Dado de saúde sem base legal; consentimento falso na importação | **[J]** matriz finalidade × base legal (art. 7º/11), que fecha a DEC-005. **[T, já]** a importação deixa de gravar `consentimentoLgpd: true` sem evidência. **[T, depois da J]** tabela `lead_legal_bases` (lead, finalidade, base legal, versão do texto, origem, evidência, data, ator) substituindo o booleano | `bulk-import.ts:248,295`, `marketing-import/service.ts:361`, `manual-create.ts`, webhooks de lead, `schema.ts:421` e os leitores do campo | Sim (tabela nova) | M | Médio (muitos leitores de `consentimentoLgpd`) | [J] + [T] |

### Alto

| ID | Problema | O que mudar | Arquivos | Migration | Esforço | Risco | Tipo |
|---|---|---|---|---|---|---|---|
| AL-1 | Diretor gera e lê link de reset de qualquer membro (incluindo diretor e admin) | Bloquear alvo `isPlatformAdmin` e `director`; não devolver `resetUrl` quando o WhatsApp foi enviado; notificar o alvo; auditar ator e alvo | `src/features/team/password-recovery-scope.ts`, `password-recovery.ts:195-237,374-435` | Não | P/M | Médio (muda o fluxo dos diretores) | [T], com decisão [J] sobre quem pode resetar diretor |
| AL-2 | Platform admin sem 2FA obrigatório e sem reautenticação | Exigir 2FA ou passkey em `getRequiredPlatformAdmin`; sessão admin de 12 h; reautenticação antes de purge e criação de acesso; corrigir `/admin/login` para tratar `twoFactorRedirect` | `src/shared/auth/platform-admin.ts`, `src/features/platform-admin/service.ts`, `src/app/(auth)/admin/login/page.tsx` | Não | M | Médio (admin cadastra 2FA antes do deploy) | [T] |
| AL-3 | Senha mínima de 3 caracteres no primeiro acesso | Política única `src/shared/auth/password-policy.ts` (mínimo 10) usada por onboarding, convite, reset, admin e `emailAndPassword.minPasswordLength` | `onboarding-password-policy.ts`, `onboarding-actions.ts`, `invites.ts`, `recuperar-senha/actions.ts`, `platform-admin/service.ts`, `src/shared/auth/index.ts` | Não | P | Baixo | [T] |
| AL-4 | XSS refletido em `/api/avatar/[seed]` | Validar `size` (inteiro 16-512) e `style` (lista); escapar iniciais; resposta SVG com `CSP: default-src 'none'` | `src/app/api/avatar/[seed]/route.ts` | Não | P | Baixo | [T] |
| AL-5 | Sem HSTS e sem CSP global | HSTS (`max-age=31536000; includeSubDomains`) e CSP primeiro em `Report-Only`, depois aplicada | `next.config.ts` | Não | M | Médio (CSP mal ajustada quebra Meta SDK e realtime) | [T] |
| AL-6 | Webhook de lead com token público sem rate limit | Produzir o `RATE_LIMITED` já previsto: limite por credencial e por IP+telefone | `src/app/api/webhooks/leads/[token]/route.ts`, `webhooks/leads/route.ts`, `create-lead-from-webhook-sync.ts` | Opcional (contadores) | M | Médio (limite baixo perde lead em pico) | [T] |
| AL-7 | `better-auth@1.7.1`, `sharp@0.34.5`, `zod@4.4.3` vulneráveis | `better-auth` e `@better-auth/passkey` ≥1.7.7, `sharp@^0.35.5`, `zod@^4.6.6` | `package.json` | Não | P | Médio | [T] |
| AL-8 | `xlsx@0.18.5` sem patch, fazendo parse de upload no servidor | Migrar para o tarball oficial SheetJS 0.20.x (ou `exceljs`); limitar tamanho e linhas | 6 arquivos com `xlsx` (`marketing-import/service.ts`, `spreadsheet-actions.ts`, `duty-schedule-spreadsheet.ts`, `report-export-service.ts` e outros) | Não | M | Médio (import/export de planilha) | [T] |
| AL-9 | Preço de demonstração enviado ao lead sem "(exemplo)" | Bloquear "Enviar no WhatsApp" enquanto os dados forem mock, ou manter "demonstrativa (exemplo)" no texto | `src/features/broker-workspace/chat/quote-flow.ts:170-212` | Não | P | Baixo | [T] |
| AL-10 | Opt-out não vale para o titular (`waha_suppressions` nunca é gravada) | No "PARE" explícito, inserir em `waha_suppressions` (hash do telefone, motivo, origem) e checar a supressão também no outbox Meta | `conversation-state-machine.ts`, `ai-qualification/service.ts`, `communication-channels/outbound-service.ts` | Não (tabela já existe) | P | Baixo | [T]; a política de recontato é [J] |
| AL-11 | Conversa sem máscara para IA paga no exterior | Aplicar `maskPersonalData` (CPF, e-mail, agência/conta, linha digitável) também nos perfis pagos quando a tarefa não precisa do dado (conversation-intelligence, catálogo); ajustar o texto do cartão de consentimento | `src/features/ai-gateway/gateway.ts:217-219`, `privacy.ts`, `conversation-intelligence/analyzer.ts`, `consent-card.tsx` | Não | P/M | Baixo/médio (qualificação que precisa de CNPJ) | [T] |
| AL-12 | Não há como excluir ou anonimizar um titular; R2 sem delete | `deleteR2Object`; ação "Anonimizar/Excluir titular" (apaga objetos R2 de documentos e mídia, faz hard delete do lead com cascata e mantém só a auditoria); incluir R2 no purge de tenant; `broker_profiles` no expurgo de usuário | `src/shared/storage/r2-storage.ts`, `src/app/(dashboard)/leads/actions.ts`, `src/features/platform-admin/service.ts`, `purge-job.ts`, nova `src/features/data-subject/` | Talvez (tabela de solicitações) | M/G | **Alto** (exclusão irreversível; confirmação dupla e testes) | [T] |
| AL-13 | Sem export de dados do titular nem canal do encarregado | **[J]** nomear o encarregado e publicar o contato. **[T]** "Exportar dados do titular" (lead, beneficiários, mensagens, documentos, consentimentos, histórico) | `src/features/data-subject/`, super-admin | Talvez | M | Médio | [J] + [T] |
| AL-14 | Sem retenção | **[J]** tabela de prazos (lead não convertido, cliente, logs: 6 meses no Marco Civil, art. 15). **[T]** job `/api/internal/jobs/retention` (anonimiza ou apaga, junto com R2), em simulação primeiro, e registro no runbook | nova rota de job, `docs/runbooks/coolify-scheduled-tasks.md` | Talvez (prazo por tenant) | M | **Alto** (apagar dado errado) | [J] + [T] |
| AL-15 | Sem política de privacidade | **[J]** texto. **[T]** página pública `/privacidade` (controlador, finalidades, bases, suboperadores, transferência internacional, retenção, direitos, cookies, decisões automatizadas, encarregado); apontar login, wizard e landing para ela | novo `src/app/privacidade/page.tsx`, `login/page.tsx`, `src/app/page.tsx`, `onboarding-wizard.tsx` | Não | P (código) | Baixo | [J] + [T] |
| AL-16 | Suboperadores e transferência internacional não documentados | **[J]** lista com país, finalidade, DPA e cláusulas-padrão (Res. CD/ANPD 19/2024); resumo na política | `docs/security/suboperadores.md` | Não | M (jurídico) | — | [J] |
| AL-17 | Fonte proprietária "Amil Typeface" servida publicamente | Confirmar licença; se não houver, remover e usar fonte OFL | `public/fonts/Amil Typeface Bold.ttf`, `src/app/globals.css:57,66-67` | Não | P | Baixo (muda o logo) | [J] → [T] |
| AL-18 | Sem backup documentado nem teste de restauração | **[P]** confirmar plano e PITR do Supabase, versionamento do bucket R2 e snapshot do volume WAHA. **[T]** `docs/runbooks/backup-restore.md` (RPO/RTO) e `pg_dump` semanal cifrado para bucket separado via Scheduled Task; restore trimestral em staging | runbooks, script de dump | Não | M | Baixo | [P] + [T] |
| AL-19 | Sem error tracking nem alertas; login falho não auditado | **[J/P]** escolher Sentry (SaaS) ou GlitchTip (self-host no Coolify) e uptime (Uptime Kuma/Better Stack). **[T]** integrar; hook do better-auth gravando `auth.sign_in_failed` em `audit_logs` (IP truncado, e-mail com hash) | `src/shared/auth/index.ts`, `src/instrumentation.ts` | Não | M | Baixo | [J/P] + [T] |
| AL-20 | Sem playbook de incidente nem procedimento ANPD | `docs/runbooks/incidente-seguranca.md` (severidade, papéis, contenção, rotação de segredos, preservação de logs, pós-mortem) e `docs/security/notificacao-incidentes-lgpd.md` (3 dias úteis, conteúdo mínimo, modelo ao titular, registro de incidentes por 5 anos) | docs | Não | P/M | — | [T] (rascunho) + [J] (papéis, encarregado, validação) |
| AL-21 | CI não roda no que vai para produção | Gatilho do CI em todas as branches; Node 22; `npm audit --omit=dev --audit-level=high`; Coolify só faz deploy de commit com check verde (ou voltar a promover via `main`) | `.github/workflows/ci.yml`, Coolify | Não | P | Baixo | [T] + [P] (fluxo de deploy) |
| AL-22 | Sem ROPA, RIPD nem política formal | Rascunho técnico de ROPA e RIPD (fluxos de qualificação, documentos e IA) para o jurídico completar; política de segurança e calendário de revisão trimestral | `docs/security/ropa.md`, `docs/security/ripd.md`, `docs/security/politica-seguranca.md` | Não | M | — | [T] (rascunho) + [J] |
| AL-23 | Depoimentos e números sem fonte na landing | Remover a seção de depoimentos, ou trocar por reais com autorização arquivada; remover ou comprovar "15k+ leads", "98% uptime" etc.; tirar "Preços → #" e "Criar conta gratuita" se não houver oferta | `src/app/page.tsx:308-311,508-560,605-676` | Não | P | Baixo | [J] (decisão) → [T] |
| AL-24 | Aviso de estimativa ausente no cartão de cotação; link `/cotacao/<token>` quebrado | Aviso único "valores estimados, sujeitos à análise da operadora…" no cartão e no PDF; trocar o link pelo PDF público ou criar a página | `src/features/quotes/utils.ts:101-130`, `src/app/api/quotes/[token]/pdf/route.ts` | Não | P | Baixo | [T]; texto do aviso [J] |

### Médio

| ID | Problema | O que mudar | Migration | Esforço | Tipo |
|---|---|---|---|---|---|
| ME-1 | Mídia do WhatsApp servida inline com MIME do remetente | `attachment` + `application/octet-stream` para HTML/SVG/XML; `nosniff` e `CSP: sandbox` nas respostas de mídia, documento e material; avatar de contato só jpeg/png/webp | Não | P | [T] |
| ME-2 | Route handlers com cookie sem checagem de `Origin` | Helper `assertSameOrigin(request)` em todo handler mutável; exigir `application/json` | Não | M | [T] |
| ME-3 | Rate limit de login em memória; reset sem limite por IP; `/api/chat` sem limite nem validação | `rateLimit: { storage: "database", customRules }` e `ipAddressHeaders: ["cf-connecting-ip"]`; limitador nas actions públicas; `/api/chat` e agent-drawer passando pelo limitador do gateway, com zod (só `user`/`assistant`, tamanho máximo) | Sim (tabela `rateLimit` do better-auth) | M | [T] |
| ME-4 | Token de reset em texto puro | Gravar `sha256(token)` e buscar pelo hash (invalida links pendentes) | Sim | P | [T] |
| ME-5 | Planilha pública: token fraco, sem expiração, senha sha256 sem sal | Token `randomBytes(32)`, `public_expires_at`, revogação, scrypt, `timingSafeEqual`, limite por IP+token, auditoria de acesso | Sim | M | [T] |
| ME-6 | PDF de cotação público: token fraco, sem expiração | Token de 32 bytes, `expires_at` (ex.: 30 dias), revogação | Sim | P/M | [T] |
| ME-7 | Download de documento sem escopo para supervisor e gestor sem unidade | Usar o escopo estrito de papel dos outros módulos; gestor sem unidade é negado | Não | P | [T] |
| ME-8 | `/api/health` público expõe `lastError` e métricas | Público só com `status`; detalhes atrás de `CRON_SECRET` ou platform admin (ajustar o monitor externo) | Não | P | [T] |
| ME-9 | TLS do Postgres não forçado | `ssl: "require"` em produção; "Enforce SSL" no Supabase (testar em staging) | Não | P | [T] + [P] |
| ME-10 | Chaves de IA e `webhook_secret` OpenWA em texto puro | Cifrar com AES-GCM (env `AI_KEYS_ENCRYPTION_KEY`) e script de recifra; remover a rota OpenWA se aposentada | Não (dados) | P | [T] |
| ME-11 | PII e erro cru em logs | Remover nome e telefone dos logs do ingest Meta; helper `logError` sem `params:` do Drizzle; regra de lint contra `console.error(x, error)`; `/api/chat` não devolve `error.message` | Não | M | [T] |
| ME-12 | Auditoria administrativa incompleta | `requestId`, IP e resultado nos eventos; auditoria na mesma transação; falha de auditoria em ação crítica aborta; ator real no "Ver como"; `tenant_id` e IP (hash) em `audit_logs` | Sim (colunas) | M | [T] |
| ME-13 | Termos: versão gravada errada, sem IP/UA, sem reaceite, dois textos | Constante `TERMS_VERSION` única; gravar IP e UA; reaceite quando a versão subir; mesmo texto no wizard e em `/termos` | Não | P | [T] + [J] (texto definitivo) |
| ME-14 | Identificação do fornecedor ausente | Rodapé legal (razão social, CNPJ, endereço, contato, SUSEP se aplicável) na landing, termos, política e PDF de cotação; marca unificada | Não | P | [J] (dados) + [T] |
| ME-15 | Aviso de IA só uma vez e editável; templates turbo sem aviso | Frase fixa e não editável "atendimento automatizado (IA)" na 1ª mensagem e nos templates (os templates exigem nova aprovação na Meta); canal de revisão de decisão automatizada na política | Não | P | [T] + [J] |
| ME-16 | Sem Dependabot; `npm ci \|\| npm install` | `.github/dependabot.yml` (npm, docker, actions); só `npm ci` no Dockerfile | Não | P | [T] |
| ME-17 | `check-security` nunca falha; sem SAST; e2e negativo inexistente | `check-security` sai com erro; CodeQL ou Semgrep e gitleaks no CI; spec Playwright com 2 tenants (URL direta de outro tenant → 403/404) | Não | M | [T] |
| ME-18 | Sem pentest | Contratar pentest externo (auth, multi-tenant, uploads, webhooks, extensão); no mínimo ZAP baseline em staging | Não | M/G | [J/P] |
| ME-19 | Sem SECURITY.md/SLA; imagem sem pin nem scan | `SECURITY.md` (contato, SLA: crítica 48 h, alta 7 d, média 30 d); registro de aceite de risco; `FROM node:22-alpine@sha256:…` com Dependabot; Trivy no CI | Não | P | [T] + [J] (SLA) |
| ME-20 | Lint não bloqueia; sem CODEOWNERS | Baseline do ESLint e bloqueio de erros novos; `CODEOWNERS` para auth, drizzle, proxy, Dockerfile e `.github`; proteção de branch | Não | M | [T] + [P] |
| ME-21 | Finalidades sem documentação (CAPI Meta, aprendizado de situações) | Entram na ROPA e na política | Não | P | [J] |
| ME-22 | Remix Icon License (não OSI) | Revisar termos; se houver conflito, trocar por Hugeicons/Lucide, já presentes | Não | P/M | [J] → [T] |
| ME-23 | Backups ad-hoc de produção na máquina local | Regra de retenção curta, cifra e descarte; registrar no runbook | Não | P | [P] |

### Baixo

Agrupados no lote 9, em um único PR de higiene [T], sem migration:
- `protectedPathPrefixes` desatualizado: passar a deny-by-default no proxy.
- Revogação de sessão leva até 60 s: invalidar caches nos pontos de revogação.
- Reset de senha não revoga os tokens da extensão.
- Staging como `trustedOrigin` em produção.
- `CRON_SECRET` comparado sem tempo constante: helper `isCronAuthorized`.
- Update só por `id` depois do select com tenant: incluir `tenantId` no `where`.
- `/l/[id]/feedback` sem escopo de lead.
- `GET /view-as/exit` muda estado: passar para POST.
- Callback OAuth Meta valida `state` depois da troca do `code`.
- `verifyMetaWebhookSignature` compara strings em vez de buffers.
- Nonce WAHA não guardado.
- Webhooks sem limite de corpo.
- `/api/internal/performance` anônimo.
- Rota OpenWA carrega todos os leads em memória.
- Chave de fallback fixa em `meta-oauth.ts`.
- Telefones em claro em logs.
- `purgeUserLGPD` sem proteção contra o próprio admin.
- Cookie do simulador de cargo sem `secure`.
- Compose OpenWA em `0.0.0.0`.
- `curl` no runner.
- Node 20 no CI.
- `.gitignore`: `.env*` anula a exceção e falta `env-recuperados/`.
- `CRON_SECRET=change-me` no exemplo.
- Inter sem `OFL.txt`.
- `"license": "UNLICENSED"`.
- SBOM no CI.
- Regra de lint para `sql.raw`.
- `formData` com allowlist de campos (o que fica na allowlist é decisão [J]).
- Seção de cookies na política [J].
- Fechar itens abertos da revisão de 2026-09-08 (M5, A3).

---

## 2. Lotes (cada um vira uma branch)

A ordem leva em conta o risco imediato e a dependência de decisão jurídica. Os lotes 1 a 4 não dependem de você e podem começar logo depois da aprovação.

| Lote | Branch sugerida | Conteúdo | Migration | Esforço | Depende de |
|---|---|---|---|---|---|
| **0** | — (ação sua, sem código) | CR-1: trocar a senha do admin e ativar 2FA. Conferir se o Fastify é alcançável de fora (CR-3). Abrir `public/CRM_HOSTINGER_VPS.pdf` e decidir se sai do `public/`. Confirmar backups no Supabase e na Hostinger | — | Horas | Você |
| **1** | `fix/seg-dependencias` | CR-2, AL-7, ME-16 (Dependabot, `npm ci`) | Não | P/M | — |
| **2** | `fix/seg-superficie-publica` | CR-3 (código), AL-4, AL-6, ME-1, ME-8, e os baixos de webhook (nonce, buffer, limite de corpo, OAuth state, cron em tempo constante) | Não (contadores opcionais) | M | Lote 0 (exposição do Fastify) |
| **3** | `fix/seg-auth-admin` | CR-1 (script), AL-1, AL-2, AL-3, ME-4, e os baixos de auth (extensão no reset, trustedOrigins, purge do próprio admin, cookie `secure`) | Sim (`token_hash` do reset) | M | Decisão sobre quem reseta diretor (AL-1) |
| **4** | `fix/lgpd-correcoes-rapidas` | AL-9, AL-10, AL-11, AL-24 (sem o texto final do aviso), parte técnica de CR-4 (importação sem `true` falso), `broker_profiles` no expurgo | Não | M | — |
| **5** | `fix/seg-headers-csrf-ratelimit` | AL-5 (HSTS e CSP em Report-Only), ME-2, ME-3, ME-9 | Sim (tabela `rateLimit`) | M | Lote 1 (better-auth atualizado) |
| **6** | `fix/seg-escopo-auditoria-logs` | ME-5, ME-6, ME-7, ME-10, ME-11, ME-12, e os baixos de escopo (feedback, update com tenant, proxy deny-by-default, view-as) | Sim (`expires_at`, colunas de auditoria) | M/G | — |
| **7** | `fix/seg-xlsx` | AL-8 | Não | M | — |
| **8** | `chore/seg-ci-governanca` | AL-21, ME-17, ME-19, ME-20, SBOM, `.gitignore`, `SECURITY.md`, AL-19 (Sentry ou GlitchTip e auditoria de login falho) | Não | M | Escolha do Sentry e do fluxo de deploy |
| **9** | `chore/seg-higiene` | Baixos restantes | Não | P/M | — |
| **10** | `docs/seg-processos` | AL-18 (runbook e dump), AL-20, AL-22 (rascunhos), ME-23, ME-18 (escopo do pentest) | Não | M | Revisão jurídica dos rascunhos |
| **11** | `feat/lgpd-paginas-legais` | AL-15, ME-13, ME-14, ME-15, AL-23, AL-17, cookies e decisões automatizadas na política | Não | P/M (código) | **Textos jurídicos** |
| **12** | `feat/lgpd-titular` | CR-4 (tabela de base legal), AL-12, AL-13, AL-14 (job de retenção em simulação primeiro) | Sim | G | **Matriz de base legal, prazos de retenção, encarregado** |

O pentest externo (ME-18) é melhor depois dos lotes 1 a 6, para não pagar por achados já conhecidos.

---

## 3. O que depende de você (jurídico, negócio, painel)

**Decisões e textos [J]:**
1. Matriz finalidade × base legal (art. 7º e 11), que fecha a DEC-005 e destrava CR-4 e o lote 12.
2. Encarregado (DPO): nome e canal público.
3. Prazos de retenção por categoria (lead não convertido, cliente, conversas, documentos, logs).
4. Política de privacidade (texto) e termos de uso definitivos, com razão social, CNPJ, endereço e SUSEP, se aplicável.
5. Lista de suboperadores com DPA e cláusulas-padrão ANPD para a transferência internacional (OpenAI, Anthropic, OpenRouter, Google, Groq, Meta, Supabase, Cloudflare, Hostinger).
6. ROPA e RIPD: eu entrego o rascunho técnico e o jurídico completa.
7. Papéis no incidente e validação do procedimento ANPD.
8. Texto do aviso de preço estimado (ANS/SUSEP) e do aviso de IA; política de recontato após opt-out.
9. Landing: manter, comprovar ou remover depoimentos e números; manter ou não "Criar conta gratuita" e "Preços".
10. Licença da fonte Amil e revisão da Remix Icon License.
11. Quem pode resetar a senha de um diretor (AL-1).
12. SLA de vulnerabilidades, contratação de pentest e escolha e custo do Sentry ou GlitchTip.

**Painel e processo [P]:**
1. Rotação da senha do admin e 2FA (lote 0).
2. Exposição do Fastify e firewall.
3. Plano e PITR do Supabase, "Enforce SSL", `sslmode`.
4. R2 privado e versionamento.
5. Snapshots Hostinger e volume WAHA.
6. HSTS e modo SSL na Cloudflare.
7. `NODE_ENV` e réplicas no Coolify.
8. Proteção de branch no GitHub e deploy só com CI verde.
9. Configuração da política no formulário Lead Ads e reaprovação dos templates na Meta.

**Técnico [T]:** todo o resto. Os lotes 1 a 9 são quase todos técnicos e não esperam jurídico, salvo os pontos marcados.

---

## 4. Andamento

| Lote | Branch | Estado | Observações |
|---|---|---|---|
| 1 | `fix/seg-dependencias` | Na branch de deploy (`feat/diretor-visual-lite`) | next 16.4.5, better-auth 1.7.18, sharp 0.35.5, zod 4.6.7, Dependabot, `npm ci` estrito. O zod 4.6 mudou o preprocess de campos ausentes: 11 campos de plantão/distribuição ajustados. |
| 2 | `fix/seg-superficie-publica` | Na branch de deploy | CR-3 em duas fases (token `x-ancora-waha-token`; ver `docs/integrations/waha-webhook.md`), AL-4 avatar, ME-1 mídia/documentos/materiais com `safeFileHeaders`, avatar de contato só raster, AL-6 rate limit no webhook de lead (60/min e 600/h por credencial; 10/min por visitante quando há `cf-connecting-ip`), ME-8 `/api/health` público só com status, `CRON_SECRET` em tempo constante (21 rotas), assinatura Meta por buffer, `state` do OAuth validado antes da troca do code, limite de 1 MB no corpo dos webhooks. Pendente do lote: nonce do HMAC WAHA (baixo). **Ação sua:** fases 1-3 do token WAHA no Coolify. |
