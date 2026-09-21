# 2026-09-21 — Conexão WhatsApp Lite: QR vivo, sessão preservada e feedback por fase

**Estado:** em validação (aguarda redeploy do `services/whatsapp-api` e homologação com WAHA real)
**Branch:** `fix/waha-lite-connection-flow`

## Sintoma

O corretor gerava o QR, mas a conexão não concluía: ao escanear, o CRM não atualizava o
status; ao tentar de novo, o celular exibia erro de vínculo.

## Causas (regressões de 15/09)

1. **QR nunca renovado** (`ee3677e2`). O WAHA rotaciona o QR — o primeiro vale 60 s, os
   seguintes 20 s, no máximo 6 tentativas, quando a sessão vira `FAILED`. O diálogo buscava
   o QR uma única vez e mantinha a imagem: o corretor lia um código morto.
2. **Abrir o diálogo recriava a sessão** (`473a21a4`). `handleOpenChange` chamava
   `start({ forceNew })`, que executa `stop → logout → delete → create`. Com o WAHA já em
   `WORKING` e o CRM ainda desatualizado, o `logout` **desvinculava o aparelho**; a operação
   levava até 60 s e, como Server Actions rodam em fila, travava todo o polling.
3. **Status não chegava ao CRM.** O webhook mapeava `SCAN_QR_CODE`/`STARTING` para
   `offline` (sobrescrevendo "conectando"); o polling fazia 3 chamadas ao WAHA e uma escrita
   no banco a cada 500 ms; o badge do pai sobrescrevia o estado do diálogo com QR/status
   antigos lidos do banco.
4. **UI sem fases.** "QR disponível", "iniciando" e "pós-scan" eram o mesmo estado
   (`WAITING_QR`).

## Correção

### Fastify (`services/whatsapp-api`)
- `WahaSession.providerStatus` expõe o status bruto do WAHA.
- Nova rota `GET /internal/waha/connections/:id/state`: status + `providerStatus` + telefone
  + **QR atual na mesma leitura** (uma ida ao WAHA para o status, outra só se houver QR).
  O QR nunca é cacheado.
- `reconnect` só faz `logout` quando a sessão está `CONNECTED`; recuperação de `FAILED` nunca
  faz. Sessão inexistente pula `stop/delete`.
- `resolveWebhookUrl()` centraliza o destino dos webhooks e **avisa** quando cai no fallback
  `http://api:3000`, que só resolve na mesma rede Docker.

### CRM
- `pollWhatsAppConnection()` (Server Action): uma chamada ao Fastify; escreve no banco só
  quando o status muda; o QR **não é mais persistido**. Com Fastify antigo (sem `/state`)
  cai automaticamente para `/status` + `/qr`.
- `startWhatsAppConnection` sem `forceNew` é idempotente e é o que abrir o diálogo usa.
  `forceNew` só por ação explícita (“Gerar novo QR”) ou expiração confirmada.
- Webhook `session.status`: `STARTING/SCAN_QR_CODE/AUTHENTICATING/OPENING` → `connecting`
  (banco: `initializing`), não mais `offline`.
- Diálogo com máquina de fases (`idle → starting → qr → pairing → ready | error`), derivada em
  `src/features/waha-cadence/pairing-phase.ts` (testada):
  - polling auto-agendado (1–1,5 s aberto), sem empilhar consultas;
  - QR renovado sozinho, com contagem e animação de troca;
  - pós-scan sinalizado (“Celular conectado — finalizando…”);
  - sucesso visível por 1,6 s antes de fechar;
  - renovação automática (até 2×) quando o QR expira (`FAILED`) ou a sessão some;
  - **verificação contínua também com o diálogo fechado** (a cada 3 s por até 10 min);
  - o badge mantém o diálogo montado enquanto aberto.

### Visual
`whatsapp-pairing-panel.tsx` (componentes puros) usa somente tokens `ds-*`: Callouts do
design system por tom, Status Badge, cards 12 px com borda Ash, Electric Blue como único
destaque. **Todo texto/tom/ícone por fase fica em
`src/features/waha-cadence/pairing-copy.ts`** — é o único lugar a editar para mudar um
feedback. Revisão sem WAHA em `/dev/whatsapp-connect` (somente `next dev`).

