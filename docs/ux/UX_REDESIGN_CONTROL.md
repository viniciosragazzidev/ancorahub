## 2026-10-21: dados completos do lead e painel no celular

Papel: corretor em `/leads/[id]`, inclusive na visualização do super-admin.
Ação principal: consultar o cadastro e a qualificação disponíveis durante o atendimento.
Disclosure: mesmos dados na coluna do desktop e no sheet "Ver dados" do celular,
incluindo beneficiários. Estados: antes do aceite com contato protegido, após aceite
com contato autorizado, dados parciais e observações longas. O portal reutiliza o
tema Arc e a altura disponível abaixo dos avisos, com rolagem e fechamento existentes.
Sem token, primitive, variante ou movimento novo. Não avança a etapa global UX-M1.10.

## 2026-10-21: busca da unidade e enviados versus aceitos

Refinamento funcional do Lite autorizado pelo Vinicios. Na aba Unidade de Minha
equipe, a ação principal é encontrar o corretor pelo nome e usar Adicionar ou
Convidar. SearchField Arc existente, com lupa, limpar, rótulo acessível, resultados
e vazio de busca; somente dados já autorizados da própria unidade. No perfil
compartilhado de gestor/supervisor, enviados e aceitos ficam lado a lado com taxa
e escopo histórico explícito. Reutiliza tokens e composições existentes, sem
primitive, variante ou animação nova. SearchField recebe apenas clearLabel opcional
para localizar o rótulo de limpar. Preserva flags, auditoria, erro, loading e
negação existentes. Não avança o gate global do redesign.
Registro: `docs/implementations/active/2026-10-21-team-search-lead-acceptance.md`.

## 2026-10-17: Lite 2 D, Agora e menos passos

Papeis: corretor na fila e no inicio; supervisor na equipe. O corretor ve no
topo o que requer acao agora: aceite com prazo e plantao de origem, resposta do
cliente e retorno vencido, ate tres itens. A chegada mostrada e a distribuicao ao
corretor (`offeredAt` ou `assignedAt`); `createdAt` continua oculto. Aceitar abre a
ficha do lead em seguida. `/plantoes/agora` lista somente distribuicoes dentro da
janela do plantao atual. O supervisor ve chegadas de hoje, primeiro contato atrasado
e escala/confirmacoes de hoje, com acao direta. Estados vazios e carregamento usam
copy clara e skeletons Arc existentes. Entradas usam tokens de movimento Arc e
`motion/react`, com `prefers-reduced-motion`, foco visivel e alvos de toque de 44px.
Sem novo token, primitive ou regra de dominio. Registro:
`docs/implementations/active/2026-10-17-lite2-agora.md`.
Vitest focado e `tsc --noEmit` passaram; QA visual ficou pendente porque o ambiente
local nao compilou o proxy do Next com a junction de `node_modules`.

## 2026-10-16: P11, ficha de lead completa no Lite de supervisão

Papéis: supervisor na própria equipe e gestor na própria unidade. A ação principal
é consultar a qualificação, as informações e a conversa do WhatsApp no mesmo
detalhe; as ações atuais de repasse, cobrança, etapa e reatribuição permanecem nos
seus papéis. Conversa, qualificação, tarefas e documentos do gestor são somente
leitura; não há envio de mensagem ou formulário de corretor. Reutiliza o detalhe
Arc do corretor, o ChatScreen e o leitor escopado de conversas da equipe, sem token,
primitive ou animação nova. Registro:
`docs/implementations/active/2026-10-16-supervisor-lead-detail.md`. Tsc e testes
focados passaram; prévia Webpack não respondeu para capturar QA visual, pendente.

## 2026-10-14: T124, Gestor Lite com Leads como primeira etapa

Papel: Gestor (`manager`); objetivo: acompanhar e repassar leads da própria unidade.
Ação principal: abrir um lead e repassá-lo pelo fluxo existente para um corretor
ativo da unidade. Estados: unidade vinculada, unidade ausente com vazio explícito,
lead atribuído/sem corretor, sucesso e erro do repasse. Início apresenta uma conversa
"Leads da unidade"; Leads reutiliza o radar e o detalhe Lite do supervisor com
variante de gestão. A allowlist limita a experiência a Dashboard, Leads,
Notificações, Configurações e Primeiro acesso. Sem token ou primitive nova; nenhuma
transição nova. Drawers de feedback/agente e loaders de onboarding por rota/agenda
ficam ocultos como no Lite do corretor; onboarding geral de tenant e wizard existentes
permanecem. Registro: DEC-141 e
`docs/implementations/active/2026-10-14-manager-lite-leads.md`.

