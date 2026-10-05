# Padrões de Página

Estes padrões são estruturais e genéricos. Dados, permissões e regras de negócio permanecem nas features.

| Padrão | Estrutura mínima | Estados obrigatórios |
|---|---|---|
| List | contexto, ação principal, filtros, conteúdo e paginação/continuação | loading, vazio, erro, sem permissão, indisponível. |
| Detail | contexto da entidade, resumo, ações contextualizadas e conteúdo | loading, not found, erro, sem permissão, sucesso de mutação. |
| Dashboard | contexto/escopo, no máximo três prioridades, dados com origem e drill-down real | loading, sem dados, erro, período/escopo indisponível. |
| Settings | contexto, subnavegação persistível, formulário e feedback de salvamento | loading, dirty, saving, success, error, sem permissão. |
| Form | título, campos rotulados, ajuda, validação e ação principal | default, invalid, submitting, success, error, disabled. |
| Empty | explicação, causa e próxima ação quando disponível | não usar ilustração como única explicação. |
| Wizard | objetivo, progresso verificável, próxima ação e saída segura | início, em progresso, bloqueado, concluído, erro. |

**CONFIRMED:** largura de referência até 1200 px, seção 96 px, card 24 px e gap 12 px. **MISSING:** adaptação desses valores a telas operacionais, tabelas e mobile.
