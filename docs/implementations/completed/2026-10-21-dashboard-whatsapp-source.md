# Origem das respostas WAHA no dashboard

## Regra entregue

O card do Diretor conta leads distintos que receberam mensagem inbound `waha`
real nos sete dias anteriores. A linha marcada com `whatsapp_connection_id` só
conta para o dono atual quando a conexão é do próprio corretor e está pronta.
Linhas legadas sem `whatsapp_connection_id` e sem `waha_number_id` mantêm a
aproximação anterior: dono atual conectado e telefone fora de `waha_numbers`.
Stories e eventos sem conteúdo continuam excluídos. O legado sai automaticamente
da janela móvel depois de sete dias.

O filtro da central `/conversas` usa o mesmo critério quando recebe
`respondeu=7d`. Parâmetros inválidos falham fechado, e o escopo de tenant, unidade
e equipe continua vindo do servidor.

## Persistência

A migration `drizzle/0211_whatsapp_message_source.sql` adiciona os dois IDs de
origem e o índice parcial. O índice é normal, seguindo os breakpoints do journal;
não usa `CONCURRENTLY`. O SQL está idempotente e pronto para aplicação manual.
Ele não foi executado e nenhum banco foi acessado nesta tarefa.

## Arquivos

- `drizzle/0211_whatsapp_message_source.sql`, `drizzle/meta/_journal.json` e
  `src/shared/db/schema.ts`: colunas, chaves estrangeiras e índice.
- `src/features/waha-cadence/inbound.ts` e
  `src/features/leads/actions/send-lead-message.ts`: gravação da origem WAHA.
- `src/features/broker-workspace/first-message/actions.ts`: gravação da conexão
  pessoal usada no primeiro envio pelo sistema.
- `src/features/dashboard/whatsapp-activity-query.ts`, `today.ts` e
  `src/app/(dashboard)/conversas/page.tsx`: critério compartilhado do card e do
  filtro `respondeu=7d`.
- Testes em `src/features/dashboard` e `src/features/waha-cadence`; link do card
  atualizado em `command-center.tsx`.
- `src/features/roadmap/roadmap-data.ts` e este registro.

## Verificação

- `npx tsc --noEmit -p .`: passou.
- Testes focados após atualizar a base: 30 passaram em quatro arquivos,
  incluindo `first-message-dialog.test.tsx`.
- `npx vitest run src/features/dashboard src/features/waha-cadence`: 103
  passaram; `operational-dashboard.test.tsx` teve timeout de 5s. O mesmo teste
  também excedeu o limite quando executado sozinho.
- `npx eslint` nos arquivos alterados: zero erros e oito avisos de variáveis não
  usadas em linhas preexistentes.
- `git diff --check` e validação JSON do journal: passaram.
- `agent:verify --level full`: documentação, type-check e segurança passaram;
  arquitetura e desempenho emitiram observações. O lint global parou por
  mojibake preexistente em `docs/business-rules.md`,
  `src/features/leads/management-actions.test.ts` e
  `src/features/reports/metrics/lead-quality-period.test.ts`. A suíte completa
  registrou 19 falhas e 2.626 aprovações, principalmente timeouts; o build não foi
  iniciado após a falha dos testes. Relatório:
  `reports/agent/verification/2026-10-21T19-23-28.480Z.md`.

## Ajustes complementares

Na central `/conversas`, quando `brokerId` ou `respondeu=7d` filtra os leads, as mensagens são carregadas pelos IDs desses leads e por telefone apenas para registros sem `lead_id`. O limite global de 2.000 mensagens continua no modo sem filtro. Os filtros de tenant, stories e histórico de coexistência são preservados.

O card reutilizável aparece no command center clássico e no Início Lite de gestores e supervisores. A métrica usa o escopo existente de relatórios: unidade do gestor e equipe supervisionada do supervisor. Cada corretor aponta para `/conversas?tab=leads&brokerId=<id>&respondeu=7d`, onde o servidor também aplica o escopo da sessão.

Validações deste ajuste: `npx tsc --noEmit -p .` passou; Vitest focado passou com 20 testes em 4 arquivos, incluindo as condições SQL de unidade/equipe e a tela Lite. ESLint focado passou sem avisos. Nenhum commit foi criado.

O `agent:verify --level full` seguinte passou em documentação, type-check e segurança; o lint global falhou por mojibake preexistente nos três arquivos listados acima, e a suíte completa terminou com 18 falhas, 2.639 testes aprovados e 19 ignorados. A execução focada dos quatro arquivos afetados passou; `command-center.test.tsx` teve um timeout somente sob a carga da suíte completa. Relatório: `reports/agent/verification/2026-10-21T19-45-08.343Z.md`.

`npm run build` falhou no Turbopack porque o junction `node_modules` aponta para fora da raiz da worktree. O prebuild gerou o pacote da extensão, ignorado pelo Git. Nenhuma migration foi executada e nenhum banco foi acessado.

## Rollback

Como a migration ainda não foi aplicada, basta reverter o código antes de entregar
a mudança. Se o SQL já tiver sido aplicado, reverta primeiro o código e depois
remova o índice, as duas constraints e as duas colunas.
