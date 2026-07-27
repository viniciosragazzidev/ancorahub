# ADR 0031 — Catálogo oficial global com extensão privada

**Status:** Aceito  
**Data:** 2026-07-16

## Contexto

O catálogo atual pertence a cada tenant. Isso duplica operadoras, dificulta atualizar tabelas e permite que uma alteração comercial modifique leituras históricas. Ao mesmo tempo, uma corretora pode negociar uma operadora ou condição exclusiva que não pode se tornar dado da plataforma.

## Decisão

Separar o domínio em catálogo oficial global, governado pelo Super-admin, e extensão privada vinculada a um único tenant e governada pelo Diretor. Planos e tabelas possuem versões comerciais imutáveis e vigentes. Um serviço público resolve a disponibilidade efetiva sem expor a origem ao chamador como regra de acesso.

## Alternativas consideradas

- Manter um catálogo duplicado por tenant: rejeitado por inconsistência e custo de atualização.
- Tornar todo item global: rejeitado porque acordos privados não devem ser compartilhados.
- Permitir que a IA publique automaticamente: rejeitado por risco comercial e de auditoria.

## Consequências

O banco cresce de forma aditiva e as FKs legadas continuam durante a transição. Cotações novas deverão persistir origem, versão e snapshot. Toda publicação, disponibilidade e mudança privada será auditada e reversível por arquivamento, nunca por exclusão física.
