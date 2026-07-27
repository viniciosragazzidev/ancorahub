# ADR-0033 — Migração para WhatsApp Cloud API da Meta

**Status:** Aceita — 2026-07-16  
**Decisão:** a integração oficial usa Embedded Signup, `communication_channels` e Cloud API; OpenWA é legado transitório.

## Contexto

O conector por QR é vinculado a sessões individuais e não oferece o contrato estável, empresarial e multi-número necessário para uma plataforma SaaS. A Meta identifica o número remetente no webhook por `phone_number_id`; esse identificador é a fronteira segura para encontrar o canal e, por consequência, o tenant.

## Decisão

- Implementar `GET` e `POST /api/webhooks/meta/whatsapp`.
- Validar GET pelo verify token e POST por `X-Hub-Signature-256` calculado com App Secret.
- Persistir canais por tenant/unidade e cifrar o access token com AES-256-GCM em chave mantida no ambiente.
- Autorizar somente Diretor a conectar ou pausar canais do seu tenant; Super-admin ativa/desativa a capacidade global com auditoria.
- Ao enviar, selecionar canal Meta ativo da unidade antes do fallback OpenWA. Ao receber, descartar mensagens sem canal ou sem lead/cliente associado.

## Consequências

O canal oficial pode coexistir com o QR sem redirecionamento de tráfego entre tenants. Esta primeira fase trata texto inbound/outbound e status. Templates, mídia, janela de 24 horas, campanhas, filas assíncronas e retirada definitiva do OpenWA seguem como etapas posteriores.
