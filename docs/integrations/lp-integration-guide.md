# CorreTop — Integração via Landing Page

Guia completo para integrar o formulário de captação de leads do CorreTop em qualquer landing page.

---

## Visão Geral

```
Visitante preenche formulário na LP
        ↓ submit
Script /embed/lead-form.js captura os dados
        ↓ POST JSON
POST /api/webhooks/leads/{TOKEN}
        ↓ valida → cria lead + beneficiário titular
        ↓ distribui round-robin (síncrono)
        ↓ push notification (síncrona)
Lead aparece na fila do corretor em tempo real (Supabase Realtime)
```

**Tudo síncrono na mesma requisição.** Não tem fila, não tem delay, não tem polling.

---

## Passo 1 — Gerar o Token no CorreTop

1. Acesse **Configurações → Integrações**
2. Clique em **"Nova fonte"**
3. Preencha:
   - **Nome**: identificador da fonte (ex: "LP Principal", "Meta Ads - SP")
   - **Origem padrão**: selecione "Landing page"
   - **Filial de destino**: opcional (se não selecionar, usa a primeira filial ativa)
4. Clique em **"Gerar token"**
5. **Copie o token** — ele só é exibido uma vez

O token tem o formato: `crt_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

---

## Passo 2 — Preparar o Formulário na LP

Adicione o atributo `data-corretop-form` no elemento `<form>` da sua landing page.

### Campos esperados

| `name` do input       | Obrigatório | Descrição                    |
|-----------------------|-------------|------------------------------|
| `nome`                | Sim         | Nome completo do lead        |
| `telefone`            | Sim         | Telefone com DDD (mín. 10 dígitos) |
| `email`               | Não         | E-mail do lead               |
| `plano_interesse`     | Não         | Plano desejado               |
| `website`             | Não (honeypot) | **Invisível** — campo armadilha para bots |

### Exemplo mínimo

```html
<form data-corretop-form>
  <input type="text" name="nome" placeholder="Seu nome completo" required>
  <input type="tel" name="telefone" placeholder="(11) 99999-9999" required>
  <input type="email" name="email" placeholder="seu@email.com">
  <select name="plano_interesse">
    <option value="">Selecione o plano</option>
    <option value="individual">Individual</option>
    <option value="familiar">Familiar</option>
    <option value="empresarial">Empresarial</option>
  </select>

  <!-- Honeypot — invisível ao humano, bots preenchem -->
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">

  <button type="submit">Quero minha cotação</button>
</form>
```

### Se os campos já têm nomes diferentes na sua LP

Use o atributo `data-corretop-field` para mapear sem alterar o `name` original:

```html
<form data-corretop-form>
  <input data-corretop-field="nome" name="full_name" required>
  <input data-corretop-field="telefone" name="phone_number" required>
  <input data-corretop-field="email" name="email_address">
</form>
```

Isso é útil quando o construtor de LP (WordPress, Wix, etc.) usa os campos para outra coisa também.

---

## Passo 3 — Colar o Script antes do `</body>`

```html
<script
  src="https://app.corretop.com.br/embed/lead-form.js"
  data-token="crt_live_SEU_TOKEN_AQUI"></script>
```

**Substitua** `crt_live_SEU_TOKEN_AQUI` pelo token que você gerou.

### Com redirecionamento pós-submit

Se quiser redirecionar o visitante para uma página de obrigado após o envio:

```html
<script
  src="https://app.corretop.com.br/embed/lead-form.js"
  data-token="crt_live_SEU_TOKEN_AQUI"
  data-redirect="/obrigado"></script>
```

---

## Exemplo Completo — HTML Puro

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planos de Saúde - Cotação Grátis</title>
</head>
<body>
  <h1>Receba sua cotação de plano de saúde</h1>
  <p>Preencha o formulário e um especialista entrará em contato.</p>

  <form data-corretop-form>
    <div>
      <label for="nome">Nome completo *</label>
      <input type="text" id="nome" name="nome" placeholder="Maria da Silva" required>
    </div>
    <div>
      <label for="telefone">Telefone com DDD *</label>
      <input type="tel" id="telefone" name="telefone" placeholder="(11) 99999-9999" required>
    </div>
    <div>
      <label for="email">E-mail</label>
      <input type="email" id="email" name="email" placeholder="maria@email.com">
    </div>
    <div>
      <label for="plano">Plano de interesse</label>
      <select id="plano" name="plano_interesse">
        <option value="">Selecione</option>
        <option value="individual">Individual</option>
        <option value="familiar">Familiar</option>
        <option value="empresarial">Empresarial</option>
      </select>
    </div>

    <!-- Honeypot -->
    <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">

    <button type="submit">Quero minha cotação</button>
  </form>

  <!-- CorreTop Lead Capture -->
  <script
    src="https://app.corretop.com.br/embed/lead-form.js"
    data-token="crt_live_SEU_TOKEN_AQUI"
    data-redirect="/obrigado"></script>
</body>
</html>
```

---

## Exemplo — WordPress (Elementor / WPBakery / Clássico)

### No editor de texto (HTML)

Cole no final da página, antes do `</body>`:

