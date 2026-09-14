# Estabilização arquitetural — 2026-09-14

## Tipo

Auditoria/documentação. Nenhum comportamento de produção foi alterado.

## Evidências

- Inventário atual: 342 arquivos em `src/app`, 526 em `src/features` e 65 rotas API.
- Grafo existente em `.ua/knowledge-graph.json` está datado de 2026-08-20 e deve ser atualizado.
- `docs/architecture/AUTHORITY_MAP.md` registra fragmentação crítica no motor de distribuição e adoção parcial do RBAC canônico.

## Entrega

- `docs/architecture/STABILIZATION_1.0.md` define fontes de verdade, riscos, ondas, gates e rollback.

## Próximo passo seguro

Executar somente a Onda 0 (cartografia), sem mover arquivos ou alterar regras. A primeira
mudança de código só deve começar após registrar as decisões P0/P1 e adicionar testes de contrato.
