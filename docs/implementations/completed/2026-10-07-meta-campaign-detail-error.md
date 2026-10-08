# Erro no detalhe de campanhas Meta com anúncios

## Diagnóstico

- A falha real era de esquema: o PostgreSQL retornou `42703`, pois a coluna `meta_ads.lead_gen_form_id` não existia no banco usado pelo servidor local. A migration `0184_meta_ad_lead_form_link.sql` estava no repositório, mas não aplicada nem registrada nesse banco.
- A migration `0184` foi aplicada isoladamente. Não executei `0185` nem as migrations futuras.
- A associação dos anúncios agora usa junção entre anúncios e conjuntos, sempre limitada por `tenant_id` e pela campanha. A associação de formulários usa uma subconsulta equivalente, sem materializar os IDs no servidor.
- Foi adicionada uma boundary específica da rota para permitir retry e exibir o digest quando outra falha ocorrer.
- A consulta que falhava foi repetida após a migration e retornou 22 anúncios.
- O arquivo de leads foi cruzado com o CRM: 28 de 28 contatos têm registro correspondente. Dois envios foram deduplicados por telefone contra registros mais antigos. As últimas tentativas de sincronização de ativos da Meta foram classificadas como limite de chamadas; não disparei nova sincronização durante o backoff.

## Arquivos

- `src/app/(dashboard)/marketing/campanhas/[id]/page.tsx`
- `src/app/(dashboard)/marketing/campanhas/[id]/error.tsx`

## Validação

- `npm run type-check` — passou.
- `npm run build` — passou: compilação, TypeScript e geração das páginas concluídos.
- `npm run agent:changed` — passou.
- `npm run agent:security` — passou, sem achados.
- `npm run agent:architecture` — concluiu com quatro avisos de tamanho em arquivos preexistentes fora desta alteração.
- `git diff --check` — passou.
- Consulta SQL exata após `0184` — passou, 22 linhas.
- Testes automatizados não executados.

## Limites e operação

A página deve ser atualizada no navegador para buscar novamente. A sincronização dos ativos Meta continua sujeita ao rate limit retornado pela Meta; nova tentativa deve aguardar o backoff registrado. Nenhum lead ou estado de sincronização foi alterado.
