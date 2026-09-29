# Investigação da gestão fora das estatísticas de corretores

## Escopo

Leads em `under_analysis` assumidos por Diretor ou Gestor para investigação não
representam recebimento de corretor. Eles deixam de compor a tabela de
Corretores do dashboard, mas continuam disponíveis na operação e no funil
gerencial.

## Implementação

- `src/features/leads/management-investigation.ts` centraliza o predicado SQL
  tenant-scoped para excluir apenas a investigação pertencente à gestão.
- `src/features/dashboard/service.ts` aplica o filtro à agregação de
  Corretores; leads em análise atribuídos a corretores permanecem contabilizados.
- `/leads` resolve os membros de gestão no servidor e sinaliza os registros
  correspondentes com `Investigação da gestão`.
- Tabela e kanban usam destaque visual compartilhado por estado, sem alterar
  filtros, permissões ou ações do lead.

## Validação

- Type-check e build de produção executados após a implementação.
- Alterações não relacionadas existentes no workspace não foram incluídas.
