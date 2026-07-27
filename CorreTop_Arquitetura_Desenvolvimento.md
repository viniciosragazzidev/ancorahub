# CorreTop — Arquitetura de Desenvolvimento e Padrões de Engenharia

**Versão:** 1.0
**Data:** Julho/2026
**Escopo:** Guia técnico de como o sistema deve ser construído — estrutura, convenções, fluxo de trabalho e processos. Complementa o Documento de Requisitos (funcional/UX/negócio).

---

## 1. Visão Geral

Este documento define **como** o CorreTop será construído, de forma concisa e padronizada, para que o código permaneça manutenível mesmo em regime de crunch solo, e para que a base já esteja pronta para receber outros desenvolvedores no futuro, caso seja necessário.

Princípio orientador: **processo leve o suficiente para não travar um dev solo, mas rigoroso o suficiente para que ninguém (nem você, daqui a 3 meses) precise adivinhar uma convenção.**

---

## 2. Stack Consolidada

| Camada | Tecnologia | Observação |
|---|---|---|
| Framework | Next.js (App Router) | Full-stack em um único projeto |
| Linguagem | TypeScript | Ponta a ponta, modo estrito (`strict: true`) |
| Banco de dados | PostgreSQL | Gerenciado via Neon ou Supabase |
| ORM | Drizzle ORM | Migrations versionadas no repositório |
| Autenticação | BetterAuth | Multi-tenant, sessões, 2FA opcional (TOTP) |
| Validação | Zod | Nas rotas de API, Server Actions e formulários |
| Estilo | Tailwind CSS | Variáveis CSS para tema (claro/escuro/white-label) |
| Componentes UI | shadcn/ui + extensões compatíveis com o CLI do shadcn | Instalados via CLI, customizados no projeto (não é dependência de pacote fechado) |
| Estado do servidor (cliente) | TanStack Query (React Query) | Cache e sincronização de dados assíncronos |
| Comunicação frontend-backend | Server Actions (mutações simples) + API Routes (webhooks externos, integrações) | Ver critério de escolha na Seção 6 |
| Testes unitários | Vitest | Colocado junto ao código (`*.test.ts`) |
| Testes E2E | Playwright | Fluxos críticos apenas (ver Seção 9) |
| CI/CD | GitHub Actions + deploy automático via Vercel | Pipeline detalhado na Seção 8 |
| Monitoramento de erros | Sentry | Erros de frontend e backend no mesmo painel |
| Hospedagem | Vercel | Aplicação |
| Storage de documentos | S3-compatible (Cloudflare R2 ou storage do Supabase) | — |
| Comunicação com lead | Meta Cloud API (integração direta, sem BSP) | Conta Meta Business única e verificada da CorreTop; números de cada tenant adicionados manualmente pela equipe |

---

## 3. Estrutura de Pastas (Organização por Domínio)

Estrutura orientada a **domínio/funcionalidade**, não por camada técnica — cada módulo do negócio (leads, cotação, comissão, integridade, etc.) vive em sua própria pasta, com tudo que ele precisa dentro (componentes, lógica, tipos, testes).

```
corretop/
├── app/                          # Rotas do Next.js (App Router)
│   ├── (auth)/                   # Rotas de autenticação (login, convite, 2FA)
│   ├── (dashboard)/               # Rotas autenticadas, agrupadas por papel
│   │   ├── diretor/
│   │   ├── gestor/
│   │   └── corretor/
│   ├── api/                       # API Routes (webhooks externos, integrações)
│   │   ├── webhooks/leads/[tenantId]/
│   │   └── webhooks/whatsapp/
│   └── layout.tsx
│
├── features/                      # Núcleo do domínio de negócio
│   ├── leads/
│   │   ├── components/            # UI específica de leads
│   │   ├── actions.ts              # Server Actions de leads
│   │   ├── queries.ts               # Leituras (via Drizzle)
│   │   ├── schema.ts                 # Validação Zod
│   │   ├── types.ts
│   │   └── leads.test.ts
│   ├── distribution/               # Round-robin + SLA + estagnação
│   ├── quotes/                      # Cotador
│   ├── documents/                   # Gestão documental + checklist
│   ├── commissions/                  # Motor de comissão
│   ├── customers/                     # Pós-venda / Cliente Ativo
│   ├── integrity/                     # Painel de integridade/antifraude
│   ├── goals/                          # Metas comerciais
│   ├── branches/                        # Filiais/unidades
│   └── billing/                          # Assinatura do tenant
│
├── shared/                          # Código compartilhado entre domínios
│   ├── ui/                          # Componentes shadcn/ui customizados
│   ├── db/                           # Conexão Drizzle, schema global, client
│   ├── auth/                          # Helpers de sessão/permissão (BetterAuth)
│   ├── tenant/                         # Middleware/helpers de isolamento multi-tenant
│   └── utils/
│
├── drizzle/                          # Migrations versionadas
├── e2e/                               # Testes Playwright
├── docs/                              # Documentação técnica (Seção 12)
│   ├── adr/                           # Architecture Decision Records
│   └── README.md
├── .github/workflows/                 # Pipelines de CI/CD
├── .env.example
└── package.json
```

