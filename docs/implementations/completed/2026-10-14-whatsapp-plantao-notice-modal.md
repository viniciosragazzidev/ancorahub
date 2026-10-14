# Modal diário do aviso de WhatsApp (T127)

Em 14/10/2026, o modo diário do aviso passou de banner para modal centralizado
com duas colunas no desktop e ilustração de celular construída em CSS. O modo
compacto fixo na conversa com o Jack permanece visualmente igual. Em telas
pequenas, a ilustração aparece acima do conteúdo e o CTA de conexão vira a
orientação para abrir o CRM no computador, com apenas o botão “Entendi”.

O modal reutiliza `Dialog`, `DialogTitle`, `DialogDescription` e `Button` do
projeto. Escape e “Agora não” fecham até o próximo dia local e preservam a
auditoria. A flag, o público, o armazenamento diário, a auditoria e o fluxo de
conexão não mudaram. Não foram criados tokens, variantes ou dependências.

## Validação

### Mobile illustration follow-up

The rotated phone is inset farther from the top edge and the art panel has more height, so the whole device stays visible on small screens. Validation: `reports/agent/verification/2026-10-14-t127-mobile-illustration.md`.

- `npx vitest run src/components/whatsapp/whatsapp-plantao-notice.test.tsx`: 5 testes aprovados.
- `npm run type-check`: aprovado.
- `npx eslint` nos arquivos TSX alterados: aprovado.
- Capturas Playwright do modo diário em `tmp/t127/`: desktop claro 1440px,
  desktop escuro 1440px e celular 390px.
