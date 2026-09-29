# Correção da lista de aguardando distribuição no plantão

## Escopo

A lista `Aguardando distribuição` no detalhe de um plantão não exibe leads com
status de qualificação `disqualified` nem o alias legado `not_qualified`.

Leads já distribuídos continuam disponíveis na aba `Distribuídos`, pois a
alteração corrige somente a fila visual de espera.

## Implementação

- `src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx`
  normaliza o status pelo catálogo compartilhado e remove os desqualificados da
  lista e do contador de aguardando.
- A consulta server-side, o escopo de tenant, o histórico e a aba de
  distribuídos permanecem inalterados.

## Validação

- Teste focado e type-check executados com os binários locais do projeto.
- `npm run agent:verify -- --level fast` e `npm run build` tentados; o `npm`
  global do ambiente está quebrado porque não encontra
  `AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js`.
