# Matriz Contract → Runtime

| Contract token | Runtime token | Status | Observação |
|---|---|---|---|
| `color.surface.page` | `--background`, `--surface-base` | NEEDS_REMAP | runtime usa OKLCH e preserva light/dark. |
| `color.surface.subtle` | `--muted`, `--surface-secondary` | NEEDS_REMAP | Snow conflita em DG-001. |
| `color.text.primary` | `--foreground` | NEEDS_REMAP | papel semântico compatível; valor distinto da referência. |
| `color.action.primary` | `--primary` | NEEDS_REMAP | runtime usa marca azul; contrato requer decisão de convergência. |
| `border.subtle` | `--border` | MATCH | borda semântica central. |
| spacing scale | `--size-spacing-*` | NEEDS_RENAME | escala runtime inclui valores adicionais. |
| radius | `--radius-*`, `--border-radius-*` | LEGACY | DG-003 impede promoção visual. |
| shadows | `--shadow-*`, `--shadow-card`, `--shadow-dialog` | LEGACY | contrato ainda não aprovou equivalência. |
| motion | `--duration-*`, `--ease-*`, `--distance-*` | MATCH | escala central e reduced motion presentes. |
| focus | `--ring` + `focus-visible:ring-*` | MATCH | regra técnica compartilhada. |
| z-index | `--zindex-*` | MATCH | escala runtime central. |

Nenhum token runtime foi removido. Aliases futuros só podem ser adicionados após decisão de DG-001/DG-003/DG-004.
