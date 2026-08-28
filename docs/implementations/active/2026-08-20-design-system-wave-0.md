# Registro de implementação — Design System Wave 0

**Branch:** `redesign`
**Status:** partial
**Produção alterada:** NÃO

## Objetivo

Preparar a camada de componentes e patterns transversais para a migração progressiva de rotas, sem alterar dados, serviços, autorização, tenant, RBAC, auditoria ou regras de negócio.

## Entregue

- Plano de waves com critérios de aceite e rollback.
- Compatibilidade documental com Pattern Rules, Interaction e Navigation Patterns.
- Context pack para agentes e registro obrigatório de blueprint.
- Primitives compostas reutilizáveis: `PageHeader`, `FilterToolbar` e `FormSection`.
- Testes de semântica estrutural dos primitives.
- Refinamento global das foundations e dos primitives mais usados: `Button`,
  `Card`, `Input`, `Textarea`, `Field`, `Table`, `DataTable`, `EmptyState`,
  `Dialog`, `Popover`, `DropdownMenu`, `Tabs`, `Checkbox`, `Switch` e
  `Sonner`. Eles agora compartilham a mesma escala de superfície, raio, borda,
  foco e elevação discreta, sem mudança de regra de negócio.

## Decisão de UX

O header concentra localização, objetivo e ação principal; filtros, resultado e ações secundárias ficam em toolbar; formulários longos são agrupados por assunto sem transformar cada grupo em card. Isto reduz ruído sem alterar comportamento de features.

## Riscos e rollback

Nenhum primitive introduz busca, estado local, fetch, mutação ou autorização. O rollback é a reversão dos arquivos desta wave; páginas existentes ainda não consomem esses componentes.

## Limites da entrega

O trabalho é de foundation e componentes compartilhados. Páginas não foram
migradas em massa, os componentes permanecem `CANONICAL_CANDIDATE` até a revisão
visual autenticada e nenhum baseline visual foi promovido para `APPROVED`.

## Verificações

- `npm run test -- --run src/components/ui/foundation-primitives.test.tsx src/components/ui/pattern-primitives.test.tsx`: passou (6 testes).
- `npm run type-check`, `npm run agent:docs`, `npm run design:patterns:validate` e `git diff --check`: passaram.
- `npm run build`: concluiu e gerou o artefato `.next/BUILD_ID`.
- `npm run agent:verify -- --level full`: documentação, changed-files,
  arquitetura, segurança, performance e type-check passaram; o lint falha por
  mojibake pré-existente em `src/features/platform-admin/purge-job.ts` e a
  suíte global falha em 2 testes pré-existentes de
  `meta-integration-view.test.tsx`.
- `npm run ui:audit`: mantém 21 selects nativos legados em rotas ainda não
  migradas; esta wave não adicionou nenhum deles.

## Próximos passos

Concluir a revisão visual dos componentes gerais e migrar progressivamente as
rotas por blueprint, validando desktop, tablet, mobile e fluxos com dados
sintéticos antes de promover qualquer família para `CANONICAL_READY`.
