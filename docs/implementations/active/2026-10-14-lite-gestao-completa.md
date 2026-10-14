# Plano: gestão completa no Lite (gestor e supervisor)

> Pedido do Vinicios em 2026-10-14. Base: `feat/diretor-visual-lite`.
> Status: ativo. Dono da execução: Maestro (coordena), Cinzel e Vigia (executam), revisão cruzada entre eles.

## 1. Objetivo

Levar para o Lite do **gestor** (diretor da própria unidade) e do **supervisor** (a própria equipe) **todas** as funcionalidades de gestão que existem hoje no modo diretor, sem perder nenhuma função, com o design e o estilo do Lite **obrigatoriamente** e sem falhas.

O que for construído aqui será reaproveitado quando o diretor geral migrar para o Lite.

**Fica de fora (continua só no modo diretor):**
- Específico do diretor geral (visão da empresa inteira): `/leads/arquivados`, `/equipe/recuperacoes`, `/roadmap`, comparativo entre unidades.
- Marketing: `/marketing/*`, campanhas e importações Meta, `/integrations/meta`.
- Configurações do tenant: `/integrations/*`, `/qualificacao`, `/atendimento/*`, `/fluxos-whatsapp`, `/equipe/cargos`, `/filiais`, `/assinatura`, `/settings/feedback-templates`, `/settings/waha-diagnostic`, `/guia/webhook`, aba "empresa" de `/settings`, regras de comissão do tenant, definição de filas, roteamento e regras de DDD.

**Fica dentro:** tudo de gestão de unidade e de equipe (lista completa por etapa abaixo).

## 2. Regras que valem para TODAS as etapas

### 2.1 Escopo (não negociável)
- Gestor: só a unidade dele (`getManagerUnitScope`, `branchId === context.branchId`). Gestor sem unidade = tela vazia, nunca a empresa.
- Supervisor: só a equipe dele (`supervisorId = me`, `inSupervisorTeam`, `getSupervisedBrokerIds`). Nunca a unidade inteira.
- Sempre `tenantId` da sessão. Toda leitura e **toda ação** re-checa o escopo no servidor (wrapper Lite), nunca confiar no cliente.
- Preferir os helpers existentes: `buildLeadScopeWhere`, `buildClientScopeWhere`, `resolveReportDataScope`.

### 2.2 Design Lite (obrigatório)
- Só componentes e CSS do Lite: `light-chrome`, chat rail (`useDesktopChatRail`), `chat-home`, `thread-row`, `chat-screen`, componentes Arc (`bottom-sheet`, `metric-card`, `segmented-control`, `search-field`, `empty-state`, `skeleton`...), CSS modules de `supervisor-workspace` e `manager-workspace`.
- Nenhuma tela de gestor/supervisor pode renderizar o visual do modo normal dentro do chrome Lite.
- Desktop: rail de conversas à esquerda igual ao corretor (referência `tmp/ref-rail-lite-corretor.png`). Celular: navegação inferior e "Mais".
- Números em blocos cinza arredondados, uma ação principal por tela, sheets para ações, estados vazios e de carregamento em toda tela.
- Acessibilidade: teclado, foco visível, contraste AA, `prefers-reduced-motion`, sem scroll horizontal em 390px.
- Avisos/banners: modal 2 colunas com ilustração (padrão do aviso do WhatsApp, T127).
- Copy pt-BR, sem travessão.

### 2.3 Rotas e chaves
- Cada rota nova entra com regex exata em `LIGHT_MANAGER_ALLOWED_ROUTES` / `LIGHT_SUPERVISOR_ALLOWED_ROUTES` e nos `*_DESTINATIONS` (`src/components/light/light-routes.ts`), com teste.
- Tudo atrás de `feature_manager_lite_enabled` (gestor) e `feature_supervisor_lite_enabled` (supervisor). Flag desligada = nada muda para ninguém.
- Corretor e diretor no modo normal: sem regressão.

