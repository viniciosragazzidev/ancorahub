# Egress do Supabase: mensagens do /conversas e fotos de perfil (26/10/2026)

Status: implementado na branch `fix/egress-conversas-fotos`, sem push, aguardando revisão do Vinicios.

## Contexto

O Egress da organização no Supabase passou de 141% da cota (351 de 250 GB no ciclo de 12/10 a 12/11).
O `pg_stat_statements` de 59 dias mostrou como maiores devolvedoras as leituras de `whatsapp_messages`
com o texto do `/conversas` (de 2.000 a 4.000 linhas por chamada, uns 260 milhões de linhas) e a leitura
do usuário pelo login, que traz `user.image` com foto em base64 de até 625 KB (20 usuários com foto).
Diagnóstico completo na branch `claude/supabase-egress-b6e684`, `docs/implementations/active/2026-10-26-supabase-egress.md`.

## O que mudou

### /conversas (diretor e gestor)

- A lista lê um índice leve das mesmas mensagens (`id`, `lead_id`, `client_id`, `phone`, `direction`,
  `sent_at`, `communication_channel_id`), com os mesmos filtros e limites de antes.
- Texto e mídia vêm por id só para as 3 mais novas de cada conversa (prévia e ordem da lista) e para o
  histórico da conversa aberta (`?leadId=`, até as 300 mais novas, pelo lead ou pelo mesmo telefone).
  Sem `?leadId=`, abre completa a conversa da mensagem mais nova, que é a que a tela seleciona sozinha.
- O "N mensagens" da linha e o filtro Atendente Virtual usam `messageCount` e `hasIncoming`, contados
  no índice. A aba WhatsApp coex também filtra pelo índice.
- Regra pura e testada em `src/features/conversations/message-window.ts`.

### Foto de perfil

- `updateAvatarAction` grava a imagem no R2 (`avatars/users/<id>/<hash>.<ext>`) e `user.image` guarda só
  `/api/users/<id>/avatar/<hash>.<ext>` (menos de 80 bytes). Sem R2 configurado, mantém a data URL.
- Rota `src/app/api/users/[id]/avatar/[file]/route.ts`: só usuário da mesma empresa, `Cache-Control`
  privado e imutável (o hash muda com a foto), `nosniff` e CSP sem script para SVG.
- Script `scripts/migrate-user-avatars-to-r2.ts` move as fotos que já existem. Simula por padrão;
  grava com `--apply`. Idempotente.

## Validação

- `npx tsc --noEmit -p .` sem erros; ESLint sem erro nos arquivos alterados (os avisos do
  `conversations-workspace.tsx` já existiam).
- Vitest: 13 arquivos, 51 testes (janela de mensagens, foto, `/conversas`, banco).
- Sem banco local: o `/conversas` não foi aberto com dados reais. Conferir em produção depois do deploy.

## Depois do deploy

1. Rodar a migração das fotos na VPS (container do CRM) ou num ambiente com as mesmas variáveis:
   `npx tsx --conditions=react-server scripts/migrate-user-avatars-to-r2.ts` e, conferido, com `--apply`.
2. No dia seguinte, comparar o `pg_stat_statements` (zerado em 26/10 13:54 UTC) e o gráfico de Egress.

## Não incluído

- Cache de sessão do BetterAuth (`cookieCache`): reduz as consultas de sessão a cada clique, mas atrasa
  em até alguns minutos o efeito de desativar um usuário. Fica para decisão separada.
- `fetch_types: false` no postgres.js, jobs e recargas do Lite: próximas entregas do relatório.
