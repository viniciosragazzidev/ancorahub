# Extensão do WhatsApp Web v2 (AncoraHub Assistant)

## Objetivo

Pedido do Vinicios (2026-11-03): refazer a extensão do WhatsApp Web por
inteiro, no design Lite, com cara de parte do próprio WhatsApp. Ela precisa de:

- recursos que só a extensão tem;
- sincronização com o CRM e alertas;
- conexão fácil com a conta do corretor;
- aceite do lead pela extensão, com a conversa já aberta.

**Regra mãe (Vinicios):** todas as regras do CRM continuam valendo e ficam mais
fortes. A extensão não tem regra própria. Toda ação passa pelo gateway
`/api/extension/*`, que chama o mesmo serviço do CRM. A extensão pode bloquear
antes (na interface), mas quem decide é sempre o servidor.

Base: o MVP v0.1.2 em `apps/browser-extension`, as rotas `src/app/api/extension/*`,
`src/features/browser-extension/*` e o ADR-0034, que define a extensão como
plugin contextual e não como automação.

## Decisões

- **Aceite só para corretor (`broker`)**, igual ao modo corretor Lite.
- **Oferta perto de vencer:** contador na extensão a partir do `expiresAt` do
  servidor e aviso no último minuto. Não há job novo no servidor, porque a oferta
  padrão dura 3 min.
- **Tarefa vencendo:** o aviso nasce no servidor, reaproveitando
  `runTaskOverdueSweep` (`task-overdue-sweep.ts:22`) para gerar a notification,
  e chega pela extensão.
- **Transferência fica fora da v2.** Não é escopo do corretor.
- **Documentos fora da v2:** não existe regra de acesso definida. A gaveta mostra
  só um link "Abrir no CRM".
- **Horário comercial e WhatsApp obrigatório no plantão:** a extensão não cria
  essas regras. Ela segue o que o servidor já faz e só **avisa** quando o WAHA
  do corretor está desconectado ou quando ele está fora do plantão.
- **Modo Lite x normal:** o servidor filtra por papel e unidade. O modo visual não
  entra na regra.
- **Envio:** a extensão só preenche o composer. Quem clica em enviar é sempre o
  corretor. Ela não envia em lote, não lista contatos e não lê mensagens fora da
  conversa aberta.
- **Build:** continua o esbuild que já existe. React só no painel, CSS como
  string dentro do Shadow DOM. Nada de JS remoto, CDN ou eval. Tokens do Lite
  exportados num subconjunto (`venancor-scope.css`, `foundation.css`,
  `chat.module.css`, `motion-tokens.ts`).
- **Endereço do CRM** vem da variável de build. Acabam as URLs fixas em
  `service-worker.ts:1` e `popup/index.ts:63`.
- **Distribuição:**
  - piloto pelo ZIP atual, em modo desenvolvedor;
  - depois, Chrome Web Store como **não listada**, com link direto e atualização
    automática. Precisa de uma conta de desenvolvedor do Vinicios (taxa única);
  - o acesso real continua sendo a sessão do CRM.

## Regras que a extensão tem de respeitar (inventário do Vigia, 03/11)

Cada etapa só sai se passar por esta lista. A referência é o código na base
`5fd5b30e`.

