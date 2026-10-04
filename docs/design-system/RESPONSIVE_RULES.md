# Regras Responsivas

## Estado da evidência

`design.md` não define breakpoints, ordem de reflow, comportamento de tabela, sidebar, densidade ou alvos de toque. Valores numéricos são **MISSING**.

## Contrato enquanto o gap existir

1. Não introduzir breakpoint, largura fixa ou variante mobile inventada.
2. Preservar comportamento responsivo existente ao tocar uma superfície, salvo decisão aprovada.
3. Testar viewport estreito, zoom e overflow horizontal; conteúdo essencial não pode desaparecer sem alternativa.
4. Tabelas precisam declarar estratégia por coluna (reflow, prioridade, scroll ou visão de detalhe) antes de mudança.
5. Navegação, filtros e ações devem permanecer alcançáveis por teclado e toque; a implementação concreta aguarda DG-005.
