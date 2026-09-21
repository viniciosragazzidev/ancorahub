# 2026-09-21 — Composição ERP premium do dashboard

**Estado:** em validação visual
**Branch:** `fix/waha-lite-connection-flow`

## Escopo

Refino visual da experiência executiva em `/dashboard`, sem alterar regras de negócio,
consultas, escopo por tenant/papel ou o dashboard Lite do corretor.

## Implementação

- Criados widgets reutilizáveis em `src/features/dashboard/components/dashboard-widgets.tsx`
  usando os primitives shadcn existentes: `Card`, `Badge`, `Chart`, `Table`, `Separator` e
  estados vazios semânticos.
- Recomposta a tela em grid responsivo assimétrico: KPIs, evolução, atenção, fluxo,
  qualificação, desempenho por unidade/corretor e atividade recente.
- Adicionadas animações de entrada com `motion`, respeitando `prefers-reduced-motion`.
- Criado skeleton específico em `src/app/(dashboard)/dashboard/loading.tsx`, mantendo a
  forma do dashboard durante o carregamento.
- Mantida a fonte canônica de dados em `src/features/dashboard/service.ts` e no catálogo de
  métricas de relatórios; não foram criados números ou fontes paralelas.

## Validação

- ESLint nos arquivos alterados: passou sem erros.
- `vitest run src/features/dashboard/contracts.test.ts`: 2 testes passaram.
- `npm run lint:encoding`: passou.
- `next build`: compilação do código passou; a etapa de TypeScript falhou em tipos gerados
  preexistentes em `.next/dev/types/routes.d.ts` e `.next/dev/types/validator.ts`.
- `agent:verify --level fast`: documentação válida; bloqueado pelo mesmo erro de tipos
  gerados, registrado em `reports/agent/verification/2026-09-21T13-36-18.779Z.md`.

## Rollback

Reverter os três arquivos de dashboard desta entrega restaura a composição anterior; nenhum
schema, métrica, permissão ou integração foi alterado.
