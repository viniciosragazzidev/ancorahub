# Confirmar presença no plantão exige WhatsApp conectado (plano, 05/11/2026)

**Pedido do Vinicios (05/11):** a partir de amanhã (06/11), o corretor só confirma presença no plantão com o
WhatsApp dele conectado. Fluido: ao tocar em "Confirmar presença" sem conexão, abre a conexão por código e um
tutorial de como digitar o código no WhatsApp do celular; conectou, a presença é confirmada sem tocar de novo.

Status: **implementado em 05/11** (decisões abaixo aprovadas como recomendadas: vale também para presencial e
plantão extra; WhatsApp fora do ar libera e registra no log). Aviso aos corretores (item 5) não foi enviado.

Arquivos: `duty-presence-whatsapp.ts` (regra pura), `duty-presence-whatsapp-server.ts` (checagem ao vivo),
`duty-presence-whatsapp-actions.ts` (consulta antes de confirmar), flag `feature_duty_presence_requires_whatsapp`
(padrão ligada; a data de início fica no código), rotas `api/duty/presence` e `api/public/duty-presence/confirm`,
cartão `presence-callout.tsx` (carrega a conexão só quando precisa), `WhatsAppConnectDialog` (`initialMethod`,
`showCodeTutorial`, `onReady`), tutorial `PairingCodeTutorial`, página `confirm-duty-presence-button.tsx`.

## Como é hoje

- Dois caminhos confirmam presença:
  1. **No app** — cartão "Confirme sua presença" (`src/components/chat/presence-callout.tsx`), na Início, na
     conversa do Plantão e em `/plantoes/agora`; chama `POST /api/duty/presence` (online: um toque; presencial: foto).
  2. **Pelo link do WhatsApp** — página pública `/confirm_presence` (sem login), botão
     `confirm-duty-presence-button.tsx` → `POST /api/public/duty-presence/confirm` (só online e plantão extra).
- A conexão do WhatsApp do corretor já existe: `WhatsAppConnectDialog` (`src/components/whatsapp/`) com QR e
  **código de pareamento**, passos em `pairing-copy.ts` e ações em `settings/whatsapp-actions.ts`
  (`getWhatsAppConnection`, `requestWhatsAppPairingCode`, `getWhatsAppSessionStatus`). Hoje ninguém é obrigado.

## Plano por componente

### 1. Regra no servidor (a trava de verdade)
- Novo `src/features/lead-distribution/duty-presence-whatsapp-gate.ts`:
  `presenceWhatsAppRequirement(tenantId, now)` e `brokerWhatsAppReady(tenantId, brokerId)`.
- Configuração no catálogo de flags (`src/shared/feature-flags/catalog.ts`):
  `duty_presence_requires_whatsapp_from` = `2026-11-06` (vazio = desligado). A data vale no horário de São Paulo;
  dá para desligar sem deploy.
- "Conectado" = sessão do corretor com status `ready`, conferida na hora no WAHA (`getWhatsAppSessionStatus`).
- `POST /api/duty/presence` e `POST /api/public/duty-presence/confirm`: sem conexão, respondem 409 com
  `code: "whatsapp_required"` e uma mensagem clara. Nada é gravado.
- Não muda: liberação manual pelo gestor/diretor, marcar ausência, corretor marcado online pelo diretor.

### 2. Cartão "Confirme sua presença" (app)
- O cartão já sabe se o WhatsApp está conectado (campo novo na pergunta de presença), para não gastar um toque.
- Sem conexão: o botão vira **"Conectar WhatsApp e confirmar"**. O toque abre o `WhatsAppConnectDialog` já no modo
  **código** (prop nova `initialMethod="code"`), com o tutorial abaixo.
- Quando o diálogo avisa "conectado" (`onConnectionChanged` com `ready`), o cartão **confirma sozinho** e mostra
  "Presença confirmada". No presencial, abre a câmera em seguida, como hoje.
- Se o servidor responder `whatsapp_required` (desconectou no meio), abre o mesmo diálogo.

### 3. Tutorial do código no celular
- Bloco "Como digitar o código no WhatsApp" dentro do diálogo, no modo código, com seletor **Android | iPhone**
  (`DsSegmentedControl`, já existe):
  - Android: abra o WhatsApp → toque em **⋮** (canto de cima) → **Dispositivos conectados** →
    **Conectar dispositivo** → embaixo do leitor, **Conectar com número de telefone** → digite o código de 8 letras.
  - iPhone: abra o WhatsApp → **Configurações** → **Dispositivos conectados** → **Conectar dispositivo** →
    **Conectar com número de telefone** → digite o código.
- Botões que já existem: **Copiar código** e **Abrir WhatsApp**. Aviso de validade (cerca de 2 minutos) e "Gerar
  novo código".
- Textos novos em `pairing-copy.ts`; componentes e tokens do design system, sem cor nova.

### 4. Página do link (`/confirm_presence`)
- Sem login não dá para conectar o WhatsApp. Sem conexão, a página mostra: "A partir de 06/11 a presença só é
  confirmada com o seu WhatsApp conectado" e o botão **"Abrir no app para conectar"**, que leva a
  `/plantoes/agora` (o cartão do item 2 faz o resto).

### 5. Aviso aos corretores
- Opcional: hoje, um aviso no app ("A partir de amanhã, conecte o WhatsApp para confirmar presença no plantão"),
  pelo mural/avisos que já existem. Não sai WhatsApp para ninguém sem aprovação.

### 6. Testes
- Trava: antes de 06/11 não pede; a partir de 06/11 pede; conexão `ready` passa; desligado não pede.
- Rotas: 409 `whatsapp_required` sem gravar nada; com conexão, confirma como hoje.
- Cartão: sem conexão abre o diálogo no código; conectou → confirma sozinho; presencial abre a câmera depois.
- Página do link: sem conexão mostra o botão para o app.

## Decisões em aberto
1. Vale também para o **presencial** (foto)? Recomendado: sim, para todo plantão.
2. WAHA fora do ar na hora da checagem: **libera** (não trava o plantão por falha nossa) ou **bloqueia**?
   Recomendado: libera e registra no log.
3. Plantão extra da noite (até 08:00) entra na regra? Recomendado: sim.

## Critério de pronto
A partir de 06/11, ninguém confirma presença sem WhatsApp conectado, nem pelo app nem pelo link; quem não está
conectado conecta pelo código, com o tutorial, e a presença é confirmada sem novo toque.