Adendo desktop T125: a coluna lateral do gestor usa os cinco destinos persistentes
Início, Leads, Equipe, Notificações e Configurações; abaixo de 1024px ela segue
oculta, preservando a navegação mobile existente. Reutiliza a coluna e os tokens
compartilhados do Lite, sem nova primitive, token ou regra de domínio.

## 2026-10-14: E4, Equipe e unidade no Lite

Papel: Gestor (`manager`) administra somente membros da unidade autenticada e o
Supervisor (`supervisor`) administra somente corretores da própria equipe. Em
`/equipe`, o gestor consulta corretores e convites da unidade, adiciona corretor
ou supervisor, revisa pedidos de transferência e abre perfis. Em
`/unidades/<branchId>`, consulta métricas, membros e ranking sem controles de
distribuição. Em `/equipe/minha`, o supervisor mantém suas abas e ganha convite
para criar corretor novo já vinculado à equipe. Ações principais: convidar,
aprovar ou recusar transferência, abrir perfil e consultar a unidade. Estados:
unidade ausente, listas vazias, convites pendentes, pedidos pendentes, envio,
sucesso, erro e carregamento. Disclosure: convites e decisões ficam em sheets ou
cards de ação; dados de operação e ranking permanecem em leitura. Reutiliza
primitivas Arc e tokens Lite existentes, com entrada da página, listas em
stagger, toque leve e reduced motion. Sem novo token ou primitive.

## 2026-10-14: T122, refinamento visual do aviso de WhatsApp

### T127 mobile follow-up

The daily WhatsApp modal gives the tilted phone illustration additional vertical space and a top inset, keeping the full device visible inside the existing art panel. No new token or component.

Papel: corretor sem WhatsApp conectado; ação principal: iniciar a conexão no
computador. O cartão diário usa um tile à esquerda e uma coluna de conteúdo à
direita, com a linha do computador e o CTA alinhados na mesma linha. O aviso de
Jack permanece em uma linha sticky de 60px no fluxo da conversa. Reutiliza o card,
tipografia, botão, tokens e entrada animada do tour Lite; ícone do WhatsApp verde,
foco visível e reduced motion respeitado. No celular, ambos ocultam o CTA e mostram
a orientação de computador; o daily mantém texto completo e X. Não altera
elegibilidade, flag, auditoria, armazenamento ou diálogo de conexão. Registro:
`docs/implementations/completed/2026-10-14-whatsapp-plantao-notice-lite-redesign.md`.

## 2026-10-13: T120, aviso de conexão do WhatsApp para o plantão

Papel: corretor (`broker`); objetivo: conectar o WhatsApp pessoal antes de 20/10;
ação principal: abrir o pareamento por QR no computador. Estados: conexão ausente,
aviso diário, aviso fechado até amanhã, orientação no celular, QR aberto e conectado.
O lembrete fixo fica no topo da conversa com Jack e não tem fechamento. O aviso diário
fica no topo do conteúdo do dashboard. A flag global do Super-admin controla ambos;
desativá-la não muda a distribuição. O refinamento visual T122 reutiliza card e
tipografia do tour Lite, `Button` e o diálogo de conexão existentes. Gap: o token
Deep Sapphire `#1e40af` descrito em
`docs/design-system.md` ainda não estava ligado à primitiva `Button`. Decisão: expor o
token documentado por uma variante compartilhada `deep-sapphire` e usá-la neste único
CTA. Registro:
`docs/implementations/completed/2026-10-13-whatsapp-plantao-notice.md`.

## 2026-10-10: T54, ligações da Jornada no corretor Lite

Papel: corretor no Lite; escopo autorizado pela Onda B do plano de Jornada. Ação principal em Configurações, Placar: escolher presença no placar da unidade. Switch Arc instalado, finalidade da exposição, estados pendente/sucesso/erro/indisponibilidade, confirmação no controle e foco de teclado compartilhado. Divulgação progressiva: seção no índice de Configurações, conversa Jornada e detalhes em `/jornada`. Sem token ou primitive nova. A missão de etapa reutiliza a barra e os tokens de movimento existentes, com reduced motion. Diretor/Gestor mantêm suas configurações normais. Registro: `docs/implementations/active/2026-10-10-jornada-ranking-v2-onda-b-ligacoes.md`.

## 2026-10-06 — Simulador demonstrativo de cotação do Corretor Lite

## 2026-10-10 - Pedido de transferencia entre equipes do supervisor

Papel: supervisor no Lite. Objetivo: pedir a transferencia de um corretor ativo de outra equipe na mesma unidade. Acao principal: escolher o corretor e explicar o motivo. A gestao decide em `/equipe`; estados: lista vazia, envio, confirmacao e erro. A equipe so muda apos aprovacao autorizada, com auditoria e limite de 30. Reutiliza Button, Textarea e tokens Lite existentes; sem nova primitive ou movimento. Registro: `docs/implementations/active/2026-10-10-lite-supervisor.md`, pacote P9.

