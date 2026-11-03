# Extensão v2: servidor da E4

Data: 03/11/2026. Branch: `feat/ext-v2-e3`.
Plano: `2026-11-03-extensao-whatsapp-v2.md`, E4.
Mapa: `mapa-ext-e2-e4.md`, trecho E4.

## Inbox

- `GET /api/extension/inbox?cursor=` passa por `requireExtensionAccess` com `VIEW_LEAD` e exige perfil `broker`. O rate limit próprio do helper é 200 pedidos por hora e não é compartilhado com resolve ou aceite.
- `readExtensionInbox` seleciona ofertas ativas e não vencidas do corretor dentro do tenant e notificações do mesmo usuário/tenant apenas dos nove tipos autorizados. O cursor é base64url de `{createdAt,id}`; comparações e ordenação mantêm os microssegundos do PostgreSQL e desempate pelo id.
- Cada item tem somente `{id,type,leadId,createdAt}`. Ofertas usam `type: "lead_offer_pending"`. Notificações não selecionam `title` nem `message`; o `leadId` só sai quando o lead também pertence ao tenant.
- Quando não há registro depois do cursor, responde `304` com corpo vazio. A auditoria registra a leitura sem armazenar cursor ou texto da notificação. O helper de acesso só grava `lastSeenAt` quando o intervalo de cinco minutos venceu.
- Consulta ofertas com tenant, corretor, status e validade para usar `lead_offers_broker_status_expires_idx`; notificações filtram usuário, tenant, tipos e cursor para usar `notifications_recipient_created_idx`. Sem SQL ou índices novos.

## Pendências da E3

- Repetir a recusa de uma oferta já recusada agora retorna `alreadyDeclined: true`, `contaComoPulo: false` e mensagem sem afirmar novo pulo.
- O teste de segurança do payload contém a atribuição de compilação `const clientContract: LeadAmpliado = result.lead`; o typecheck confirma o contrato compartilhado sem alterar `apps/browser-extension/src/shared/types.ts`.

## Verificação e escopo restante

- Vitest mockado: 21 testes em `inbox-route-contract.test.ts`, `offers-route-contract.test.ts` e `payload-security.test.ts` passaram.
- `npx tsc --noEmit`: passou.
- Sem build, migração, acesso a banco ou mudanças em `apps/browser-extension`.
- Alarmes, notificações Chrome, selo, som e aviso no WhatsApp foram implementados na parte cliente da E4 em `2026-11-03-extensao-whatsapp-v2-e3-e4-cliente.md`.
