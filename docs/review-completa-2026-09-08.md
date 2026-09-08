# Relatório de Revisão Completa — CorreTop

**Data:** 2026-09-08
**Escopo:** revisão geral do repositório (`src/`, infra, docs, CI) — qualidade, segurança,
arquitetura, testes, dívida técnica e governança.
**Método:** execução dos checks do harness (`agent:verify fast/full`, lint, type-check,
testes, build), varreduras estáticas (segredos, env em client, rotas, `any`, `console.log`,
auditoria, isolamento de tenant) e leitura dirigida de componentes críticos (auth,
webhooks, exports, jobs, proxy, layouts).

---

## 1. Resumo executivo

| Check | Resultado | Observação |
|---|---|---|
| `npm run build` | ✅ Passa | inclui `build:extension` no prebuild |
| `npm run type-check` | ✅ Passa | `tsc --noEmit` limpo |
| `npm test` | ✅ **668/668** | **3 arquivos de teste corrigidos nesta revisão** (isolamento de env) |
| `npm run lint` | ❌ **18 erros / 1.119 warnings** | erros reais de React + `require()` em produção; lint não bloqueia no CI (por design) |
| `agent:verify --level fast` | ✅ Passa | evidência em `reports/agent/verification/2026-09-08T15-17-04.446Z.md` |
| `agent:architecture/security/performance` | ✅ 0 achados | diagnósticos heurísticos rasos |
| Segredos hardcoded (`sk-`, `ghp_`, `AIza…`) | ✅ 0 ocorrências | — |
| `eval(` / `dangerouslySetInnerHTML` | ✅ sem risco | só CSS interno em `chart.tsx` |
| `NEXT_PUBLIC_*` | ✅ só valores públicos | verificado nos 2 client components que usam `process.env` |

**Veredito geral:** base sólida — isolamento multi-tenant e auditoria estão bem
implementados, testes cobrem bem o domínio e o build está verde. A dívida concentra-se
em **higiene de código (lint)**, **drift de documentação/decisões**, **testes que
vazam ambiente**, e **listas de rotas/proteção mantidas à mão**.

---

## 2. Pontos fortes (o que está bem feito)

1. **Isolamento multi-tenant exemplar.** `getRequiredTenantContext()` (`src/shared/auth/tenant-context.ts`)
   deriva tenant/role/unidade exclusivamente da sessão do servidor, valida status do
   usuário, membership, tenant e unidade, e usa `cache()` por request. O layout de
   `(dashboard)` e o de `super-admin` revalidam em toda navegação.
2. **Webhooks com assinatura e tenant derivado do canal, não da URL.**
   - OpenWA: HMAC-SHA256 com `timingSafeEqual` + `tenantId` resolvido pela conexão
     assinada (`src/app/api/webhooks/openwa/[tenantId]/route.ts`) — excelente.
   - Meta Lead Ads: verificação `x-hub-signature-256` + modo `verify_token`.
   - WAHA relay: assinatura própria (`verifyRelaySignature`).
3. **Auditoria onipresente em mutações críticas.** `schema.auditLogs` é gravado em
   transação nas ações de leads, qualificação, feedback, SLA, webhooks, disponibilidade,
   tarefas e reatribuições (36+ pontos em `src/features/leads`).
4. **Harness de engenharia funcional.** `agent:context`, `agent:verify`, `agent:record`
   e relatórios com evidência em `reports/agent/verification/` — processo sério e
   verificável.
5. **CI com portões reais.** `.github/workflows/ci.yml` bloqueia em docs, arch, security,
   performance, type-check, testes e build. Lint roda com `continue-on-error` (dívida
   declarada, ENG-001).
6. **Jobs internos protegidos** por `CRON_SECRET` Bearer; `/api/internal/vps-health`
   exige platform-admin.
7. **Docs ricos e controlados:** `decision-log.md`, 12 ADRs, `UX_REDESIGN_CONTRACT.md` +
   `UX_REDESIGN_CONTROL.md` com próxima ação obrigatória definida (M1.10).
