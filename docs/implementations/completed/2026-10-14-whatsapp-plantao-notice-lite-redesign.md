# Refinamento Lite do aviso de WhatsApp do plantão (T122)

Em 14/10/2026, o aviso existente foi redesenhado na linguagem do card do tour
Lite. O modo diário mantém o texto completo, fechamento e CTA no topo do conteúdo.
O modo sticky reaproveita o card e fica compacto no topo da conversa de Jack,
sem sobrepor as mensagens; no celular, mantém título e orientação da conexão.

Foram reaproveitados classes do tour Lite, botão compartilhado, ícones existentes
e a animação de entrada existente, respeitando reduced motion, foco visível e
larguras móveis. O verde está restrito ao ícone do WhatsApp. A lógica de exibição,
conexão, auditoria, flag e localStorage não foi alterada.

## Validação

- `npx vitest run src/components/whatsapp/whatsapp-plantao-notice.test.tsx`: 4 testes aprovados.
- `npm run type-check`: aprovado.
- `npx eslint` nos arquivos TS/TSX alterados: aprovado.
- Capturas Playwright em 1440px e 390px para os dois modos em `tmp/t122-whatsapp-notice/`; largura de rolagem igual ao viewport e sem erros de página.
