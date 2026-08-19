# Central de Feedback no header (report por WhatsApp)

## Objetivo

Substituir a ajuda contextual do ícone `?` no header por uma central de feedback: ao
clicar, abre um Sheet com a lista de 5 assuntos genéricos; ao escolher um, aparece a
descrição com "Voltar"/"Enviar". O envio manda texto livre pelo canal oficial da Meta
Cloud da própria corretora (janela de 24h, sem template) para um WhatsApp de destino
global, controlado pelo Super-admin. Critério de aceite: mensagem chega no destino com
o formato abaixo.

```
*REPORT SISTEMA*
*{{CARGO}}*: {{Nome}}
_{{TITULO_REPORT}}_
{{MENSAGEM}}
```

## Escopo e arquivos

- `src/features/system-report/message.ts` — constantes de settings, 5 triggers genéricos, builder da mensagem.
- `src/features/system-report/message.test.ts` — testes do builder e triggers.
- `src/features/system-report/actions.ts` — `sendSystemReportAction` (zod, contexto, flags, envio, auditoria).
- `src/components/system-feedback-drawer.tsx` — Sheet com lista → descrição (motion/react, lista→form).
- `src/components/contextual-help-drawer.tsx` — **removido** (substituído).
- `src/components/dashboard-header.tsx` — evento `open-system-feedback` + aria-label/title.
- `src/app/(dashboard)/layout.tsx` — import do `SystemFeedbackDrawer`.
- `src/features/broker-workspace/components/light-dashboard.tsx` e `light-leads-list.tsx` — botão de report nos headers lite.
- `src/app/(platform-admin)/super-admin/actions.ts` — `updateSystemReportSettingsAction` (kill switch + destino, auditado).
- `src/app/(platform-admin)/super-admin/settings/page.tsx` — card "Report de problema no WhatsApp".

## Decisões

- Destinatário global em `system_settings` (`system_report_whatsapp_destination`), sem vínculo por tenant; aplica-se a todos os tenants.
- Kill switch `feature_system_report_enabled` controlado pelo Super-admin; por padrão ativo (como demais features), mas exige destino configurado para enviar.
- Remetente: canal `meta_cloud` ativo/registered do tenant via `getPreferredMetaCloudChannel` + `sendMetaCloudChannelText`; fluxo de review da Meta (`services/whatsapp-api`) não é usado no envio.
- Cargo/nome via `getUserDisplayInfo()` (rótulo de cargo custom e override do super-admin tratados).
- Auditoria do envio em `auditLogs` (tenant): `entidade=system_report`, `acao=system_report.sent`, `entidadeId=messageId`, sem corpo/telefone. Alterações de settings em `platformAuditLogs` com hash do destino.
- Transição lista→form via `AnimatePresence` + tokens de motion existentes; `MotionConfig reducedMotion` global já cobre o `prefers-reduced-motion`.
- Multi-tenant derivado do contexto de servidor; nenhum `tenant_id` vem do cliente.

## Validações

- `npx vitest run src/features/system-report` → 1 arquivo, 4 testes passando.
- `npx tsc --noEmit` → **PASSOU** no `agent:verify full`.
- `npx eslint <arquivos tocados>` → 0 erros.
- `npm run build` (next build) → **PASSOU**.
- `npm run agent:verify -- --level full` → evidência em `reports/agent/verification/2026-08-19T13-11-26.579Z.md`; `type-check` passou; falhas separadas como pré-existentes:
  - `lint`: 337 erros de dívida pré-existente em `breadcrumb/sidebar/ai-agent/service/waha/request-timing/temp_deskcomm_crm/update_cards.js` — nenhum nos arquivos tocados.
  - `test`: 2 falhas pré-existentes em `meta-ads/components/meta-integration-view.test.tsx` (área não tocada).
- Ajuste de tooling: `scripts/agent/check-{architecture,security,performance}.ts` passaram a ignorar arquivos deletados (`fileExists`), pois a remoção do `contextual-help-drawer.tsx` quebrava o `readFileSync`.

## Riscos e rollback

- **Janela 24h da Meta**: se o dono nunca iniciou conversa com o número oficial, a Meta rejeita o envio; o erro é retornado ao usuário na UI. Mitigação/documentação mantida no card do Super-admin.
- **Destino não configurado**: envio falha com mensagem clara; não há dado sensível em log.
- Rollback: restaurar `contextual-help-drawer.tsx` do git, reverter evento e imports, e remover o card; flags `system_report_*` podem ser apagadas sem perda.
- Não commitar/pushar (instrução explícita do usuário).