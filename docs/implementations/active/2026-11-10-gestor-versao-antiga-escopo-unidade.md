# Gestor volta para a versão antiga, só com a gestão da unidade (10/11/2026)

**Pedido do Vinicios (10/11, literal):** "Preciso que planeje agora para que o gestor ele volte para a versão antiga,
porém removendo todas as coisas de configuração de sistema e deixando disponível somente as coisas relacionadas à
gestão da unidade dele, corretores dele, plantões que alguém da unidade dele está (sem mostrar info de outros
corretores de outras unidades) etc."

**Decisões complementares do Vinicios (10/11):**
- "Distribuição, conversas de qualificação, comercial, leads em geral, marketing, atendimento IA etc. pode remover do
  cargo dele."
- "Faça isso agora, e deixe pós-venda pra depois." Pós-venda sai do gestor por enquanto.

Base: `origin/feat/diretor-visual-lite` (ec46ff0d). Código em `feat/gestor-versao-antiga`.

## 1. Objetivo e decisões

### O que é "versão antiga" no código

Hoje existem duas camadas "Lite" que alcançam o gestor:

1. **Lite do gestor** (telas próprias em `src/features/manager-workspace/*`, chrome `LightChrome`). Liga com a chave
   global `feature_manager_lite_enabled` (`src/shared/feature-flags/catalog.ts:203`), que está **ligada em produção**.
   Com ela o gestor é forçado ao modo LIGHT (`src/features/broker-workspace/experience-mode.ts:59-62`) e não consegue
   voltar (`experience-mode.ts:108-113`). O layout usa o chrome Lite (`src/app/(dashboard)/layout.tsx:203-214`) com a
   lista `LIGHT_MANAGER_ALLOWED_ROUTES` (`src/components/light/light-routes.ts:59-83`).
2. **Visual Lite do diretor** (skin Arc nas telas internas, `src/components/arc/*`, `useDirectorLitePage`,
   `director-lite-routes`). Liga por empresa com `feature_director_lite_style_<tenant>` (ligada na Âncora Saúde) e
   valia para todo papel no modo normal **exceto** corretor e supervisor (`src/features/director-lite/style-flag.ts:27`).
   Ou seja: se só desligássemos o Lite do gestor, ele cairia no modo normal **com a skin Arc do diretor**.

"Versão antiga" = modo NORMAL (sidebar `CorreTopSidebar`, telas legadas) **sem** a skin Arc. É o que o gestor via
antes de 25/10.

### Como trocar (decidido pelo recomendado: regra por papel, não toggle por usuário)

- `getExperienceMode` devolve sempre NORMAL para `role = manager`; `setExperienceModeAction` recusa LIGHT para o gestor.
- `isManagerLiteAvailable` passa a devolver `false` (a chave `feature_manager_lite_enabled` deixa de valer; as telas
  Lite do gestor ficam no código para uma volta futura).
- `manager` entra em `DIRECTOR_LITE_EXCLUDED_ROLES` (`style-flag.ts`): a skin Arc nunca vale para o gestor. Diretor
  continua com o Lite.
- Por que regra por papel: são 4 gestores na Âncora, todos com o mesmo pedido; toggle por usuário seria mais uma
  configuração para manter, e o toggle de modo hoje não aparece em lugar nenhum (`dashboard-header.tsx:66`, prop
  `showModeToggle` sem chamador).

**Quem é "gestor" aqui:** papel `manager` fora das funções marketing e financeiro (que também usam o papel
`manager`, ver `style-flag.test.ts`). Helper `isOutsideManagerScope(role, jobTitle)` em `manager-scope/manager-routes.ts`.
Sem a função informada conta como gestor (fail closed). Em produção nenhum `manager` tem função marketing/financeiro;
a outra empresa tem 9 gestores com função `broker`, que contam como gestor.

## 2. O que o gestor VÊ e o que NÃO vê mais

Fonte única: `src/features/manager-scope/manager-routes.ts` (`MANAGER_ALLOWED_ROUTES`). Fail closed: rota fora da
lista é negada no servidor.

### Allowlist (menu e rotas)

