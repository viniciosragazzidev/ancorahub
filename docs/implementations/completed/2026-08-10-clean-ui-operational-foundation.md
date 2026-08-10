# Clean UI operacional - fundação

## Entrega

- Criada a capacidade global `feature_clean_ui_operational_enabled`.
- A interface operacional simplificada fica disponível por padrão para todas as empresas. O Super-admin pode desligá-la globalmente ou devolver uma empresa ao layout anterior; ambas as ações ficam registradas em auditoria.
- O Dashboard do Corretor passou a priorizar quatro decisões diárias: conversas aguardando, tarefas vencidas, retornos e novos leads.
- Os atalhos duplicados foram retirados da home. A ação de atendimento em massa que apenas informava estar em desenvolvimento também foi removida.
- Registrada matriz de densidade em `docs/ux-clean-ui-audit.md` para orientar as próximas ondas sem mudar regras comerciais, dados ou permissões.

## Segurança e reversão

O tenant é sempre derivado no servidor. A configuração global e a exceção por empresa são realizadas somente pelo Super-admin e gravam `platform_audit_logs`. Desligar a capacidade restaura o dashboard anterior, sem migração nem exclusão de dados.

## Validação

- `npm run type-check` concluído com sucesso.
- `npm test` concluído com sucesso: 60 arquivos e 258 testes aprovados.
- `npm run build` e `npm run agent:verify -- --level fast` excederam o limite local de execução disponível; a publicação em produção deve confirmar a compilação remota antes da expansão do rollout.