| # | Regra | Fonte da verdade | Como a extensão cumpre |
|---|---|---|---|
| V1 | Lead visível só para o corretor dono, no tenant e na unidade dele | `lead-context.ts:9-14` `isExtensionLeadVisibleForUser` | Toda rota usa essa função; a extensão nunca filtra sozinha |
| V2 | Sessão válida e vínculo de membro ativo | `auth.ts:24-35`, `resolve/route.ts:15-16` | Membership consultado de novo a cada ação |
| V3 | Chave global e chave por tenant | `resolve/route.ts:13,17-18` | Checagem em **todas** as rotas (hoje só no resolve) |
| O1 | Oferta ativa (PENDING/SENT/DELIVERED/READ) | `offers.ts:1016-1019`, `domain.ts:426` | Aceite chama `handleLeadOfferWebhookResponse` (`offers.ts:715`) |
| O2 | Prazo e tolerância | `offers.ts:148-153`, `domain.ts:422-424` | Contador só exibe; o servidor decide e devolve `expired` |
| O3 | Uma aceitação só, com lock do lead | `offers.ts:~945-960` | Idempotência por `offerId`; `already_accepted` vira mensagem clara |
| O4 | Ação só "aceitar" ou "recusar" | `offers.ts:~830-835` | Texto do botão fixo; nunca texto livre |
| O5 | Recusa conta como pulo do plantão | `offers.ts:~855-863` | Avisar antes de recusar |
| O6 | Nivelamento, corte do dia, frios liberados às 9h do 2º dia | `received-in-day-core.ts`, `broker-day-history.ts:46-52`, `cold-age-release.ts:30,43` | A extensão não mexe; só mostra o que o servidor ofereceu |
| S1 | Transições válidas | `lead-status-constants.ts:15-27`, `change-lead-status.ts:208-214` | Só mostra as opções válidas; o servidor valida de novo |
| S2 | Perdido exige motivo da lista | `lead-status-constants.ts:39`, `change-lead-status.ts:226-232` | Seletor de motivos vindo do CRM (motivos editáveis da Onda 1) |
| S3 | Só o dono muda; o atendimento precisa ter começado | `change-lead-status.ts:131-149` | O mesmo serviço; nunca o caminho `system` (`:231,:260`) |
| S4 | Versão otimista | `change-lead-status.ts:177-180` | Sempre envia `expectedVersion`; 409 recarrega a gaveta |
| T1 | Tarefas e lembretes | `task-actions.ts`, `reminder-actions.ts:25` | Chama essas actions |
| L1 | Telefone mascarado | `browser-extension/schemas.ts:45-48` | Número inteiro só depois do aceite, para abrir a conversa |
| L2 | Dados que não saem do CRM (CPF, comissão, observações internas) | `lead-context.ts:21-48` | O payload novo usa lista fechada de campos (allowlist), revisada pelo Vigia |
| M1 | Anti-bloqueio do envio | `outbound-service.ts:908-917`, `team-notices/guard.ts:14-16` | Essas travas só cobrem envios do CRM; o envio manual no WhatsApp Web não passa por elas. Por isso a extensão nunca envia nem automatiza envio: sugestões e saudação só preenchem o texto |
| P1 | Plantão no aceite (regra 16 do inventário, ainda não confirmada no código) | `processQueuedLead` (`candidate.onDuty`) | Confirmar no mapa da E3 se o aceite checa o plantão; se não checar, só avisar e anotar como pendência para o Vinicios, sem regra nova |
| A1 | Auditoria | `change-lead-status.ts:~346`, `auth.ts:53-58` | Ação `extension.*` com metadados `{source:"extension", deviceId, sessionId}` |

Reforços que a extensão traz, sempre com a checagem também no servidor:

- trava a ação se a conversa aberta não for a do lead, comparando com o telefone
  resolvido pelo servidor;
- avisa quando o corretor está fora do plantão ou com o WAHA desconectado;
- trava no cliente e no servidor o aceite de oferta já vencida;
- responde igual quando o lead não existe e quando é de outro corretor, para
  ninguém descobrir números (`resolve/route.ts:16`);
- limita a quantidade de pedidos por sessão nas rotas de resolve e de aceite;
- checa a permissão gravada na sessão (`auth.ts:47`) em cada rota;
- confere vínculo de membro ativo e unidade a cada pedido, com cache curto,
  em `authenticateExtensionRequest` (`auth.ts:24-35`). A desativação do membro
  e a troca de unidade revogam as sessões dele (hoje só o logout revoga, em
  `auth.ts:57`).

**Fora da v2 (revisão do Vigia, B1):** selos na lista de chats. Eles exigiriam
ler o telefone de cada conversa visível e mandar ao servidor, o que contradiz a
regra de não ler fora da conversa aberta.

## Conexão fácil (1 clique)

1. O corretor instala a extensão. A primeira tela dela tem o botão "Conectar ao
   CRM", que abre `/extensao/conectar` no CRM.
2. No CRM, logado com o cookie normal, a tela mostra quem está conectando
   (nome, unidade e o aparelho) e o botão "Conectar".
3. O CRM gera o código de uso único que já existe (5 min, sha256) e o entrega
   direto à extensão por `chrome.runtime.sendMessage`.
   - O código fica amarrado ao `extensionId` e ao `deviceId` que a extensão
     mandou ao abrir a página. O `auth/exchange` recusa se eles não baterem.
   - `externally_connectable.matches` aceita só o host exato do CRM, sem
     curinga de subdomínio. `onMessageExternal` recusa qualquer outro remetente.
   - A extensão troca o código pela sessão. O token não passa por URL nem pelo
     DOM do WhatsApp.
4. A sessão renova com o uso, mas cai depois de 7 dias sem uso e, em qualquer
   caso, aos 30 dias. Cada renovação troca o token. A sessão também é revogada
   quando o membro é desativado, troca de unidade ou clica em "Desconectar" no
   CRM ou na extensão.
5. O modo corretor Lite detecta se a extensão está instalada e mostra o cartão
   "Conectar extensão" ou "Extensão conectada". O código digitado continua como
   plano B.
