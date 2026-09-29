# Persistência das regras de roteamento

**Data:** 2026-09-15  
**Escopo:** Matriz de roteamento em `/distribuicao` e `/leads/distribuicao`  
**Estado:** concluído (migration pendente de execução no ambiente Coolify)

## Causa

`leadRoutingRules` estava definido no schema Drizzle e era usado pelas Server Actions, mas não havia uma migration criando a tabela. A leitura capturava a falha e retornava uma lista vazia; ao salvar, o `INSERT` falhava e a interface exibia apenas “Erro ao salvar regra de roteamento”.

## Correção

- adicionada a migration idempotente `drizzle/0146_lead_routing_rules.sql`;
- criada a tabela com isolamento por tenant, referências para tenant, fila e usuário, JSONB de condições e índice de prioridade;
- migration registrada no journal Drizzle para ser executada pelo processo de deploy;
- nenhuma regra de seleção, permissão ou fluxo de distribuição foi alterada.

## Operação

Após o próximo deploy no Coolify, o runner de migrations deve aplicar `0146_lead_routing_rules`. Em seguida, criar, editar, pausar e reordenar uma regra pela Matriz deve persistir normalmente. O type-check e o build foram validados localmente após a proteção contra `chatId` nulo no sincronizador WAHA.
