# Roteiro guiado: conectar o WhatsApp e confirmar presença no plantão (plano, 09/11/2026)

**Pedido do Vinicios (09/11):** deixar o processo de copiar o código, conectar o WhatsApp e confirmar presença
mais dinâmico, simples e explicativo. Passo a passo por etapa, no estilo do Duolingo, pensado para o corretor
com menos familiaridade com tecnologia.

**Por que importa:** desde 06/11 a presença só é confirmada com o WhatsApp conectado
(`feature_duty_presence_requires_whatsapp`) e o plantão só distribui para quem confirmou. Corretor que se perde
na conexão fica sem lead, e o plantão fica sem gente.

Status: **implementado em 09/11** na branch `feat/roteiro-presenca-guiado` (cortada de `feat/diretor-visual-lite`), com as
opções recomendadas da § 8 e o ajuste da tela inicial (§ 10). Aguardando revisão visual antes do merge.

---

## 1. Como é hoje (mapeado no código em 09/11)

### 1.1 Onde a presença é confirmada
| Caminho | Arquivo | O que faz |
|---|---|---|
| Cartão "Confirme sua presença" (app) | `src/components/chat/presence-callout.tsx` | Aparece no Início, na conversa do Plantão e em `/plantoes/agora`. Online: um toque. Presencial: foto do local e o diretor libera. |
| Link do lembrete (sem login) | `src/app/confirm_presence/*` | Online e plantão extra confirmam pelo link. Sem WhatsApp, mostra "Abrir no app para conectar" (vai para `/plantoes/agora`). |
| Servidor | `src/app/api/duty/presence/route.ts`, `src/app/api/public/duty-presence/confirm/route.ts` | Sem WhatsApp `ready`, responde 409 `whatsapp_required`. Se o WAHA não responde, libera e registra. |

### 1.2 Regras envolvidas
- **Exige WhatsApp** (`duty-presence-whatsapp.ts`): vale a partir de 06/11/2026 (São Paulo), para online,
  presencial e plantão extra. Ao vivo manda; serviço fora do ar libera (`service_unavailable`).
- **Janela de autoconfirmação** (`duty-presence-domain.ts`, BR-086): abre 30 min antes do início
  (`not_open` antes disso) e fecha 1 hora depois do início ou da entrada no plantão (`late`). Depois, só a gestão
  libera; a mensagem é `SELF_CONFIRM_LATE_MESSAGE`.
- **Presencial:** foto do local, fica pausado até o diretor validar (`awaiting_release`).
- **Corretor está sempre no modo Lite** (`experience-mode.ts`): o cartão de presença usa o kit de chat Lite.

### 1.3 Como a conexão acontece hoje (`WhatsAppConnectDialog variant="presence"`)
Três telas em `presence-whatsapp-screens.tsx`, dentro de um diálogo:
1. **Vantagens + privacidade** e o botão "Gerar meu código" (mais "Assistir tutorial", vídeo de 90 s).
2. **Código** grande + botão "Copiar código e abrir o WhatsApp" + celular animado em loop
   (`pairing-code-demo.tsx`, 6 passos a cada 2,2 s) + "Ver passo a passo" escondido (Android | iPhone).
3. **Conectado** → a presença é confirmada sozinha (`onReady` → `continueAfterConnected`).

Peças técnicas que o roteiro novo reaproveita sem mudar a lógica:
- Código de pareamento: `requestWhatsAppPairingCode`, até 15 tentativas enquanto a sessão sobe,
  `PAIRING_COOLDOWN`, código vale cerca de 2 minutos, `codeExpired` quando a sessão é renovada.
- Polling do status com `visibilitychange` (acorda quando o corretor volta do WhatsApp) e vigilância em segundo
  plano por 10 minutos com o diálogo fechado.
- Número do cadastro carregado sozinho (`getWhatsAppPairingPhone`); com ele, o código sai sem digitar nada.
- Celular abre o app por `whatsapp://send`; computador só copia e pede para abrir no celular.

### 1.4 Onde o corretor leigo se perde (leitura do fluxo atual)
1. **Muita coisa na mesma tela:** código, botão, animação em loop, legenda, link do passo a passo. Não fica claro
   qual é o próximo passo.