8. **`proxy.ts` (Next 16)** com cache de sessão, timeout de 3s, `x-request-id`,
   medição de spans e bypass consciente de Supabase quando não há cookie — bem pensado.

---

## 3. Problemas encontrados (por severidade)

### 🔴 Alta prioridade

#### A1. Testes que dependem do ambiente real (`ai-agent`)
Os testes de `model-router`, `service` e `conversation-state-machine` liam
`GROQ_API_KEY`/`OPENROUTER_API_KEY`/`DATABASE_URL` do `.env.local` carregado pelo
Vitest. Consequências observadas:
- **Falhas locais** (`npm test` falhava 2 testes) **que passavam no CI** (sem as chaves).
- Teste de fallback chegou a **fazer chamada de rede real** à Groq (timeout de 5s).

**Status:** ✅ **corrigido nesta revisão** — `beforeEach` isola as variáveis nos 3
arquivos (`src/features/ai-agent/{model-router,service,conversation-state-machine}.test.ts`).
**Ação complementar:** revisar `qualification-timeout-sweep.test.ts`, que tenta conectar
no pooler real do Supabase (~2,5s por execução) e deveria usar mock de conexão.

#### A2. Erros de lint que são bugs reais de React (não só estilo)
18 erros em 9 arquivos:
- **Mutação de estado durante render** (`react-hooks/immutability`) em
  `src/app/(dashboard)/equipe/recuperacoes/recovery-requests-table.tsx`
  (`approveState.message = undefined`), e padrão `prevError[0] = …` (useState usado como
  ref) em `leads/distribuicao/_components/distribution-dashboard.tsx` e
  `distribution-inbox.tsx`. Consequência: toasts podem disparar múltiplas vezes ou
  perder estados; viola as regras do React. **Já existe o hook correto**
  (`src/hooks/use-action-dialog-lifecycle.ts`) que não é usado nesses pontos.
- **`react-hooks/rules-of-hooks`** (hook condicional) em
  `src/components/motion/file-upload.tsx` — risco real de crash intermitente.
- **"Cannot create components during render"** em `src/components/ui/breadcrumb.tsx`.
- **`prefer-const`** e **`@typescript-eslint/no-require-imports`** (12) — `require()`
  em produção em `webhooks/openwa/[tenantId]/route.ts`, `features/branches/queries.ts`,
  `shared/auth/authorization-service.ts`, `hooks/use-action-dialog-lifecycle.ts`,
  `lib/compose-refs.ts`, `components/ui/sidebar.tsx` etc. Trocar por import estático ou
  `createRequire` justificado.

#### A3. Exportação de comissões sem auditoria
`src/app/api/internal/export/commissions/route.ts` (CSV/XLSX com dados financeiros e
pessoais) valida permissão (`exportar_relatorios`), mas **não grava `auditLogs`**.
`AI_RULES.md` exige auditoria imutável para exportações. O `export-service.ts` também não
audita. **Ação:** registrar `entidade: "comissao_export"` com tenant/user/periodo/filtros.

#### A4. `proxy.ts`: lista de rotas protegidas desatualizada + checagem por presença
- **15 prefixos obsoletos** (rotas que não existem mais): `/metas`, `/catalogo`,
  `/minha-meta`, `/financeiro`, `/diretor`, `/gestor`, `/corretor`, `/checklist`,
  `/materiais-divulgacao`, `/automacoes`, `/inteligencia`, `/cotacao`, `/tarefas`,
  `/agentes-ia`, `/ferramentas-vendas`.
- **Rotas novas fora da lista**: `/assinatura`, `/distribuicao`, `/fluxos-whatsapp`,
  `/integridade`, `/settings`, `/unidades`, `/super-dev`, `/internal/*`.
- A checagem de rota protegida usa **presença do cookie**, não validade do token
  (a validade só é consultada para o fluxo de onboarding); os layouts revalidam no
  servidor, então o risco real é baixo — mas a camada de defesa em profundidade está
  furada e a lista exigirá manutenção eterna.
- **Prefetch ignora a checagem de sessão** (`isNavigationPrefetch` retorna antes).

