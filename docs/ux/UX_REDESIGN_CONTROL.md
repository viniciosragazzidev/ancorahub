# Controle de Execução do Redesign

**Atualizado em:** 2026-09-25
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

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