2. **O caminho dentro do WhatsApp é mostrado na hora errada.** A animação aparece junto com o botão que tira o
   corretor do app; quando ele chega ao WhatsApp, já não está vendo o passo a passo.
3. **A animação em loop não espera o corretor**: troca de passo a cada 2,2 s, quer ele tenha entendido ou não.
4. **Voltar do WhatsApp não tem tela própria:** ele volta e vê a mesma tela de antes, sem saber se deu certo,
   se falta algo ou se o código venceu.
5. **Erros aparecem como toast ou texto pequeno** (código vencido, cooldown, demora), sem dizer o que fazer.
6. **Não há progresso visível** ("falta quanto?") nem retomada se o celular recarregar a página ao trocar de app
   (comum em Android com pouca memória).
7. **Visual misturado:** o cartão de presença é Lite (chat), o diálogo de conexão usa os tokens do
   `docs/design-system.md` (`ds-*`), e o celular animado usa tamanhos fora da escala (`text-[8px]`, `[9px]`,
   `[10px]`).

---

## 2. O roteiro proposto

### 2.1 Ideia central
Uma **tela cheia de "lição"**, no padrão do Duolingo, conduzida pelo mascote do Plantão (onigiri, matiz 28, o
mesmo do cartão de presença):

```
┌──────────────────────────────────┐
│  ✕   ▓▓▓▓▓▓▓░░░░░░░░   2 de 6    │  ← fechar + barra de progresso
│                                  │
│  (mascote)  Frase curta do passo │  ← o mascote "fala" (texto sem balão, 18/500)
│             Uma linha de apoio.  │
│                                  │
│        [ ilustração/animação ]   │  ← uma ideia só, para o passo atual
│                                  │
│  Precisa de ajuda?               │  ← link discreto: vídeo, texto, supervisor
│  [      UM botão de ação      ]  │  ← único CTA, preso no pé, 50px
└──────────────────────────────────┘
```

Regras do roteiro:
- **Uma ideia e um botão por tela.** Nada de segundo botão primário; ajuda vai para um menu.
- **O roteiro pula o que já está feito:** número já no cadastro, WhatsApp já conectado, presença já confirmada.
  Quem já tem WhatsApp conectado continua confirmando com um toque, como hoje, sem ver o roteiro.
- **O servidor é a verdade:** a cada abertura e a cada volta ao app, o roteiro confere conexão e presença e salta
  para o passo certo.
- **Sucesso é comemorado em cada passo** (check que se desenha, mascote reage) e o roteiro avança sozinho
  quando não há o que decidir.

### 2.2 Etapas (celular, plantão online)

Barra de progresso com 6 marcos. Os passos que forem pulados somem da contagem.

| # | Etapa | O mascote diz | Ilustração / animação | Botão único | Avança quando |
|---|---|---|---|---|---|
| 1 | **Boas-vindas** | "Para receber leads hoje, conecte seu WhatsApp. Leva 1 minuto." Apoio: "Suas conversas pessoais continuam só suas." (toque abre a explicação de privacidade atual em um painel) | Mascote acenando + o celular com o selo do WhatsApp | **Vamos lá** | Toque. Dispara a geração do código em segundo plano. |
| 1b | **Seu número** (só se não houver número válido no cadastro) | "Qual é o número do WhatsApp deste celular?" | Campo grande com "+55" fixo, teclado numérico | **Continuar** | Número com 10 ou 11 dígitos. |
| 2 | **Seu código** | "Este é o seu código. Toque para copiar." | Código em 8 quadradinhos (`ABCD-1234`) que entram um a um; ao copiar, os quadradinhos ficam verdes e aparece "Copiado!" | **Copiar código** | Copiou (ou o corretor tocou de novo depois de falhar a cópia). Avança sozinho em 0,8 s. |
| 3 | **O caminho no WhatsApp** | "No WhatsApp, você vai tocar em 4 lugares. Veja:" | Celular ilustrado com os 4 toques, **um por vez, avançando pelo toque do corretor** (Android ou iPhone detectado; troca manual em "É iPhone?") | **Entendi, abrir o WhatsApp** | Toque. Abre `whatsapp://send`. O roteiro guarda que saiu. |
| 4 | **Colar o código** (tela que o corretor encontra ao voltar) | "Colou o código no WhatsApp? Estou esperando a confirmação." | Celular com os quadradinhos preenchidos e um indicador de "esperando" (mascote no estado `working`) | **Abrir o WhatsApp de novo** (secundário visual: "Ver o caminho de novo" volta ao passo 3) | Status `ready` no polling. |
| 5 | **Conexão confirmada** | "Pronto, seu WhatsApp está conectado!" | Check que se desenha + selo do WhatsApp + mascote comemorando | nenhum (avança sozinho em 1,6 s) | Automático. |
| 6 | **Confirmar presença** | "Agora é só confirmar sua presença no {plantão}." | Cartão do plantão (nome, unidade, até HH:mm) | **Confirmar presença** | Resposta `ok` do `POST /api/duty/presence`. |
| 7 | **Tudo certo** | "Presença confirmada às HH:mm. Os leads deste plantão já podem chegar para você." | Check grande + mascote feliz; vibração curta (já existe `navigator.vibrate(30)`) | **Ir para o Plantão** | Fecha o roteiro e mostra o cartão já como "Presença confirmada". |

