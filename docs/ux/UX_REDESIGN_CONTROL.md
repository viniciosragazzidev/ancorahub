# Controle de Execução do Redesign

**Atualizado em:** 2026-09-04  
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

| Campo | Valor |
|---|---|
| Etapa atual | UX-1C — Sidebar & Navigation Restructure |
| Estado | `NOT_STARTED` |
| Mudança visual autorizada | Reorganização da sidebar, agrupar rotas de acordo com o mapa de navegação aprovado na UX-1A |
| Próxima ação obrigatória | Iniciar UX-1C (Sidebar & Navigation Restructure) com base em `docs/ux/NAVIGATION_MAP.md` |
| Bloqueios conhecidos | Nenhum bloqueio. UX-1A e UX-1B concluídas e 100% validadas |

## Registro de etapas

| Etapa | Estado | Evidência | Próxima decisão |
|---|---|---|---|
| UX-1A — Auditoria | `COMPLETE` | `docs/ux/UI_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/audits/ROUTE_SIMPLIFICATION_AUDIT.md`<br>`docs/ux/NAVIGATION_MAP.md`<br>`docs/ux/UX_FUNCTIONALITY_MATRIX.md`<br>`docs/ux/ACTION_MAP.md`<br>`docs/ux/FILTER_MAP.md`<br>`docs/ux/CONFIGURATION_AUTHORITY_MAP.md`<br>`docs/ux/COMPONENT_INVENTORY.md` | Iniciar UX-1B para refinamento e criação das fundações canônicas |
| UX-1B — Foundations/componentes | `COMPLETE` | `src/components/foundations/` (13 componentes)<br>`src/components/foundations/foundations.test.tsx` (11 testes 100% pass)<br>`docs/ux/UX_FOUNDATIONS.md`<br>Piloto: `src/features/branches/components/branches-manager.tsx` | Iniciar UX-1C (Sidebar & Navigation Restructure) |
| UX-1C — Sidebar & Navigation | `NOT_STARTED` | — | Executar reestruturação da Sidebar conforme `docs/ux/NAVIGATION_MAP.md` |
| UX-1D a UX-1J | `NOT_STARTED` | — | Seguir a ordem estrita do contrato |

## Como atualizar este controle

Ao encerrar uma alteração visual, registrar data, rotas, componentes, estados
revisados, verificações executadas, riscos e a próxima ação exata. Nunca marcar uma
etapa como concluída apenas porque houve mudança de CSS ou porque uma página parece
melhor isoladamente.
