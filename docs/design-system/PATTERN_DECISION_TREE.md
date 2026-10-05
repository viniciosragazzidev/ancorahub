# UI Decision Tree

1. Coleção com filtros/tabela? `LIST_PAGE`.
2. Uma entidade com contexto e histórico? `DETAIL_PAGE`.
3. Configuração persistida? `SETTINGS_PAGE`.
4. Métricas para decidir? `DASHBOARD_PAGE`.
5. Edição focada com poucos campos? Dialog; extensa/contextual? Drawer; fluxo próprio? Form/Detail Page.
6. Conversa operacional? `CHAT_PAGE`; configuração de IA? `SETTINGS_PAGE` em `/qualificacao`.

Se nenhuma opção cobrir o caso, abra gap de pattern; não crie layout ad hoc.
