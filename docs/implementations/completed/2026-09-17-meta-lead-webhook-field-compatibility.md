# Compatibilidade do lookup de leads Meta

## Objetivo

Restaurar a criação de leads recebidos pelo webhook Meta quando a consulta do
`leadgen_id` é feita pela Graph API.

## Causa identificada

Após a unificação de atribuição de campanhas, o lookup passou a solicitar
`page_id` no objeto Lead. Esse campo não é suportado pela API de Lead Ads e a
Meta rejeita a requisição inteira. O webhook era recebido, mas o lead não era
criado e o erro ficava registrado na fonte.

## Escopo entregue

- Removida a solicitação de `page_id` do lookup do lead.
- Mantidos os campos necessários para atribuição e roteamento: anúncio,
  conjunto, formulário, campanha e dados do formulário.
- A página continua sendo identificada pelo `entry.id` do próprio webhook,
  com `page_id` preservado apenas como campo opcional de resposta.
- Adicionado teste de contrato que impede a reintrodução de campos não
  suportados nessa chamada.

## Validações

- Suíte focada Meta Lead Ads e atribuição: 31 testes aprovados.
- `next build`: compilação concluída; a etapa de TypeScript permanece bloqueada
  por erro preexistente em `scripts/_tmp-diag2.ts`, fora deste reparo.
- `git diff --check`: sem erros de formatação.

## Rollback

Reverter apenas `meta-lead-ads.ts` e seu teste restaura o comportamento anterior;
nenhuma migração ou alteração de infraestrutura é necessária para esta correção.
