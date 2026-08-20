# FormField

O FormField canônico é composição, não um schema nem um componente de domínio:

`Field` → `FieldLabel` → control (`Input`, `Select`, `Textarea`, `Checkbox`, `Radio` ou `Switch`) → `FieldDescription`/`FieldError`.

O projeto não possui React Hook Form como dependência declarada. Zod valida dados no servidor; qualquer integração futura de formulário deve adaptar a composição existente, sem colocar schema, tenant ou regra de negócio nas primitives.

Select é lista curta fechada; Combobox é lista pesquisável; Autocomplete só é criado após necessidade distinta documentada.
