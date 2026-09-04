# Controle de Execução do Redesign

**Atualizado em:** 2026-09-04  
# Controle de Execução do Redesign

**Atualizado em:** 2026-09-04  
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

| Campo | Valor |
|---|---|
| Etapa atual | UX-1D — Dashboard Unificado |
| Estado | `IN_PROGRESS` |
| Protocolo de Governança | UX-GOV-1 (`UX_FOUNDATIONS.md`, `UX_DECISIONS.md`, `UX_CHANGELOG.md`, `UX_FUNCTIONALITY_MATRIX.md`) |
| Mudança visual autorizada | Implementar abas e métricas canônicas do Dashboard unificado conforme especificação UX-1D |
| Próxima ação obrigatória | Executar UX-1D seguindo rigorosamente o checklist de 30 pontos de Visual QA do UX-GOV-1 |
| Bloqueios conhecidos | Nenhum bloqueio. UX-1A, UX-1B e UX-1C concluídas e 100% validadas |

## Registro de etapas

| Etapa | Estado | Evidência | Próxima decisão |
|---|---|---|---|
| UX-1A — Auditoria | `COMPLETE` | `docs/ux/UI_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/audits/ROUTE_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/NAVIGATION_MAP.md`<br>`docs/ux/UX_FUNCTIONALITY_MATRIX.md`<br>`docs/ux/ACTION_MAP.md`<br>`docs/ux/FILTER_MAP.md`<br>`docs/ux/CONFIGURATION_AUTHORITY_MAP.md`<br>`docs/ux/COMPONENT_INVENTORY.md` | Iniciar UX-1B para refinamento e criação das fundações canônicas |
| UX-1B — Foundations/componentes | `COMPLETE` | `src/components/foundations/` (13 componentes)<br>`src/components/foundations/foundations.test.tsx` (11 testes 100% pass)<br>`docs/ux/UX_FOUNDATIONS.md`<br>Piloto: `src/features/branches/components/branches-manager.tsx` | Iniciar UX-1C (Sidebar & Navigation Restructure) |
| UX-1C — Sidebar & Navigation | `COMPLETE` | `src/components/corretop-sidebar.tsx` (Rail vertical com alto contraste e tiles canônicos)<br>`docs/ux/UX_DECISIONS.md` (DEC-001)<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1D (Dashboard Unificado) |
| UX-1D — Dashboard unificado | `IN_PROGRESS` | `docs/ux/DASHBOARD_TABS_INTELLIGENT_MERGE_REPORT.md` | Executar unificação do Dashboard sob governança UX-GOV-1 |
| UX-1E a UX-1J | `NOT_STARTED` | — | Seguir a ordem estrita do contrato |
etapa como concluída apenas porque houve mudança de CSS ou porque uma página parece
melhor isoladamente.