## 2026-10-10 — Feedback 1 a 1 na ficha Lite do supervisor

Papel: supervisor; objetivo: registrar orientação, elogio ou alerta para um corretor da própria equipe e consultar o histórico. Ação principal: salvar um feedback curto; estados: formulário, envio, sucesso, erro e histórico vazio/preenchido. Diretor e Gestor consultam o histórico em cartão somente leitura, com autorização de equipe/unidade no servidor. Reutiliza Button, Textarea e tokens Lite existentes; sem nova primitive, token ou animação. Auditoria registra ator, tipo e alvo, sem copiar o texto pessoal para o log. Registro: `docs/implementations/active/2026-10-10-lite-supervisor.md`, pacote P3.

## 2026-10-07 — Reatribuição pelo drawer dentro do plantão

Correção funcional do drawer compartilhado de leads. Papel: Diretor/Gestor;
ação: escolher um corretor escalado na fila do lead; estado: consulta da escala,
roster disponível, vazio e erro. Com plantão ativo, o drawer esconde a seleção
de unidade e restringe a lista ao roster elegível da fila; sem plantão ativo,
preserva o fluxo genérico de transferência por unidade. Reutiliza Select, Label,
Button e auditoria existentes, sem novo token, primitiva ou animação. Regra já
aprovada em BR-024C/DEC-116. Registro:
`docs/implementations/completed/2026-10-07-lead-drawer-duty-reassignment.md`.

## 2026-10-06 — Transferência manual entre unidades

Refinamento funcional no drawer compartilhado de leads, sem avançar UX-M1.10.
Papel: Diretor/Gestor; ação principal: escolher unidade ativa de destino e um
corretor ativo daquela unidade. Estados: seleção, envio, sucesso e erro. Os dados
de origem/campanha permanecem visíveis como contexto; nenhuma nova primitive,
token ou animação é necessária. O servidor conserva o escopo e a permissão, e a
mudança segue auditável e governada pelo Super-admin. Contrato: DEC-133.

## 2026-10-02 — Inclusão de corretores desativados em plantões

DEC-130 aprovada: gestão pode selecionar cadastros desativados para a escala,
sem reativar acesso ou elegibilidade para leads. Papel: Diretor/Gestor na seleção;
Super-admin no controle reversível. Mantidos estados e componentes das listas;
o card existente de planejamento recebe formulário independente de política,
com checkbox/label e Button existentes. Sem novo token, variante ou movimento.
Preserva UX-M1.10 e a separação entre planejamento e prontidão operacional.
Registro: `docs/implementations/completed/2026-10-02-inactive-brokers-duty-roster.md`.

## 2026-10-02 — WhatsApp conectado no celular

Correção autorizada do diálogo compartilhado de conexão, sem avançar a etapa
global UX-M1.10. Papel: corretor; objetivo: usar a sessão já conectada e abrir o
WhatsApp do próprio aparelho. Estados: desconectado, pareando, conectado e erro.
O computador é necessário para o pareamento por QR, não para administrar uma
sessão pronta nem para abrir o app. Reutiliza Dialog, Button e PairingCallout;
sem nova primitive, token, animação ou alteração no escopo/autorização das ações.
Teste de regressão reproduziu o erro antes da correção. A auditoria legada
`docs/ux-audit-2026-07-13.md` está ausente; contrato e controle vigentes são a
referência deste ajuste.
Registro: `docs/implementations/completed/2026-10-02-whatsapp-connected-mobile.md`.

## 2026-10-02 — Confirmação de atribuição em verde

Hardening pontual autorizado pelo pedido do usuário, sem mudar a etapa global
UX-M1.10. Papel: gestão autorizada no drawer compartilhado de leads/plantão;
ação principal: confirmar a reatribuição após escolher o corretor. Mantém o
disclosure, dimensões, teclado/foco e estados sem seleção, disponível e pendente.
Gap: Button não possui variante afirmativa verde. Decisão: adicionar `success`
na base compartilhada usando os tokens semânticos existentes, escurecendo o fundo
no tema claro para contraste do texto, e aplicá-la apenas nesse CTA. Sem nova
animação, token, regra, permissão ou controle administrativo; auditoria e governança
da atribuição existente são preservadas. A referência legada
`docs/ux-audit-2026-07-13.md` não está presente; contrato e controle vigentes foram
usados para este refinamento exclusivamente visual.
Registro e evidências: `docs/implementations/completed/2026-10-02-lead-assignment-green.md`.

