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

## Operação necessária (Coolify)

| Serviço | Variável | Observação |
| --- | --- | --- |
| Fastify | `WHATSAPP_HOOK_URL` | URL **pública** do próprio Fastify + `/internal/webhooks/waha`. Sem ela o fallback `http://api:3000` só funciona na mesma rede Docker; com serviços em VPS separadas o WAHA descarta o webhook. |
| Fastify | `CRM_WEBHOOK_URL`, `WAHA_RELAY_SHARED_SECRET` | Destino/assinatura do encaminhamento ao CRM (mesmo segredo no CRM). |
| Fastify | `WAHA_BASE_URL`, `WAHA_API_KEY` | Conferir a chave (`WAHA_UNAUTHORIZED` agora aparece como aviso no diálogo). |
| Frontend | `VPS_API_URL`, `WHATSAPP_API_INTERNAL_TOKEN` | Mesmo token do Fastify. |

Sessões já criadas mantêm o webhook configurado na criação: depois de corrigir
`WHATSAPP_HOOK_URL`, use “Gerar novo QR” para recriá-las.

1. Redeploy do **Fastify** (obrigatório para `/state` e o reconnect sem logout) e do frontend.
2. Homologar: conectar → QR renova sozinho → escanear → ver “finalizando” → “conectado” sem
   recarregar; reabrir com WhatsApp conectado **não** deve desvincular o celular.
3. Acompanhar `waha.connection.state` nos logs (`providerStatus`, `hasQr`, `durationMs`).

## Validação

- Fastify: 95 testes (novo fluxo ponta a ponta contra WAHA simulado com rotação de QR, scan,
  reabertura sem logout e recriação de `FAILED`).
- Vitest: contrato de webhook e fases do pareamento.
- `tsc` limpo nos arquivos alterados; ESLint sem erros novos.

## Pendências conhecidas

- `POST /internal/webhooks/waha` do Fastify não autentica quem chama antes de assinar e
  encaminhar ao CRM. Recomenda-se exigir um segredo (header configurado nos webhooks do WAHA
  via `customHeaders`/`hmac`). Não incluído aqui porque exige recriar as sessões existentes.