Observações das etapas:
- **Passo 6 com botão, não automático.** Hoje a presença é confirmada sozinha ao conectar. No roteiro proposto o
  corretor toca "Confirmar presença" para ter o momento de "eu confirmei" (o que ele foi fazer ali). Alternativa:
  manter automático e mostrar o passo 6 marcando sozinho. Ver pergunta 7.
- **Plantão presencial:** o passo 6 vira **"Tirar foto do local"** (abre a `CameraCapture` atual) e o passo 7 diz
  "Foto enviada. O diretor valida e libera você; até lá você fica pausado." com o estado de espera atual.
- **O texto do passo 3** sai de `PAIRING_CODE_TUTORIAL` (já revisado):
  Android: ⋮ → Dispositivos conectados → Conectar dispositivo → Conectar com número de telefone.
  iPhone: Configurações → Dispositivos conectados → Conectar dispositivo → Conectar com número de telefone.
- **Atalho a verificar no aparelho:** ao pedir o código de pareamento, o WhatsApp do celular costuma mostrar uma
  notificação para digitar o código, que abre direto o campo. Se isso se confirmar em Android e iPhone, o passo 3
  ganha a dica "Apareceu uma notificação do WhatsApp? Toque nela." e encurta o caminho. Ver pergunta 11.

### 2.3 Barra de progresso e ritmo
- Barra no topo, ao lado do "✕", com a contagem "2 de 6" (tabular). Preenchimento anima a largura do passo por
  `transform: scaleX` (sem animar `width`).
- Cada troca de etapa: conteúdo sai para a esquerda e o novo entra pela direita (8 px + fade, 240 ms,
  `--ease-enter`). Com movimento reduzido: troca instantânea.
- "Voltar" do sistema/gesto volta um passo dentro do roteiro, sem sair dele; "✕" pergunta "Sair agora? Sem o
  WhatsApp conectado você não recebe leads do plantão." com "Continuar conectando" e "Sair".

### 2.4 Feedback de sucesso e erro
- **Sucesso pequeno** (copiou, número aceito): troca de ícone por check por 1,5 s, quadradinhos ficam verdes.
- **Sucesso grande** (conectou, presença confirmada): check que se desenha (`pathLength`, 450 ms), mascote passa
  para `idle` feliz, vibração curta. Proposta de estilo na pergunta 2.
- **Erro:** o mascote muda para o estado de atenção, a frase diz **o que aconteceu e o que fazer**, e o botão
  único vira a ação de conserto. Sem toast: no Lite, a confirmação e o erro aparecem na própria tela.

---

## 3. Falhas e como o roteiro reage

