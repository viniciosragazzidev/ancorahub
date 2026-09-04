# Controle de Execução do Redesign

**Atualizado em:** 2026-09-04  
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

| Campo | Valor |
|---|---|
| Etapa atual | UX-1F — Detalhe do Lead (`/leads/[id]`) |
| Estado | `READY_TO_START` |
| Protocolo de Governança | UX-GOV-1 (`UX_FOUNDATIONS.md`, `UX_DECISIONS.md`, `UX_CHANGELOG.md`, `UX_FUNCTIONALITY_MATRIX.md`) |
| Mudança visual autorizada | Iniciar UX-1F conforme especificação de contrato e matriz de funcionalidades |
| Próxima ação obrigatória | Executar UX-1F estruturando a visualização canônica de detalhe do lead |
| Bloqueios conhecidos | Nenhum bloqueio. UX-1A, UX-1B, UX-1C, UX-1D e UX-1E concluídas e 100% validadas |

## Registro de etapas

| Etapa | Estado | Evidência | Próxima decisão |
|---|---|---|---|
| UX-1A — Auditoria | `COMPLETE` | `docs/ux/UI_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/audits/ROUTE_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/NAVIGATION_MAP.md`<br>`docs/ux/UX_FUNCTIONALITY_MATRIX.md`<br>`docs/ux/ACTION_MAP.md`<br>`docs/ux/FILTER_MAP.md`<br>`docs/ux/CONFIGURATION_AUTHORITY_MAP.md`<br>`docs/ux/COMPONENT_INVENTORY.md` | Iniciar UX-1B para refinamento e criação das fundações canônicas |
| UX-1B — Foundations/componentes | `COMPLETE` | `src/components/foundations/` (13 componentes)<br>`src/components/foundations/foundations.test.tsx` (11 testes 100% pass)<br>`docs/ux/UX_FOUNDATIONS.md`<br>Piloto: `src/features/branches/components/branches-manager.tsx` | Iniciar UX-1C (Sidebar & Navigation Restructure) |
| UX-1C — Sidebar & Navigation | `COMPLETE` | `src/components/corretop-sidebar.tsx` (Rail vertical com alto contraste e tiles canônicos)<br>`docs/ux/UX_DECISIONS.md` (DEC-001)<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1D (Dashboard Unificado) |
| UX-1D — Dashboard unificado | `COMPLETE` | `src/app/(dashboard)/dashboard/_components/executive-dashboard.tsx`<br>`src/app/(dashboard)/relatorios/_components/`<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1E (Workspace de Leads & Kanbans) |
| UX-1E — Leads workspace | `COMPLETE` | `src/app/(dashboard)/leads/`<br>`src/app/(dashboard)/leads/_components/leads-filters.tsx`<br>`src/app/(dashboard)/leads/leads-workspace.tsx`<br>`docs/ux/UX_CHANGELOG.md` | Iniciar UX-1F (Detalhe do Lead) |
| UX-1F — Detalhe do lead | `READY_TO_START` | `docs/ux/ACTION_MAP.md` · `src/app/(dashboard)/leads/[id]/` | Executar reestruturação de `/leads/[id]` |
| UX-1G a UX-1J | `NOT_STARTED` | — | Seguir a ordem estrita do contrato |
