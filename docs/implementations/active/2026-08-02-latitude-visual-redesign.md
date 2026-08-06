# Redesign visual AncoraHub × Latitude

## Objetivo

Substituir a linguagem visual herdada do experimento Firecrawl por uma
implementação própria inspirada no Latitude. O escopo é exclusivamente visual:
rotas, dados, permissões, integrações, consultas e ações do AncoraHub não são
alterados.

## Decisões

- A referência local `latitude-llm-reference/` é somente de consulta visual e
  está ignorada pelo Git.
- Nenhum código, dependência, API ou domínio da referência é incorporado.
- Tokens, primitives e shells compartilhados são a única fonte de estilos para
  superfícies operacionais; páginas não recebem clones locais desses controles.
- A cor de marca do tenant continua disponível para ações e foco, enquanto a
  hierarquia de superfície permanece neutra para preservar legibilidade.
- Claro e escuro usam a mesma relação: canvas, card, popover, borda, foco,
  seleção e feedback semântico.

## Migração concluída nesta etapa

- Rollback isolado da camada visual Firecrawl nesta branch.
- Camada semântica de tokens para claro e escuro.
- Shell autenticado, cabeçalhos e navegação móvel mais densos.
- Primitives compartilhados de card, botão, input, textarea, select, tabela,
  badge, tabs, dialog, sheet, dropdown, scroll e estados vazios.
- Login e superfícies de métricas passam a reutilizar a mesma elevação e raio.

## Verificação necessária antes de promover

1. Type-check, testes e build.
2. Revisão de screenshot nas rotas representativas: dashboard, leads, tarefas,
   conversas, vendas, plantões, configurações e Super Admin, em claro/escuro e
   viewport estreito.
3. Confirmar navegação, tabelas longas, menus, diálogos, foco de teclado e
   estados sem dados.

## Rollback

Produção pode retornar a `main` sem migration ou alteração de dados. A cópia da
referência visual permanece local e fora do repositório.