| Situação | Como detectar | O mascote diz | Botão único | Volta para |
|---|---|---|---|---|
| **Código venceu** (cerca de 2 min ou sessão renovada) | `codeExpired`, ou código com mais de 110 s ao voltar ao passo 2/4 | "Esse código venceu. Já fiz outro para você." | **Copiar o novo código** | Passo 2, com o código novo já gerado |
| **Pediu código demais** (`PAIRING_COOLDOWN`) | resposta da ação | "Espere {n} segundos para eu pedir outro código." (contagem regressiva) | botão desabilitado com a contagem | Passo 2 |
| **Número ausente ou inválido** | `presencePhoneValid` falso | (passo 1b) | **Continuar** | Passo 1b |
| **Código recusado pelo WhatsApp** (número digitado não é o deste celular) | `error` no polling depois do código | "O WhatsApp não aceitou. O número precisa ser o do WhatsApp deste celular: {número}." | **Corrigir o número** | Passo 1b |
| **Demorando para conectar** (`stalled`) | `PAIRING_STALL_SECONDS` | "Está demorando. Deixe o WhatsApp aberto mais um pouco." | **Gerar outro código** (aparece depois de 20 s) | Passo 2 |
| **WhatsApp não abriu** (sem app, PWA no iPhone) | a página continua visível 1,5 s depois do toque | "Não abriu? Abra o WhatsApp pelo ícone na tela do celular e volte aqui." | **Já abri** (vai ao passo 4) | Passo 4 |
| **Cópia bloqueada** (navegador sem permissão) | `clipboard.writeText` falha | "Não consegui copiar. Anote o código: ABCD-1234." (código em destaque, selecionável) | **Anotei** | Passo 3 |
| **Serviço do WhatsApp fora do ar** (`unreachable`/`unauthorized`) | fase do diálogo | "O WhatsApp está instável agora. Pode confirmar sua presença mesmo assim." | **Confirmar presença** (o servidor já libera nesse caso e registra) | Passo 6 |
| **WhatsApp desconectou no meio** (409 `whatsapp_required` ao confirmar) | resposta da rota | "Seu WhatsApp desconectou. Vamos conectar de novo, é rápido." | **Gerar meu código** | Passo 2 |
| **Antes da janela** (`not_open`, mais de 30 min antes) | estado da janela | "A confirmação abre às HH:mm. Já deixe o WhatsApp conectado agora." | segue o roteiro até o passo 5; o passo 6 mostra "Volte às HH:mm para confirmar" e **Fechar** | Passo 6 em espera |
| **Fora da janela de 1 hora** (`late`), antes ou durante o roteiro | estado da janela ou erro da rota | `SELF_CONFIRM_LATE_MESSAGE` em linguagem do mascote: "Passou de 1 hora do início. Agora só o seu supervisor libera você." | **Fechar** (a conexão do WhatsApp, se feita, fica valendo para os próximos plantões) | Fim |
| **Sem internet** | `navigator.onLine` / falha de rede | "Sem internet. Assim que voltar, eu continuo daqui." | **Tentar de novo** | Mesmo passo |
| **Câmera negada** (presencial) | `CameraCapture` → `onFallback` | já existe: abre a câmera do sistema | **Tirar foto do local** | Passo 6 |

---

## 4. Retomada de onde parou

- **O servidor decide o passo**, o navegador só lembra o detalhe. Função pura nova
  `resolvePresenceGuideStep(facts)` com entrada: estado da janela, modo (online/presencial), status da presença,
  status da conexão, número válido, idade do código, "saiu para o WhatsApp". Saída: o passo e o erro, se houver.
  Testada como os roteiros do Lite (`build*Script`).
- **Lembrança local** em `localStorage`, chave `ancora:presenca-guia:{assignmentId}`: passo, plataforma escolhida
  (Android/iPhone), hora do código e "saiu para o WhatsApp". Sempre em `try/catch`; se não houver, o roteiro
  recomeça pelo passo que o servidor indicar. Expira no fim do plantão.
- **Voltando do WhatsApp** (`visibilitychange`, já existe): se conectou, vai ao passo 5; se não, ao passo 4; se o
  código venceu, gera outro e mostra o erro "Esse código venceu".
- **Página recarregada pelo sistema** (Android sem memória): o cartão de presença reabre o roteiro sozinho no passo
  lembrado, porque havia um roteiro em andamento para este plantão.
- **Fechou no meio:** o cartão de presença mostra "Continuar de onde parei · passo 3 de 6" no lugar de
  "Conectar WhatsApp e confirmar".
- **Pelo link do lembrete** (`/confirm_presence`): o botão "Abrir no app para conectar" passa a abrir
  `/plantoes/agora?assignment={id}&guia=1`, que já abre o roteiro.

---

## 5. Celular x computador

