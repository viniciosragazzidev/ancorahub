# Button

## Purpose

Ação interativa principal. Implementação oficial: `src/components/ui/button.tsx`.

## Variants and sizes

Use `primary`, `secondary`, `outline`, `ghost`, `destructive` ou `link`; `default` e `accent` são aliases legados e não devem ser introduzidos em novos usos. Tamanhos existentes: `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.

## States and accessibility

Default, hover, active, focus-visible e disabled são providos pelo primitive. Ícone sem texto exige `aria-label`; prefira o tamanho `icon*` ao montar um botão de ícone local. `render`/`asChild` servem para links sem duplicar botão.

## Responsive and migration

O Button não define layout responsivo do container. Troque wrappers equivalentes por Button apenas em uma onda de migração, preservando tipo, label, disabled e feedback.
