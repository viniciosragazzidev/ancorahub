# Controle de Execução do Redesign

**Atualizado em:** 2026-09-05
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

| Campo | Valor |
|---|---|
| Etapa atual | UX-M1.1 — Mobile Foundations |
| Estado | `AUDIT_COMPLETE_READY_TO_IMPLEMENT` |
| Protocolo de Governança | UX-GOV-1 (`UX_FOUNDATIONS.md`, `UX_DECISIONS.md`, `UX_CHANGELOG.md`, `UX_FUNCTIONALITY_MATRIX.md`) |
| Mudança visual autorizada | Hardening transversal UX-H1 aprovado pelo usuário: biblioteca única, sidebar preta, tabelas claras e auditoria por rota |
| Próxima ação obrigatória | Implementar M1.1 Foundations a partir de `docs/ux/mobile/`, depois M1.2 App Shell. O Corretor Lite permanece preservado pela DEC-015 |
| Bloqueios conhecidos | Nenhum bloqueio. UX-1A, UX-1B, UX-1C, UX-1D, UX-1E e UX-1F concluídas e 100% validadas |

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
| UX-M1 — Mobile Experience | `AUDIT_COMPLETE` | `docs/ux/mobile/MOBILE_UX_AUDIT.md`<br>`docs/ux/mobile/MOBILE_PATTERNS.md`<br>`docs/ux/mobile/MOBILE_FUNCTIONALITY_MATRIX.md`<br>DEC-016 | Implementar M1.1 Foundations sem criar design system paralelo |
