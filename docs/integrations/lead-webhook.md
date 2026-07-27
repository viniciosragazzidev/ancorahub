# Webhook de Leads — CorreTop

Endpoint externo para recebimento de leads no CorreTop com segurança,
idempotência, rastreabilidade e isolamento multi-tenant.

---

## Endpoint

```
POST https://app.corretop.com.br/api/webhooks/leads/<TENANT_ID>
```

> O `<TENANT_ID>` é o identificador único do tenant (corretora) no sistema.

---

## Autenticação

Todas as requisições devem incluir um token Bearer no header `Authorization`:

```
Authorization: Bearer crt_live_<token>
```

> O token é gerado pelo administrador do tenant na interface de configurações
> ou via script de linha de comando. O token bruto é exibido **uma única vez**
> no momento da criação e não pode ser recuperado posteriormente.

### Headers obrigatórios

| Header | Valor |
|---|---|
| `Authorization` | `Bearer <token>` |
| `Content-Type` | `application/json` |

---

## Idempotência (opcional)

Para evitar duplicação por reenvio acidental, inclua o header:

```
Idempotency-Key: <identificador único>
```

- Máximo de 64 caracteres
- Caracteres permitidos: letras, números, `_` e `-`
- Chaves repetidas com o **mesmo payload** retornam o lead anterior (200 OK)
- Chaves repetidas com **payload diferente** retornam conflito (409 Conflict)

---

## Payload

### Campos obrigatórios

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string (2–160) | Nome completo do lead |
| `phone` | string (8–30) | Telefone de contato |
| `source` | string (1–100) | Origem comercial do lead (ex: `landing-page`, `indicacao`) |

### Campos opcionais

| Campo | Tipo | Descrição |
|---|---|---|
| `externalId` | string (1–191) | Identificador do lead no sistema de origem |
| `email` | string (válido) | E-mail do lead |
| `planInterest` | string (max 160) | Nome do plano de interesse |
| `branchExternalId` | string (max 191) | Identificador externo da filial de destino |
| `metadata` | object | Dados complementares (chave-valor, máx 20 chaves) |

### Exemplo

```json
{
  "externalId": "src-lead-123",
  "name": "Maria da Silva",
  "phone": "+5521999999999",
  "email": "maria.silva@example.com",
  "planInterest": "Plano Empresarial Premium",
  "source": "landing-page",
  "branchExternalId": "matriz-01",
  "metadata": {
    "campaign": "saude-empresarial",
    "utm_source": "google",
    "utm_medium": "cpc"
  }
}
```

### Campos rejeitados

Os seguintes campos **não são aceitos** no payload e causarão erro `422`:

- `tenantId`, `tenant_id`
- `branchId`
- `assignedUserId`, `assignedTo`, `brokerId`, `managerId`
- `role`, `permissions`
- `status`
- `createdAt`, `updatedAt`

---

## Limites

| Recurso | Limite |
|---|---|
| Tamanho máximo do payload | 32 KB |
| Metadados — chaves | Máximo 20 |
| Metadados — valor | Máximo 500 caracteres |
| Anexos, imagens, base64 | Não suportado |
| Dados médicos | Não suportado |

---

## Respostas

### 201 — Lead criado

```json
{
  "success": true,
  "data": {
    "leadId": "lead_abc123",
    "duplicate": false
  }
}
```

### 200 — Replay idempotente

```json
{
  "success": true,
  "data": {
    "leadId": "lead_abc123",
    "duplicate": true
  }
}
```

### 400 — JSON inválido

```json
{
  "success": false,
  "error": {
    "code": "INVALID_JSON",
    "message": "O corpo da requisição deve conter JSON válido."
  }
}
```

### 401 — Credencial inválida

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Credenciais inválidas."
  }
}
```

### 403 — Acesso indisponível

```json
{
  "success": false,
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Integração indisponível."
  }
}
```

### 409 — Conflito de idempotência

```json
{
  "success": false,
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "A chave de idempotência já foi utilizada com outro conteúdo."
  }
}
```

### 413 — Payload muito grande

```json
{
  "success": false,
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "O payload excede o limite de 32 KB."
  }
}
```

### 415 — Content-Type inválido

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "O Content-Type deve ser application/json."
  }
}
```

### 422 — Payload inválido

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "Os dados enviados são inválidos.",
    "issues": [
      {
        "path": "phone",
        "message": "Telefone inválido."
      }
    ]
  }
}
```

### 429 — Limite excedido

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Limite de requisições excedido. Tente novamente mais tarde."
  }
}
```

### 500 — Erro interno

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Não foi possível processar a requisição."
  }
}
```

---

## Exemplo com curl

```bash
curl --request POST \
  --url "https://app.corretop.com.br/api/webhooks/leads/TENANT_ID" \
  --header "Authorization: Bearer crt_live_SEU_TOKEN" \
  --header "Content-Type: application/json" \
  --header "Idempotency-Key: meu-idempotency-key-123" \
  --data '{
    "externalId": "src-lead-456",
    "name": "João Exemplo",
    "phone": "+5521999999999",
    "email": "joao.exemplo@email.com",
    "planInterest": "Plano familiar",
    "source": "landing-page"
  }'
```

---

## Segurança

- O token nunca é armazenado em texto plano — apenas o hash SHA-256 é salvo
- O token é exibido **uma única vez** no momento da criação
- Tokens podem ser revogados individualmente sem afetar outras credenciais
- O tenantId na URL é validado contra o tenant da credencial autenticada
- Nenhuma informação interna (stack trace, SQL, hash) é exposta em erros

---

## Rotação de token

1. Crie uma nova credencial na interface administrativa
2. Atualize a integração externa com o novo token
3. Revogue a credencial antiga

A revogação não apaga o histórico de entregas — leads já criados permanecem acessíveis.

---

## Rate limiting

Atualmente não implementado. O endpoint aceita todas as requisições
autenticadas dentro dos limites de infraestrutura. A implementação de
rate limiting distribuído está no roadmap.