**Ação:** derivar a lista do diretório de rotas (script) ou restringir o matcher a
grupos protegidos; validar o token do cookie sempre que a sessão existir (com cache,
como já é feito para onboarding).

### 🟠 Média prioridade

#### M1. Drift documental — DEC-042 (cron Vercel) nunca fechado
`docs/decision-log.md` DEC-042 segue **"Contingência temporária; upgrade urgente
pendente"**, mas `vercel.json` já usa crons nativos do Vercel Pro (`*/2 * * * *`, 8 crons)
e `.github/workflows/scheduled-jobs.yml` confirma a migração. **A decisão foi tomada e
nunca registrada** — viola a governança do próprio projeto.

#### M2. Referência morta: `docs/ux-audit-2026-07-13.md`
Referenciado como consulta obrigatória em `AI_RULES.md` (linha 138),
`docs/engineering-checklist.md` e `docs/product/plano-simplificacao-filas.md`, mas o
**arquivo não existe** (nem em `docs/_archive`). Provavelmente substituído por
`docs/ux/UI_SIMPLIFICATION_AUDIT.md` sem atualizar as referências. Atualizar os 3
documentos ou restaurar o arquivo.

#### M3. Roadmap com 82 itens `partial` de 226
`src/features/roadmap/roadmap-data.ts`: 132 `done`, **82 `partial`**, 9 `planned`, 3
`external`. Muitos itens parciais refletem entregas sem a superfície de governança
super-admin que `AI_RULES.md` exige (auditável, editável, ativável/desativável). Revisar
o backlog e fechar ou reabrir com registro.

#### M4. Lint com 1.119 warnings — ruído que esconde problemas
- **568** `no-unused-vars` (o maior bloco — limpeza mecânica possível)
- **219** `no-explicit-any` (só 1 arquivo tem >10: `src/types/react-aria-components.d.ts`, ok)
- **157** `no-unused-expressions`
- **49** `set-state-in-effect`, **28** `refs`, **18** `exhaustive-deps`, **15** `immutability`

Sugestão: campanha por domínio (ENG-001) com lint bloqueante no CI ao final.

#### M5. `/api/health` público expõe status de dependências e métricas
Retorna matriz de saúde (DB etc.) e resumo p50/p95/p99 sem autenticação. Útil para
monitoramento, mas revela infraestrutura e carga. Considerar token de monitoramento ou
restrição (o `/api/internal/vps-health` já exige platform-admin).

#### M6. Monólitos de arquivo
- `src/shared/db/schema.ts`: **4.283 linhas**
- `src/features/ai-agent/conversation-state-machine.ts`: 1.794
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx`: 1.740
- `src/app/(platform-admin)/super-admin/settings/page.tsx`: 1.729
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`: 1.639
- Ações coladas em páginas (`equipe/actions.ts` 828, `super-admin/actions.ts` 825)

Dificulta revisão e testes. Quebrar schema por domínio e extrair actions para
`src/features/*`.

### 🟡 Baixa prioridade

- **B1. Bibliotecas de UI sobrepostas:** ícones — `lucide-react` (73 arquivos),
  `@phosphor-icons/react` (9), `@remixicon/react` (5), `@hugeicons` (9) e `cuelume`
  instalado e **sem uso**. Primitivas — `@base-ui` (19), `react-aria` (11), `radix-ui`
  (5), `@radix-ui/*` avulsos. Padronizar (1 set de ícones; 1 família de primitivas)
  reduz bundle e manutenção.
- **B2. `console.log` em produção:** 22 ocorrências em 13 arquivos, incluindo webhooks
  (`meta/lead-ads`) e páginas. Preferir logger estruturado; os spans
  (`shared/observability/middleware-timing`) já são o caminho certo.
- **B3. Duas listas manuais de rotas para manter sincronizadas:** `proxy.ts` e a lista
  `allowedLightPrefixes`/`restrictedPrefixes` no `(dashboard)/layout.tsx` (Corretor
  Lite e cargo marketing). Fontes únicas ou script de verificação evitam regressão.
