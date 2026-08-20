# KANBAN_PAGE

Use quando a evolução por estágio é o trabalho principal. Para auditoria, busca e comparação densa, combine com `LIST_PAGE` em vez de substituir a tabela.

## Composição

Contexto e filtros persistíveis → colunas nomeadas com contagem real → cartões resumidos → detalhe contextual → ação de mover com confirmação quando aplicável.

- Cada coluna possui estado vazio próprio e rolagem controlada.
- Drag and drop nunca é o único meio de mudar estágio; disponibilize ação por teclado/menu.
- Falha de sincronização preserva a intenção e oferece retry/rollback explícito.

## Estados obrigatórios

loading por coluna, vazio, filtrado sem resultado, sincronizando, erro de mutação, sem permissão e indisponível.