6. No WhatsApp Web, se a extensão estiver sem sessão, aparece um aviso discreto
   no estilo do WhatsApp com "Conectar". O QR do WAHA continua no CRM
   (`waha-connections-card.tsx`): a extensão só leva até ele.

## Arquitetura no WhatsApp Web

- **Registro de detectores por capacidade:** shell, barra esquerda, cabeçalho,
  composer, gaveta e linha de chat.
  - Cada detector tem alternativas: `data-icon`, `role`/`aria-label` em PT e EN,
    e `data-testid` quando existir.
  - Cada um confere que o elemento é único e está visível.
  - Se um detector falha, só aquela capacidade se esconde. O resto continua, com
    o botão "Abrir no CRM".
  - Chave de desligar por capacidade, controlada pelo super admin em
    `extension_settings`.
- **Identidade da conversa:**
  - O mundo ISOLATED não lê o React fiber. Se ele for indispensável, entra uma
    ponte mínima no mundo MAIN, empacotada com a extensão, que devolve só a
    identidade da conversa ativa e é tratada como entrada não confiável.
  - `@lid` nunca vira telefone, e o contato nunca é adivinhado pelo nome. Se a
    identidade estiver ambígua, o contexto fica escondido.
- **Tema:** ponte de CSS no `:host` com prefixo `--ct-*`, lida das variáveis e
  das cores calculadas do WhatsApp, observando a troca entre claro e escuro. A
  fonte é a do próprio WhatsApp. O Lite entra na hierarquia, na ação primária
  azul, nos números tabulares e no movimento (com redução respeitada).
- **Superfícies:**
  - botão AncoraHub na barra esquerda, do mesmo tamanho e com o mesmo tooltip dos
    vizinhos;
  - gaveta direita no estilo de "Dados do contato";
  - selo de etapa e temperatura no cabeçalho, só da conversa aberta;
  - botão ao lado de Anexar no composer.
- **Abrir conversa** depois do aceite:
  - fluxo da própria interface: Nova conversa, buscar o número internacional,
    selecionar o resultado exato e conferir a identidade antes de preencher;
  - reserva: `wa.me/<número>`. Se falhar, o aceite continua valendo e aparece o
    botão "Tentar abrir";
  - WA-JS fica só como teste opcional atrás de uma chave, nunca como dependência.

## Sincronização e alertas

- **Rota nova `GET /api/extension/inbox?cursor=`.** Devolve ofertas pendentes
  (com `expiresAt`), notifications do usuário (cliente respondeu, lead
  transferido, tarefa vencendo) e o novo cursor.
  - Consulta barata e com índice, porque o egress do Supabase está no limite.
  - Cada item leva só id, tipo, lead e horário. Nunca vai o texto da mensagem
    do cliente.
  - Responde 304 quando o cursor não mudou.
- **`lastSeenAt` da sessão** passa a ser gravado só quando tem mais de 5 min
  (hoje é gravado em todo pedido, em `auth.ts:33`). Sem isso, cada consulta
  periódica vira um UPDATE.
- **Transporte:**
  - Com a aba do WhatsApp aberta, uma porta mantém o service worker vivo e o
    inbox é consultado a cada 20 s.
  - Sem a aba aberta, `chrome.alarms` consulta a cada 1 min.
  - IDs processados ficam guardados, sem alerta repetido, inclusive dos que o
    corretor já viu no CRM.
  - **Sem canal de tempo real do Supabase na v2.** Fica só a consulta
    periódica, que é mais simples, não aumenta o egress e não depende de
    autorização privada no Realtime.
- **Alertas:**
  - `chrome.notifications`: o clique foca o WhatsApp e mostra a oferta, sem
    aceitar;
  - selo com o número de pendentes no ícone;
  - aviso no WhatsApp no estilo do `dynamic-notice.tsx`;
  - som opcional, tocado por documento offscreen, com modo silencioso;
  - texto discreto quando a tela está bloqueada.

## Etapas

Execução em worktrees próprias, a partir de `feat/extensao-v2`.

- **Revisão cruzada:** as etapas do Cinzel o Vigia revisa; as do Vigia, o
  Cinzel revisa. Em toda entrega, o Lince faz o QA contra a tabela de regras.
- **Push** só com o revisor da etapa aprovando.
- **SQL**, se houver, vai para o Vinicios e nunca roda por `db:migrate`.

