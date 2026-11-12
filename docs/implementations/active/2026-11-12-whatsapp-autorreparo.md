# Auto-reparo das conexões de WhatsApp dos corretores

**Data:** 2026-11-12 · **Status:** diagnóstico concluído, implementação aguardando decisão (ver "Decisões pendentes")
**Tenant:** Âncora `d47a4d41-4e45-450d-a0b8-a9e1be286903` · **Leitura:** só SELECT no banco de produção e só GET no relay (nenhuma escrita, nenhum restart, nenhum recover).

## 1. Números (produção, 12/11 ~11h, horário de São Paulo)

Tabela `whatsapp_connections`:

| status no CRM | n | com sessão | já conectou alguma vez | status real no relay (GET /status) |
|---|---|---|---|---|
| error | 95 | 95 | 36 | ERROR: 95/95 |
| ready | 66 | 66 | 66 | CONNECTED: 66/66 |
| disconnected | 7 | 0 | 0 | não consultado (sem sessão) |
| paused | 1 | 1 | 1 | DISCONNECTED: 1/1 |

Conclusão de leitura: **o CRM e o relay concordam**. Não há status desatualizado no CRM para as conexões em error.

### Quando as 95 caíram em error (campo `updated_at`)

- Por dia: 10/11 = 78 · 11/11 = 8 · 12/11 = 9.
- Em 10/11, 56 caíram às **17:52** e 21 às **17:51**. Só 2 conexões tiveram o último update fora desse minuto de pico (mesma janela).
- Eventos `session.status` recebidos (tabela `waha_webhook_events`, status `processed`): entre 17:47 e 17:52 houve **~1.000 eventos** (153, 248, 219, 288, 129 por minuto). Antes e depois, centenas ou menos por dia.
- Deploy do relay `corretop-infra` commit `e5ee5a1` ("envio de texto aceita grupo") às **17:42:32**, 5 min antes da onda. **Hipótese, não confirmada:** o redeploy reiniciou o serviço WAHA e as sessões voltaram como FAILED. Confirmar com os logs do Coolify (não tenho acesso).

### Causas (separadas, conforme o brief)

- **(a) Sessão FAILED no servidor, já conectada antes: 36 corretores.** Candidata a reinício simples (`POST /sessions/{nome}/start`), mas **ainda não testada**. Nenhum restart foi feito.
- **(b) Nunca completou o pareamento: 59 corretores** (`connected_at` nulo). Precisam de QR novo; reiniciar não resolve. Destes, 49 entraram em error no próprio pico de 10/11.
- **(c) Status no CRM desatualizado: 0 casos** nas 95 conexões em error.
- **(d) Nunca conectou:** é o mesmo grupo de (b).
- Celular deslogado (b do brief) não dá para separar só com o banco; precisaria do status WAHA `SCAN_QR_CODE` com o celular ainda vinculado. Fica como pendência.

## 2. O que o sistema já faz (e por que não basta)

- **Relay** (`corretop-infra/api/waha-routes.js`): mapeia WAHA `FAILED → ERROR`, `STOPPED → DISCONNECTED`. Não existe reparo automático.
- **Rota `POST /internal/waha/connections/:id/recover`** e o caminho de conexão quando a sessão está ERROR: fazem **stop + delete + create**. Isso **apaga a autenticação salva**: o corretor precisa escanear QR de novo. Não pode ser chamada pelo vigia sem confirmação.
- **CRM** (`src/app/(dashboard)/settings/whatsapp-actions.ts`): o status só é atualizado quando o próprio corretor abre a tela de conexão (polling de 5 s) ou pelo webhook. Se ele não abre, o CRM fica parado no último valor. Por isso o vigia precisa consultar o relay, não só o banco.

## 3. Decisões pendentes (Maestro/Vinicios)

1. **Restart de teste:** autorizar UM `POST /start` numa sessão da categoria (a), com o corretor avisado. Hoje não há autorização.
2. **Aviso de reconexão (ajuste do Vinicios):** sai **um dia antes do plantão**, às **18h** (horário configurável, valor padrão marcado como **a confirmar**). Vigia checa os escalados do dia seguinte sem conexão `ready` e envia **um aviso por corretor por plantão** (idempotente). Texto curto, revisado pelo Vinicios antes de ligar a flag.
3. **Reconexão por QR:** para os 59 da categoria (b)/(d), o aviso leva ao roteiro guiado de conexão (faixa "Conectar agora", commit b7113502). Não há QR automático sem o corretor.
4. **Causa do pico de 10/11:** confirmar nos logs do Coolify se o redeploy de `e5ee5a1` reiniciou o WAHA. Se confirmar, o deploy do relay precisa de cuidado (reiniciar só após as sessões estarem estáveis), e isso é ponto para o Vinicios.

## 4. Plano de implementação (depois das decisões)

- Flag global `feature_whatsapp_autoreparo_enabled` (padrão desligado), com auditoria.
- Vigia periódico (job Coolify ou rota cron): para cada conexão não-ready, consulta o relay (GET); se o relay já diz CONNECTED, corrige o CRM; se ERROR e a sessão já conectou antes, tenta `start` com backoff (1, 5, 15 min, máximo N por dia); nunca apaga sessão.
- Aviso de véspera (regra acima), com idempotência por `(corretor, plantão)`.
- Nenhuma migration nesta etapa. Se precisar de coluna para a idempotência, gerar o SQL e não executar.

## 5. Como foi feito o diagnóstico (reproduzível)

- Consultas SELECT via `postgres` (pacote do `ancorahub`), sessão com `default_transaction_read_only = on`, URL lida do `.env.local` do repo principal sem cópia.
- `GET {VPS_API_URL}/internal/waha/connections/{sessão}/status` para as 95 + 66 + 1 sessões com nome.
- Scripts em `scratchpad` (fora do repo): `diag1.mjs`, `diag2.mjs`, `relay.mjs`, `body.mjs`.
