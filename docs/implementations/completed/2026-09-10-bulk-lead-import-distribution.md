# Importação de leads pela fila canônica

## Objetivo

Exibir todas as filas aplicáveis na importação CSV e garantir que o lote use o mesmo
fluxo resiliente de ofertas WhatsApp da distribuição normal.

## Escopo entregue

- filas gerais do tenant e filas da unidade escolhida aparecem no seletor;
- filas de outra unidade são omitidas e filas manuais aparecem desabilitadas;
- a fila escolhida é revalidada no servidor por tenant, unidade, estado, exclusão e modo;
- leads sem qualificação automática são persistidos sem owner e recebem job durável e
  idempotente, em vez de uma atribuição direta pela lógica legada;
- o toggle de Qualificação IA da fila prevalece na importação: desligado significa
  `qualified`/`COMPLETED` e disparo imediato do processador, sem estado `pending`;
- o processador inicia um lote limitado imediatamente e preserva o restante para retry,
  respeitando janela comercial e a configuração global existente;
- a oferta oficial continua sequencial: um corretor elegível por vez, confirmação
  atômica no aceite e fallback manual apenas após o ciclo se esgotar.

## Arquivos principais

- `src/app/(dashboard)/leads/page.tsx`
- `src/app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx`
- `src/features/leads/bulk-import.ts`
- `src/features/leads/bulk-import-policy.ts`
- `src/features/leads/bulk-import-policy.test.ts`

## Segurança e auditoria

O tenant e o escopo de unidade continuam derivados da sessão. O `queueId` do
navegador é apenas entrada não confiável e precisa pertencer ao tenant ativo. A
auditoria de importação existente é preservada e o motor registra ofertas, falhas,
aceites e esgotamento separadamente, sem conteúdo de mensagem.

## Validação

- `npx vitest run src/features/leads/bulk-import-policy.test.ts src/features/lead-distribution/domain.test.ts src/features/lead-distribution/jobs.test.ts src/features/communication-channels/templates.test.ts`: cobertura da fila, bypass da IA, estado qualificado, jobs e templates aprovada;
- `npm run type-check`: aprovado;
- `npm run build`: aprovado;
- `npm run agent:verify -- --level full`: documentação e segurança aprovadas,
  157 arquivos de teste/708 testes aprovados e build aprovado. O lint geral terminou
  sem erros e com 1.110 avisos preexistentes; o lint dirigido não encontrou erro novo;
- evidência integral em `reports/agent/verification/2026-09-10T12-28-12.230Z.md`.

## Rollback

Reverter esta entrega restaura a filtragem e a atribuição direta anteriores. Jobs já
persistidos permanecem idempotentes e podem ser pausados pelo controle global da
distribuição sem apagar leads.