- **B4. `CRON_SECRET=change-me`** como default em `.env.example` — risco só se copiado
  para produção; vale um placeholder com aviso em vermelho.
- **B5. Documentos soltos na raiz:** `ETAPA_IA_CONVERSATION_INTELLIGENCE.md`,
  `PRODUCT.md`, `CLAUDE.md`, `nexus-analytics-dashboard-DESIGN.md`, `codex.toml` —
  migrar para `docs/` ou `docs/_archive/` conforme valor.
- **B6. Fase UX:** etapa **UX-M1.10 — Mobile QA transversal** com
  `IMPLEMENTATION_COMPLETE_QA_PENDING`; próxima ação obrigatória é a matriz visual
  autenticada em viewports 320–430px. Nenhum trabalho de UI deve avançar antes.

---

## 4. O que foi corrigido nesta revisão

| Item | Mudança | Arquivos |
|---|---|---|
| Testes env-dependentes | `beforeEach` isolando chaves de IA e URLs de DB; import de `beforeEach` adicionado | `src/features/ai-agent/model-router.test.ts`, `service.test.ts`, `conversation-state-machine.test.ts` |

**Validação:** `npm test` 668/668 ✅ · `type-check` ✅ · `agent:verify fast` ✅
(evidência `reports/agent/verification/2026-09-08T15-17-04.446Z.md`).

---

## 5. Plano de ação sugerido (priorizado)

**P0 (curto prazo)**
1. Corrigir os erros de lint de React (A2) — usar `useActionDialogLifecycle`; revisar
   `file-upload.tsx` (hook condicional) e `breadcrumb.tsx` (componente em render).
2. Adicionar auditoria na exportação de comissões e em outras exportações (A3).
3. Sincronizar `proxy.ts` com as rotas reais e validar token na sessão (A4).

**P1 (médio prazo)**
4. Atualizar `DEC-042` (fechar a contingência) e a referência a `ux-audit-2026-07-13.md` (M1/M2).
5. Campanha de limpeza de lint por domínio (M4) e ativar lint no CI.
6. Reduzir os 82 itens `partial` do roadmap com registro honesto (M3).
7. Revisar `qualification-timeout-sweep.test.ts` para não tocar o DB real (A1).

**P2 (estrutural)**
8. Quebrar `schema.ts` e os monólitos de 1.5k+ linhas (M6).
9. Padronizar ícones/primitivas e remover `cuelume` (B1).
10. Centralizar listas de rotas/permissões de acesso (B3) e restringir `/api/health` (M5).

---

## 6. Evidências coletadas

**Comandos executados:** `npm run lint` (18E/1119W), `npm run type-check` (ok),
`npm test` (668/668 após correção), `npm run build` (ok, 90 rotas), `npm run agent:verify
--level fast` (ok, relatório registrado), `agent:architecture|security|performance` (0
achados), greps de segredos/`NEXT_PUBLIC_`/`dangerouslySetInnerHTML`/`eval`/`require`/
`console.log`, comparação de rotas reais × `proxy.ts`, leitura de auth/tenant-context/
webhooks/exports/jobs/CI/vercel.json/decision-log/roadmap/UX control.

**Arquivos-chave lidos:** `src/proxy.ts`, `src/shared/auth/tenant-context.ts`,
`src/shared/auth/platform-admin.ts`, `src/app/(dashboard)/layout.tsx`,
`src/app/(platform-admin)/super-admin/layout.tsx`, `src/features/ai-agent/*`,
`src/app/api/internal/jobs/distribution/route.ts`, `src/app/api/internal/export/
commissions/route.ts`, `src/app/api/webhooks/{openwa,meta/lead-ads,waha}/route.ts`,
`vercel.json`, `.github/workflows/*.yml`, `.env.example`, `docs/decision-log.md`,
`src/features/roadmap/roadmap-data.ts`, `docs/ux/UX_REDESIGN_CONTROL.md`.

---

*Relatório gerado em revisão completa em 2026-09-08. Revisões futuras devem comparar os
portões (build, type-check, testes, lint) e revalidar os itens P0/P1 acima.*