| Área do menu | Aba | Rota | Escopo |
|---|---|---|---|
| Início | Painel | `/dashboard` | métricas por `leads.branch_id` da unidade (`metric-scope.ts:116-138`, fail closed sem unidade) |
| Equipe | Pessoas | `/equipe`, `/equipe/[id]`, `/equipe/convidar`, `/unidades/[id]` | membros e leads da unidade (`equipe/page.tsx:50-63`; perfil `member-profile.ts:79-81`) |
| Equipe | Plantões da unidade (nova) | `/equipe/plantoes`, `/plantoes/corretor/[id]` | só plantões com corretor da unidade, só esses corretores |
| Configurações | Ajustes | `/settings` (abas Conta e Segurança) | própria conta |
| (fora do menu) | | `/leads/[id]`, `/notificacoes`, `/primeiro-acesso`, `/welcome`, `/access-denied` | lead só da unidade (`lead-authorization.ts:114-133`) |

### O que sai do gestor (com o que existia antes)

| Área | Rotas | Como estava | Agora |
|---|---|---|---|
| Configuração do sistema | `/integrations*`, `/settings/*` (subpáginas), abas Unidade/Atendimento/WhatsApp/Integrações de Ajustes, `/assinatura`, `/guia*`, `/configuracoes/*`, `/equipe/cargos`, `/equipe/recuperacoes`, `/internal/*` | `/assinatura` e `/guia/webhook` sem guarda de papel; feedback da empresa editável pelo gestor (`settings/feedback-actions.ts:15`); Ajustes mostrava Integrações porque o gestor tinha `ver_importacoes_meta` (`settings/page.tsx:61,81`) | bloqueado; feedback só diretor |
| Distribuição | `/distribuicao*`, `/leads/distribuicao*`, plantão do diretor `/leads/distribuicao/plantao/[id]` | o menu mostrava as 5 abas de `/distribuicao` (`nav-registry.ts:87-92`) mas o layout já negava (`leads/distribuicao/layout.tsx:6`), então o "Plantão da unidade" do Lite caía em acesso negado | bloqueado; ações de fila, regra, SLA, plantão, escala, troca e modo da fila recusam o gestor |
| Conversas de qualificação | `/conversas*`, `/mensagens*`, qualificação em massa | página aceitava o gestor | bloqueado |
| Comercial | `/vendas`, `/propostas`, `/negociacoes`, `/clientes*`, `/documentos`, `/configuracoes/comissoes`, `/ferramentas*` | tudo aberto ao gestor | bloqueado |
| Leads em geral | `/leads`, `/leads/arquivados`, `/leads/dashboard`, ações em lote | lista da unidade | bloqueado (o lead da unidade abre pelo perfil do corretor) |
| Marketing | `/marketing*` | já negado no layout (`marketing/layout.tsx`) | segue bloqueado; capacidades removidas |
| Atendimento IA | `/qualificacao*`, `/atendimento*`, `/fluxos-whatsapp`, `/assistente`, Agente IA da sidebar | `/atendimento/*` e `/fluxos-whatsapp` aceitavam o gestor; Agente IA aberto | bloqueado; Agente IA recusa o gestor (403) |
| Pós-venda | `/equipe/pos-venda` | aberto com a chave | bloqueado (volta depois) |
| Outros | `/noc`, `/relacionamento`, `/relatorios*`, `/dashboard/drill/*`, `/empresas`, `/integridade`, `/tarefas`, `/cotacao`, `/filiais`, `/gestao*` | variados | bloqueado |

### Enforcement no servidor (não só esconder menu)

1. **Layout do painel** (`src/app/(dashboard)/layout.tsx`): gestor fora da allowlist vai para `/equipe` (carga
   completa da página).
2. **Layout de cada área bloqueada** (novo `layout.tsx` com `redirectManagerAway()`, `src/features/manager-scope/deny-manager.ts`):
   cobre a navegação por link dentro do app, em que o layout do painel não roda de novo.
3. **Capacidades do papel** (`src/shared/auth/permissions.ts`): o gestor perde `acessar_qualificacao_ia`, as 7 de
   distribuição (`lead_queues_*`, `distribution_*`, `duty_schedules_manage`, `leads_bulk_assign`,
   `leads_route_to_unit`) e as de marketing/integração (`importar_*`, `ver_importacoes_meta`,
   `acessar_campanhas_meta`, `acessar_integracao_meta`, `gerenciar_materiais_divulgacao`).
