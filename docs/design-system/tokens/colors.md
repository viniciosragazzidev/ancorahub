# Tokens de Cor

| Token semântico | Valor | Propósito | Usar | Não usar |
|---|---|---|---|---|
| `color.text.primary` | `#1e1e1e` | texto principal (Ink) | headings/body conforme contraste | como fundo de CTA. |
| `color.text.secondary` | `#666` | texto auxiliar (Smoke) | ajuda e corpo secundário | texto essencial sem contraste verificado. |
| `color.text.tertiary` | `#8d8d8d` | meta/navegação (Fog) | informação não crítica | estado crítico. |
| `color.text.disabled` | `#999` | placeholder/disabled (Ash) | apenas controle realmente indisponível | conteúdo essencial. |
| `color.action.primary` | `#0d111b` | CTA preenchido (Midnight) | ação primária | status de negócio. |
| `color.surface.page` | `#fff` | página/paper | superfície base clara | substituto automático para dark mode. |
| `color.surface.subtle` | `#f7fafc` | snow de referência | superfícies discretas | assumir `#fafafa`. |
| `color.border.subtle` | `#ccd1da` | hairline (Mist) | bordas/divisores | comunicar erro/seleção. |
| `color.accent.inline` | `#0098f2` | destaque curto | checks, rates, eyebrow | botão preenchido ou superfície grande. |

Iris, Magenta, Leaf, Coral, Ice, Lavender e Blush são **CONFIRMED como cores decorativas**, mas não possuem token semântico de produção. Status é **MISSING** (DG-002). Carbon `#0f0f0f` não é token semântico global.
