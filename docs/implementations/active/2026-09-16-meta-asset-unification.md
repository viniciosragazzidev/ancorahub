# Unificação dos ativos de aquisição Meta

## Objetivo

Deixar `/integrations/meta` e `/marketing/campanhas` coerentes para que o tenant
consiga identificar campanhas, anúncios e formulários ativos, entender a relação
entre eles e saber quais ativos podem capturar leads. A distribuição continua
centralizada em `/leads/distribuicao`; esta entrega não cria um segundo motor de
roteamento.

## Decisões aplicadas

- A elegibilidade de captura usa um único resolvedor (`meta-capture-policy.ts`)
  consumido pela integração, pelo webhook e pelos indicadores de campanhas.
- O modo global (`all`, `selective` ou `disabled`) continua sendo a primeira
  decisão. Em modo seletivo, campanha autorizada é a base; uma regra de anúncio
  ou formulário pode substituir a fila, enquanto uma regra filha desativada não
  invalida uma autorização explícita da campanha.
- A hierarquia visual apresenta campanha → anúncio/conjunto e Página → formulário.
  Formulários são ativos de Página na Meta; a ligação com uma campanha só é
  exibida quando a atribuição do anúncio estiver disponível.
- Na criação do plantão, “Origem de entrada” continua filtrando a credencial da
  Página/integração (o campo persistido é `webhookCredentialId`), mas agora usa o
  nome da Página em vez do ID técnico. Campanhas específicas devem ser definidas
  na Matriz de Roteamento, evitando que o plantão pareça uma segunda regra de
  campanha.
- O webhook preserva a cadeia técnica completa (campanha, conjunto, anúncio,
  formulário e Página) nas colunas canônicas do lead. Os nomes locais são usados
  na interface e os IDs aparecem como referência técnica secundária.
- Campanhas pausadas continuam visíveis quando possuem leads ativos, evitando
  que o histórico operacional desapareça. Ativos sem atividade e fora da captura
  não são promovidos como ativos de entrada.

## Reversão

Reverter o commit restaura o cálculo anterior sem apagar campanhas, rotas ou
leads. Os novos campos de atribuição são aditivos e podem permanecer preenchidos;
nenhuma migração destrutiva é necessária.

## Validação

- `npx vitest run src/features/meta-ads/components/meta-integration-view.test.tsx src/features/communication-channels/meta-lead-ads.test.ts src/features/meta-ads/meta-analytics-service.test.ts`
- `git diff --check`
- `npm run agent:verify -- --level fast` (documentação aprovada; type-check ainda
  reporta o erro preexistente em `scripts/_tmp-diag2.ts`.)