4. **Ações e APIs**: `isOutsideManagerScope(role)` antes das checagens antigas em distribuição
   (`lead-distribution/{actions,duty-actions,roster-actions,monthly-duty-actions,duty-swap-actions,duty-roster-pending-actions,routing-actions,sla-actions,broker-summary-actions,control-service,queue-mode}.ts`,
   `manager-unit-scope-server.ts`), ações em lote de leads (`leads/status-actions.ts`), qualificação em massa
   (`ai-qualification/bulk-qualification-actions.ts`), distribuição automática da unidade (`branches/actions.ts`),
   relatórios de distribuição, plantão e escala (`api/reports/*`), exportação de comissões, Agente IA.
5. **Menu** (`src/shared/navigation-access.ts`): a lista fixa `managerHiddenPaths` virou a allowlist; aba nova
   "Plantões da unidade" (`nav-registry.ts`, só `manager`).

## 3. Escopo da unidade

**Unidade do gestor = `tenant_memberships.branch_id` da sessão** (`tenant-context.ts:95`). A tabela
`tenant_manager_branches` **não existe em produção** (medido); o código que a lia sem `catch`
(`supervisor-workspace/transfer-actions.ts:40,102,216`) quebrava o painel de transferências do gestor no modo normal
e o aviso de transferência para todos. Passa a usar só a unidade da sessão.

**Corretor da unidade = unidade ATUAL do vínculo**, nunca a unidade gravada na escala (`duty_roster_assignments.branch_id`
diverge da atual em 47 escalas, medido) nem `broker_profiles.branch_id`. Helper: `manager-scope/unit-brokers.ts`.

**Gestor sem unidade**: tudo vazio (fail closed). Corrigidos os pontos que abriam a empresa toda: exportação de
relatório (`reports/report-export-service.ts:88-92`), comissões, busca.

### Regras por área

- **Equipe e perfil**: já escopados no modo normal. Ajustes: placar do perfil (`equipe/[id]/page.tsx:233`) comparava
  com a empresa toda, agora só com a unidade; gráfico de membros por mês (`equipe/page.tsx:192-196`) era da empresa
  toda, agora da unidade; criar acesso (`team/create-user.ts:46`) só checava a unidade no Lite, agora sempre.
- **Plantões** (`/equipe/plantoes`, `manager-scope/unit-duty-{domain,queries}.ts`):
  - aparece o plantão (numa data, hoje e próximos 7 dias) em que **pelo menos um corretor da unidade** está escalado;
  - dentro dele, **só os corretores da unidade** (nome, horário, pausado); nada de nome, telefone ou contagem de
    corretores de outras unidades;
  - plantão da empresa toda e fila compartilhada: tratados igual, o filtro é pelo corretor (em produção todos os 270
    plantões ativos são da empresa toda, e 92% das ocorrências misturam unidades);
  - escala mensal publicada vence a semanal no mesmo plantão e data;
  - só leitura; "Ver plantão agora" abre `/plantoes/corretor/[id]` (já escopado à unidade,
    `broker-workspace/team-member-duty-now.ts:18-40`), com os leads daquele corretor.
  - A tela de plantão do diretor (`/leads/distribuicao/plantao/[id]`) segue fechada ao gestor: ela lista toda a escala
    e todos os leads da ocorrência.
- **Lead**: só `/leads/[id]` da unidade (escopo já existente). Os seletores de redistribuição no lead
  (`leads/management-actions.ts:102-131`) listavam todos os corretores da empresa (pós-venda) ou do plantão da fila;
  agora só os da unidade.
- **Busca global**: gestor só vê leads e pessoas da unidade (clientes e tarefas saíram); sem unidade, só funcionalidades.
- **Notificações**: gestor deixa de receber o que não é da unidade dele: lead sem unidade
  (`notifications/send-push-helper.ts:283-288,388-393`), renovação e documento sem unidade, exceção da fila de efeitos
  (`lead-effect-outbox.ts:116-123`), escalonamento de feedback da empresa toda (`feedback-reminders.ts:268-293`),
  revisão de foto de presença (`duty-presence.ts:558-568`). Foto de presença (`api/duty/presence/photo/route.ts:32`):
  só de corretor da unidade atual.