**Regra de ouro:** se uma nova funcionalidade não se encaixa claramente em uma pasta de `features/`, é sinal de que talvez precise virar um novo domínio, não ser espalhada em `shared/`.

---

## 4. Convenções de Código

### 4.1 Lint e Formatação
- **ESLint + Prettier configurados com regras rigorosas desde o início** (decisão do projeto).
- ESLint estendendo `next/core-web-vitals` + regras de TypeScript estritas (`@typescript-eslint/recommended-requiring-type-checking`).
- Prettier com configuração fixa no repositório (`.prettierrc`), sem divergência de estilo entre arquivos.
- **Nenhum PR/commit deve passar com erros de lint** — configurar como *pre-commit hook* (ver Seção 4.3).

### 4.2 Nomenclatura
| Item | Convenção | Exemplo |
|---|---|---|
| Arquivos de componente | PascalCase | `LeadDetailCard.tsx` |
| Arquivos utilitários/lógica | camelCase | `calculateCommission.ts` |
| Pastas | kebab-case | `features/leads` |
| Variáveis e funções | camelCase | `getLeadById` |
| Tipos e interfaces | PascalCase | `LeadStatus`, `CommissionRule` |
| Tabelas do banco (Drizzle) | snake_case | `active_customers`, `commission_schedule` |
| Constantes globais | UPPER_SNAKE_CASE | `MAX_LEADS_PER_CORRETOR` |

### 4.3 Git Hooks (Husky + lint-staged)
- **pre-commit:** roda ESLint + Prettier apenas nos arquivos alterados (`lint-staged`).
- **pre-push:** roda os testes unitários (Vitest) antes de permitir o push.
Isso garante que nada quebrado chegue ao GitHub, mesmo em ritmo acelerado de crunch.

---

## 5. Fluxo de Git (Git Flow Simplificado)

| Branch | Propósito |
|---|---|
| `main` | Sempre em estado deployável — reflete produção |
| `develop` | Integração contínua das features antes de ir para produção |
| `feature/<nome-curto>` | Uma funcionalidade específica (ex: `feature/motor-comissao`) |
| `fix/<nome-curto>` | Correção de bug pontual |
| `hotfix/<nome-curto>` | Correção urgente direto a partir de `main` (produção) |

**Fluxo padrão:**
1. Criar branch `feature/*` a partir de `develop`.
2. Commits seguindo Conventional Commits (Seção 5.1).
3. Ao concluir, abrir Pull Request para `develop` (mesmo trabalhando sozinho — serve de checkpoint e histórico, e já prepara o hábito para quando houver mais devs).
4. CI roda automaticamente (lint + testes) — só mergeia se passar.
5. Periodicamente, `develop` é mergeada em `main`, disparando o deploy de produção.
6. `hotfix/*` é a única exceção que parte direto de `main`, e depois é mergeada de volta tanto em `main` quanto em `develop`.

### 5.1 Conventional Commits

Formato: `tipo(escopo opcional): descrição curta`

| Tipo | Uso |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Manutenção, configuração, dependências |
| `refactor` | Mudança de código sem alterar comportamento |
| `test` | Adição/ajuste de testes |
| `docs` | Documentação |
| `perf` | Melhoria de performance |

Exemplos: `feat(commissions): adiciona cronograma de repasse escalonado`, `fix(leads): corrige cálculo de SLA de estagnação`.

---

## 6. Server Actions vs. API Routes — Critério de Escolha

Já que a decisão foi usar ambos conforme o caso, aqui está o critério prático:

| Situação | Usar |
|---|---|
| Mutação de dados disparada por interação do usuário dentro do próprio app (ex: mudar status de lead, aprovar documento) | **Server Action** |
| Endpoint que recebe dados de fora do sistema (webhook de captação de leads, webhook do WhatsApp) | **API Route** |
| Necessidade de um endpoint estável/versionado, potencialmente consumido por terceiros no futuro | **API Route** |
| Formulários internos (criar filial, convidar usuário, configurar metas) | **Server Action** |

---

## 7. Ambientes

| Ambiente | Propósito | Branch correspondente | Banco de dados |
|---|---|---|---|
| Desenvolvimento (local) | Máquina do desenvolvedor | qualquer `feature/*` local | Banco local ou branch de banco isolado (Neon suporta branching de banco) |
| Staging/Homologação | Testar antes de produção, validar com o cliente-piloto se necessário | `develop` (deploy automático da Vercel em preview) | Banco de staging separado, com dados de teste |
| Produção | Ambiente real dos tenants | `main` | Banco de produção |

**Gestão de variáveis de ambiente:** arquivo `.env.example` no repositório documentando todas as chaves necessárias (sem valores reais). Segredos reais configurados diretamente no painel da Vercel por ambiente (Development/Preview/Production), nunca commitados.

---

## 8. Pipeline de CI/CD (GitHub Actions + Vercel)

**Estágios do workflow (`.github/workflows/ci.yml`):**

1. **Lint** — ESLint + verificação de formatação Prettier
2. **Type-check** — `tsc --noEmit`
3. **Testes unitários** — Vitest, com relatório de cobertura
4. **Build** — `next build`, garantindo que o projeto compila
5. **Testes E2E** (apenas em PRs para `main`, ou noturno) — Playwright, cobrindo os fluxos críticos (Seção 9)

**Deploy:**
- Push em `feature/*` ou PR aberto → Vercel gera um **preview deploy** automático (URL única por PR).
- Merge em `develop` → deploy automático no ambiente de **staging**.
- Merge em `main` → deploy automático em **produção**.

O CI (GitHub Actions) atua como **gate de qualidade antes do merge**; a Vercel cuida do deploy em si — os dois se complementam, sem sobreposição de responsabilidade.

---

## 9. Estratégia de Testes

### 9.1 Testes Unitários (Vitest)
Prioridade para a lógica de negócio mais crítica e com maior risco de erro silencioso:
- Cálculo de comissão (única e escalonada)
- Cálculo de SLA (não trabalhado e estagnação)
- Round-robin de distribuição de leads
- Regras de permissão por papel (Diretor/Gestor/Corretor)
- Cálculo de taxa de perda anormal (detecção de anomalia — Seção 14 do Documento de Requisitos)

**Meta de cobertura sugerida:** não perseguir 100% — focar nos módulos acima, com meta prática de ~70-80% de cobertura nessas áreas críticas. Cobertura alta em código de UI trivial não compensa o tempo gasto em crunch.

### 9.2 Testes E2E (Playwright)
Reservados para os **fluxos críticos de ponta a ponta**, não para cada tela isoladamente:
1. Login → recebimento de lead → mudança de status → geração de cotação
2. Upload de documento → aprovação → avanço de etapa
3. Conversão de lead em venda → geração do cronograma de comissão
4. Fluxo de convite de novo usuário → primeiro login

### 9.3 O que não testar (por ora)
Componentes puramente visuais sem lógica, textos estáticos, e detalhes de estilo — não geram valor de teste proporcional ao esforço, especialmente sob prazo de crunch.

---

## 10. Migrations de Banco de Dados (Drizzle)

Fluxo adotado: **migrations versionadas no repositório**, não `drizzle-kit push` direto.

1. Alterar o schema em `shared/db/schema.ts`.
2. Rodar `drizzle-kit generate` para gerar o arquivo de migration correspondente em `/drizzle`.
3. Commitar a migration junto com a mudança de código que a utiliza (nunca separado).
4. Aplicar via `drizzle-kit migrate` como parte do pipeline de deploy (passo automatizado antes do build subir, ou via script no CI antes do deploy em staging/produção).

Isso garante histórico auditável do schema — importante inclusive para o próprio módulo de integridade/auditoria do sistema, que depende de rastreabilidade.

---

## 11. Gerenciamento de Estado no Cliente (TanStack Query)