## 2026-10-01 — Movimento da biblioteca reutilizável

Hardening transversal UX-H1 autorizado pelo pedido atual, para operação, corretores
e gestão. Objetivo: reconhecer ações, seleção, carregamento e disclosure com feedback
rápido. Aplicação nas primitivas UI/DS/Unlumen e motion compartilhado; tabelas, filas,
métricas e estruturas permanecem estáticas. Estados: foco, pressionado, desabilitado,
pendência, confirmação, aberto/fechado, movimento reduzido e controle administrativo
desligado. Reutiliza a escala `transitions-dev` já instalada, sem nova biblioteca ou
token visual. Gap: tempos conflitantes, movimento JS sem controle uniforme e flag do
Super-admin ignorada na raiz. Decisão: consolidar os estados nas bases e reconectar a
flag existente sem bloquear o HTML por uma consulta ao banco. Registro:
`docs/implementations/completed/2026-10-01-shared-interface-motion.md`. Biblioteca
validada com harness full e QA sintético em 02/10/2026. QA transversal
autenticado UX-M1.10 continua sendo a etapa global pendente.

## 2026-10-01 — Central de qualidade de leads

Refinamento coeso do Dashboard gerencial: a aba “Qualidade” ajuda Diretor, Gestor,
Supervisor e Marketing autorizado a entender temperatura persistida, origem Meta,
perfil e resposta operacional. A ação principal é comparar recortes e abrir a
população de leads que os explica. A visão usa `/dashboard?tab=quality`, o período
na URL e o escopo já autorizado pelo servidor; o modo Lite permanece preservado.
Estados: loading, dados, período vazio, erro recuperável, capacidade desativada e
drill-down. Reutiliza `PageTabs`, `PeriodSelect`, Card, Badge e DataTable; sem nova
rota paralela, token ou primitive. A classificação não é recalculada; idade aparece
por faixa e o gasto Meta não é inferido. Registro:
`docs/implementations/completed/2026-10-01-lead-quality-center.md`. QA mobile UX-M1.10
permanece pendente.

## 2026-09-30 — Agenda de plantões do Corretor Lite

Nova rota `/plantoes`, mantendo o papel de corretor e a identidade visual Lite
protegida pela DEC-015. A ação principal é consultar a escala própria: calendário
mensal com dias escalados e agenda filtrada pela data; no desktop os painéis ficam
lado a lado e, no mobile, em fluxo vertical. Um plantão em foco recebe destaque
leve; detalhes são somente leitura em Sheet compartilhado. Estados: escala ativa,
plantão atual/em andamento, pausado, data sem escala e período vazio. Reutiliza
Calendar, Card, Badge, Button e Sheet; não cria primitiva, variante ou token global.
A transição local da agenda segue `transitions-dev/07-panel-reveal`, com movimento
reduzido. Sem nova regra de domínio; consulta limitada ao corretor autenticado e à
escala publicada. Controle global e horizonte configurável pelo Super-admin.
Registro: `docs/implementations/completed/2026-09-30-broker-lite-duty-calendar.md`.
O QA visual autenticado nas larguras UX-M1.10 permanece pendente.

## 2026-09-29 — Exportação estruturada do plantão

Refinamento pontual da operação de distribuição: Diretor/Gestor exportam a lista
do plantão em `.xlsx` usando a estrutura da planilha de referência. A ação fica
ao lado do PDF, preserva o escopo e registra auditoria. Registro:
`docs/implementations/completed/2026-09-29-plantao-export-spreadsheet.md`.

## 2026-09-29 — Anotações privadas por conversa

Correção de sincronização no painel contextual de `/conversas`: ao trocar o lead
selecionado, o campo recarrega a anotação daquele lead. Papel: operador de
atendimento; ação principal: consultar/editar contexto privado; estados: anotação
existente ou vazio. Sem alteração visual, de persistência ou de etapa UX. Registro:
`docs/implementations/completed/2026-09-29-conversation-private-notes-selection-sync.md`.

## 2026-09-29 — Linha inteira da lista de leads abre o sheet

Refinamento pontual da etapa UX-1E: o papel é operação comercial, a ação
principal é inspecionar um lead e os controles internos permanecem independentes.
Toda a linha da tabela de `/leads` abre o sheet compartilhado; checkbox, botões e
links não propagam a ação da linha. Registro:
`docs/implementations/completed/2026-09-29-leads-row-click-sheet.md`.

## 2026-09-29 — Drawer de lead no plantão

Refinamento pontual do detalhe do plantão: o papel é operação de distribuição,
a ação principal é inspecionar e agir sobre um lead da tabela, e os estados são
detalhe, carregamento/fechamento e atualizações otimistas. O drawer reutiliza o
mesmo componente de `/leads`, sem novo token, primitiva, rota ou regra de
negócio. Registro: `docs/implementations/completed/2026-09-29-plantao-lead-details-drawer.md`.