| | Celular (recomendado ao corretor) | Computador |
|---|---|---|
| Moldura | Tela cheia, botão no pé com área segura | Painel central (largura do chat, 560 px), mesmo conteúdo |
| Forma de conectar | **Código** (não dá para ler QR da própria tela) | **QR Code por padrão**: no computador, apontar a câmera é mais fácil que digitar 8 letras. "Prefiro usar um código" troca para o código. Ver pergunta 6. |
| Passo 2 (código) | "Copiar código" | Sem cópia: o código fica grande na tela, "Digite este código no celular" |
| Passo 3/4 | Abre o WhatsApp no mesmo celular e volta | Não sai da tela: o passo 3 e o 4 viram um só ("Faça no celular e deixe esta tela aberta"), esperando a conexão |
| Plataforma | Detectada pelo navegador (Android/iPhone) | Pergunta "Seu celular é Android ou iPhone?" (segmented) |
| Presencial | Câmera na página | Pede para abrir no celular para a foto (como hoje) |

---

## 6. Componentes por etapa

Pasta nova: `src/components/chat/presence-guide/`. A lógica de conexão continua no `WhatsAppConnectDialog`; ela
será extraída para um hook (`useWhatsAppPairing`) sem mudar comportamento, para o roteiro e a tela de
Configurações usarem a mesma coisa.

| Peça | Reaproveita | Novo |
|---|---|---|
| `PresenceGuide` (moldura: ✕, barra, mascote, área da ilustração, botão no pé) | `AssistantAvatar` (onigiri, matiz 28, estados `idle`/`working`/`waiting`), `motion` + `useReducedMotion`, tokens do kit de chat (`chat.module.css`) | Layout de lição e transição entre passos |
| `GuideProgress` | Composer já tem faixa "x de y" (`ChatProgress`) | Barra segmentada (token em aberto, pergunta 5) |
| Passo 1 Boas-vindas | Textos e privacidade de `PRESENCE_WHATSAPP_COPY` | Ilustração do mascote com o celular |
| Passo 1b Número | `Input` do Arc (`src/components/arc/input`) com `inputMode="numeric"` | – |
| Passo 2 Código | Quadradinhos de `PairingCodePanel` | Animação de entrada dos quadradinhos e estado "Copiado!" |
| Passo 3 Caminho | `pairing-code-demo.tsx` dividido em cenas, `PAIRING_CODE_TUTORIAL`, `SegmentedControl` do Arc (Android/iPhone) | Avanço pelo toque em vez de loop por tempo |
| Passo 4 Esperando | Polling atual, mascote `working` | Tela de volta do WhatsApp |
| Passo 5 Conectado | Check desenhado do `presence-callout.tsx` | – |
| Passo 6 Confirmar | `send()` e `CameraCapture` do `presence-callout.tsx` | Cartão do plantão no roteiro |
| Passo 7 Pronto | – | – |
| "Precisa de ajuda?" | `BottomSheet` do Arc, `PresenceTutorialVideo` (vídeo de 90 s), `PairingCodeTutorial` (texto) | Item "Falar com o supervisor" (abre o WhatsApp do supervisor, se houver telefone) |
| Textos | `src/features/waha-cadence/pairing-copy.ts` | `PRESENCE_GUIDE_COPY` no mesmo arquivo, único lugar dos textos |
| Regra do passo | – | `resolvePresenceGuideStep` (função pura + testes) |

O que sai: `presence-whatsapp-screens.tsx` e o `variant="presence"` do diálogo, depois que o roteiro entrar.
O `WhatsAppConnectDialog` padrão (Configurações) não muda.

Preview para revisão visual: ampliar `/dev/presenca-whatsapp` com todos os passos e todos os erros da seção 3,
navegáveis, sem precisar de WhatsApp de verdade.

---

## 7. Testes previstos

- `resolvePresenceGuideStep`: cada combinação da seção 3 leva ao passo e ao erro certos; quem já está conectado
  não vê o roteiro; presencial troca o passo 6; `not_open` e `late`.
- Roteiro: avança com o botão único; volta do WhatsApp conectado vai ao passo 5; código vencido gera outro;
  `whatsapp_required` ao confirmar volta ao passo 2; movimento reduzido mostra tudo sem deslocamento.
