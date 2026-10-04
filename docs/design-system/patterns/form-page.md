# FORM_PAGE

Use para criação ou edição que merece foco próprio. Um formulário contextual curto pode continuar dentro de `DETAIL_PAGE` ou `SETTINGS_PAGE`.

## Composição

`PageHeader` → contexto/saída segura → `Form` → `FormField` composto → ações explícitas.

- Campos usam `FormLabel`, `FormControl`, `FormDescription` e `FormMessage` quando aplicável.
- Validação é apresentada junto ao campo e um resumo só é usado quando ajuda a localizar vários erros.
- Uma ação é primária; cancelar/navegar para trás não perde conteúdo sem aviso quando houver alterações.

## Estados obrigatórios

default, dirty, inválido, submitting, sucesso, erro recuperável, sem permissão e indisponível.

## Não usar

Não colocar schema ou regra de domínio na primitive. Não desabilitar o envio sem explicar o requisito pendente.