### 2.4 Processo
- Uma branch por etapa a partir de `origin/feat/diretor-visual-lite`, worktree próprio, `node_modules` por junction. **Nunca** copiar `.env.local` (aponta para produção). Nunca rodar teste de banco.
- Validação: testes focados + `type-check` + `eslint` dos arquivos. Sem suíte completa.
- Print desktop 1440 e celular 390 de cada tela nova (prévia em `/dev/*` se o app não subir).
- Revisão cruzada: quem não executou a etapa revisa (escopo, design, regressão). Bloqueante volta.
- Maestro junta na `feat/diretor-visual-lite` e dá push. Deploy é do Vinicios. Migration só com aprovação.
- Cada etapa registra DEC em `docs/decision-log.md` e linha em `docs/ux/UX_REDESIGN_CONTROL.md`.

## 3. Etapas

### E0. Segurança e escopo (bloqueia o resto)
Correções antes de qualquer tela nova:
1. **`/integridade`** (`integridade/page.tsx:41-53`): log de auditoria **sem filtro de tenant** (vazamento entre empresas) e sem trava de papel. Filtrar por tenant, exigir `ver_painel_integridade`, escopo de leads por unidade/equipe (`:56-80`).
2. `getDomainDashboard` (`features/dashboard/service.ts`): supervisor sem escopo (`:29`), tarefas e conversas sem escopo para ninguém (`:32-34`, `:40-41`), vendas ignora gestor (`:53`), membros da empresa toda (`:57`). Usar `resolveReportDataScope` + escopo de membership.
3. `/vendas` (`vendas/page.tsx:38-44`): supervisor vê a empresa; `?branch=` sobrescreve a unidade do gestor; lista de unidades da empresa toda.
4. `features/sales/queries.ts:91-94` (`getSaleById`) e `features/proposals/queries.ts` (5 pontos): escopo de supervisor.
5. `features/documents/actions.ts:481-494`: escopo de supervisor e filtro de unidade no SQL.
6. `conversas/page.tsx:95-100`: supervisor com `inSupervisorTeam`.
7. `empresas/page.tsx:30-33` e `features/noc/queries.ts:132-135`: escopo de supervisor.
8. `light-routes.ts`: a regex `/leads/<id>` aceita `dashboard` e `arquivados`; excluir.
9. Rotas inalcançáveis por redirect em `next.config.ts:29-33` (`/propostas`, `/configuracoes/comissoes`, `/minha-fila`): decidir destino (ver E7).
**Pronto quando:** cada ponto com teste (outro tenant, outra unidade, fora da equipe = recusa/vazio).

### E1. Leads e atendimento
- Gestor: ficha do lead completa no Lite (status, tarefas, documentos, timeline, ações) dentro de `SupervisorLeadDetail`; KPIs de leads (funil, atenção) como cards Lite (dados de `/leads/dashboard`); `/empresas` no Lite.
- Supervisor: repasse pela ficha (`/equipe/repassar` já existe), mesmos KPIs da equipe.
- Reuso: `SupervisorLeadsRadar`, `SupervisorLeadDetail`, `ManagerLeadTransferForm`, `reassignLeadAction`, `LeadTimeline`, `LeadTasks`, `LeadActionHub`, `LeadDocumentsSection`.

### E2. Clientes
- Gestor: `/clientes` e `/clientes/<id>` (hoje não tem). Reusar `LightClientsList` e a ficha do cliente (beneficiários, renovação, documentos). Escopo já seguro (`buildClientScopeWhere`).
- Supervisor: conferir paridade com o gestor.

### E3. Conversas (depende de E0.6)
- Gestor: caixa de conversas da unidade no Lite (`ThreadListScreen`, `ThreadRow`, `chat-screen`), etiquetas, filtros.
- Supervisor: conversas da equipe, só leitura.

