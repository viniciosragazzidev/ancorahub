> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Padrões de Navegação

- Sidebar e topbar são transversais: uma wave de página não altera rotas, grupos, permissões ou atalhos sem tarefa própria.
- Breadcrumb somente aparece quando existe profundidade real; páginas de primeiro nível usam título e contexto.
- Tabs separam conteúdo do mesmo contexto e devem preservar a seleção em URL quando ela for recuperável.
- Filtros, período, paginação e escopo seguem a mesma regra de persistência quando alterarem a leitura operacional.
- Drawer preserva a lista/contesto de origem; Detail Page é usada quando o trabalho exige navegação interna, histórico extenso ou vários formulários.

Estas regras complementam a árvore de decisão e não substituem RBAC ou autorização no servidor.