## Onde o servidor realmente roda (correção)

A API de produção **não é** `services/whatsapp-api` deste repositório: ela é publicada pelo
Coolify a partir do repositório **`corretop-infra`** (`api/waha-client.js`,
`api/waha-routes.js`, `docker-compose.coolify.yml`). Por isso as rotas novas davam 404 em
produção mesmo com o código neste repo. As mesmas correções foram portadas para lá (branch
`fix/waha-pairing-state`); a cópia em `services/whatsapp-api` fica só como referência/testes e
**não é o que roda** (avaliar removê-la para não divergir de novo).

No stack de produção o WAHA já recebe o webhook global `WHATSAPP_HOOK_URL=http://api:3000/...`
(mesma rede do compose) e a criação de sessão **não** configura webhook por sessão — então
`WHATSAPP_HOOK_URL` no Fastify **não** é necessária para produção (orientação anterior nesta
nota era válida apenas para a cópia deste repositório).

## Operação necessária

Ordem importa:

1. **Deploy do CRM** (esta branch): o schema do webhook passa a aceitar `connecting`.
2. **Deploy da API** (`corretop-infra`, branch `fix/waha-pairing-state`): habilita `/state`,
   reconnect sem logout indevido, sem segundo `/start` e `/diagnostics`. Se a API for
   publicada antes do CRM, os eventos `session.status` de pareamento são recusados (400).
3. Homologar: conectar → QR renova sozinho → escanear → "finalizando" → "conectado" sem
   recarregar; reabrir com WhatsApp conectado **não** deve desvincular o celular.
4. Logs da API: `waha.connection.state` (`providerStatus`, `hasQr`) e
   `waha.webhook.session_status` (linha do tempo do pareamento).

O token do CRM (`VPS_INTERNAL_API_TOKEN`) deve ser igual ao `INTERNAL_API_TOKEN` da API.

## Diagnóstico quando o celular recusa o QR ("Não foi possível conectar o dispositivo")

Esse erro aparece no aparelho, no instante do scan, e não é visível pelo CRM. Depois do
deploy da API (corretop-infra):

```bash
node --env-file=.env.local scripts/diagnose-waha-live.mjs
```

O script chama `GET /internal/waha/diagnostics` (versão/engine/tier do WAHA, uptime, sessões
com só o final do número) e aponta: WAHA Core (só sessão `default`), reinício recente
(Chromium/OOM derrubando QR), sessões `FAILED/STOPPED` e excesso de sessões. O compose usa
`devlikeapro/waha:latest`: um redeploy do stack pode trazer uma versão nova do WAHA/WhatsApp
Web que quebra o pareamento — depois de achar uma versão que funciona, fixe-a com
`WAHA_IMAGE_TAG`. Se o servidor estiver normal, as causas restantes
são do aparelho: limite de 4 dispositivos vinculados (remova os antigos em *Dispositivos
conectados*, inclusive vínculos órfãos de tentativas anteriores) e o limite temporário de
tentativas do WhatsApp (aguardar algumas horas ou usar outro número).

O Fastify também registra `waha.webhook.session_status` (sessão + status) a cada evento do
WAHA, formando a linha do tempo SCAN_QR_CODE → STARTING → WORKING/FAILED nos logs do Coolify.

## Validação

- Fastify: 95 testes (novo fluxo ponta a ponta contra WAHA simulado com rotação de QR, scan,
  reabertura sem logout e recriação de `FAILED`).
- Vitest: contrato de webhook e fases do pareamento.
- `tsc` limpo nos arquivos alterados; ESLint sem erros novos.

## Pendências conhecidas

- `POST /internal/webhooks/waha` do Fastify não autentica quem chama antes de assinar e
  encaminhar ao CRM. Recomenda-se exigir um segredo (header configurado nos webhooks do WAHA
  via `customHeaders`/`hmac`). Não incluído aqui porque exige recriar as sessões existentes.
