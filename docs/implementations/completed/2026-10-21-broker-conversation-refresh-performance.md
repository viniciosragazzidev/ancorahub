# Consultas e atualizações de conversas do corretor

## Objetivo

Reduzir mensagens transferidas e renders de servidor nas telas de conversa do corretor, mantendo os filtros por tenant e a atualização das telas que exibem os dados alterados.

## Escopo e decisão

- Consultar uma mensagem mais recente por lead e por cliente para resumos e listas.
- Quando `leadId` aponta para uma conversa aberta e válida no tenant, carregar somente as 30 mensagens mais recentes dessa conversa. Mensagens fora desse item permanecem limitadas a uma por conversa.
- Substituir o `OR` entre IDs de lead e cliente por consultas separadas, todas com `tenantId` e IDs obtidos das leituras autorizadas da sessão.
- Manter um único `router.refresh()` para atualizar a análise em background, sem o ciclo de múltiplas tentativas.
- Recarregar a tela pelo shell somente para eventos de conversa em rotas que exibem conversas. As rotas `/conversas` mantêm seus listeners locais. Eventos de conexão ficam restritos às telas que exibem a conexão.
- Aumentar a janela de coalescência do Realtime para 1.500 ms. Outros domínios e notificações mantêm o comportamento atual.

## Arquivos previstos

- `src/app/(dashboard)/conversas/broker/page.tsx`
- `src/components/providers/realtime-sync-provider.tsx`
- `src/components/providers/realtime-sync-provider.test.ts`
- `src/features/roadmap/roadmap-data.ts`

## Validação

- `npx tsc --noEmit`: passou.
- `npx vitest run 'src/app/(dashboard)/conversas' src/components/providers src/features/broker-workspace/components`: passou, 14 arquivos e 67 testes.
- `npm run agent:verify -- --level full`: docs, escopo, arquitetura, segurança, desempenho e type-check passaram. Lint falhou por mojibake preexistente em `docs/business-rules.md` e em testes fora do escopo. A suíte completa teve 10 falhas em 8 arquivos fora do escopo e 2.607 testes passaram. O harness parou antes do build após a falha da suíte.
- Evidência: `reports/agent/verification/2026-10-21T15-19-53.266Z.md`.

## Riscos e reversão

- O resumo e a lista dependem apenas da mensagem mais recente; o detalhe aberto recebe 30 mensagens em ordem cronológica.
- O filtro por `tenantId` permanece em cada consulta. Reverter consiste em restaurar a seleção anterior de mensagens e o predicado anterior de invalidação.