- Retomada: com a lembrança local, reabre no passo certo; sem `localStorage`, recomeça sem quebrar.
- Link do lembrete: o botão leva a `?guia=1` e o roteiro abre.
- Snapshot de `/integrations/whatsapp` continua igual (o diálogo padrão não muda).

---

## 8. Perguntas em aberto

1. **Qual design system vale aqui?** O `CLAUDE.md` manda seguir `docs/design-system.md` e só cita a exceção Lite
   para o Diretor. Mas o corretor está sempre no Lite e o próprio `LITE_CHAT_DESIGN_SYSTEM.md` diz "ATIVO no modo
   Lite (corretor)"; o cartão de presença já é Lite e o diálogo atual usa `ds-*`. **Recomendado:** o roteiro todo
   no Lite (Plus Jakarta Sans, azul de ação do chat, raios pílula/painel), para não misturar dois visuais na mesma
   jornada. Preciso da confirmação.
2. **Quanto "Duolingo" no movimento?** `docs/design-system/MOTION.md` proíbe bounce, elastic e confete. O Lite usa
   molas com bounce até 0,45 no próprio cartão de presença. **Proposta:** comemoração com check desenhado, mola com
   bounce até 0,3 no mascote e vibração curta; **sem confete**. Confirma, ou quer algo mais festivo?
3. **Ilustrações do WhatsApp.** As telas do WhatsApp no celular animado precisam de verde e de tamanhos de texto
   pequenos (hoje `8px`, `9px`, `10px`, fora da escala do Lite, que começa em 12). Opções: (a) desenho simplificado
   com o verde do WhatsApp do Lite (`oklch(64% .17 150)`, hoje permitido só no botão "Abrir WhatsApp") e sem texto
   miúdo, só formas e o rótulo do toque abaixo, em 14; (b) capturas reais do WhatsApp (mudam a cada versão do app);
   (c) objetos 3D navy/mint do estúdio Âncora (a exceção de 28/10 só permite enfeite pequeno de 48/64/80 px).
   **Recomendado: (a)**, liberando o verde do WhatsApp dentro da ilustração. Preciso da aprovação.
4. **Som no sucesso?** Duolingo toca um som. Hoje só existe vibração curta. Recomendado: só vibração.
5. **Barra de progresso no Lite:** o Lite não define uma barra. Proposta: trilho `--surface-muted`, preenchimento
   `--chat-action`, 8 px, raio pílula (o mesmo desenho da Progress Bar do `design-system.md`, com as cores do
   Lite). Confirma?
6. **No computador, QR Code como padrão?** Recomendado: sim (mais fácil que digitar o código), com "Prefiro usar um
   código". A regra atual abre sempre no código.
7. **Passo 6 com botão ou automático?** Recomendado: botão "Confirmar presença" (o corretor vê que confirmou). Hoje
   é automático ao conectar; o automático economiza um toque.
8. **Contagem regressiva do código visível?** Recomendado: não mostrar (relógio gera ansiedade no leigo); o roteiro
   troca o código sozinho quando vence.
