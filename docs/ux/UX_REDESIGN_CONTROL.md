# Controle de Execução do Redesign

**Atualizado em:** 2026-09-04  
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

| Campo | Valor |
|---|---|
| Etapa atual | UX-1C — Sidebar & Navigation Restructure (gate de saída) |
| Estado | `PARTIAL` |
| Mudança visual autorizada | Validar a rail implementada; depois iniciar somente o plano UX-1D de Dashboard unificado |
| Próxima ação obrigatória | Validar rail por papel, viewport e teclado; registrar a decisão de liberar UX-1D |
| Bloqueios conhecidos | UX-1D não inicia implementação antes da validação da UX-1C, do gate de simplicidade e dos gaps analíticos formalizados |

## Registro de etapas

| Etapa | Estado | Evidência | Próxima decisão |
|---|---|---|---|
| UX-1A — Auditoria | `COMPLETE` | `docs/ux/UI_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/audits/ROUTE_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/NAVIGATION_MAP.md`<br>`docs/ux/UX_FUNCTIONALITY_MATRIX.md`<br>`docs/ux/ACTION_MAP.md`<br>`docs/ux/FILTER_MAP.md`<br>`docs/ux/CONFIGURATION_AUTHORITY_MAP.md`<br>`docs/ux/COMPONENT_INVENTORY.md` | Iniciar UX-1B para refinamento e criação das fundações canônicas |
| UX-1B — Foundations/componentes | `COMPLETE` | `src/components/foundations/` (13 componentes)<br>`src/components/foundations/foundations.test.tsx` (11 testes 100% pass)<br>`docs/ux/UX_FOUNDATIONS.md`<br>Piloto: `src/features/branches/components/branches-manager.tsx` | Iniciar UX-1C (Sidebar & Navigation Restructure) |
| UX-1C — Sidebar & Navigation | `PARTIAL` | Rail entregue no commit `9a303df3`; validação visual, por papel, teclado e mobile pendente | Concluir validação e registrar resultado antes de UX-1D |
| UX-1D — Dashboard unificado | `PARTIAL` | Abas internas em `/dashboard` para Resumo, Comercial, Equipe, Unidades e Financeiro; carga server-side por aba ativa; `docs/ux/DASHBOARD_TABS_INTELLIGENT_MERGE_REPORT.md` | Validar por papel e viewport; extrair os blocos de relatório da rota e realizar canário antes de alterar `/relatorios` |
| UX-1E a UX-1J | `NOT_STARTED` | — | Seguir a ordem estrita do contrato |

## Como atualizar este controle

Ao encerrar uma alteração visual, registrar data, rotas, componentes, estados
revisados, verificações executadas, riscos e a próxima ação exata. Nunca marcar uma
etapa como concluída apenas porque houve mudança de CSS ou porque uma página parece
melhor isoladamente.
