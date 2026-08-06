# Workspace do Corretor 2.0 — V1 operacional

## Objetivo

Substituir a home ativa do Corretor por uma visão diária orientada a prioridade,
sem alterar os dashboards de Diretor e Gestor e sem criar uma segunda rota de home.

## Entrega

- Contrato agregado server-side em `src/features/broker-workspace/queries.ts`,
  com escopo derivado da sessão e consultas limitadas para carteira, mensagens,
  tarefas, documentos, cotações, metas e notificações.
- Priorização determinística e testável em `priority.ts`: resposta pendente,
  SLA, tarefa vencida, retorno, lead, cotação, documento e estagnação.
- Nova composição de `/dashboard` para Corretor: próxima ação, Meu Dia, fila,
  agenda, meta, Inbox resumida e atalhos para os módulos existentes.
- Flag global `feature_broker_workspace_enabled`, com controle e auditoria pelo
  Super-admin; desligar restaura o dashboard legado.
- Conclusão de tarefa e adiamento de retorno com autorização existente, feedback
  otimista, rollback e reconciliação pelo mecanismo local-first.
- A alteração de disponibilidade passou a validar tenant no servidor e a gerar
  auditoria, pois a ação é exposta no novo Workspace.

## Limites conscientes

- Conversas permanecem em `/conversas`; quando não há canal oficial, não há
  compositor interno simulado.
- Comissão, leaderboard de Corretor, IA contextual, favoritos/notas,
  personalização, onboarding e materiais permanecem fases posteriores.
- Não houve migration: as fontes persistidas necessárias já existem.

## Rollback

Desativar `feature_broker_workspace_enabled` em Configurações da Plataforma retorna
Corretor ao dashboard legado imediatamente, sem alteração ou remoção de dados.

## Evidências

- `npm run agent:verify -- --level fast`: documentação, type-check e 231 testes passaram.
- Teste unitário dirigido de prioridade: 3 cenários passaram.
- `npm run agent:verify -- --level full`: documentação, diagnósticos, type-check,
  231 testes e build de produção passaram; o comando terminou não-zero pelo lint
  global preexistente (325 erros em arquivos fora deste escopo, inclusive
  `update_cards.js` e referências locais). Não foram introduzidos erros de lint nos
  arquivos do Workspace.
- Uma repetição posterior de `npm run build` compilou e concluiu a checagem de tipos,
  mas parou na coleta de dados porque `src/app/(dashboard)/perfil/page.tsx` foi
  removido por uma alteração externa no workspace durante a execução. O arquivo não
  pertence a esta entrega e não foi restaurado por este registro.
- A checagem de tipos posterior também fica bloqueada por essa rota removida e por
  `src/components/period-select.tsx`, ambos fora dos arquivos desta entrega. O lint
  dirigido dos arquivos do Workspace passou sem avisos.
- Relatórios: `reports/agent/verification/2026-08-03T13-49-04.926Z.md` e
  `reports/agent/verification/2026-08-03T13-52-03.320Z.md`.