## 2026-09-29 — Funil do dashboard

Refinamento pontual em `/dashboard`: o papel é gestão/corretor em leitura da
operação, a ação principal é interpretar o fluxo de leads e os estados são
dados, vazio e saída terminal. A área de funil agora usa o componente
compartilhado `src/components/dashboard/funnel-chart.tsx`, sem novo token ou
mudança de etapa. Registro: `docs/implementations/completed/2026-09-29-dashboard-funnel-chart.md`.

## 2026-09-30 — Observação de investigação no sheet do lead

Refinamento pontual do detalhe compartilhado de `/leads` e do plantão: Diretor e
Gestor podem consultar, no resumo operacional, o motivo já registrado ao assumir
um lead para investigação. A leitura é sob demanda, restrita ao tenant e
auditada; corretores não recebem esse dado. Reutiliza o componente e tokens
existentes, sem nova primitive ou campo de persistência. QA mobile UX-M1.10
permanece pendente.

**Atualizado em:** 2026-09-25
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

Refinamento pontual no workspace de Leads (2026-09-29): leads em investigação
atribuídos à gestão recebem o estado visual `Investigação da gestão` na tabela e
no kanban, com destaque de superfície e badge, preservando o disclosure e as
ações existentes. Sem novo token ou primitiva; a regra de domínio é resolvida
no servidor. Registro: `docs/implementations/completed/2026-09-29-management-investigation-statistics.md`.

## Estado atual

Consolidação operacional da Meta (2026-10-07): Diretor/Gestor/Marketing autorizado
configura captura e fila somente no detalhe da campanha; a ação principal é
salvar destino e estado de captura. Estados: ativa com fila ativa, pausada,
salvando e falha; anúncios sincronizados e formulários com atribuição real são
listados e exibem herança da campanha, sem ações locais. A lista e a Central de Filas são leitura com link para a campanha; o
hub Meta mantém conexão/sincronização e o controle mestre de segurança fica
identificado como global. Foram reutilizados Card, Switch, AppSelect e Badge;
nenhum token/primitive foi criado e a etapa UX-M1.10 não avançou. Evidências:
`src/features/meta-ads/components/campaign-detail-view.tsx`,
`src/features/meta-ads/components/campaigns-dashboard-view.tsx`,
`src/app/(dashboard)/leads/distribuicao/_components/queues/meta-entries.tsx`.

Hardening pontual da navegação mobile (2026-09-28): no Sheet da sidebar gerencial, Diretor/Gestor e demais papéis autorizados encontram a mesma lista de destinos em área rolável; marca e usuário ficam em uma linha, controles contextuais abaixo e Agente IA/perfil empilhados no rodapé. A ação principal é escolher uma rota. Abertura, fechamento, foco e alvos de toque seguem as primitivas compartilhadas. Não há novo token, rota ou regra de domínio; UX-M1.10 segue pendente em viewports autenticados. Registro: `docs/implementations/active/2026-09-28-mobile-sidebar-responsiveness.md`.

Hardening pontual de feedback (2026-09-27): o botão compartilhado e a confirmação pública de presença exibem estado inicial, pendência, sucesso confirmado e retry após erro. Toast e badge animados passam a respeitar o controle de movimento já auditado do Super Admin e `prefers-reduced-motion`. Papel: corretor escalado; ação principal: confirmar presença; estados: pendente, confirmado e falha recuperável. Não há novo token, primitiva, rota ou regra de domínio. Plano e validação de viabilidade: `docs/ux/INTERACTION_FEEDBACK_GAMIFICATION_PLAN.md`; registro de implementação: `docs/implementations/active/2026-09-27-feedback-interaction-pilot.md`. UX-M1.10 continua pendente.

Correção pontual em `/distribuicao?view=plantao` (2026-09-27): Diretor/Gestor consultam o mês e veem total de dias com plantão, próximos/encerrados e dias sem cobertura por data distinta. A ação principal “Novo plantão” e a escala mensal permanecem; estado vazio mostra zero. Sem novo token, primitiva ou mudança de etapa. Registro em `docs/implementations/completed/2026-09-27-contagem-dias-plantao.md`.

Refinamento pontual em `/primeiro-acesso` (2026-09-26): papel membro convidado; ação principal confirmar identidade; data via calendário compartilhado e e-mail com borda visível. Estados vazio, escolhido, data futura desabilitada e e-mail fixado pelo convite preservados. Sem novo token, primitive ou mudança na etapa UX-M1.10. Registro em `docs/implementations/completed/2026-09-26-primeiro-acesso-calendario.md`.

