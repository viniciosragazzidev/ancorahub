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

- `npx vitest run src/components/whatsapp/whatsapp-plantao-notice.test.tsx`: 5 testes aprovados.
- `npm run type-check`: aprovado.
- `npx eslint` nos arquivos TSX alterados: aprovado.
- Capturas Playwright do modo diário em `tmp/t127/`: desktop claro 1440px,
  desktop escuro 1440px e celular 390px.
