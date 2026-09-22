# Arquivamento e exportação de leads sem distribuição

## Objetivo

Permitir ao Diretor limpar a operação sem apagar dados: arquivar, em uma ação confirmada, todos os leads operacionais sem corretor; e baixar a lista completa atual em um PDF tabular com nome, contato, vidas, cidade e data de entrada.

## Escopo e arquivos

- `src/shared/db/schema.ts` e `drizzle/0153_lead_distribution_archive.sql`: estado reversível `archived_at`/`archived_by` e índice tenant-scoped.
- `src/features/lead-distribution/actions.ts`: ação exclusiva do Diretor, transação, cancelamento de jobs pendentes e auditoria agregada.
- `src/features/lead-distribution/jobs.ts`, `service.ts`, `control-service.ts` e a página da Central: leads arquivados não entram em seed, processamento, roteamento, contadores ou dependências operacionais.
- `src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx`: confirmação clara, contagem total do escopo, feedback e botão PDF.
- `src/app/api/reports/distribution-unassigned/route.ts` e `unassigned-leads-pdf.ts`: exportação server-side, tenant/role derivado da sessão, extração dos campos estruturados e PDF multipágina.
- `archive-policy.test.ts` e `unassigned-leads-pdf.test.ts`: regressão de elegibilidade e encoder.

## Decisões

- Arquivar não reutiliza `deleted_at`: o registro continua preservado e distinguível para futura restauração administrativa.
- O servidor não aceita IDs, tenant ou papel para definir o conjunto; a ação sempre reconsulta o tenant do Diretor.
- O PDF representa os leads atualmente sem distribuição e não arquivados; dados de vidas/cidade vêm de `qualification_details` (incluindo memória privada da IA) e `form_data`.
- O botão é exclusivo do Diretor porque a operação altera o conjunto completo e a exportação contém dados pessoais.

## Validações

- `npx vitest run src/features/lead-distribution/archive-policy.test.ts src/features/lead-distribution/unassigned-leads-pdf.test.ts`: 8 testes passaram.
- `npm run db:check`: passou.
- `npm run lint -- --no-warn-ignored`: passou sem erros; o repositório mantém avisos preexistentes.
- `npm run agent:verify -- --level full`: documentação, escopo e segurança passaram; type-check falha somente no artefato preexistente `scripts/_tmp-diag2.ts:64` (`p.userId` possivelmente nulo).
- `npm run build`: compilação Next concluída; a etapa TypeScript foi bloqueada pelo mesmo erro preexistente em `scripts/_tmp-diag2.ts:64`.

## Riscos e rollback

- A exportação pode produzir um arquivo grande em tenants com muitos leads; o PDF é gerado sob demanda e não é armazenado.
- Para reverter o comportamento sem perda, remova `archived_at`/`archived_by` dos leads arquivados por uma operação administrativa e desfaça a migration 0153 apenas em uma janela controlada. Nenhum lead é apagado pela ação.
