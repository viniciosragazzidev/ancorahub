# Controle de Execução do Redesign

**Atualizado em:** 2026-09-05
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

| Campo | Valor |
|---|---|
| Etapa atual | UX-M1.10 — Mobile QA transversal |
| Estado | `IMPLEMENTATION_COMPLETE_QA_PENDING` |
| Protocolo de Governança | UX-GOV-1 (`UX_FOUNDATIONS.md`, `UX_DECISIONS.md`, `UX_CHANGELOG.md`, `UX_FUNCTIONALITY_MATRIX.md`) |
| Mudança visual autorizada | Hardening transversal UX-H1 aprovado pelo usuário: biblioteca única, sidebar preta, tabelas claras e auditoria por rota |
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
