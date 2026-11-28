# Direção limpa (28/11/2026)

Pedido do Vinicios: deixar o projeto todo mais limpo, com menos sombra e menos poluição, mais parecido com
eiaira.com. A salte.com, segunda referência citada, não resolve (DNS); ficou só a Aira. Vale junto com
`LITE_CHAT_DESIGN_SYSTEM.md`. Onde os dois discordarem, vale este documento.

## O que a referência faz

- Fundo cinza muito claro e cartões brancos **chapados**: sem sombra, só um contorno de 1px com ~8% de opacidade.
- Cantos grandes nos cartões (24 a 32px) e pílulas nos controles.
- Muito respiro: poucos elementos por bloco, títulos curtos, quase sem texto explicativo.
- Uma ação de destaque por área; o resto é texto ou contorno.

## Regras para o Lite

1. **Sem sombra em cartão, linha, pílula ou segmented.** `--shadow-resting` é `none` (no tema da gestão, no
   Lite e no Painel). Para destacar, use contorno (`1px solid var(--border)`, ou `inset 0 0 0 1px` em item
   ativo). A sombra fica só no que flutua: menu, popover, gaveta e diálogo (`--shadow-floating`).
2. **Contorno do cartão:** `1px solid` com `rgb(16 16 40 / 0.08)`.
3. **Menos texto fixo:**
   - título de seção sem parágrafo embaixo, salvo quando a frase muda a decisão;
   - explicação longa vai para o `?` ou para a gaveta.
4. **Números em linha:** três ou quatro números de resumo ficam numa faixa só (um cartão, divisórias finas), e não
   em quatro cartões separados.
5. **Uma coisa por bloco:** cada cartão responde uma pergunta. Configurações, filtros secundários e textos de
   ajuda vão para gaveta, menu ⋯ ou "Configurações ▾".
6. **Espaço:**
   - 24px entre blocos e 20 a 24px dentro do cartão;
   - título da página 28px; título de seção 16px, peso 500;
   - Inter 400 e 500.
7. **Cor:**
   - neutro em tudo;
   - azul de ação só no primário;
   - status só com texto;
   - nunca mais de uma cor cromática no mesmo componente.

## Como aplicar numa rota

1. Artifact primeiro (Design canvas, computador 1440 e celular 390), com dados de exemplo realistas.
2. Implementar 1:1 no ramo Lite, com marcação nova e CSS module novo.
3. Arquivo de servidor nunca importa valor (classe de CSS module, função) de módulo "use client".
4. Conferir numa prévia montada no servidor, em 1440x900 (com o zoom de 80% da gestão) e 375x812.
