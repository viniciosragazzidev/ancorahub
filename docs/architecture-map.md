# Mapa da Arquitetura de Pastas

## Convenções de localização

| Local | Responsabilidade |
|---|---|
| `src/app/` | Rotas, layouts e Route Handlers do App Router; não concentra regra de domínio. |
| `src/app/(auth)/` | Login, convite e autenticação. |
| `src/app/(dashboard)/` | Rotas autenticadas organizadas pelo papel predominante. |
| `src/app/api/webhooks/` | Entradas externas autenticadas; cada handler valida, autoriza e delega ao domínio. |
| `src/features/<domínio>/` | Regra de negócio, actions, queries, schemas, tipos, UI específica e testes do domínio. |
| `src/components/ui/` | Primitivos shadcn reutilizáveis. |
| `src/components/unlumen-ui/` | Componentes animados reutilizáveis do registry Unlumen. |
| `src/shared/` | Infraestrutura compartilhada; não recebe regra de um único domínio. |
| `drizzle/` | Migrations versionadas, quando Drizzle for aprovado e configurado. |
| `e2e/` | Cenários ponta a ponta, quando Playwright for aprovado e configurado. |
| `.github/workflows/` | Automação de qualidade e entrega. |

## Domínios inicializados

`leads`, `distribution`, `quotes`, `documents`, `commissions`, `customers`,
`integrity`, `goals`, `branches`, `billing`, `catalog`, `notifications` e `reports`.

Para um domínio novo, crie sua pasta somente se ele tiver comportamento, modelo ou
política próprios. Caso seja utilitário sem regra de negócio, avalie `src/shared/`.

## Contrato mínimo de um domínio

Crie apenas os arquivos necessários, mantendo esta convenção quando existirem:

```text
src/features/leads/
├── components/       # UI exclusiva do domínio
├── actions.ts        # mutações internas autorizadas
├── queries.ts        # leituras escopadas por tenant
├── schema.ts         # contratos/validação de entrada
├── types.ts          # tipos do domínio
└── leads.test.ts     # lógica crítica isolada
```

O `tenant_id` é derivado do contexto confiável no servidor. Não o aceite como fonte de
autoridade em actions, queries ou handlers.