| Campo | Valor |
|---|---|
| Etapa atual | UX-M1.10 — Mobile QA transversal |
| Estado | `IMPLEMENTATION_COMPLETE_QA_PENDING` |
| Protocolo de Governança | UX-GOV-1 (`UX_FOUNDATIONS.md`, `UX_DECISIONS.md`, `UX_CHANGELOG.md`, `UX_FUNCTIONALITY_MATRIX.md`) |
| Mudança visual autorizada | Hardening transversal UX-H1, centralização de mensagens em `/qualificacao` e piloto visual Efferd restrito ao dashboard gerencial; biblioteca única, sidebar preta, tabelas claras e auditoria por rota |
| Próxima ação obrigatória | Executar a matriz visual/interacional autenticada de M1.10 nas larguras 320, 360, 375, 390, 412 e 430px. O Corretor Lite permanece preservado pela DEC-015 |
| Bloqueios conhecidos | QA autenticado em dispositivos/viewports reais ainda pendente; roteamento Lite e navegação lateral mobile estão protegidos por regressão automatizada |

## Registro de etapas

| Etapa | Estado | Evidência | Próxima decisão |
|---|---|---|---|
| UX-1A — Auditoria | `COMPLETE` | `docs/ux/UI_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/audits/ROUTE_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/NAVIGATION_MAP.md`<br>`docs/ux/UX_FUNCTIONALITY_MATRIX.md`<br>`docs/ux/ACTION_MAP.md`<br>`docs/ux/FILTER_MAP.md`<br>`docs/ux/CONFIGURATION_AUTHORITY_MAP.md`<br>`docs/ux/COMPONENT_INVENTORY.md` | Iniciar UX-1B para refinamento e criação das fundações canônicas |
| UX-1B — Foundations/componentes | `COMPLETE` | `src/components/foundations/` (13 componentes)<br>`src/components/foundations/foundations.test.tsx` (11 testes 100% pass)<br>`docs/ux/UX_FOUNDATIONS.md`<br>Piloto: `src/features/branches/components/branches-manager.tsx` | Iniciar UX-1C (Sidebar & Navigation Restructure) |
| UX-1C — Sidebar & Navigation | `COMPLETE` | `src/components/corretop-sidebar.tsx` (Rail vertical com alto contraste e tiles canônicos)<br>`docs/ux/UX_DECISIONS.md` (DEC-001)<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1D (Dashboard Unificado) |
| UX-1D — Dashboard unificado | `COMPLETE` | `src/app/(dashboard)/dashboard/_components/executive-dashboard.tsx`<br>`src/app/(dashboard)/relatorios/_components/`<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1E (Workspace de Leads & Kanbans) |
| UX-1E — Leads workspace | `COMPLETE` | `src/app/(dashboard)/leads/`<br>`src/app/(dashboard)/leads/_components/leads-filters.tsx`<br>`src/app/(dashboard)/leads/leads-workspace.tsx`<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1F (Detalhe do Lead) |
| UX-1F — Detalhe do lead | `COMPLETE` | `src/app/(dashboard)/leads/[id]/page.tsx`<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1G (Documentos) |
| UX-1G a UX-1J | `NOT_STARTED` | — | Seguir a ordem estrita do contrato |
| UX-H1 — Padronização transversal | `CRM_CODE_COMPLETE_WITH_LITE_EXCEPTION` | `docs/ux/DESIGN_SYSTEM_MANUAL.md`<br>`docs/ux/COMPONENT_STANDARDIZATION_PLAN.md`<br>`docs/ux/audits/ROUTE_COMPONENT_CATALOG.json`<br>`scripts/ui/audit-ui-components.ts`<br>DEC-015 preserva o visual clássico do Corretor Lite | Executar QA visual/funcional autenticado; abrir ondas separadas para Corretor Lite, Super Admin, dev, auth e público |
| UX-M1 — Mobile Experience | `CODE_COMPLETE_QA_PENDING` | `docs/ux/mobile/MOBILE_UX_AUDIT.md`<br>`docs/ux/mobile/MOBILE_PATTERNS.md`<br>`docs/ux/mobile/MOBILE_FUNCTIONALITY_MATRIX.md`<br>`src/features/broker-workspace/broker-lite-experience.test.tsx`<br>`docs/implementations/active/2026-09-05-mobile-experience-m1.md`<br>DEC-016 | Executar M1.10 e só então marcar funcionalidades como `PRESERVED` |

## 2026-09-26 — Refinamento das integrações

