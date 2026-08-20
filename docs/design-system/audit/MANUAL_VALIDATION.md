# Validação Manual da Amostra

A auditoria foi confrontada por leitura de código, não por teste visual runtime.

## Rotas (10)
- /2fa — src/app/(auth)/2fa/page.tsx
- /access-denied — src/app/(auth)/access-denied/page.tsx
- /admin/login — src/app/(auth)/admin/login/page.tsx
- /invite/accept — src/app/(auth)/invite/accept/page.tsx
- /login — src/app/(auth)/login/page.tsx
- /recuperar-senha — src/app/(auth)/recuperar-senha/page.tsx
- /verify — src/app/(auth)/verify/page.tsx
- /agentes-ia — src/app/(dashboard)/agentes-ia/page.tsx
- /assinatura — src/app/(dashboard)/assinatura/page.tsx
- /assistente — src/app/(dashboard)/assistente/page.tsx

## Componentes (20)
- src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx — FEATURE / Button
- src/app/(dashboard)/checklist/checklist-client.tsx — FEATURE / Button
- src/app/(dashboard)/clientes/clientes-list.tsx — FEATURE / Button
- src/app/(dashboard)/conversas/conversations-workspace.tsx — FEATURE / Button
- src/app/(dashboard)/conversas/official-broker-conversations.tsx — FEATURE / Button
- src/app/(dashboard)/corretor/resumo/_components/availability-toggle.tsx — FEATURE / Select
- src/app/(dashboard)/corretor/resumo/_components/broker-resume-dashboard.tsx — FEATURE / Button
- src/app/(dashboard)/cotacao/cotador-viewer-client.tsx — UNKNOWN / Button
- src/app/(dashboard)/dashboard/logout-button.tsx — FEATURE / Button
- src/app/(dashboard)/dashboard/_components/auto-distribute-toggle.tsx — FEATURE / Button
- src/app/(dashboard)/dashboard/_components/broker-workspace-actions.tsx — FEATURE / Button
- src/app/(dashboard)/dashboard/_components/broker-workspace.tsx — UNKNOWN / Button
- src/app/(dashboard)/dashboard/_components/marketing-dashboard-content.tsx — FEATURE / Button
- src/app/(dashboard)/dashboard/_components/noc-dashboard-content.tsx — FEATURE / Button
- src/app/(dashboard)/dashboard/_components/scroll-contain.tsx — FEATURE / sem equivalente
- src/app/(dashboard)/diretor/resume/_components/director-resume-dashboard.tsx — FEATURE / Button
- src/app/(dashboard)/equipe/cargos/workspace.tsx — FEATURE / Button
- src/app/(dashboard)/equipe/member-actions.tsx — FEATURE / Button
- src/app/(dashboard)/equipe/recuperacoes/recovery-requests-table.tsx — FEATURE / Button
- src/app/(dashboard)/equipe/team-invite-form.tsx — FEATURE / Button

## Famílias exigidas

### Forms (5)

- `src/app/(dashboard)/leads/distribuicao/page.tsx`: formulário de retry com Server Action.
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx`: quatro selects nativos confirmados.
- `src/app/(dashboard)/leads/[id]/register-sale-panel.tsx`: seis selects nativos confirmados.
- `src/app/(dashboard)/settings/feedback-templates/client.tsx`: select nativo confirmado.
- `src/features/branches/components/unit-reports-exporter.tsx`: três selects nativos confirmados.

### Cards (5)

- `src/components/ui/card.tsx`: primitive central, candidato `KEEP_AND_REFINE`.
- `src/app/(dashboard)/leads/[id]/page.tsx`: múltiplas variantes locais por `className`.
- `src/app/(dashboard)/leads/distribuicao/page.tsx`: `Card` overview e cards de automação.
- `src/app/(dashboard)/clientes/[clientId]/page.tsx`: detalhe com composição de card.
- `src/app/(dashboard)/equipe/page.tsx`: lista/gestão com card grid detectado.

### Tabelas (5)

- `src/components/ui/table.tsx`: wrapper HTML central.
- `src/features/branches/components/unit-members-table.tsx`: tabela de feature.
- `src/features/automations/components/automations-client.tsx`: tabela/lista de automações.
- `src/app/(platform-admin)/super-dev/sessions/page.tsx`: padrão DataTable detectado.
- `src/app/(platform-admin)/super-dev/audit/page.tsx`: padrão DataTable detectado.

### Overlays (5)

- `src/components/ui/dialog.tsx`: primitive central.
- `src/components/ui/drawer.tsx`: primitive central com swipe.
- `src/components/ui/sheet.tsx`: primitive central lateral.
- `src/components/ui/popover.tsx`: primitive central catalogado.
- `src/features/leads/components/lead-feedback-dialog.tsx`: feature que compõe overlay.

Itens incertos permanecem com `confidence: MEDIUM` ou `REVIEW`; a amostra confirma classificação estática, não equivalência visual runtime.