```html
<form data-corretop-form>
  <input type="text" name="nome" placeholder="Seu nome" required>
  <input type="tel" name="telefone" placeholder="Telefone" required>
  <input type="email" name="email" placeholder="E-mail">
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Enviar</button>
</form>

<script src="https://app.corretop.com.br/embed/lead-form.js" data-token="crt_live_SEU_TOKEN"></script>
```

### No Elementor

1. Arraste um widget **HTML** para a página
2. Cole o código acima
3. Salve e publique

### No WPBakery

1. Adicione um bloco **Raw HTML**
2. Cole o código
3. Salve

---

## Exemplo — Wix

1. No editor, clique em **"Adicionar"** → **"HTML iFrame"**
2. Clique em **"Entrar no código"**
3. Cole o formulário + script
4. Ajuste o tamanho do iFrame

**Observação:** No Wix, o formulário pode precisar estar dentro de um HTML embed pois o Wix gerencia seus próprios forms. Use o mapeamento `data-corretop-field` se os campos nativos do Wix tiverem nomes diferentes.

---

## Exemplo — Google Sites

1. Na lateral direita, clique em **"Inserir"** → **"Incorporar"** → **"Incorporar código"**
2. Cole o HTML completo
3. Clique em **"Próximo"** → **"Inserir"**

---

## Como Funciona por Baixo dos Panos

### O que o script faz

1. Escuta o evento `submit` em qualquer formulário com `data-corretop-form`
2. Captura os dados dos campos via `FormData`
3. Verifica o honeypot (campo `website`) — se preenchido, descarta silenciosamente
4. Envia `POST` para `/api/webhooks/leads/{TOKEN}`
5. Em caso de sucesso: reseta o formulário e redireciona (se `data-redirect` configurado)
6. Em caso de falha de rede: **não trava a experiência** do visitante (fail silento)

### O que acontece no servidor

1. **Autentica** o token (SHA-256 hash lookup)
2. **Valida** os campos (Zod schema)
3. **Verifica honeypot** — se `website` estiver preenchido, descarta
4. **Resolve filial** — usa a filial vinculada ao token ou a primeira ativa
5. **Distribui** round-robin (encontra corretor com menor carga) — **síncrono**
6. **Cria lead + beneficiário titular** em uma transação — lead nasce com `corretor_id` preenchido
7. **Dispara push notification** — **síncrono**
8. **Responde 201** com o `leadId`

### Tempo real (Supabase Realtime)

O INSERT no banco dispara imediatamente o evento de replicação lógica do PostgreSQL. O frontend do corretor assina esse evento via WebSocket e recebe a notificação em milissegundos.

**Não existe polling.** Não existe intervalo. O lead aparece na tela do corretor assim que o POST retorna 201.

---

## Segurança

| Camada | Como funciona |
|--------|---------------|
| **Token SHA-256** | O token nunca fica em texto plano no banco — apenas o hash |
| **Escopo mínimo** | O token só pode **criar** leads. Nunca ler, exportar ou deletar |
| **Honeypot** | Campo `website` invisível — bots preenchem, lead é descartado |
| **Rate limiting** | Proteção contra flood por token |
| **RLS (Row-Level Security)** | Leads só aparecem para o tenant/filial correto |
| **CORS** | Endpoint responde `Access-Control-Allow-Origin: *` — necessário para chamadas do navegador |

---

## Códigos de Resposta

| Código | Significado | O que fazer |
|--------|-------------|-------------|
| `201` | Lead criado com sucesso | Sucesso — o lead já está na fila |
| `200` | Lead duplicado (idempotente) | OK — o lead já existia com os mesmos dados |
| `401` | Token inválido | Verifique se o token está correto e ativo |
| `422` | Dados inválidos | Verifique os campos obrigatórios (nome, telefone) |
| `409` | Conflito de idempotência | Mesma chave, dados diferentes — use nova chave |
| `429` | Rate limit excedido | Aguarde e tente novamente |
| `500` | Erro interno | Tente novamente; se persistir, contate o suporte |

---

## Troubleshooting

### O formulário não envia

1. Verifique se o `<form>` tem o atributo `data-corretop-form`
2. Verifique se os campos usam `name="nome"` e `name="telefone"` (ou `data-corretop-field`)
3. Abra o Console do navegador (F12) e verifique se há erros de CORS
4. Verifique se o `data-token` está preenchido corretamente

### O lead não aparece no CRM

1. Verifique se o endpoint retornou `201` (Network tab no DevTools)
2. Verifique se a tabela `leads` está na publicação `supabase_realtime` do Supabase
3. Verifique se o corretor está com status "available" na filial correta

### Erro 401

- O token pode ter sido revogado — gere um novo em Configurações → Integrações
- Verifique se não há espaços ou quebras no token

### Erro 422

- Nome deve ter pelo menos 2 caracteres
- Telefone deve ter pelo menos 10 dígitos (após remover formatação)

---

## Versionamento do Script

O arquivo `/embed/lead-form.js` é **estático e versionado**. Funcionará em qualquer LP publicada indefinidamente.

Se uma mudança incompatível for necessária no futuro, uma nova versão será publicada em `/embed/v2/lead-form.js` — a v1 continuará funcionando.

**Nunca altere o comportamento do script atual sem manter retrocompatibilidade.**
