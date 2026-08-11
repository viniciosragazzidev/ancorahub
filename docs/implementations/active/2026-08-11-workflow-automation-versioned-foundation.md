# Automation Builder: rascunhos e versões

## Objetivo

Permitir que Diretores criem e editem rascunhos de automação visual por corretora e publiquem somente grafos seguros e válidos. Cada publicação gera uma versão imutável; o Super-admin pode liberar ou pausar essa publicação globalmente sem excluir dados.

## Escopo e arquivos

- `workflow_automations` e `workflow_automation_versions`, com migration 0113.
- Contratos, validação, política de publicação, queries e server actions em `src/features/workflow-automation/`.
- Controle global auditado em `/super-admin/settings`.
- Nenhum executor assíncrono, worker, envio WhatsApp, ação de IA ou alteração de responsável/status foi conectado.

## Decisões

- A fundação é isolada de `crm_automations`, que continua atendendo o mecanismo legado.
- Tenant e papel são derivados da sessão no servidor; somente Diretor edita ou publica.
- Publicação exige a feature flag global e a validação do grafo. IA e WhatsApp iniciam desativados; WhatsApp exige confirmação humana.

## Validações

- `npx vitest run src/features/workflow-automation --reporter=dot`: 3 arquivos, 6 testes aprovados.
- `npx eslint` direcionado, `npm run type-check` e `npm run agent:verify -- --level fast`: aprovados; fast registrou `reports/agent/verification/2026-08-11T14-11-23.343Z.md`.
- `npm run agent:verify -- --level full`: testes (290) e build de produção aprovados; o comando terminou com falha apenas no lint global, por 327 erros preexistentes em `.agents/skills`, `temp_deskcomm_crm` e `update_cards.js`, fora do escopo desta entrega. Evidência: `reports/agent/verification/2026-08-11T14-19-50.079Z.md`.

## Riscos e rollback

- Desativar `feature_workflow_automation_enabled` no Super-admin interrompe novas publicações e preserva rascunhos, versões e auditoria.
- O rollback de código não aciona exclusão de tabelas; a migration é aditiva e pode permanecer como histórico até uma migração reversa deliberada.
