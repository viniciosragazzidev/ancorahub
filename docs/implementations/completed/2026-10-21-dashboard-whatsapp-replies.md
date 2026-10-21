# Respostas recentes no WhatsApp por corretor

## Entrega

O painel de comando do Diretor mostra leads distintos com mensagem inbound WAHA real nos sete dias anteriores, agrupados pelo corretor que atualmente possui o lead e cuja conexão pessoal está pronta. O card informa o total de corretores conectados e liga cada corretor à central de Conversas filtrada para ele. O card de prontidão de conexão existente foi mantido.

A consulta respeita tenant, papel, unidade e equipe usados pela central. Ela ignora stories, eventos sem conteúdo, mensagens fora da janela e telefones corporativos conhecidos em `waha_numbers`. `whatsapp_messages` ainda não registra a sessão WAHA de origem; portanto, a origem pessoal é aproximada por conexão pessoal pronta, dono atual do lead e exclusão dos números corporativos conhecidos.

## Arquivos

- `src/features/dashboard/today.ts`: agregação SQL por corretor com `count(distinct lead)`.
- `src/features/dashboard/whatsapp-activity.ts`: resumo e ordenação da agregação.
- `src/features/dashboard/components/command-center.tsx`: card de respostas recentes.
- `src/app/(dashboard)/conversas/page.tsx`: filtro server-side por corretor, ainda limitado pelo escopo de acesso existente.
- Testes da agregação e do card em `src/features/dashboard`.

## Verificação

- `npx tsc --noEmit -p .`: passou.
- `npx vitest run src/features/dashboard 'src/app/(dashboard)/conversas'`: 7 arquivos e 27 testes passaram.
- `git diff --check`: passou.
- `npm run agent:verify -- --level full`: documentação, análise de arquivos, arquitetura, segurança, desempenho e type-check passaram. A checagem de encoding do lint encontrou mojibake preexistente em `docs/business-rules.md`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`. A suíte completa teve 8 falhas em 6 arquivos não alterados, com 2.633 testes passando e 19 ignorados; o build não foi iniciado porque o harness parou após as falhas da suíte. Relatório: `reports/agent/verification/2026-10-21T18-49-44.816Z.md`.