## 4. Vazamentos encontrados (por risco) e o que foi feito

| # | Risco | Onde | Vazamento | Correção |
|---|---|---|---|---|
| 1 | Alto | `agent-drawer/mcp-tools.ts:124-205,254` | Agente IA: `get_branch_queue_summary` aceita qualquer `branchId` (nomes de leads), plantão e funil da empresa toda | Agente IA recusa o gestor (rota 403, botão e drawer escondidos); ferramentas de unidade só diretor/supervisor |
| 2 | Alto | `ai-qualification/bulk-qualification-actions.ts:59-118` | Qualificação em massa lista nome e telefone de leads da empresa toda e dispara IA em leads de outras unidades | recusa o gestor |
| 3 | Alto | `leads/status-actions.ts:58-85,197-213,313-366,427-432` | Ações em lote puxam lead de outra unidade para a própria (só a unidade de destino era checada) | recusa o gestor |
| 4 | Alto | `report-export-service.ts:87-92`, `export/commissions/route.ts:29`, `api/search/route.ts:69,79`, `duty/presence/photo/route.ts:32` | Gestor sem unidade exportava/buscava a empresa toda | fail closed; comissões fora do gestor |
| 5 | Médio | `leads/management-actions.ts:102-131` | Seletor lista todos os corretores da empresa | só da unidade |
| 6 | Médio | `duty-presence.ts:558-568`, `photo/route.ts:32` | Foto de presença de plantão da empresa toda visível a qualquer gestor | só corretor da unidade; revisão só diretor |
| 7 | Médio | `send-push-helper.ts`, `renewal-reminders.ts:148`, `documents/actions.ts:294`, `lead-effect-outbox.ts:116`, `feedback-reminders.ts:268` | Notificação de lead/cliente de outra unidade para todos os gestores | só a unidade, ou só diretor |
| 8 | Médio | `api/reports/duty-schedule/[id]`, `duty-escala/[planId]`, `distribution-summary` | Relatório do plantão com a escala inteira | fora do gestor |
| 9 | Médio | `conversas/page.tsx:852-891` | Aba de corretores por `broker_profiles.branch_id` (pode divergir) | `/conversas` fora do gestor |
| 10 | Baixo | `equipe/[id]/page.tsx:233`, `equipe/page.tsx:192` | Placar e tendência da empresa toda | escopados |
| 11 | Baixo | `dashboard/page.tsx:122`, `reference-data.ts` | Nomes de filas/unidades da empresa toda em filtros | parte saiu com as telas; aba Qualidade do Painel ainda lista filas (pendência) |
| 12 | Escrita | `team/create-user.ts:46` | Gestor no modo normal criava acesso em outra unidade com `branchId` forjado | checado sempre |
| 13 | Bug | `transfer-actions.ts:40,102,216` | `tenant_manager_branches` inexistente derrubava transferências | unidade da sessão |
| 14 | Bug | `light-routes.ts:114` + `leads/distribuicao/layout.tsx:6` | "Plantão da unidade" do Lite caía em acesso negado | substituído por `/equipe/plantoes` |

## 5. Fases de entrega

1. **F1 visual**: gestor sempre no modo normal, sem skin Arc (experience-mode, lite-audience, style-flag).
2. **F2 rotas e menu**: allowlist, layout do painel, layouts das áreas, menu, Ajustes, capacidades.
3. **F3 ações**: distribuição, lote de leads, qualificação em massa, Agente IA, relatórios, feedback.
4. **F4 escopo**: plantões da unidade (tela nova), placar e tendência, seletores, busca, notificações, foto,
   transferências, criação de acesso, sem unidade = vazio.
5. **F5 (depois)**: pós-venda do gestor; decidir se a Gestão (`/gestao`, hoje só no Lite) ganha versão no modo normal.

## 6. Testes

- `manager-scope/manager-routes.test.ts`: matriz de rotas (liberadas x bloqueadas, incluindo todas as áreas da
  decisão), menu do gestor (só Painel, Pessoas, Plantões da unidade, Ajustes), toda aba visível é rota liberada,
  diretor mantém as áreas, capacidades removidas só do gestor.
