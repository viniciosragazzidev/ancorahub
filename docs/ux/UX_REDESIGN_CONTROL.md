# Controle de Execução do Redesign

**Atualizado em:** 2026-09-04
**Fonte de verdade:** este documento e `UX_REDESIGN_CONTRACT.md`.

## Estado atual

| Campo | Valor |
|---|---|
| Etapa atual | UX-1A — Auditoria global e mapa de simplificação |
| Estado | `NOT_STARTED` |
| Mudança visual autorizada | Apenas correção visual crítica e isolada; não migrar páginas |
| Próxima ação obrigatória | Inventariar as rotas reais e produzir o mapa antes/depois por rota |
| Bloqueios conhecidos | Não usar contratos, tokens, registries ou blueprints do sistema documental anterior |

## Próxima entrega: UX-1A

Criar `docs/ux/audits/ROUTE_SIMPLIFICATION_AUDIT.md` a partir do código atual.
Para cada rota visível, registrar: objetivo, papel, ação principal, informação
essencial, informação avançada, filtros sempre visíveis/avançados/contextuais,
duplicações, problemas de densidade, proposta antes/depois e estratégia mobile.

Também criar, dentro do mesmo diretório, os seguintes mapas:

- `NAVIGATION_MAP.md`
- `ACTION_MAP.md`
- `FILTER_MAP.md`
- `CONFIGURATION_AUTHORITY_MAP.md`
- `COMPONENT_INVENTORY.md`

### Critérios de saída UX-1A

- Todas as rotas relevantes foram auditadas a partir do código real.
- Há uma navegação proposta com Homes canônicas e domínios agrupados.
- Há uma prioridade P0–P3 e uma sequência de migração pequena e reversível.
- Nenhuma regra de negócio foi alterada.
- Este documento foi atualizado para `COMPLETE`, com a próxima etapa permitida.

## Registro de etapas

| Etapa | Estado | Evidência | Próxima decisão |
|---|---|---|---|
| UX-1A — Auditoria | `NOT_STARTED` | — | Auditar rotas e componentes reais |
| UX-1B — Foundations/componentes | `BLOCKED_BY_UX-1A` | — | Só após o mapa aprovado |
| UX-1C a UX-1J | `NOT_STARTED` | — | Seguir a ordem do contrato |

## Como atualizar este controle

Ao encerrar uma alteração visual, registrar data, rotas, componentes, estados
revisados, verificações executadas, riscos e a próxima ação exata. Nunca marcar uma
etapa como concluída apenas porque houve mudança de CSS ou porque uma página parece
melhor isoladamente.