9. **Conectar antes da janela abrir.** Recomendado: permitir conectar a qualquer hora (o roteiro roda até o passo 5
   e diz quando volta para confirmar). Mudar também o texto do lembrete de 24 a 2 horas antes ("Já conecte seu
   WhatsApp") mexe em mensagem enviada a corretores e precisa da sua aprovação à parte.
10. **Medir onde o corretor trava?** Registrar cada passo e cada erro (sem dados pessoais) para ver onde os
    corretores desistem. Recomendado: sim, no log de distribuição já existente.
11. **Notificação do WhatsApp com o código:** preciso testar em um Android e um iPhone reais se o WhatsApp mostra a
    notificação ao pedir o código. Se mostrar, o passo 3 fica mais curto.

## 9. Critério de pronto
O corretor que nunca conectou o WhatsApp chega ao "Presença confirmada" seguindo só o botão de cada tela, no
celular, sem ajuda; cada falha da seção 3 diz o que fazer e leva de volta ao passo certo; se o celular recarregar
a página ou ele sair no meio, o roteiro continua de onde parou; quem já está conectado confirma com um toque, como
hoje.

## 10. Ajuste de 09/11: "Garanta que você está na tela inicial" e o link que só abre o app

Pedido do Vinicios, depois de aprovar o roteiro: ao tocar em "Abrir o WhatsApp", o app abria dentro da conversa com o
número da empresa. A causa era o `whatsapp://send` (link de envio). Nenhum link força a tela inicial: o celular volta
para a última tela usada.

- **Link novo** (`src/components/whatsapp/open-whatsapp-app.ts`): Android abre pelo pacote
  (`intent://#Intent;scheme=whatsapp;package=com.whatsapp;…`); se o WhatsApp comum não existir, o fallback do Chrome
  só muda o `#` da página e tentamos o WhatsApp Business (`com.whatsapp.w4b`); sem nenhum dos dois, aparece "Não abriu?".
  iPhone e demais: `whatsapp://`. Vale também para o botão "Abrir WhatsApp" do diálogo padrão (Configurações).
- **Etapa nova no celular** (3 de 7), entre o código e o caminho: "Abra o WhatsApp e confira se está na tela Conversas",
  com a ilustração animada (conversa aberta → toque na seta ← → lista Conversas), variantes Android (←) e iPhone (‹).
  Primeiro botão "Abrir o WhatsApp"; ao voltar, "Estou na tela de Conversas". O caminho passou a começar "Na tela
  Conversas, …". No computador, a conferência virou o primeiro item da lista ao lado do QR.
- O celular tem agora 7 marcos (boas-vindas, código, tela inicial, caminho, esperando, conectado, confirmar).

### O que ficou implementado
- `src/components/chat/presence-guide/`: `presence-guide.tsx` (roteiro), `presence-guide-art.tsx` (ilustrações),
  `presence-guide-steps.ts` (regras puras: etapa, erro, progresso, retomada) e testes.
- `WhatsAppConnectDialog variant="presence"` desenha o roteiro em tela cheia (celular) ou painel de 560 px
  (computador), não fecha ao conectar e mostra os erros na tela (sem toast). No computador abre no QR Code.
- `presence-callout.tsx`: conectado, a presença é confirmada com um toque dentro do roteiro; presencial fecha o roteiro
  e abre a câmera; 409 `whatsapp_required` reabre o roteiro em "reconectar"; fechou no meio, o botão vira
  "Continuar de onde parei". Regras do servidor sem mudança (exige WhatsApp; janela de 1 hora).
- Saíram `presence-whatsapp-screens.tsx`, `pairing-code-demo.tsx` e a prévia `/dev/presenca-whatsapp`.
  O protótipo `/dev/roteiro-presenca` usa o mesmo componente do app, com a conexão simulada.

### Não verificado
- O link de intent e o fallback para o Business precisam de teste em um Android real (com e sem o WhatsApp comum),
  e o `whatsapp://` em um iPhone real.
- O fluxo com WhatsApp de verdade (WAHA) não foi rodado: o protótipo simula a conexão; a ligação com o diálogo real
  está coberta por testes.
- Pendente do plano: o botão do link do lembrete (`/confirm_presence`) ainda leva a `/plantoes/agora` sem `?guia=1`.

## 11. Ajuste de 09/11 (noite): o WhatsApp não abria e o aviso antes de abrir

Pedido do Vinicios: "Abrir o WhatsApp" não abria o app; e, antes de abrir, mostrar que é na tela inicial, nos
3 pontinhos.

- **Causa:** o link do ajuste anterior não tinha o `send` (`whatsapp://` e o intent com host vazio). O WhatsApp só
  atende o endereço `whatsapp://send`; sem número nem texto, ele só abre o app. Agora: Android
  `intent://send#Intent;scheme=whatsapp;package=com.whatsapp;…` (com o fallback para o Business), iPhone e demais
  `whatsapp://send`.
- **Aviso antes de abrir:** todo "Abrir o WhatsApp" do roteiro abre primeiro a folha "Quando o WhatsApp abrir:" com
  1) ir para a tela inicial (Conversas), voltando pela seta se cair numa conversa, e 2) tocar nos 3 pontinhos ⋮ em
  cima à direita (no iPhone, Configurações embaixo), com a ilustração do toque. O app abre pelo botão
  "Entendi, abrir o WhatsApp" do aviso (o toque do corretor, que o celular exige para abrir outro app).
- Continua sem teste em Android e iPhone reais.
