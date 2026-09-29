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

## 2026-09-07 — piloto de composição `@efferd/dashboard-2`

### Contrato de adoção

- O registro Efferd foi adicionado ao `components.json` e o bloco foi instalado.
- O exemplo foi tratado como referência visual, não como substituto da arquitetura:
  app shell, sidebar, fixtures financeiras e componentes incompatíveis com Base UI
  foram removidos depois da inspeção.
- `src/components/dashboard.tsx` expõe o grid canônico do piloto e
  `src/components/dashboard-card.tsx` compõe o `Card` compartilhado.
- O dashboard gerencial aplica a composição aos KPIs, funil, atenção e resumo
  financeiro. As tabelas continuam usando `DataTableFrame`.
- O ramo `LightDashboard` em `/dashboard` permanece inalterado.

### Garantias

- nenhuma consulta, métrica, permissão ou escopo multi-tenant alterado;
- nenhum dado fictício do bloco renderizado;
- nenhuma nova ilha client ou dependência de runtime mantida;
- URL das abas e período preservados;
- QA visual autenticado continua pendente conforme UX-M1.10.

### Verificação executada

- `npm run ui:audit:strict`: aprovado, sem novas divergências;
- `npm run type-check`: aprovado;
- `npm run test`: 147 arquivos e 662 testes aprovados na execução integral;
- `npm run build`: aprovado duas vezes com Next.js 16.2.10;
- `npm run agent:verify -- --level full`: documentação, escopo, arquitetura,
  segurança, desempenho, tipos, testes e build aprovados. O comando encerra com
  status não zero somente pela dívida global preexistente do ESLint (18 erros),
  sem erro nos arquivos do piloto;
- evidência integral: `reports/agent/verification/2026-09-07T16-42-32.899Z.md`.
