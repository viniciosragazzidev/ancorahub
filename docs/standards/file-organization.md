# Organização de arquivos e módulos

## Objetivo

Manter cada decisão de domínio em um módulo profundo, com uma interface pequena e testável. A rota coordena a tela; o domínio decide o comportamento; adapters lidam com banco, serviços externos e storage.

## Estrutura canônica atual

```text
src/
├─ app/                         # App Router: composição, loading, error e route handlers
│  ├─ (auth)/                   # autenticação e entrada
│  ├─ (dashboard)/              # superfícies autenticadas
│  ├─ (platform-admin)/         # administração da plataforma
│  ├─ api/                      # integrações externas e endpoints estáveis
│  └─ compartilhado/            # páginas públicas com token
├─ features/                    # módulos de domínio
│  ├─ leads/
│  ├─ distribution/
│  ├─ quotes/
│  ├─ documents/
│  ├─ customer-record/
│  ├─ sales/
│  ├─ commissions/
│  ├─ communication-channels/
│  └─ ...
├─ components/                 # composição transversal de produto
├─ shared/
│  ├─ auth/                     # sessão e autorização confiável
│  ├─ db/                       # conexão, schema e transações
│  ├─ tenant/                   # escopo e contexto multi-tenant
│  ├─ storage/                  # storage privado e URLs temporárias
│  ├─ audit/                    # auditoria centralizada
│  ├─ ui/                       # primitives shadcn reutilizáveis
│  └─ utils/                    # helpers sem regra de negócio
├─ hooks/                       # hooks de UI ou integração compartilhados
├─ lib/                         # adapters de infraestrutura pequenos
└─ platform/                    # capacidades próprias da plataforma/super-admin
```

## Responsabilidade por tipo de arquivo

| Arquivo | Responsabilidade | Não deve conter |
|---|---|---|
| `page.tsx` | Busca autorizada, composição e metadata da rota | Regra de negócio extensa, SQL repetido, segredo |
| `layout.tsx` | Shell e providers da árvore | Query específica de um registro |
| `loading.tsx` | Skeleton da mesma superfície | Fetch, mutação ou timer |
| `error.tsx` | Recuperação e mensagem de erro | Exposição de stack, token ou PII |
| `not-found.tsx` | Estado 404 sem revelar existência indevida | Detalhes do banco |
| `route.ts` | Contrato externo, validação, auth/HMAC e resposta HTTP | Domínio duplicado |
| `actions.ts` | Mutações internas autorizadas | Leitura sem escopo, validação só no cliente |
| `queries.ts` | Leituras reutilizáveis e escopadas | Decisão visual |
| `service.ts` | Caso de uso e invariantes transacionais | JSX, request/response específico |
| `policy.ts` | Autorização e regras puras | Consulta direta ao cliente |
| `schema.ts` | Schemas Zod e mensagens de entrada | Acesso ao banco |
| `types.ts` | Tipos públicos do módulo | `any`, tipos derivados de segredo |
| `*.test.ts` | Testes do contrato do módulo | Dependência de produção real |
| `components/*.tsx` | UI específica do domínio | Query não autorizada ou decisão de negócio escondida |
| `src/components/ui/*` | Primitive e variante compartilhada | Regra de um único domínio |
| `shared/*` | Capacidades transversais profundas | Atalho para evitar uma fronteira de domínio |
| `drizzle/*.sql` | Migração versionada e reversível quando possível | SQL manual fora do histórico |

## Regras de dependência

1. `app` pode depender de `features`, `shared` e `components`; `features` não depende de `app`.
2. Um módulo de domínio pode depender de `shared`, mas não de outro módulo diretamente para acessar suas tabelas internas.
3. Integração entre domínios acontece por uma interface explícita, caso de uso, evento interno ou adapter documentado.
4. `shared` não pode importar regra de negócio de `features`.
5. Componentes compartilhados não podem importar `getRequiredTenantContext` nem executar query.
6. Route handlers traduzem HTTP para uma interface de domínio; não expõem o schema do banco.
7. A camada de banco é privada ao módulo de persistência. Não espalhar SQL/Drizzle pela UI.
8. Imports devem usar o alias `@/` e caminhos estáveis, nunca atravessar `../../` para acessar internals.

## Nomenclatura

- Pastas: `kebab-case`.
- Componentes React: `PascalCase.tsx`.
- Ações, queries, policies e serviços: `camelCase.ts`.
- Testes: ao lado do contrato (`*.test.ts` ou `*.spec.ts`).
- Schemas de banco: snake_case conforme Drizzle/PostgreSQL.
- Tipos de domínio: nomes do vocabulário em `CONTEXT.md`, não abreviações.
- IDs e escopos nunca recebem nomes genéricos como `id` em interfaces públicas; prefira `leadId`, `tenantId`, `beneficiaryId`.

## Critério para criar um novo módulo

Criar uma nova pasta em `features/` somente quando existir pelo menos uma destas condições:

- possui invariantes e permissões próprias;
- tem persistência, integração ou fluxo que precisa de testes isolados;
- será usado por duas ou mais rotas;
- tem ciclo de vida independente.

Se for apenas composição visual, use `components/`. Se for um helper puro e transversal, use `shared/utils/`.

## Estratégia de migração do legado

- Primeiro criar a interface nova e testes do contrato.
- Adicionar adapter para o caminho antigo, sem duplicar regra.
- Migrar imports em lotes de um módulo por vez.
- Monitorar erros e auditoria antes de remover o adapter.
- Toda remoção exige `rg` sem referências, type-check, testes e build.
