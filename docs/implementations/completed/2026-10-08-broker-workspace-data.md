# Dados diários do Início do corretor

## Objetivo

Estender o contrato de `BrokerWorkspaceData` para a home do corretor apresentar a
escala atual/próxima e contagens diárias corretas, sem alterar regras de negócio ou
componentes de UI.

## Implementação

- `duty` expõe a ocorrência ativa e a próxima em uma janela de hoje mais sete dias,
  resolvendo substituições mensais sobre a escala semanal e incluindo fila, filial,
  pausa e estado de presença. Não chama o calendário anual nem grava auditoria de
  visualização.
- `today` acrescenta recebidos por `assigned_at` no dia de São Paulo, ofertas aceitas
  por `accepted_at`, atendimentos em progresso para todos os status definidos e o
  total distinto de leads com SLA `sla_risk` ou `sla_overdue` das prioridades já
  calculadas.
- As três novas consultas de dados (atribuições, publicações mensais da janela e
  agregado de indicadores) rodam em paralelo. Flags de escala/presença são incluídas
  como subconsultas escalares do agregado; a resolução por data usa os IDs já lidos.
- `drizzle/0186_broker_workspace_metrics_indexes.sql` e a entrada no journal criam
  índices parciais de ofertas aceitas e leads não excluídos. A migração não foi
  aplicada.

## Validação

- TypeScript: `npm.cmd run type-check` passou após as alterações finais.
- Testes: `npm.cmd run test -- src/features/broker-workspace`, 9 arquivos e 68
  testes passaram, incluindo fuso horário, agregação e prontidão.
- ESLint focado nos cinco arquivos TypeScript alterados passou.
- `git diff --check` passou antes do commit de código.
- Checklist Arc revisado antes de cada commit: diff sem UI/JSX/CSS ou texto visível;
  por isso os itens de tokens, tipografia, layout, estados visuais, motion,
  acessibilidade de controles e responsividade não se aplicam. Nenhuma dependência,
  componente Pro, animação ou estado de renderização cliente foi introduzido.
- `npm.cmd run agent:docs` não iniciou: Node falhou em `uv_os_get_passwd` com
  `ENOMEM`. A verificação completa do harness/build e a suíte geral não foram
  executadas porque podem executar testes com banco; o pedido desta tarefa proíbe
  acesso ao banco. Não houve leitura ou escrita em banco.

## Risco e reversão

O contrato usa somente campos existentes. A migração de índices ainda precisa ser
aplicada pelo fluxo normal de mudanças de banco antes do deploy, para garantir o
benefício de desempenho. A reversão do código remove os campos do contrato e as
consultas agregadas; os índices podem ser removidos por uma migração posterior se
forem revertidos.