### E4. Equipe e unidade
- Gestor: convidar corretor (sheet), aprovar pedidos de transferência (`TransferRequestsPanel`), notas de feedback, "Minha unidade" (`/unidades/<branchId>`: métricas, membros, top corretores) no Lite.
- Supervisor: já tem `/equipe/minha`, configurar, transferência, repassar, perfil. Conferir paridade visual.

### E5. Desempenho e relatórios (depende de E0.2)
- Painel do dia (números, filas, plantões, WhatsApp dos corretores) em cards Lite; relatório de qualidade dos leads simples; drill-downs (`/dashboard/drill/<id>`); ranking da unidade (`unitLeaderboard`) em `/equipe/desempenho` para o gestor; NOC da unidade (E0.7); integridade da unidade (E0.1).
- Exportação de relatórios (`report-export-service`, já aceita supervisor).

### E6. Metas e comissões
- Meta da unidade/equipe (só leitura para supervisor; `ver_meta_equipe`), progresso por corretor.
- Comissão da unidade/equipe (visão, não regras; regras seguem do tenant).

### E7. Vendas e propostas (depende de E0.3, E0.4, E0.9)
- Lista e detalhe de vendas no Lite; propostas (vencendo, criar) no Lite, com a rota alcançável.

### E8. Tarefas, agenda e pendências (depende de E0.2, E0.5)
- Lista de tarefas da unidade/equipe (a partir de `leadTasks` com escopo), agenda de retornos, documentos pendentes (`/documentos`, aprovar só gestor).

### E9. Plantão e distribuição da unidade (só gestor)
- No Lite: resumo do dia da distribuição, plantões da unidade (`/leads/distribuicao/plantao/<id>`: presença, leads do turno, histórico), escala da unidade (consulta), distribuir lead parado na unidade.
- Continua só no diretor geral: criar/editar filas, roteamento, regras de DDD, escala da empresa.
- Supervisor: segue com o assistente "Plantão da equipe" (só leitura).

### E10. Relacionamento e notificações
- Gestor: `/relacionamento` com `RelationshipCenterLite` (mensagens e jornada da unidade). Notificações já prontas.

### E11. Configurações pessoais e da unidade
- Gestor: `ManagerLiteSettings` no modelo de `SupervisorLiteSettings` (conta, segurança, WhatsApp, extensão, aba da unidade com `gerenciar_configuracoes_unidade`).

## 4. Ordem e divisão entre os agentes

| Ordem | Etapa | Executor | Revisor |
|---|---|---|---|
| 1 | E0 Segurança e escopo | Cinzel | Vigia |
| 1 (paralelo) | E2 Clientes | Vigia | Cinzel |
| 2 | E1 Leads | Cinzel | Vigia |
| 2 (paralelo) | E11 Configurações | Vigia | Cinzel |
| 3 | E4 Equipe e unidade | Cinzel | Vigia |
| 3 (paralelo) | E10 Relacionamento | Vigia | Cinzel |
| 4 | E5 Desempenho e relatórios | Cinzel | Vigia |
| 4 (paralelo) | E6 Metas e comissões | Vigia | Cinzel |
| 5 | E3 Conversas | Cinzel | Vigia |
| 5 (paralelo) | E8 Tarefas e pendências | Vigia | Cinzel |
| 6 | E7 Vendas e propostas | Cinzel | Vigia |
| 7 | E9 Plantão e distribuição | Cinzel | Vigia |

Arquivos de alto conflito (`light-routes.ts`, `light-chrome.tsx`, `chat-rail-data.ts`, `layout.tsx`): mudança pequena e aditiva por etapa; o Maestro resolve conflitos no merge.

## 5. Pronto quando (plano inteiro)
- Todas as rotas de gestão da seção 3 abrem no Lite para gestor e supervisor, com o escopo certo, sem nenhuma tela no visual do modo normal.
- Nenhuma função de gestão do modo diretor (fora as excluídas na seção 1) fica sem equivalente no Lite.
- E0 fechado com testes, sem vazamento entre empresas, unidades ou equipes.
- Prints aprovados pelo Vinicios em cada etapa.
