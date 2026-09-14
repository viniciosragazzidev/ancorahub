# Implementação — Mídia oficial nas conversas (DEC-098 / ADR-0044)

**Data:** 2026-09-14
**Estado:** Concluída (aguardando homologação externa com a Meta)

## Escopo entregue

- `/conversas` (aba principal de leads/clientes): receber mídia inbound
  (imagem, áudio, documento, vídeo) pelo webhook Meta Cloud, enviar mídia
  outbound pelo canal oficial e visualizar/ouvir na plataforma.
- Aba Corretores: mídia inbound do número do corretor renderizada no histórico;
  binários servidos pela mesma rota autenticada.
- Visualização: imagem inline com lightbox, áudio com player inline (ouvir),
  vídeo com controles nativos, documento com download autenticado. Mensagem de
  mídia sem objeto armazenado é exibida como "Mídia indisponível" com motivo,
  sem quebrar a conversa.
- Envio: botão de anexo (clipes) no ChatInput com menu Imagem/Áudio/Documento/
  Vídeo, seletor de arquivo, prévia e legenda opcional. Corretor permanece
  bloqueado (DEC-091), diretor/gestor enviam pelo canal Meta ativo do tenant.

## Arquivos afetados

- `drizzle/0145_conversation_media.sql` + `drizzle/meta/_journal.json`: colunas
  `media_*` em `whatsapp_messages` (migração aditiva).
- `src/shared/db/schema.ts`: colunas de mídia refletidas no schema Drizzle.
- `src/shared/feature-flags/catalog.ts`: flag global
  `feature_conversation_media_enabled` (padrão ativo).
- `src/features/communication-channels/conversation-media.ts`: domínio de mídia
  (validação MIME/tamanho, limites Meta, R2 privado com prefixo
  `whatsapp-media/<tenantId>/`, download/upload Graph API, resolução escopada
  por tenant/papel para leitura).
- `src/features/communication-channels/service.ts`: webhook Meta baixa mídia
  inbound, persiste metadados no ledger; falha de download nunca perde a
  mensagem (persistida como mídia indisponível, log sem PII).
- `src/features/communication-channels/types.ts`: payload de mídia tipado.
- `src/features/leads/actions/send-lead-media.ts`: Server Action de envio
  (validação no servidor, upload Meta, persistência atômica, auditoria,
  revalidate/invalidação opaca).
- `src/app/api/conversations/media/[messageId]/route.ts`: rota autenticada e
  escopada por tenant/papel/unidade; auditoria `midia_visualizada`; sem URL
  pública do bucket.
- `src/features/conversations/components/media-bubble.tsx`: renderização de
  mídia por tipo (imagem/áudio/vídeo/documento) + estado indisponível.
- `src/features/conversations/components/media-attach-button.tsx`: anexo com
  menu, seletor, legenda e envio via action.
- `src/app/(dashboard)/conversas/page.tsx`: queries incluem colunas `media_*`;
  mensagens (leads, sintéticas e Corretores) carregam metadados de mídia.
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`: MediaBubble no
  histórico, lightbox, botão de anexo no ChatInput e atualização otimista do
  envio de mídia.
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx`: mídia no
  histórico da aba Corretores.
- `src/components/huge-icons.tsx`: ícones Image/Music/Video/File/Paperclip/Play/
  Pause adicionados via aliases Hugeicons existentes (sem dependência nova).
- `src/app/(platform-admin)/super-admin/actions.ts` e
  `src/app/(platform-admin)/super-admin/settings/page.tsx`: kill switch
  auditado `conversation_media.global_feature_updated` no Super-admin.

## Governança

- Kill switch global `feature_conversation_media_enabled` controlado pelo
  Super-admin em `/super-admin/settings` ("Mídia nas conversas oficiais"),
  com auditoria em `platform_audit_logs`. Desativado: novos downloads/envios
  param; histórico e objetos preservados; rota de mídia responde 503.
- Auditoria: envio (`midia_enviada:<kind>`) e acesso (`midia_visualizada`) por
  mensagem; tenant, papel e escopo sempre derivados da sessão.

## Validações executadas

- `npx tsc --noEmit`: sem erros.
- `npx vitest run src/features/communication-channels/service.test.ts
  src/features/conversations`: 9 testes passando.
- ESLint dirigido nos arquivos alterados: 0 erros (warnings pré-existentes).
- `npm run build`: build de produção concluído.

## Pendências / riscos

- Homologação real com a Meta (download `lookaside.fbsbx.com` e upload de
  mídia em WABA de teste) pendente, conforme `docs/provider-homologation.md`.
- WAHA/OpenWA permanecem fora do escopo de mídia (texto já coberto).
- Sticker inbound é tratado como imagem estática.
