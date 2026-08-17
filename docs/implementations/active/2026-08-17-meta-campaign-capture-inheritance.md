# Elegibilidade de campanha Meta herdada pelos ativos

## Objetivo

Evitar a perda de um Lead Ads quando a campanha foi autorizada para captura, mas
existem regras antigas e desativadas para o anúncio ou formulário que a Meta atribuiu
ao lead.

## Regra aplicada

- Ao ativar uma campanha em `/integrations/meta`, a mesma transação reativa todos os
  anúncios sincronizados que pertencem a ela (via `meta_ad_sets`).
- No modo seletivo, uma campanha ativa é a autorização base para o anúncio e o
  formulário presentes na atribuição do webhook. Uma regra filha habilitada ainda pode
  definir uma fila mais específica; uma regra filha desativada não descarta o lead.
- A associação de formulário é confirmada pela atribuição imutável retornada no
  webhook. O catálogo de formulários da Meta é de Página, não de Campanha, portanto o
  CRM não habilita preventivamente formulários de outras campanhas da mesma Página.

## Controles e auditoria

A alteração continua restrita ao tenant e usuário autenticados. A ativação registra o
evento `meta_campaign.capture_enabled_with_ads`; desativar a campanha permanece
reversível e auditado.

## Validação

- `src/features/communication-channels/meta-lead-ads.test.ts`
- `src/features/leads/lead-filter-preferences.test.ts`
- `src/features/meta-ads/components/meta-integration-view.test.tsx`
- `tsc --noEmit`

## Controle de acesso de Gestor

Em 17/08, o papel Gestor deixou de visualizar e acessar diretamente Marketing Meta,
Integrações, Inteligência do Tenant, Qualificação IA, Distribuição & Plantão e
Automações & Regras. O bloqueio existe tanto no menu quanto em layouts server-side
que abrangem as rotas filhas, redirecionando acesso direto para `/access-denied`.

## Ajustes operacionais da fila

Os filtros persistidos de `/leads` passam a recarregar a rota nativamente com seus
parâmetros de URL, garantindo que a consulta server-side aplique o filtro salvo. Em
`/leads/distribuicao`, as áreas de entrada por campanha e exceção por anúncio possuem
busca por nome e rolagem própria para seleção e regras configuradas extensas.
