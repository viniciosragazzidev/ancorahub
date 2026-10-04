# Tokens de Raio

| Token | Valor | Propósito | Estado | Não usar |
|---|---:|---|---|---|
| `radius.pill` | 100 px | tags e botões | CONFIRMED | em containers grandes. |
| `radius.card` | 16 px | feature card | CONFIRMED | assumir em todos os cards. |
| `radius.image` | 20 px | imagem/card elevado | CONFIRMED | virar raio padrão sem decisão. |
| `radius.panel` | 32 px | painel grande | CONFIRMED | controlos pequenos. |
| `radius.control` | 10 px | quick-start da referência | CONFIRMED | panels, cards ou pills. |

DG-003 foi resolvido no Design Contract 1.2.0; novos primitives devem usar os
aliases runtime correspondentes, nunca valores locais arbitrários.
