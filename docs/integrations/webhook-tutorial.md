# Tutorial: Integrar Landing Page via Webhook

Guia passo a passo para enviar leads automaticamente do seu site para o CorreTop.

---

## Visão geral

```
Seu site  ──POST──►  CorreTop Webhook  ──►  Lead criado no sistema
```

**O que você vai precisar:**
- Acesso de Diretor ao CorreTop
- Um site ou landing page com formulário de contato
- Conhecimento básico de HTML e JavaScript

---

## Passo 1: Criar fonte de captura

1. Acesse **Configurações > Integrações**
2. Clique em **Nova fonte**
3. Preencha:
   - **Nome**: ex: `Landing Page - Saúde`
   - **Origem padrão**: `Landing page`
   - **Filial de destino**: selecione (opcional)
4. Clique em **Gerar token**

> ⚠️ O token completo (`crt_live_...`) é exibido **apenas uma vez**. Copie e guarde em local seguro.

---

## Passo 2: Adicionar snippet no site

Cole este snippet antes da tag `</body>` no seu HTML:

```html
<script>
  window.CORRETOP_HUB_URL = "https://app.corretop.com/api/webhooks/leads/SEU_TENANT_ID";
  window.CORRETOP_HUB_TOKEN = "crt_live_SEU_TOKEN";
</script>
```

Substitua:
- `SEU_TENANT_ID` → ID da sua corretora (aparece na URL ao acessar o CorreTop)
- `crt_live_SEU_TOKEN` → Token copiado no Passo 1

---

## Passo 3: Configurar envio do formulário

No submit do formulário, use JavaScript para enviar o payload:

```html
<form id="lead-form">
  <input name="name" placeholder="Nome completo" required />
  <input name="phone" placeholder="Telefone com DDD" required />
  <input name="email" type="email" placeholder="E-mail (opcional)" />
  <button type="submit">Enviar</button>
</form>

<script>
  document.getElementById("lead-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const response = await fetch(window.CORRETOP_HUB_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + window.CORRETOP_HUB_TOKEN,
        "Idempotency-Key": "lead-" + Date.now()  // opcional
      },
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        email: fd.get("email") || undefined,
        source: "landing-page"
      })
    });

    const result = await response.json();
    if (result.success) {
      alert("Lead enviado com sucesso!");
    } else {
      alert("Erro: " + result.error.message);
    }
  });
</script>
```

---

## Payload

### Obrigatórios

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `name` | string | Nome completo (2-160 chars) | `"Maria da Silva"` |
| `phone` | string | Telefone com DDD (mín. 10 dígitos) | `"+5521999999999"` |
| `source` | string | Origem do lead (1-100 chars) | `"landing-page"` |

### Opcionais

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `email` | string | E-mail do lead | `"maria@email.com"` |
| `planInterest` | string | Plano de interesse (máx. 160) | `"Plano Empresarial"` |
| `externalId` | string | ID no seu sistema (máx. 191) | `"lead-123"` |
| `branchExternalId` | string | ID da filial de destino | `"filial-centro"` |
| `metadata` | object | Dados complementares (máx. 20 chaves) | `{"utm_source": "google"}` |

### Exemplo completo

```json
{
  "name": "Maria da Silva",
  "phone": "+5521999999999",
  "email": "maria.silva@example.com",
  "source": "landing-page",
  "planInterest": "Plano Empresarial Premium",
  "externalId": "src-lead-123",
  "branchExternalId": "matriz-01",
  "metadata": {
    "campaign": "saude-empresarial",
    "utm_source": "google",
    "utm_medium": "cpc"
  }
}
```

---

## Códigos de resposta

| Código | Significado | Descrição |
|--------|-------------|-----------|
| `201` | Lead criado | Lead criado com sucesso no sistema |
| `200` | Replay | Mesmo payload enviado anteriormente (idempotente) |
| `400` | JSON inválido | O corpo da requisição não é JSON válido |
| `401` | Não autorizado | Token inválido ou ausente |
| `409` | Conflito | Chave de idempotência usada com payload diferente |
| `413` | Payload grande | Corpo excede 32 KB |
| `415` | Content-Type | Header Content-Type deve ser application/json |
| `422` | Dados inválidos | Payload não passa na validação |
| `429` | Rate limit | Limite de requisições excedido |
| `500` | Erro interno | Erro inesperado no servidor |

---

## Testar com curl

```bash
curl -X POST \
  "https://app.corretop.com.br/api/webhooks/leads/SEU_TENANT_ID" \
  -H "Authorization: Bearer crt_live_SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: teste-001" \
  -d '{
    "name": "João Exemplo",
    "phone": "+5521999999999",
    "email": "joao@email.com",
    "source": "landing-page",
    "planInterest": "Plano familiar"
  }'
```

---

## Idempotência (evitar duplicatas)

Para evitar que o mesmo lead seja criado duas vezes (ex: cliente clica两次 no botão), inclua o header:

```
Idempotency-Key: <identificador único>
```

- Máximo de 64 caracteres
- Letras, números, `_` e `-`
- Mesmo payload + mesma chave = retorna o lead anterior (200)
- Payload diferente + mesma chave = retorna conflito (409)

---

## Campos rejeitados

Os seguintes campos **não são aceitos** e causam erro `422`:

- `tenantId`, `tenant_id`
- `branchId`
- `assignedUserId`, `assignedTo`, `brokerId`, `managerId`
- `role`, `permissions`
- `status`
- `createdAt`, `updatedAt`

---

## Segurança

- O token nunca é armazenado em texto plano — apenas o hash SHA-256 é salvo
- O token é exibido **uma única vez** no momento da criação
- Tokens podem ser revogados individualmente sem afetar outras credenciais
- O `tenantId` na URL é validado contra o tenant da credencial autenticada

---

## Links úteis

- **Configurações**: `/settings?tab=integrations`
- **Guia completo**: `/guia/webhook`
- **Documentação técnica**: `/docs/integrations/lead-webhook.md`
