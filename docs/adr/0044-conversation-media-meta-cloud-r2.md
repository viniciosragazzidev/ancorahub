# ADR-0044 — Mídia oficial nas conversas (inbound/outbound) via Meta Cloud + R2 privado

**Estado:** Aceita
**Data:** 2026-09-14
**Relaciona:** DEC-098, DEC-033, DEC-069, DEC-091, ADR-0033

## Contexto

`/conversas` exibia apenas texto: o webhook Meta persistia mídia como `[audio]`,
`[image]` etc., sem baixar o binário, e não havia envio de mídia pela plataforma.
O bucket privado R2 (DEC-069) já é o padrão de binários do CRM, com rota
autenticada e auditoria.

## Decisão

1. **Persistência:** `whatsapp_messages` ganha colunas de mídia (`mediaKind`,
   `mediaMimeType`, `mediaFilename`, `mediaSizeBytes`, `mediaStorageKey`,
   `mediaProviderId`, `mediaSha256`). O banco permanece a autoridade de metadados;
   o corpo de texto continua sendo a legenda quando existir.
2. **Inbound:** ao receber mídia pelo webhook Meta, o servidor baixa o binário da
   Graph API usando a credencial decifrada do canal, grava em R2 sob
   `whatsapp-media/<tenantId>/` e persiste a mensagem com os metadados. Falha de
   download não perde a mensagem: ela é persistida como mídia indisponível com
   motivo registrado no log operacional.
3. **Outbound:** gestão (diretor/gestor) envia mídia via Server Action; o arquivo
   chega como `FormData`, é validado (tipo MIME e tamanho — imagem 5 MB; áudio,
   vídeo e documento 16 MB), gravado em R2 e enviado pela Graph API
   (`/media` upload + referência na mensagem). O envio permanece negado ao
   corretor, conforme DEC-091.
4. **Leitura:** o download acontece somente pela rota autenticada
   `GET /api/conversations/media/[messageId]`, que resolve o tenant e o escopo do
   papel no servidor, valida o vínculo da mensagem, aplica auditoria e transmite
   o objeto do R2. Nenhuma URL pública do bucket é exposta.
5. **Governança:** kill switch global `feature_conversation_media_enabled`
   (padrão ativo), controlado e auditado pelo Super-admin. Desativado, novas
   mídias deixam de ser baixadas e enviadas; histórico e objetos são preservados.

## Consequências

- Migração aditiva (`0145_conversation_media.sql`), sem quebrar consumidores
  existentes de `whatsapp_messages`.
- WAHA/OpenWA permanecem fora do escopo de mídia nesta entrega.
- A aba Corretores ganha suporte de mídia inbound recebida do número do corretor;
  o envio de mídia para corretores reutiliza a mesma action da aba principal.

## Rollback

Reverter os arquivos do domínio `communication-channels`/`conversations` e a rota
de mídia restaura o comportamento somente-texto sem perda de dados; a migração é
aditiva e pode permanecer no banco. O kill switch interrompe a capacidade em
produção sem deploy.