- Etapa UX-H1. Em WhatsApp, Diretor navega entre Oficial e Diretoria; a segunda visão amplia e centraliza os cartões sem alterar as ações. O aviso de proteção removido era apenas texto da aba Oficial.
- Em `/integrations/meta`, o painel operacional torna-se o primeiro conteúdo. Os cards editoriais removidos não tinham controles; conexão, autorização, estados e ativos permanecem. Sem novos tokens ou primitives. Evidência: `docs/implementations/active/2026-09-26-whatsapp-integration-tabs.md`.
- QA mobile transversal UX-M1.10 continua pendente.

## 2026-09-26 — Refinamento de Qualificação

- Refinamento UX-H1 em `/qualificacao`, para Diretor e demais perfis já autorizados. Ação principal: salvar configurações; estados existentes de IA ativa/pausada e painéis preservados.
- Disclosure: abas horizontais com rolagem no mobile, indicadores apenas na aba inicial e conteúdo das demais abas sob demanda. Cards com a variante neutra compartilhada, sem novos tokens ou primitives.
- Evidência: `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx`, painéis de roteiros/permissões, `docs/implementations/active/2026-09-26-qualificacao-distribuicao-visual.md`. QA mobile UX-M1.10 transversal permanece pendente.

## 2026-09-26 — Histórico de ocorrências encerradas

- Refinamento transversal UX-H1: a integração WhatsApp agora organiza Meta e Diretoria em abas na mesma rota, preservando papel e controles existentes; o título grande duplicado saiu do conteúdo. A Distribuição abre em Resumo. O detalhe do plantão ativo/encerrado padroniza hierarquia e badges. Registro em `docs/ux/UX_CHANGELOG.md` e `docs/implementations/active/2026-09-26-whatsapp-integration-tabs.md`; QA mobile UX-M1.10 continua pendente.

- Refinamento pontual de UX-H1 no detalhe do plantão: datas encerradas em navegação compacta e consulta em leitura por data. Diretor vê o tenant; Gestor fica no escopo da unidade. O estado “Terminado” identifica a ocorrência, sem mudar o status da regra recorrente.
- Estados: sem ocorrências, data inválida, histórico vazio, vínculo estimado ou confirmado, e capacidade desativada pelo Super-admin. Sem novo token ou primitiva; QA M1.10 continua pendente.

## 2026-09-26 — Planejamento mensal de plantão em sheet

- Refinamento pontual da etapa UX-H1 em `/distribuicao?view=plantao`: resumo compacto na página e cotas/revisão por mês no sheet compartilhado, sem novo token ou primitiva.
- Papel: Diretor e Gestor; ação principal: planejar e publicar escala mensal; estados: sem proposta, carregamento, erro, rascunho, parcial, publicada e desativada. Detalhes dos corretores ficam sob demanda.
- Evidências: `src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx`, `docs/implementations/active/2026-09-26-duty-scheduling-quotas.md` e `docs/ux/UX_CHANGELOG.md`. A matriz autenticada UX-M1.10 ainda é obrigatória.

## 2026-09-25 — Unificação da gestão de equipe e unidades

- Implementação visual limitada à reorganização das listas e navegação existentes; permissões e fluxos de negócio seguem os contratos atuais.
- Evidências: `docs/implementations/active/2026-09-25-unificacao-equipe-unidades-ui-plan.md`, `src/app/(dashboard)/equipe/`, `/dev/component-preview`.
- O QA autenticado em larguras M1.10 continua sendo a próxima etapa global obrigatória; esta mudança não encerra UX-M1.

## 2026-09-07 — piloto Efferd no dashboard gerencial

- O bloco `@efferd/dashboard-2` foi instalado como referência e curado para a
  arquitetura existente: o shell, a sidebar e os dados fictícios do exemplo não
  entram no produto.
- `DashboardGrid` e `DashboardCard` concentram a linguagem visual do piloto:
  superfícies contínuas, divisores de 1 px, ausência de sombra e maior densidade.
- KPIs de Visão geral, Comercial e Financeiro, além de Funil e Atenção, adotam
  a composição sem alterar métricas, escopo, permissões, URL ou consultas.
- A experiência do Corretor Lite permanece fora do piloto conforme DEC-015.
## 2026-10-13: T121, retenção de leads frios por fila

Papel: Diretor/Gestor na configuração da fila e no plantão; objetivo: manter
leads frios sem proprietário para decisão manual. Ação principal: ligar ou
desligar a retenção por fila. Estados: ligado/desligado, lead frio retido,
simulação com retenção e atribuição manual permitida. Reutiliza Checkbox, Badge,
simulador e relatório existentes; sem token, primitive ou movimento novo. A
leitura e a gravação da política permanecem escopadas pelo tenant. Registro:
`docs/implementations/completed/2026-10-13-cold-leads-per-queue.md`.
## 2026-10-14: T125, Lista e perfil Lite de equipe

