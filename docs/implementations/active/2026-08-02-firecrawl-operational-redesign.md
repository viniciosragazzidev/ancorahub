# Redesign operacional Firecrawl — fundação compartilhada

## Escopo entregue nesta onda

- Consolidação das superfícies sem transparência: canvas, cards, inputs, popovers e dialogs usam camadas opacas e previsíveis em light e dark.
- Sidebar e cabeçalho respeitam o tema ativo: superfícies claras no light mode e grafite no dark mode. A cor do tenant permanece reservada a seleção, foco e ações diretas.
- `Card`, `Table`, `Button`, `Input`, `Dialog`, `DropdownMenu`, `SidebarMenuButton` e `MobileBottomNav` foram recalibrados a partir dos mesmos tokens, sem introduzir uma biblioteca ou primitivos paralelos.
- O cabeçalho autenticado foi compactado para 64px, preservando o contexto de rota e as ações contextualizadas existentes.
- O cabeçalho compacto usa os tokens semânticos de superfície em dashboard, CRM e Super Admin, sem forçar uma aparência escura no light mode.
- `MetricsOverview` centraliza indicadores em uma única superfície com divisores, aplicado em Dashboard por papel, Leads, Clientes, Equipe e Vendas. Tarefas deixou de usar uma área de tabela sem superfície.
- Cards transparentes legados dentro do shell autenticado passam a receber uma superfície operacional consistente, sem exigir cópias locais de estilos nas páginas.

## Limites e sequência

Esta é a primeira onda do plano em `docs/product/ancorahub-redesign-master-plan.md`. Ela afeta todas as rotas por herança dos primitives e shells. As próximas ondas ainda exigem uma revisão visual, com screenshots e estados completos, dos domínios que possuem composição própria: Conversas, distribuição, configurações, Super Admin, autenticação e extensão.

## Segurança e rollback

- Não houve alteração de rota, consulta, contrato, permissão, tenant, dados pessoais ou integração externa.
- O rollback é limitado aos tokens e variantes dos componentes compartilhados listados acima.
- A aparência do shell segue os tokens do tema ativo, preservando hierarquia equivalente em light e dark.

## Validações

- `npm run type-check` — aprovado.
- `npm run agent:verify -- --level fast` — 53 arquivos e 227 testes aprovados.
- `npm run agent:verify -- --level full` — tipos, testes, documentação, arquitetura, segurança e desempenho aprovados. O lint permanece com dois erros pré-existentes em `update_cards.js` (CommonJS) e avisos legados fora deste escopo.
- `npm run build` — aprovado em 02/08/2026, incluindo o pacote da extensão e as 74 rotas do App Router.
- `npm run agent:verify -- --level fast` — aprovado novamente após a migração visível de workspace em 02/08/2026: 53 arquivos e 227 testes.
- `npm run build` — aprovado novamente após a migração visível, com as 74 rotas e o pacote da extensão.
- Correção de tema em 02/08/2026: tokens de sidebar e ambos os cabeçalhos passaram a consumir superfícies semânticas; `type-check` e verificação rápida aprovados após o ajuste.
- Ajuste de acabamento em 02/08/2026: logos respeitam o contraste do tema pelo componente compartilhado, e a superfície operacional de Tarefas recebeu cabeçalho e estado vazio compactos.
