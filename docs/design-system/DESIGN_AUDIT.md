# Auditoria de `design.md`

## Fonte auditada

- `design.md`: referência “Acctual — Style Reference”, tema claro e composição editorial/marketing.
- `src/app/globals.css`, `src/components/ui/{button,card,input}.tsx`: implementação atual consultada apenas para identificar divergências; não substituem a fonte visual nesta auditoria.

## Regras explícitas — CONFIRMED

- Paleta nomeada: Ink `#1e1e1e`, Carbon `#0f0f0f`, Midnight `#0d111b`, Smoke `#666`, Fog `#8d8d8d`, Ash `#999`, Mist `#ccd1da`, Paper `#fff`, Snow `#f7fafc`, Concrete `#afb0b1`, Electric Blue `#0098f2`, Iris `#6c56fc`, Magenta `#f200ca`, Leaf `#5d9c06`, Coral `#ff6363`, Ice `#cfeafa`, Lavender `#e1e0fc`, Blush `#f6d2f4`.
- Open Runde é a família primária; Caveat é exclusiva da atribuição de depoimento; SF Pro é uso raro em caixa alta.
- Escala tipográfica, escala de espaço de 4 px, largura máxima de 1200 px, seção de 96 px, card de 24 px e gap de 12 px estão documentados.
- CTAs primários são escuros; Electric Blue não deve preencher botões nem grandes superfícies; não usar gradientes.
- Botões são pills; cards comuns usam raio 16; painéis grandes usam 32; feature cards não recebem sombra.
- Tema de referência é claro.

## Regras interpretadas — INFERRED

- A prioridade visual é sóbria, com superfície clara, bordas discretas e uma ação principal por contexto.
- Os valores de `design.md` podem orientar primitives genéricos, mas não autorizam copiar componentes de marketing para telas operacionais.
- O uso de tokens semânticos é necessário para evitar hex, espaçamentos e sombras locais em futuras implementações.

## Ambiguidades, contradições e lacunas

| Tipo | Item | Evidência / impacto |
|---|---|---|
| CONFLICT | `Snow` | definido como `#f7fafc` e usado como `#fafafa` em outra seção. |
| CONFLICT | Ink/Carbon | ambos são descritos como texto primário/secundário em trechos sobrepostos. |
| CONFLICT | raios | regras citam 10, 16, 20, 32 e 100, mas o “do not” diz que apenas 16, 32 e 100 são válidos. |
| CONFLICT | texto abaixo de Smoke | proíbe texto abaixo de `#666`, mas também atribui Fog/Ash a meta e disabled. |
| CONFLICT | sombra `subtle-2` | a tabela está truncada; outra seção fornece uma pilha semelhante, sem declarar equivalência. |
| MISSING | semântica de status | as cores decorativas não definem sucesso, alerta, erro, informação ou contraste. |
| MISSING | tema escuro | não há paleta ou comportamento para dark mode. |
| MISSING | responsividade | não há breakpoints, reflow, tabela, sidebar ou touch target. |
| MISSING | acessibilidade | não há foco, contraste medido, teclado, ARIA, zoom ou leitor de tela. |
| MISSING | estados | loading, empty, error, success, offline, permission denied e disabled não têm contrato completo. |
| MISSING | motion | não há duração, easing, distância ou política de reduced motion na fonte. |
| MISSING | z-index | não há escala de camadas. |

## Componentes

**Especificados:** botão preenchido, botão secundário escuro, botão link outline, feature card, card elevado, painel grande, card colorido, accordion de FAQ, label eyebrow e marca.

**Não especificados:** input, select, checkbox, radio, switch, tooltip, dialog, drawer, dropdown, toast, tabs, table, pagination, badge semântico, skeleton, empty/error state, navegação operacional e componentes de dados.

## Divergência observada — não alterada

O CSS atual possui tokens semânticos e motion próprios; o `Input` usa raio de 10 px e `Card` usa `rounded-xl`, padding e sombra diferentes. Isto é uma divergência de implementação, não uma autorização para sobrescrever nem para considerar a migração concluída.

As decisões a resolver estão enumeradas em [DESIGN_GAPS.md](./DESIGN_GAPS.md).