- `manager-scope/unit-duty-domain.test.ts`: plantão da empresa toda com corretor da unidade aparece só com ele;
  sem corretor da unidade não aparece; escala mensal vence a semanal; validade e pausa; sem nome de outra unidade.
- `manager-scope/deny-manager.test.ts`: layout das áreas bloqueadas (gestor com e sem unidade vai para `/equipe`;
  diretor, supervisor, corretor, marketing e financeiro passam).
- Testes existentes ajustados onde a regra mudou: experience-mode, lite-audience, style-flag, navigation-access,
  nav-registry (pós-venda), busca, modo da fila, escala e corretor online no plantão.
- Resultado (10/11): `tsc --noEmit` limpo; eslint sem erros nos arquivos tocados; vitest completo com as mesmas
  falhas da base `ec46ff0d` (14 arquivos, nenhuma nova).
- Matriz manual antes do merge (papel x unidade): diretor (tudo), gestor Matriz 7° Andar, gestor Niterói 1, gestor
  sem unidade (tudo vazio), supervisor e corretor (sem mudança).

## 7. Riscos

- **Gestor perde ferramentas que usava** (lista de leads da unidade, conversas da unidade, plantão exclusivo da
  unidade criado em 05/11): é o pedido; a volta é pelo diretor. Comunicar aos 3 gestores reais antes do deploy.
- **Telas do Lite do gestor ficam mortas no código** (`manager-workspace/*`): sem custo de execução; remover depois
  se a volta não for planejada.
- **Painel (`/dashboard`) tem links para áreas bloqueadas**: o clique leva para `/equipe`. Limpar os atalhos é
  pendência visual.
- **Ações de um lead da unidade** (status, mensagem, redistribuição para corretor da unidade) continuam abertas no
  `/leads/[id]`: escopadas à unidade, mas não são "só leitura". Ver decisão 1.

## 8. Decisões tomadas pelo recomendado

1. **Lead da unidade**: o gestor abre o lead do corretor da unidade (a partir do perfil) e mantém as ações já
   escopadas no lead; a lista geral `/leads` sai. *(decidido pelo recomendado)*
2. **Gestão (`/gestao`)**: fica fora por enquanto (só existe no visual Lite); o modo normal já tem Equipe, perfil e
   unidade. *(decidido pelo recomendado)*
3. **Plantões**: só leitura para o gestor; criar, editar, escalar e trocar ficam com o diretor. *(decidido pelo
   recomendado)*

## 9. Números de produção (leitura, 10/11)

- Chaves: `feature_manager_lite_enabled = true`, `feature_supervisor_lite_enabled = true`,
  `feature_director_lite_style_<Âncora Saúde> = true`, `feature_team_management_enabled = true`,
  `feature_post_sale_audit_enabled = true`.
- `tenant_manager_branches`: **não existe** (`to_regclass` nulo).
- Âncora Saúde: 5 diretores, **4 gestores** (Madureira 2 - Robson, Matriz 7° Andar, Niterói 1 - Luiz Leopoldo,
  Unidade Testes), 7 supervisores, 239 corretores em 15 unidades. Todos os gestores com `preferred_experience_mode =
  LIGHT` e sem cargo personalizado. Outra empresa ("Ancora Corretora") tem 12 vínculos com papel gestor, 2 sem unidade.
- Plantões: 270 ativos, **todos da empresa toda** (`branch_id` nulo). Nos 61 dias em volta de hoje, 147 ocorrências
  com escala datada; **135 (92%) misturam unidades**, média de 3,8 unidades por ocorrência.
- Por gestor (mesma janela): Matriz 7° Andar em 75 ocorrências (107 vagas da unidade de 476 no total); Niterói 1 em 42
  (49 de 249); Unidade Testes em 11 (12 de 67); Madureira 2 em nenhuma.
- Escalas cuja unidade gravada difere da unidade atual do corretor: 47 (de 1.322). Escalas semanais (sem data): 426.
- Não há log de visita por tela. O único evento de leitura de gestor nos últimos 30 dias é
  `team_management_metrics.viewed` (17 vezes); os demais eventos atribuídos a gestores são automações.
