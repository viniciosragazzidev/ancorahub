# REFINE_APP — Dashboard executivo

## Objetivo

Refinar `/dashboard` para o Diretor como a porta de entrada executiva do
produto, sem introduzir uma segunda fonte de verdade para métricas ou alterar
fluxos de leads, distribuição, qualificação ou mensagens.

## Decisões confirmadas

- Pattern Blueprint: `DASHBOARD_PAGE`.
- O escopo sempre é derivado de `TenantContext`; filtros de URL apenas refinam
  o período permitido.
- `src/features/reports/metrics` é a fonte canônica para métricas comerciais,
  funil, atenção, unidades e financeiro (DEC-090).
- Diretor, Gestor e Supervisor compartilham a composição. O adaptador canônico
  restringe Gestor à sua unidade e Supervisor aos corretores supervisionados;
  corretor, marketing e os workspaces existentes permanecem inalterados.
- As abas no dashboard são navegação para superfícies canônicas existentes;
  não duplicam consultas nem estados de negócio.

## Limites desta entrega

- Não modifica distribuição, SLA, workers, webhooks, pipeline ou regras de
  negócio.
- Não adiciona filtros de unidade que possam ampliar o escopo da sessão.
- O gráfico temporal é implementado no serviço canônico de métricas e não em
  componente de interface.

## Verificação planejada

- validação de tipos;
- testes focados de métricas;
- `npm run agent:verify -- --level fast` durante a alteração e `--level full`
  ao encerrar;
- `git diff --check`.

## Diagnósticos aceitos nesta etapa

O harness sinaliza que `metrics-service.ts` já é um módulo grande. A projeção
temporal foi adicionada ali deliberadamente para não criar uma segunda camada
de consulta ao banco. A extração de famílias de métricas é uma refatoração
estrutural posterior; não será feita junto ao refinamento visual do dashboard.
