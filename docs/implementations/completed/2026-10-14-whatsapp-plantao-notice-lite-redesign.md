# Refinamento Lite do aviso de WhatsApp do plantão (T122)

Em 14/10/2026, o aviso existente foi redesenhado na linguagem do card do tour
Lite. No desktop, o modo diário usa o ícone à esquerda e a coluna de conteúdo à
direita; o título, texto e CTA ficam alinhados, com o botão à direita da linha de
instrução do computador. O modo sticky mostra ícone, título curto e botão em uma
linha de 60px no topo da conversa de Jack. Em celulares, os dois modos ocultam o
CTA e exibem a instrução para abrir o CRM no computador; o diário mantém o texto
explicativo e o fechamento.

Foram reaproveitados classes do tour Lite, botão compartilhado, ícones existentes
e a animação de entrada existente, respeitando reduced motion, foco visível e
larguras móveis. O verde está restrito ao ícone do WhatsApp. A lógica de exibição,
conexão, auditoria, flag e localStorage não foi alterada.

## Validação

- `npx vitest run src/components/whatsapp/whatsapp-plantao-notice.test.tsx`: 4 testes aprovados.
- `npm run type-check`: aprovado.
- `npx eslint` nos arquivos TSX alterados: aprovado.
- Capturas Playwright em 1440px e 390px para os dois modos em `tmp/t122-whatsapp-notice/`; largura de rolagem igual ao viewport, sem erros de página, sticky desktop com 60px.
