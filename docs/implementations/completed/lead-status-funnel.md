# Implementação — Item 3.3: Funil de Status do Lead + Timeline

Data: July 12, 2026
Prioridade: 🔴 P0

---

## 1. Schema Alterado

### `lead_status` enum — adicionados 2 valores:
- `documentation_pending` (antes de `converted`)
- `under_analysis` (antes de `converted`)

Enum final: `new → distributed → in_contact → quote_sent → negotiation → documentation_pending → under_analysis → converted`, mais `lost` (a partir de qualquer etapa)

### `leads` — adicionado:
- `motivo_perda` (text, nullable)

## 2. Permissões RBAC

| Permissão | Roles |
|---|---|
| `alterar_status_lead` | broker, manager, director |
| `reabrir_lead_perdido` | manager, director |

## 3. Regras de Transição

| Transição | Regra |
|---|---|
| Qualquer status ativo | Broker: só próprio lead. Manager: só mesma filial. Director: qualquer |
| → `perdido` | Exige `motivo_perda` válido (lista fixa de 7 motivos). Confirmado via dialog. |
| → `convertido` | **Bloqueado manualmente.** Só ocorre via criação de venda. |
| `perdido` → ativo (reabertura) | Restrito a manager/director. |

## 4. Comportamento Técnico

Toda mudança de status:
1. Valida permissão no backend (nunca só UI)
2. Atualiza `leads.status`
3. Reseta `leads.stage_entered_at` para `now()`
4. Cria `lead_interactions` tipo `status_change` com conteúdo descritivo
5. Cria `audit_logs` com ação (`alterou`, `perdeu`, `reabriu`)

## 5. Arquivos Criados/Modificados

### Criados
- `src/features/leads/lead-status-constants.ts` — constantes compartilhadas (sem `server-only`)
- `src/features/leads/change-lead-status.ts` — serviço central (com `server-only`)
- `src/features/leads/components/lead-status-selector.tsx` — componente cliente
- `src/app/(dashboard)/leads/status-actions.ts` — Server Action
- `src/features/leads/tests/change-lead-status.test.ts` — 4 testes
- `drizzle/0007_complete_lake.sql` — migration

### Modificados
- `src/shared/db/schema.ts` — +2 status, +coluna `motivo_perda`
- `src/shared/auth/permissions.ts` — +2 permissões
- `src/app/(dashboard)/leads/[id]/page.tsx` — status selector + timeline com highlights

## 6. Timeline — Destaques Visuais

| Evento | Cor/Estilo |
|---|---|
| Status normal | Borda `primary/40` |
| Mudança para `perdido` | Borda `destructive` |
| Reabertura de lead perdido | Background âmbar + badge "Reabertura" + texto semibold |

## 7. Validação Final

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ Sem erros |
| `npm test` | ✅ 62/62 testes |
| `npx next build` | ✅ (após correções) |

## 8. Sugestão de Commit

```
feat(leads): add status funnel with RBAC rules and timeline
```
