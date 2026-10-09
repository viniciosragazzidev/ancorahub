> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# UI Decision Tree

1. Coleção com filtros/tabela? `LIST_PAGE`.
2. Uma entidade com contexto e histórico? `DETAIL_PAGE`.
3. Configuração persistida? `SETTINGS_PAGE`.
4. Métricas para decidir? `DASHBOARD_PAGE`.
5. Edição focada com poucos campos? Dialog; extensa/contextual? Drawer; fluxo próprio? Form/Detail Page.
6. Conversa operacional? `CHAT_PAGE`; configuração de IA? `SETTINGS_PAGE` em `/qualificacao`.

Se nenhuma opção cobrir o caso, abra gap de pattern; não crie layout ad hoc.
