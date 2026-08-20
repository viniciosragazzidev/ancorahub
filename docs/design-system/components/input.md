# Input and Textarea

## Purpose

Controles de texto oficiais: `src/components/ui/input.tsx` e `textarea.tsx`. Formatação de CPF, telefone e moeda é responsabilidade opcional do Input, não do FormField.

## States

Default, placeholder, hover, focus-visible, disabled, read-only e `aria-invalid`. Input file nativo oculto é exceção legítima quando encapsulado por upload.

## Migration

Use `Field`, `FieldLabel`, `FieldDescription` e `FieldError` para anatomia de formulário. A definição final de FormField e de tokens de radius depende de DG-010/DG-003.
