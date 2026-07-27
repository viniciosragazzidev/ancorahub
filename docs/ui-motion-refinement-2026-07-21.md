# Refinamento visual e de motion — 2026-07-21

## Direção aplicada

O CorreTop é um CRM operacional B2B. A interface deve transmitir confiança, leitura rápida e controle: densidade moderada, contraste claro, azul como ação primária e movimento curto apenas quando explica uma mudança de estado.

## Melhorias aplicadas

- Componentes de ação usam propriedades de transição explícitas e os tokens compartilhados (`--duration-quick` e `--ease-smooth-out`), evitando `transition-all` e animações acidentais.
- Campos de texto e diálogos têm entrada, foco e saída com a mesma curva visual, além de desligamento completo com `prefers-reduced-motion`.
- Cards de métricas respondem com elevação mínima no hover somente em ponteiro fino; a informação não se desloca em dispositivos sem hover ou com movimento reduzido.
- Sidebar e tabelas preservam o feedback de estado ativo/foco sem competir com o conteúdo.
- Os tokens de distância, escala e blur usados nas transições de rota agora estão definidos globalmente, mantendo a animação previsível em todos os temas.

## Regras para próximas telas

1. Não usar `transition-all`; declarar somente propriedades visuais ou transform.
2. Interações frequentes devem ficar abaixo de 250 ms e não animar dados pessoais.
3. Toda animação de deslocamento precisa respeitar `prefers-reduced-motion` e o controle global do Super-admin.
4. Cards só devem ganhar elevação quando forem interativos; cards informativos permanecem estáveis.
5. Estados de sucesso, erro, carregamento e abertura de diálogo devem reutilizar os tokens existentes antes de criar novos.

## Validação

`npm run type-check` passou em 21/07/2026. O build de produção deve ser executado antes do deploy.
