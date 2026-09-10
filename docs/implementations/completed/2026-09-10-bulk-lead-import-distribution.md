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
- a importação ativa automaticamente a distribuição da unidade operacional e a
  política exata da fila; unidade pausada ou Central é recusada antes de persistir;
- o job recorrente recupera `queued` e `unassigned` e reinicia ciclos esgotados,
  preservando o histórico e priorizando corretores com menor carga;
- a aba `Sem atribuição` oferece ao Diretor e ao Gestor uma recuperação em lote;
  o servidor deriva tenant e unidade, exclui leads ainda em qualificação ou encerrados,
  reenfileira os elegíveis e continua o processamento após a resposta da interface;
- o ranking considera apenas corretores ativos, disponíveis e com telefone no perfil
  do próprio tenant, evitando ciclos de ofertas canceladas para membros sem canal;
- a rota legada do scheduler Coolify encaminha para o endpoint canônico de jobs;
- o processador inicia um lote limitado imediatamente e preserva o restante para retry,
  respeitando janela comercial e a configuração global existente;
- a oferta oficial continua sequencial: um corretor elegível por vez e confirmação
  atômica no aceite; ciclo esgotado reinicia automaticamente após o intervalo seguro.
- no estouro do SLA sem primeiro contato, a troca ocorre diretamente do owner atual
  para outro corretor elegível; não há gravação intermediária em `queued`/`unassigned`;
- sem substituto elegível, o owner atual é preservado e a gestão continua alertada;
  quando a troca acontece, o aviso oficial ao novo corretor é processado imediatamente.

## Arquivos principais

- `src/app/(dashboard)/leads/page.tsx`
- `src/app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx`
- `src/features/leads/bulk-import.ts`
- `src/features/leads/bulk-import-policy.ts`
- `src/features/leads/bulk-import-policy.test.ts`
- `src/features/leads/sla.ts`
- `src/features/leads/assignment.ts`
- `src/features/lead-distribution/service.ts`
- `src/features/lead-distribution/jobs.ts`
- `src/features/lead-distribution/bulk-recovery.ts`
- `src/features/lead-distribution/bulk-recovery.test.ts`
- `src/features/lead-distribution/actions.ts`
- `src/app/(dashboard)/leads/leads-workspace.tsx`
- `src/app/api/internal/cron/distribution/route.ts`
- `docs/runbooks/coolify-lead-distribution-scheduler.md`

## Segurança e auditoria

O tenant e o escopo de unidade continuam derivados da sessão. O `queueId` do
navegador é apenas entrada não confiável e precisa pertencer ao tenant ativo. A
auditoria de importação existente é preservada e o motor registra ofertas, falhas,
aceites e esgotamento separadamente, sem conteúdo de mensagem. A recuperação em lote
registra `lead.bulk_distribution_requested`, não aceita tenant nem unidade do navegador
e nunca grava owner antes do aceite.

## Validação

- `npx vitest run src/features/leads/bulk-import-policy.test.ts src/features/lead-distribution/domain.test.ts src/features/lead-distribution/jobs.test.ts src/features/communication-channels/templates.test.ts`: cobertura da fila, bypass da IA, estado qualificado, jobs e templates aprovada;
- `npm run type-check`: aprovado;
- `npm run build`: aprovado;
- `npm run agent:verify -- --level full`: documentação e segurança aprovadas,
  157 arquivos de teste/708 testes aprovados e build aprovado. O lint geral terminou
  sem erros e com 1.110 avisos preexistentes; o lint dirigido não encontrou erro novo;
- evidência integral em `reports/agent/verification/2026-09-10T12-28-12.230Z.md`.
- validação incremental desta emenda: 43 testes dirigidos e build Next.js aprovados;
  o harness integral de `2026-09-10T17-07-07.740Z` aprovou documentação, segurança e
  type-check, mas foi interrompido após timeouts em testes globais de UI não relacionados.
- validação final: 35 testes dirigidos, TypeScript e build Next.js aprovados. O harness
  integral de `2026-09-10T18-40-47.887Z` aprovou 154 arquivos/710 testes e encontrou
  6 falhas preexistentes ou não relacionadas por timeout em VPS, Meta UI e WhatsApp Admin.

## Rollback

Reverter esta entrega restaura a filtragem e a atribuição direta anteriores. Jobs já
persistidos permanecem idempotentes e podem ser pausados pelo controle global da
distribuição sem apagar leads.
