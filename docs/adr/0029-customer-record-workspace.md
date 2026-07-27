# ADR-0029: Workspace compartilhado de Lead e Cliente

## Status

Aceita incrementalmente em 2026-07-16.

## Contexto

Lead e Cliente representam momentos diferentes da mesma relação comercial, mas as telas possuíam campos e decisões espalhados. Documentos e dependentes estavam disponíveis, porém a navegação não oferecia uma biblioteca clara nem um lugar único para informações estruturadas.

## Decisão

As duas entidades utilizarão o mesmo padrão visual de workspace, com cabeçalho contextual, resumo, dados pessoais, dependentes, documentos, cotações/vendas e histórico. O Lead continuará dono do atendimento e da distribuição; o Cliente continuará dono do pós-venda, contrato e renovação.

A primeira fatia é visual e reversível: o componente compartilhado organiza fatos da pessoa e a biblioteca documental agrupa requisitos em categorias lógicas sem remover o modelo atual. A normalização completa de perfil, dependentes e metadados documentais será feita em migrations posteriores.

## Consequências

- URLs existentes permanecem válidas.
- Documentos antigos continuam sendo lidos pela estrutura atual.
- Categorias são inferidas temporariamente quando o requisito ainda não possui categoria persistida.
- Datas pessoais e automações de aniversário só devem ser ativadas depois que o perfil central e consentimentos estiverem persistidos.
- As próximas fases precisam manter escopo multi-tenant, RBAC e auditoria para PII/documentos.
