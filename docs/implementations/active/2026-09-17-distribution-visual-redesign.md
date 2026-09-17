# Redesign visual da Central de Distribuição

**Status:** em validação
**Escopo:** `/leads/distribuicao` e seus painéis de filas e plantões.

## Objetivo

Reduzir a carga visual da Central de Distribuição sem alterar regras de roteamento,
permissões, consultas ou ações. A navegação passa a apresentar uma única camada de
contexto por vez, e cada fila mostra suas campanhas Meta vinculadas no próprio card.

## Entrega

- Substituição do fluxo visual redundante por abas canônicas compactas, com indicador
  linear e sem o preenchimento verde da variante segmentada.
- Ordem das abas ajustada para manter `Filas` imediatamente ao lado de `Plantões`,
  facilitando a configuração do destino e da escala em sequência.
- Remoção do segundo cabeçalho gerado pelo container: cada área volta a ter apenas um
  título, uma descrição e uma hierarquia semântica coerente.
- Correção dos botões da inbox que repetiam ícone e rótulo (`Auto`, `Atribuir` e ações
  correlatas), com largura mínima estável para seleção de corretor e ações por lead.
- Cards de fila com métricas agrupadas, destino operacional e campanhas vinculadas
  explicitamente (com indicação de exceção por anúncio).
- Seções de campanhas e anúncios com hierarquia mais clara, descrições curtas e
  formulários responsivos.
- Remoção do painel duplicado de dependências da criação de plantão; os indicadores
  canônicos permanecem na grade semanal e nos cards de resumo.
- Estados e ações existentes preservados; nenhuma mudança de domínio ou API.

## Arquivos

- `src/app/(dashboard)/leads/distribuicao/_components/distribution-tabs-container.tsx`
- `src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx`
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx`
- `src/app/(dashboard)/leads/distribuicao/page.tsx`
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx`

## Validação

- [x] Auditoria do grafo atual (`graphify-out/graph.json` e `.ua/knowledge-graph.json`).
- [x] Contrato e controle de redesign consultados.
- [x] Lint focado aprovado.
- [x] 57 testes focados do motor de distribuição aprovados.
- [x] Compilação Next.js de produção concluída sem erro de aplicação.
- [ ] `npm run agent:verify -- --level full`: documentação, arquitetura, segurança,
  desempenho e lint aprovados; o type-check foi interrompido apenas pelo arquivo local
  não versionado `scripts/_tmp-diag2.ts` (`userId` possivelmente nulo).
- [ ] `npm run build`: compilação concluída e bloqueio idêntico ocorreu na etapa de
  type-check do mesmo script local não versionado.
- [ ] QA autenticado por papel e viewport; permanece pendente conforme UX-M1.10.

Evidência do harness: `reports/agent/verification/2026-09-17T18-17-21.795Z.md`.

## Rollback

Reverter o commit desta etapa. A mudança é somente de composição visual e não exige
migration ou alteração de dados.
