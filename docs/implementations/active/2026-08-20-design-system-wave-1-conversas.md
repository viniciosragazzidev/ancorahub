# Registro de implementação — Design System Wave 1: Conversas

**Branch:** `redesign`
**Status:** verifying
**Rota:** `/conversas`
**Blueprint:** `CHAT_PAGE` + `CRM_PAGE`
**Produção alterada:** NÃO

## Discover e UX audit

- **Objetivo do usuário:** localizar um atendimento no próprio escopo, compreender o contexto e agir no chat.
- **Ação principal:** selecionar um lead e conduzir o atendimento pelo canal disponível.
- **Informação prioritária:** filtros, seleção atual, histórico e contexto do lead.
- **Problema UX-P2:** o shell já identificava a rota como Atendimento/Conversas e o workspace repetia “Atendimentos” com descrição, competindo com os filtros.
- **Problema UX-P2:** o loading genérico não antecipava as três áreas da central.

## Decisão

Substituir o cabeçalho interno repetido por `FilterToolbar`, mantendo seletor de unidade, filtros, contadores e resultado visível. Substituir o loading por skeleton que representa lista, conversa, compositor e perfil. Ações, URLs de seleção, consulta, mutação, tenant, RBAC e auditoria não foram alterados.

## Antes / depois

| Antes | Depois |
|---|---|
| Título contextual duplicado antes dos filtros. | Shell mantém a localização; toolbar começa diretamente no contexto operável. |
| Loading genérico de rota. | Skeleton estrutural da central de conversas. |
| Filtros eram composição local. | Filtros usam `FilterToolbar` canônico. |

## Risco e rollback

Risco funcional baixo: os mesmos callbacks e estado local foram preservados. Rollback: reverter `conversations-workspace.tsx` e `loading.tsx`; nenhum schema, ação ou serviço foi alterado.

## Verificações

- `npm run type-check`: passou.
- `npm run test -- src/components/ui/pattern-primitives.test.tsx`: 3 testes passaram.
- QA visual autenticado: pendente.
- Build final desta wave: pendente.
