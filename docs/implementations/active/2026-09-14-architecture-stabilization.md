# Estabilização arquitetural — 2026-09-14

## Tipo

Auditoria/documentação e refinamento visual do dashboard. As ondas comportamentais
de distribuição, autorização e integrações continuam bloqueadas pelos gates P0/P1.

## Evidências

- Inventário atual: 342 arquivos em `src/app`, 526 em `src/features` e 65 rotas API.
- Grafo `graphify-out/graph.json` atualizado com exclusões de ferramentas: 12.938 nós,
  37.589 relações e 488 comunidades, no commit `b2c898fb`.
- `docs/architecture/AUTHORITY_MAP.md` registra fragmentação crítica no motor de distribuição e adoção parcial do RBAC canônico.

## Entrega

- `docs/architecture/STABILIZATION_1.0.md` define fontes de verdade, riscos, ondas, gates e rollback.

## Próximo passo seguro

Executar a Onda 2 (distribuição) somente em uma mudança isolada, após registrar a
decisão do executor único e adicionar testes de concorrência, idempotência e lead
sem corretor. A primeira correção da O2 removeu o bloqueio indevido da fila geral
pela unidade de origem em `resolveQueueCandidateBranchIds`; o contrato agora é
coberto por teste de domínio. O dashboard refinado aguarda QA visual/responsivo
antes de publicar.
