# Regras de roteamento: escopo de entrada e Desqualificado

**Data:** 2026-09-16
**Estado:** entregue nesta fatia; integração do resolvedor ao distribuidor permanece como próxima etapa controlada

## Entregue

- Catálogo único de origens/canais com os valores canônicos usados pelo intake e aliases legados (`meta_ads`, `site`, `google`, entre outros), incluindo a opção explícita **Todas as origens**.
- Catálogo único de status de qualificação, incluindo `disqualified` como **Desqualificado**.
- Avaliação segura de regras: um lead desqualificado só passa por uma regra que selecionou explicitamente esse status. Filtros vazios continuam significando “qualquer valor” para os demais campos.
- Normalização aplicada também ao simulador, evitando divergência entre a prévia e a regra persistida.
- Matriz de roteamento com explicação de origem/canal, filtro vazio e separação entre matriz e regras específicas de campanha Meta em **Filas e campanhas**.
- Destino geral **Todas as unidades ativas**, com identificador estável para não depender de uma unidade específica.
- Modo de distribuição por regra: **Oferta automática** ou **Ação manual**. O modo manual é persistido e sinalizado na matriz; a aplicação no executor operacional fica condicionada à próxima integração do resolvedor.
- Persistência sanitizada de filtros e auditoria mantida nas ações de criação, edição, ordenação e exclusão.

## Validação

- Testes direcionados cobrem: regra global bloqueando Desqualificado, regra com opt-in permitindo Desqualificado e aliases de origem Meta.
- Type-check, build e `agent:verify` devem ser executados antes do merge; registrar os resultados no relatório de verificação da rodada.

## Próxima etapa segura

Conectar `resolveLeadDestinationRule` ao ponto único de distribuição de produção (`processQueuedLead`) depois de definir, com dados reais e testes de contrato, como cada destino (`queue`, `branch`, `broker_group`, `specific_broker`) será aplicado. A etapa deve derivar tenant/unidade da sessão, selecionar campanhas Meta por IDs autorizados e manter fallback auditável. Até essa integração, a matriz é a fonte de decisão do editor/simulador, enquanto a distribuição operacional segue o resolvedor de qualificação/fila existente.

## Rollback

Reverter o commit desta implementação restaura os catálogos locais e a avaliação anterior; não há alteração de schema ou migração nesta fatia.
