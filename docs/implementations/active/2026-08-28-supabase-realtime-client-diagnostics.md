# Diagnóstico do cliente Supabase Realtime após migração

## Escopo

Auditar a origem da configuração do cliente Realtime usado no navegador e
instrumentar, de forma temporária e opt-in, os estados da assinatura. Nenhuma
alteração é feita em banco, RLS, publication ou regras de negócio.

## Constatações

- O cliente do navegador é construído exclusivamente em
  `src/utils/supabase/client.ts` por `createBrowserClient(url, publishableKey)`.
- URL e chave pública vêm diretamente de `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; não há fallback ou chave hardcoded.
- O único consumidor de Realtime no shell autenticado é
  `RealtimeSyncProvider`, que assina um tópico Broadcast privado e opaco por
  tenant e usuário. Este fluxo não usa `postgres_changes`.
- Como as duas variáveis têm prefixo `NEXT_PUBLIC_`, o Next.js as incorpora no
  JavaScript na etapa de build. Uma mudança no Coolify exige rebuild completo
  da imagem e recarregamento forçado do navegador para afetar o WebSocket.

## Diagnóstico temporário

Definir `NEXT_PUBLIC_REALTIME_DIAGNOSTICS=true` em **Buildtime** do projeto CRM
no Coolify, fazer um deploy com rebuild e abrir o Console do
navegador. Os logs com prefixo `[supabase-realtime]` incluem somente hostname,
project ref, evento, estado da assinatura e se o SDK forneceu erro. Nunca
incluem chave, token, tópico ou payload.

## Validação

1. Em Console, confirmar `client_created` e que `projectRef` é o projeto novo.
2. Confirmar `subscribe_requested` seguido de `subscription_status` com
   `SUBSCRIBED`.
3. Se houver `CHANNEL_ERROR`, `TIMED_OUT` ou `CLOSED`, registrar apenas esses
   campos e o horário para correlacionar com o Console/Network do navegador.
4. Após o diagnóstico, remover a variável ou definir `false`; os logs deixam
   de ser emitidos sem novo código.

## Rollback

Remover `NEXT_PUBLIC_REALTIME_DIAGNOSTICS` e fazer novo deploy, ou reverter
somente os dois arquivos de diagnóstico. O fluxo de Realtime permanece igual.
