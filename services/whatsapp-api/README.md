# WhatsApp API

Servico Fastify isolado que guarda a credencial de revisao da Meta e faz a chamada
server-to-server para a Graph API. Ele nao aceita chamadas do navegador.

## Endpoint de revisao

`POST /api/integrations/whatsapp/send-test-message`

Cabecalho obrigatorio: `X-CorreTop-Internal-Token`. O CRM envia esse cabecalho somente
do seu servidor. Corpo:

```json
{ "to": "5521999999999", "message": "Mensagem de teste enviada pelo CorreTop CRM." }
```

O token da Meta fica somente em `META_WHATSAPP_REVIEW_ACCESS_TOKEN` neste servico. O
CRM recebe apenas `messageId` ou um erro seguro.

## Executar localmente

```bash
cp .env.example .env
npm install
npm run dev
```

Mantenha `WHATSAPP_REVIEW_ENABLED=false` ate o Super-admin habilitar a capacidade no
CRM e as credenciais de teste da Meta estarem configuradas. Para producao, publique
esta pasta como um servico Node/Docker separado da Vercel e configure as mesmas
variaveis como segredos do provedor.