Papel e rotas: gestor em `/equipe` e `/equipe/<id>`, limitado aos corretores da
unidade; supervisor permanece em `/equipe/minha` e no perfil dos corretores com
`supervisorId` próprio. Ações principais: abrir perfil, enviar recado e executar
operações básicas explicitamente autorizadas. Estados: lista com busca/contadores,
sem unidade, sem resultados, convite pendente, perfil fora do escopo e ação com
confirmação/sucesso/erro. Disclosure por menu do card e por seções do perfil; os dias
de plantão ficam somente para leitura. Reutiliza as peças Arc/Lite e o perfil atual;
sem novo token, primitive ou animação. Decisão de produto: DEC-142. A revisão não
avança a etapa global UX-M1.10.


## 2026-10-14: T126 Manager Lite chat rail

Desktop manager home uses the shared conversation rail on the left and the unit summary at center. Primary actions open Leads da unidade and Minha unidade. Mobile navigation stays as before. Reuses ChatHome styles, tokens, and components without adding a primitive, token, or animation.

### T126b: desktop parity with broker Lite

The manager desktop now uses the broker's existing header controls, Assistentes/Leads tabs, count badge, and conversation row components. The list and four home metrics use only the authenticated manager's tenant and unit scope. Mobile behavior is unchanged. No new token or primitive.

## 2026-10-14: T127, aviso diário de WhatsApp em modal

Papel: corretor; objetivo: conectar o WhatsApp para receber leads do plantão.
O aviso diário usa o `Dialog` compartilhado, com foco e fechamento por Escape;
o CTA “Agora não” mantém o fechamento diário e a auditoria existentes. Desktop:
texto e ilustração em duas colunas. Celular: ilustração acima, orientação de
conexão e “Entendi”. O aviso compacto do Jack, a audiência, a flag, a conexão e
o armazenamento local permanecem iguais. Nenhum token, componente-base,
variante ou movimento novo; sem avanço da etapa global UX-M1.10. Registro:
`docs/implementations/completed/2026-10-14-whatsapp-plantao-notice-modal.md`.

## 2026-10-14: E2, Clientes no Lite do gestor e supervisor

Papel: gestor e supervisor; objetivo: ver clientes da unidade ou da equipe no Lite.
Lista com título grande, dois blocos de contagem e entrada escalonada; ficha do
cliente com contato, renovação (leitura), vendas, beneficiários, documentos e linha
do tempo. Gestor pela flag `MANAGER_LITE`; supervisor pela `SUPERVISOR_LITE`.
Corretor sem mudança de layout: a lista compacta continua e só ganha a entrada
animada. Pendências: skeleton Lite no carregamento da rota (`loading.tsx` ainda é o
genérico), prints lado a lado com a tela do corretor e ação de renovação com escopo
de equipe (E0). Registro: DEC-143.
## 2026-10-14: E4, equipe e unidade no Lite

Papéis e rotas: gestor em `/equipe` e `/unidades/<branchId>`, limitado à unidade
autenticada; supervisor permanece em `/equipe/minha` e na equipe vinculada ao seu
`supervisorId`. Ações principais: aprovar transferências, convidar pessoas dentro
do escopo e consultar métricas da unidade. A tela da unidade é somente leitura;
configuração de filas, disponibilidade e escala ficam fora desta etapa. Estados:
carregamento com skeleton compartilhado, lista, convites pendentes, transferência,
unidade vazia, ausência de dados e erro recuperável. Disclosure por sheet de convite
e ações individuais; abas usam `SegmentedControl` compartilhado. Reutiliza Arc, Lite,
`motion/react`, `useReducedMotion` e tokens existentes, sem nova primitive ou token.
O visual Lite continua claro, sem tema escuro. Prints sintéticos desktop e celular
ficam em `tmp/e4/`; a etapa não avança a UX-M1.10.

## 2026-10-15: G6, destaques e evolucao da equipe

Papeis e rotas: gestor em `/gestao` (unidade) e supervisor em `/gestao` (equipe propria); linha do tempo no perfil Lite `/equipe/[id]`. Acoes: consultar resumo dos ultimos sete dias, abrir o perfil destacado e, somente para supervisor, reconhecer corretor com motivo. Estados: sem historico, sem destaques, timeline indisponivel antes da migration, envio/sucesso/erro no reconhecimento existente. Disclosure no card semanal e tabela mensal. Reutiliza Card, Select, Button, Avatar e RecognizeSheet existentes, sem novo token, primitive ou animacao. Escopos continuam derivados no servidor e ranking_opt_out remove o corretor dos destaques automaticos.