| Etapa | Conteúdo | Dono | Revisa | Pronto quando |
|---|---|---|---|---|
| E0a Segurança e rotas | Rate limit **por rota** (resolve, aceite e inbox com limites separados); resposta igual para lead inexistente e de outro corretor; chave do tenant e permissão em toda rota; vínculo de membro e unidade a cada pedido, com revogação na desativação ou troca de unidade; sessão com 7 dias de ociosidade, teto de 30 e rotação do token; `lastSeenAt` gravado a cada 5 min; código amarrado a `extensionId` e `deviceId`; allowlist de campos do payload (L2); auditoria `extension.*`. Colunas novas (código e sessão) vão num SQL único para o Vinicios, antes do push | Cinzel | Vigia | Testes das rotas (escopo, enumeração, rate limit por rota, membro desativado, sessão ociosa e vencida, código de outro dispositivo); teste que falha se sair campo fora da allowlist |
| E0b Build e base da interface | React e CSS no shadow, endereço do CRM por variável, stubs removidos, prebuild que não quebra o build do Next, minificação em produção; registro de detectores e ponte de tema | Cinzel | Vigia | Bundle inicial abaixo de 30 KB gzip e painel com React abaixo de 200 KB gzip; extensão carrega igual à v1; build do Next passa mesmo com falha do esbuild |
| E1 Conexão 1 clique | `externally_connectable` com host exato, `/extensao/conectar`, cartão no Lite do corretor, popup novo no Lite, aviso no WhatsApp | Vigia | Cinzel | Conectar sem digitar código; recusa de remetente estranho testada; desconectar dos dois lados; prints claro e escuro |
| E2 Gaveta Lite | `lead-context` ampliado (temperatura, fila, idade, plano, vidas, valor, próximo passo, histórico) dentro da allowlist; gaveta direita, selo no cabeçalho, botão na barra | Vigia | Cinzel | Prints claro e escuro ao lado do WhatsApp nativo; teste da allowlist passa com os campos novos |
| E3 Aceite e abrir conversa | `POST /api/extension/offers/[id]/accept` e `/decline` (reaproveita `handleLeadOfferWebhookResponse`, idempotente); lista de ofertas com contador; abrir conversa e preencher a saudação. Antes: confirmar a regra P1 (plantão no aceite) | Cinzel | Vigia | Testes de aceite: vencido, já aceito, outro corretor, papel errado, repetido; abrir com e sem contato salvo |
| E4 Alertas e sincronização | `/api/extension/inbox` (304, só id/tipo/horário), notificações, selo no ícone, aviso, som; aviso de tarefa vencendo no sweep | Cinzel | Vigia | Sem alerta duplicado; retomada depois de dormir; inbox com no máximo 200 pedidos por hora por corretor com a aba aberta (limite próprio, separado de resolve e aceite), e 304 sem corpo quando nada mudou, medido antes de liberar |
| E5 Ações rápidas | Etapa e status (transições válidas e motivo de perda), nota, tarefa e lembrete, sugestões pelo composer (só preenchem) | Vigia | Cinzel | Cada ação passa pelo serviço do CRM; 409 tratado; auditoria gravada |
| E6 Publicar | Telemetria de seletor sem dados pessoais, desligamento por capacidade, lista de teste (PT/EN, claro/escuro, zoom, grupo, lista longa), troca de versão sem perder rascunho, Web Store não listada | Lince (QA) e Maestro | Vigia | Piloto com 2 corretores, 5 dias úteis, com: conectar em 1 clique; aceitar e abrir conversa (contato salvo e não salvo); alerta de oferta e de último minuto; nenhum alerta duplicado; WhatsApp em PT e EN, claro e escuro, zoom 80% a 125%; grupo aberto sem painel; troca de versão sem perder rascunho; zero erro de detector na telemetria por 2 dias seguidos |

O Lince mapeia a próxima etapa enquanto a atual é executada e faz o QA de cada
entrega.

## Entrega E0a (03/11/2026)

Status: implementada em `feat/ext-v2-e0a`, aguardando revisão cruzada do Vigia e QA do Lince.
Registro: [E0a segurança e rotas](2026-11-03-extensao-whatsapp-v2-e0a.md).
Todas as rotas usam `requireExtensionAccess`, inclusive exchange autenticado pelo grant de uso único.
O plano B manual continua sem vínculo; E1 pode emitir código com `{extensionId, deviceId}`.
A unidade/membership é conferida em cada chamada. Renovação explícita: `POST /api/extension/session`;
`GET` permanece compatível e não rotaciona. SQL manual: `drizzle/0216_extension_auth_code_binding.sql`.
Validações: typecheck e testes focados com mocks; detalhes e limites no registro da E0a.

## Pendente com o Vinicios

- Conta de desenvolvedor da Chrome Web Store (E6).
- Escolher os 2 corretores do piloto.
- SQL, se a sessão deslizante ou a chave por capacidade precisarem de coluna
  nova. Vai na área de transferência antes do push.
