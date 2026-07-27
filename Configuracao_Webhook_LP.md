# Guia de Integração: Webhook de Leads para Landing Pages
*Como enviar leads da sua Landing Page (LP) diretamente para o CorreTop CRM*

Para receber leads gerados em seus formulários externos (WordPress, Webflow, RD Station, Wix, formulários estáticos HTML/JS, etc.), você deve configurar o envio de dados via requisição HTTP POST para o endpoint unificado do CorreTop.

---

## 1. Informações de Endpoint e Autenticação

*   **URL do Webhook:** `https://corretop.vercel.app/api/webhooks/leads`
*   **Método HTTP:** `POST`
*   **Content-Type:** `application/json`

### Cabeçalhos Requeridos (Headers)
1.  `Authorization`: Deve conter o token da filial no formato `Bearer <SEU_TOKEN_AQUI>`.
    *   *Exemplo:* `Authorization: Bearer ct_lh_abc123...`
2.  `Idempotency-Key` (Opcional): Uma chave única (gerada na sua LP) para evitar duplicações caso a rede caia e o form envie a mesma requisição duas vezes.

---

## 2. Estrutura do Payload (JSON)

O corpo da requisição deve ser um objeto JSON estrito. **Nota Importante:** O validador do CorreTop rejeitará o envio caso existam propriedades extras não listadas abaixo (regra estrita). Envie apenas os campos especificados.

```json
{
  "name": "Nome do Lead",
  "phone": "+55 (11) 99999-9999",
  "email": "lead@exemplo.com.br",
  "source": "lp_campanha_julho",
  "planInterest": "Plano de Saúde Individual",
  "externalId": "id-do-formulario-12345",
  "branchExternalId": "filial-centro"
}
```

### Detalhes dos Campos:

| Campo | Tipo | Obrigatório | Descrição / Restrições |
| :--- | :--- | :--- | :--- |
| `name` | String | **Sim** | Nome completo do lead (mínimo 2, máximo 160 caracteres). |
| `phone` | String | **Sim** | Telefone com DDD. Deve conter pelo menos 10 dígitos numéricos válidos (ex: `11999998888`). Caracteres como `+`, `(`, `)`, `-` e espaços são limpos automaticamente pelo CRM. |
| `email` | String | Não | E-mail válido do contato (máximo 254 caracteres). |
| `source` | String | **Sim** | Nome da origem do lead (ex: `lp_leads`, `facebook_ads`, `google_search`). Máximo 100 caracteres. |
| `planInterest` | String | Não | Plano ou operadora de preferência do cliente (máximo 160 caracteres). |
| `externalId` | String | Não | Identificador único gerado pela sua LP para rastreabilidade (máximo 191 caracteres). |
| `branchExternalId`| String | Não | ID externo da filial correspondente (caso possua filiais físicas mapeadas no CRM). |

---

## 3. Exemplo de Código (JavaScript / Fetch)

Se a sua Landing Page utiliza um formulário HTML customizado, você pode capturar o evento de envio e encaminhar o lead usando o script abaixo:

```javascript
document.querySelector("#seu-formulario").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.target);

  // Mapeia e higieniza os dados do formulário
  const payload = {
    name: formData.get("nome"),
    phone: formData.get("telefone"),
    email: formData.get("email") || "",
    source: "lp_vendas_direta", // Origem identificadora desta LP
    planInterest: formData.get("plano_interesse") || ""
  };

  try {
    const response = await fetch("https://corretop.vercel.app/api/webhooks/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer INSIRA_SEU_TOKEN_AQUI" // Substitua pelo Token gerado em Configurações > Integrações
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert("Obrigado! Seu contato foi enviado com sucesso.");
    } else {
      console.error("Erro no envio:", result.error);
      alert("Ocorreu um erro ao enviar seus dados. Tente novamente.");
    }
  } catch (error) {
    console.error("Falha de rede ou conexão:", error);
  }
});
```

---

## 4. Como gerar o Token no CorreTop CRM

1.  Acesse o CorreTop CRM com a conta de **Diretor** ou **Gestor**.
2.  Navegue até o menu **Configurações** (no menu lateral do dashboard).
3.  Abra a aba **Integrações**.
4.  Clique em **Gerar nova credencial** ou selecione a filial/unidade correspondente.
5.  Copie o token gerado. Ele deve ser inserido no cabeçalho `Authorization` da Landing Page.

---

## 5. Resolução de Problemas Comuns (Troubleshooting)

*   **Erro `415 Unsupported Media Type`:** O Content-Type da requisição não foi definido como `application/json` ou está vazio.
*   **Erro `401 Unauthorized`:** O token enviado no header `Authorization` está incorreto, expirou ou o formato `Bearer ` está faltando.
*   **Erro `422 Invalid Payload`:** O validador Zod rejeitou os dados. Os motivos mais comuns são:
    *   Propriedades adicionais enviadas no JSON (ex: enviar `sobrenome` em vez de concatenar no `name`). Lembre-se: o CorreTop usa validação estrita.
    *   Telefone com menos de 10 dígitos numéricos.
    *   E-mail formatado incorretamente.