**Padrão de uso:**
- Toda leitura de dados que alimenta listas/dashboards (fila de leads, relatórios, painel de integridade) passa por um hook `useQuery` do TanStack Query, com chave de cache padronizada por domínio (ex: `['leads', tenantId, filialId, filtros]`).
- Mutações (Server Actions) invalidam as queries relacionadas após sucesso, mantendo a UI sincronizada sem necessidade de recarregar a página.
- Evitar estado global manual (Context/Redux) para dados de servidor — o TanStack Query já resolve cache, revalidação e loading/error state de forma consistente.
- Estado puramente de interface (ex: modal aberto, aba ativa) continua em `useState` local, sem necessidade de lib externa.

---

## 12. Documentação Técnica Contínua

Já que a decisão foi manter documentação contínua desde o início:

### 12.1 README principal
Deve conter: como rodar o projeto localmente, variáveis de ambiente necessárias, comandos principais (`dev`, `build`, `test`, `db:migrate`), e um link para esta arquitetura.

### 12.2 ADRs (Architecture Decision Records)
Para decisões técnicas relevantes (ex: "por que Server Actions em vez de API Routes aqui", "por que catálogo híbrido de operadoras"), criar um arquivo curto em `docs/adr/NNNN-titulo-da-decisao.md`, com: contexto, decisão tomada, alternativas consideradas, consequências. Não precisa ser extenso — o objetivo é não perder o "porquê" de uma decisão, especialmente importante se outros devs entrarem no projeto depois.

### 12.3 Sobre trazer novos desenvolvedores
Como ainda está indefinido se você vai trazer mais devs logo após o MVP, a recomendação é: **mantenha o rigor de processo definido aqui mesmo sozinho** (Conventional Commits, PRs, ADRs, testes nos módulos críticos). O custo de manter isso solo é pequeno, e o benefício de já estar pronto para escalar o time — sem precisar "arrumar a casa" depois — é alto.

---

## 13. Segurança e Multi-tenancy — Padrão de Implementação

- Toda query ao banco deve passar por uma camada central que **injeta automaticamente o filtro por `tenant_id`** da sessão ativa (evitar que cada desenvolvedor precise lembrar de filtrar manualmente em cada query — isso é a fonte mais comum de vazamento de dados entre tenants em sistemas multi-tenant).
- Sugestão prática: um helper `getTenantDb()` ou middleware de repositório que já retorna queries pré-filtradas, ao invés de expor o client do Drizzle "cru" nos domínios de `features/`.
- Segredos (chaves de API do WhatsApp, tokens de scraping, credenciais de banco) nunca no código — sempre via variáveis de ambiente configuradas na Vercel.
- Logs de auditoria (RF081, RF191, RF192) gravados de forma centralizada, não espalhados improvisadamente em cada módulo — vale um helper único de log de auditoria chamado nos pontos certos.

---

## 14. Definition of Done (Checklist por Funcionalidade)

Antes de considerar uma funcionalidade "pronta" para merge em `develop`:

- [ ] Código segue a estrutura de pastas por domínio (Seção 3)
- [ ] Passa em lint + type-check sem warnings
- [ ] Testes unitários cobrindo a lógica de negócio crítica da funcionalidade (se aplicável)
- [ ] Validação de entrada via Zod em toda Server Action/API Route nova
- [ ] Query ao banco passa pelo filtro de `tenant_id` (Seção 13)
- [ ] Commit segue Conventional Commits
- [ ] PR aberto e revisado (mesmo que autorrevisão em fase solo)
- [ ] Se a funcionalidade envolve dado sensível (documentos, saúde), log de auditoria implementado

---

## 15. Próximos Passos Técnicos

1. Inicializar o repositório com a estrutura de pastas da Seção 3, mesmo vazia, para já fixar o padrão desde o primeiro commit.
2. Configurar ESLint + Prettier + Husky + lint-staged antes de escrever a primeira feature.
3. Configurar o pipeline básico de GitHub Actions (lint + type-check + testes) antes de acumular muito código sem CI.
4. Criar o schema inicial no Drizzle já contemplando as entidades mapeadas no Documento de Requisitos (Seções 6, 11.3 e 14.3), incluindo os campos de auditoria/tenant desde a primeira migration.
5. Documentar a primeira ADR: a decisão de estrutura por domínio e o critério de Server Actions vs. API Routes, já formalizando o que foi definido aqui.

---

*Este documento complementa o Documento de Requisitos do CorreTop, focando exclusivamente em como o sistema deve ser construído (arquitetura, convenções e processos de engenharia).*
