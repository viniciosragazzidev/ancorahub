# Escopo de regras de roteamento e status desqualificado

## Objetivo

Tornar `/distribuicao?view=roteamento` compreensível para o Diretor/Gestor e
impedir que leads desqualificados caiam em um destino por uma regra genérica.

## Plano executado nesta fatia

1. Centralizar o catálogo de origens e status usados pelo editor e pelo simulador,
   incluindo as opções explícitas **Todas as origens** e **Todas as unidades ativas**.
2. Corrigir aliases de origem (`meta_ads` legado para `meta_lead_ads`) sem quebrar
   regras existentes.
3. Adicionar `Desqualificado` ao editor e ao simulador.
4. Aplicar opt-in explícito para `disqualified`/`not_qualified` no resolvedor.
5. Explicar no formulário a diferença entre origem/canal e regras de campanha Meta,
   que continuam em Filas e campanhas.
6. Cobrir match, não-match, alias, normalização e Todas as origens com testes unitários.
7. Persistir o modo da regra como `automatic` ou `manual`; no modo manual, o
   destino é registrado sem criar oferta de corretor.

## Próxima fatia recomendada

Conectar `resolveLeadDestinationRule` ao ponto único de distribuição de produção
(`processQueuedLead`) depois de definir, com dados reais e testes de contrato, como
cada destino (`queue`, `branch`, `all_branches`, `broker_group`, `specific_broker`)
será aplicado e como o modo `manual` interrompe a criação de ofertas/SLA. Adicionar
então, sob disclosure avançado, um seletor opcional de campanha/anúncio/formulário
que apenas referencia os ativos Meta já autorizados. A implementação deve reutilizar
o resolvedor de entrada existente, nunca duplicar a consulta de ativos nem aceitar
IDs fora do tenant.

## Risco e rollback

A mudança é aditiva e reversível: remover a opção da UI não reativa o roteamento de
desqualificados, pois o guard permanece no resolvedor. A migration 0147 adiciona o
modo com default automático para preservar regras existentes.

## Validação

- `routing-engine.test.ts`: status desqualificado, opt-in e aliases de origem.
- Type-check, build e harness completo devem ser executados antes de promover a
  fatia para `done` no roadmap.
