# WhatsApp oficial da Meta — configuração e migração

## O que já existe no CorreTop

Esta fundação adiciona o domínio `communication_channels`, tokens cifrados em repouso, Embedded Signup para Diretor, webhook assinado e envio de texto pela Cloud API. O OpenWA/QR continua apenas como fallback enquanto não houver canal oficial ativo para a unidade.

| Método | URL | Finalidade |
|---|---|---|
| `GET` | `/api/webhooks/meta/whatsapp` | Confirmação do callback (`hub.challenge`) |
| `POST` | `/api/webhooks/meta/whatsapp` | Eventos de mensagens e status assinados |

O webhook não recebe `tenant_id`. Ele descobre o canal pelo `metadata.phone_number_id` enviado pela Meta e encontra o tenant a partir do banco.

## 1. Preparar o app Meta

1. Em Meta for Developers, crie ou use um app do tipo **Business**.
2. Adicione o produto **WhatsApp** e configure **Facebook Login for Business** com Embedded Signup.
3. Crie a configuração de login para WhatsApp e guarde o **Configuration ID**.
4. Para produção, conclua a revisão/Live exigida pela Meta antes de atender números reais.

Use como referências primárias a coleção oficial [WhatsApp Business Platform da Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/folder/13382743-ba8d099d-007e-4b52-b9f2-3cf3c60e4fbc), que inclui Cloud API e Embedded Signup, e a documentação técnica hospedada pela Meta para [verificação de webhooks](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/). A SDK citada está arquivada; ela é usada aqui apenas para o contrato de verificação, não como dependência do CorreTop.

## 2. Configurar variáveis na Vercel

Cadastre estas variáveis somente em **Production**. Nunca crie `NEXT_PUBLIC_` para App Secret, verify token ou chave de cifra.

```text
META_WHATSAPP_APP_ID=...
META_WHATSAPP_APP_SECRET=...
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=...            # valor aleatório criado por você
META_WHATSAPP_TOKEN_ENCRYPTION_KEY=...             # base64 de 32 bytes
META_WHATSAPP_GRAPH_API_VERSION=v23.0
NEXT_PUBLIC_META_WHATSAPP_APP_ID=...               # o App ID pode ser público
NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=...
```

Gere a chave de cifra localmente e guarde-a no cofre de variáveis:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`META_WHATSAPP_REDIRECT_URI` é opcional e só deve ser definida se a configuração de Login for Business usar uma URL de redirecionamento. Ela precisa coincidir exatamente com o valor informado à Meta.

## 3. Configurar o callback da Meta

No produto WhatsApp do app Meta, informe:

```text
Callback URL: https://corretop.vercel.app/api/webhooks/meta/whatsapp
Verify Token: <o mesmo META_WHATSAPP_WEBHOOK_VERIFY_TOKEN da Vercel>
```

Assine inicialmente `messages`. Depois habilite `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_alerts` e `business_capability_update` quando suas superfícies operacionais estiverem implementadas.

## 4. Ativar com segurança

1. Faça deploy com as variáveis configuradas.
2. Entre como Super-admin em `/super-admin/settings` e ative **WhatsApp oficial da Meta**.
3. Entre como Diretor da corretora em `/settings/whatsapp`.
4. Escolha a unidade (ou toda a corretora) e clique em **Conectar número oficial**.
5. Conclua o Embedded Signup da Meta. O CorreTop troca o code no servidor, valida WABA/número, assina a WABA no app e cifra o token.
6. Envie uma mensagem de teste para um lead de teste cujo telefone esteja registrado na corretora.

## Contratos e limites desta fase

- O POST valida `X-Hub-Signature-256` antes de interpretar o JSON.
- Mensagens de texto inbound são persistidas somente quando o contato corresponde a lead ou cliente do mesmo tenant; mídia e contatos não vinculados são descartados com ledger sem conteúdo pessoal.
- Status da Meta atualiza a mensagem já registrada; mensagens externas são deduplicadas por ID do provedor.
- Texto livre pela Cloud API depende das políticas/janelas de conversa da Meta. Templates, mídia, campanhas e fila assíncrona ainda não foram adicionados.
- Pausar a capacidade global impede processamento e envio oficiais sem apagar os canais. Pausar um canal no tenant é auditado e reverte ao fallback legado quando existir.

## Checklist de teste antes de liberar a primeira corretora

- [ ] `GET` de verificação retorna o `hub.challenge` com 200 usando o verify token correto.
- [ ] Verify token errado retorna 403.
- [ ] POST sem assinatura válida retorna 401.
- [ ] POST válido de número desconhecido não cria mensagem nem associa tenant.
- [ ] POST válido de número conhecido cria uma mensagem para o lead/cliente correto.
- [ ] Envio por unidade com canal oficial ativo cria `whatsapp_messages.provider = meta_cloud`.
- [ ] Sem canal oficial ativo, o fluxo legado permanece funcional até a retirada planejada.
