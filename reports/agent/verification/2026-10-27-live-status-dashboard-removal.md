# Verificação: faixa de status vivos fora do dashboard

Data: 2026-10-27

## Resultado

- `/dashboard` não consulta a flag nem renderiza `LiveStatusBoundary` nas versões normal e Lite ou nas homes de corretor, gestor e supervisor.
- A única inclusão de tela do `LiveStatusBoundary` continua em `/leads/distribuicao`. API e provedores foram preservados.
- A fixture de status vivos saiu de `/dev/diretor-shell-real`; testes de renderização agora verificam a ausência da faixa em `ChatHome` e `DirectorLiteDashboard`.
- As seis fontes dos painéis/homes são idênticas ao commit `5f57f73d^`, anterior à adição da faixa. Isso confirma paridade do HTML do dashboard com a chave ligada ou desligada.

## Comandos

- `npx vitest run src/components/chat/chat-home.test.tsx src/features/dashboard/components/director-lite/director-lite-dashboard.test.tsx src/features/live-status --maxWorkers=1`: passou, 11 arquivos e 93 testes.
- `npx tsc --noEmit`: passou.
- ESLint dos arquivos TS/TSX alterados: passou.
- `git diff --check`: passou.

Sem acesso a banco, testes de banco, migrations, leitura de `.env.local` ou build.
