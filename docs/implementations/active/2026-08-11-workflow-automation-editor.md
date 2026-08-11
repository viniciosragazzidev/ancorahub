# Editor visual de automações

**Estado:** entrega parcial e segura
**Rota:** `/automacoes`
**Papel:** Diretor da corretora

## Auditoria antes da implementação

- Não havia biblioteca de canvas ou graph, React Flow, Zustand ou histórico de undo/redo no repositório.
- `dnd-kit` já atende ordenação de listas, mas não oferece um modelo de workflow com ports; por isso o editor usa estado local isolado e eventos de ponteiro somente no canvas.
- O domínio já possuía `WorkflowDefinition`, registry declarativo, persistência de rascunho/versionamento e Server Actions auditadas.
- O Design System existente fornece Button, Input, ScrollArea, tokens de motion, `motion/react` e redução de movimento por preferência do sistema.
- O engine legado (`crm_automations`) continua intacto e fica disponível como área recolhível de histórico e compatibilidade.

## Entregue

- Biblioteca por categoria e busca de nodes registrados.
- Canvas com arraste, seleção, conexões, quick-add e organização automática.
- Ports com direção, tipo de dado, rótulo e limite de conexão; a UI e o servidor bloqueiam conexões incompatíveis.
- Painel de configuração por schema declarativo, variáveis de lead assistidas e indicador de pendências no node.
- Estado local-first: alteração imediata, autosave com debounce, feedback de salvamento e preservação do rascunho quando o servidor falha.
- Desfazer/refazer local e remoção segura de node, com remoção das conexões vinculadas.
- Validação server-side de configuração obrigatória, trigger, branches, alcance, ciclos e ports antes da publicação.

## Limites desta etapa

- Não há executor, envio externo, teste real, dry-run, trace, dados fixados, loop, subflow, merge, copiar/colar ou inserção em conexão.
- A publicação continua bloqueada pela feature flag global e por ações protegidas; IA e WhatsApp não são liberados por este editor.
- Uma migration 0113 precisa estar aplicada no banco para salvar rascunhos persistentes. Sem ela, o canvas continua disponível como rascunho local e informa erro ao salvar.

## Rollback

Desativar `feature_workflow_automation_enabled` no Super-admin bloqueia novas publicações sem apagar rascunhos, versões ou auditoria. O editor não ativa o executor legado nem altera canais externos.
