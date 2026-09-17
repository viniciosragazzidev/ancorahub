# Redesign visual da Central de Distribuição

**Status:** em validação
**Escopo:** `/leads/distribuicao` e seus painéis de filas e plantões.

## Objetivo

Reduzir a carga visual da Central de Distribuição sem alterar regras de roteamento,
permissões, consultas ou ações. A navegação passa a apresentar uma única camada de
contexto por vez, e cada fila mostra suas campanhas Meta vinculadas no próprio card.

## Entrega

- Substituição do fluxo visual redundante por abas canônicas compactas e cabeçalho
  contextual reutilizando `PageTabs`.
- Cards de fila com métricas agrupadas, destino operacional e campanhas vinculadas
  explicitamente (com indicação de exceção por anúncio).
- Seções de campanhas e anúncios com hierarquia mais clara, descrições curtas e
  formulários responsivos.
- Remoção do painel duplicado de dependências da criação de plantão; os indicadores
  canônicos permanecem na grade semanal e nos cards de resumo.
- Estados e ações existentes preservados; nenhuma mudança de domínio ou API.

## Arquivos

- `src/app/(dashboard)/leads/distribuicao/_components/distribution-tabs-container.tsx`
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx`
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx`

## Validação

- [x] Auditoria do grafo atual (`graphify-out/graph.json` e `.ua/knowledge-graph.json`).
- [x] Contrato e controle de redesign consultados.
- [x] Lint focado aprovado.
- [ ] `npm run agent:verify -- --level full`.
- [ ] `npm run build`.
- [ ] QA autenticado por papel e viewport; permanece pendente conforme UX-M1.10.

## Rollback

Reverter o commit desta etapa. A mudança é somente de composição visual e não exige
migration ou alteração de dados.
