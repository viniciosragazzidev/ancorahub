# Restauração visual do Corretor Lite

**Data:** 05/09/2026  
**Estado:** implementado; validação técnica registrada neste ciclo

## Objetivo

Restaurar a experiência visual do Corretor Lite ao estado imediatamente anterior
ao lote UX-H1, conforme preferência explícita do usuário, sem reverter o redesign
das demais rotas do CRM.

## Escopo

- navegação superior do shell Lite;
- dashboard Lite;
- listas Lite de leads e clientes;
- detalhe e feedback de lead no modo Lite;
- central read-only de insights em `/conversas/broker`.

## Limites preservados

Não há mudança em queries, ações, persistência, distribuição, permissões, escopo de
tenant/carteira, seleção do modo de experiência ou integração WAHA. Diretor e
Gestor permanecem na central completa de conversas; somente o Corretor autenticado
em modo `LIGHT` usa esta experiência.

## Rollback

A alteração é puramente de apresentação e pode ser revertida reaplicando o lote
UX-H1 nos componentes `Light*`, sem migração de dados.

## Validação

- comparação dos sete arquivos restaurados com o pai do commit UX-H1;
- verificação dirigida dos componentes Lite;
- auditoria estática mantém o Lite como exceção estreita e rastreável pela DEC-015;
- `agent:verify --level fast` e build de produção executados ao final do ciclo.
