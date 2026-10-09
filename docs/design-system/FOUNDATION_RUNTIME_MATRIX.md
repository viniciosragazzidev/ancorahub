> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Matriz Contract → Runtime

| Contract token | Runtime token | Status | Observação |
|---|---|---|---|
| `color.surface.page` | `--background`, `--surface-base` | MATCH | Paper no tema claro; tema dark preserva adaptação semântica. |
| `color.surface.subtle` | `--muted`, `--surface-secondary` | MATCH | Snow `#f7fafc` no tema claro; tema dark preserva adaptação semântica. |
| `color.text.primary` | `--foreground` | MATCH | Ink no tema claro; tema dark preserva contraste semântico. |
| `color.action.primary` | `--primary` | MATCH | Midnight no tema claro; tema dark mantém contraste de CTA. |
| `border.subtle` | `--border` | MATCH | borda semântica central. |
| spacing scale | `--size-spacing-*` | NEEDS_RENAME | escala runtime inclui valores adicionais. |
| radius | `--radius-control`, `--radius-card`, `--radius-panel`, `--border-radius-pill` | MATCH | escala DG-003 centralizada e reutilizada pelos primitives. |
| shadows | `--shadow-*`, `--shadow-card`, `--shadow-dialog` | LEGACY | contrato ainda não aprovou equivalência. |
| motion | `--duration-*`, `--ease-*`, `--distance-*` | MATCH | escala central e reduced motion presentes. |
| focus | `--ring` + `focus-visible:ring-*` | MATCH | regra técnica compartilhada. |
| z-index | `--zindex-*` | MATCH | escala runtime central. |

Nenhum token runtime foi removido. Aliases futuros exigem decisão de contract;
DG-001 e DG-003 foram resolvidos, DG-004 continua pendente para convergência dark.
