# WAHA relay da Ancora

Este serviço fica em uma VPS separada. Ele não recebe conexão com o banco, tokens da
Meta nem tráfego público direto. Exponha-o somente atrás de proxy HTTPS com allowlist
da Vercel ou rede privada.

Configure `WAHA_RELAY_SHARED_SECRET` com uma chave aleatória longa e igual no relay e
na Vercel. Configure `WAHA_API_KEY` somente na VPS. O CRM chama `POST /v1/messages`
com assinatura HMAC; o relay deduplica por `idempotencyKey` antes de enviar ao WAHA.

Antes de ativar a feature, valide uma sessão sintética, persistência do volume
`waha_sessions`, reinício dos containers, rotação de logs e backup externo dos volumes.
O endpoint de inbound do CRM é `/api/webhooks/waha`; conecte o adaptador de webhook do
WAHA a ele somente depois de validar o formato normalizado e a assinatura ponta a ponta.
