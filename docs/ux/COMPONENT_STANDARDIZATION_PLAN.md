# Plano de Padronização Integral de Componentes

**Estado:** CRM operacional convertido; QA visual em execução  
**Decisão:** DEC-014  
**Inventário por rota:** `docs/ux/audits/ROUTE_COMPONENT_CATALOG.json`

## Escopo da rodada de 2026-09-05

Esta rodada cobre exclusivamente o CRM autenticado: dashboard, leads,
conversas, equipe, qualificação, distribuição, campanhas, documentos,
financeiro, propostas, metas e configurações usadas pela operação. Super Admin,
ferramentas de desenvolvimento/diagnóstico, autenticação e páginas públicas
ficam deliberadamente fora e terão auditoria própria em uma etapa posterior.

## Resultado esperado

Cada situação recorrente usa uma única base em `src/components/`, com variantes explícitas. Rotas deixam de definir cores, sombras, raios, estados, foco ou motion próprios. Regras de negócio, permissões e dados permanecem nas features e no servidor.

## Diagnóstico verificável

O catálogo percorre os 90 `page.tsx` e seus imports locais transitivos. A auditoria direta encontrou, no início desta etapa, 67 botões, 73 inputs, 4 selects, 15 tabelas e 2 textareas nativos fora das pastas canônicas, além de 14 cores, 11 raios e 42 sombras arbitrárias. Há duas APIs TanStack de DataTable, três famílias históricas de EmptyState e baixa adoção de algumas foundations declaradas concluídas.

Esses números são dívida, não aprovação. O JSON por rota permite ordenar a conversão sem depender de inspeção subjetiva ou esquecer rotas menos acessadas.

## Arquitetura escolhida

Foram confrontadas três propostas: API mínima, compound components e migração progressiva. A solução adotada combina as três:

- primitives pequenas e compatíveis em `components/ui`;
- compound components apenas onde ordem e semântica importam;
- adapters temporários para preservar comportamento durante a migração;
- rollout Clean UI server-side e reversível;
- nenhuma mega-API `Overlay` ou `Page` com dezenas de props.

## Catálogo e destino

| Família atual | Destino único | Conversão |
|---|---|---|
| `button.tsx`, botões nativos e receitas locais | `ui/Button` | manter compatibilidade; CSS-first; icon-only exige `aria-label` |
| `card.tsx`, cards de rota e divs com recipe | `ui/Card`, `foundations/Section`, `StatCard` | escolher por intenção; remover `card-soup` |
| `ui/table`, duas DataTables, tabelas nativas | `ui/Table` + `ui/data-table/DataTableFrame` | compartilhar aparência agora; convergir comportamento por lotes |
| tabs locais e links estilizados | `ui/Tabs` ou `foundations/PageTabs` | separar estado local de navegação URL |
| inputs/selects/textarea nativos | controls em `ui` dentro de `ui/Field` | preservar eventos e validação server-side |
| Dialog/Sheet/Drawer/Popover | primitives atuais + presets foundations | manter semântica separada |
| badges por rota | `foundations/StatusBadge` + mapas de domínio | trocar emoji/hue por tom e ícone |
| EmptyState duplicado | `foundations/EmptyState` | adapter e remoção após zerar consumidores |
| `components/base` e `components/application` | quarentena | nenhuma importação nova; retirar após prova de não uso |

## Lotes de conversão

### Lote 0 — fundação e não regressão

- [x] Sidebar preta via tokens, sem cores fixas na rail.
- [x] `Button` CSS-first, sem Motion obrigatório.
- [x] `Table` e `Field` server-safe.
- [x] `DataTableFrame` compartilhado pelas duas APIs existentes.
- [x] `/leads` usa a mesma superfície clara de `/equipe`.
- [x] auditor e catálogo por rota versionados.

### Lote 1 — primitives e chrome

- [x] zerar botões nativos de chrome e ações no CRM;
- [x] zerar selects nativos no CRM;
- [x] converter emojis de interface para ícones no CRM;
- [x] substituir inputs e textareas visíveis nativos pelos primitives compartilhados;
- [ ] revisar associação de label, descrição e erro em QA por rota;
- [ ] manter inputs `hidden` nativos quando forem transporte sem UI.

### Lote 2 — dados e navegação

- [x] migrar tabelas nativas simples do CRM para `ui/Table`;
- [x] remover recipes locais de superfície da tabela de `/leads`;
- [ ] escolher adapter state-owned ou controlled por rota;
- [ ] migrar navegação de rota para `PageTabs` e tabs locais para `ui/Tabs`;
- [ ] garantir link acessível na célula primária.

### Lote 3 — superfícies e estados

- [ ] converter div-cards para `Card`, `Section` ou estrutura plain;
- [ ] consolidar métricas em `StatCard`;
- [ ] consolidar status e empty/loading/error;
- [x] remover cores, raios e sombras arbitrárias detectáveis no CRM operacional.

### Lote 4 — overlays e formulários

- [ ] substituir `window.confirm` por `ConfirmDialog`;
- [ ] migrar edições contextuais para `DetailDrawer`/Sheet;
- [ ] padronizar rodapé, pending, erro e foco inicial;
- [ ] validar formulários com Server Actions sem confiar em tenant do cliente.

### Lote 5 — retirada e certificação

- [ ] zerar `ui:audit:strict` no chrome de produto;
- [ ] remover adapters sem consumidores e stacks em quarentena;
- [ ] QA por papel, viewport, tema e estado;
- [ ] medir JS, RSC, INP e CLS antes/depois;
- [ ] atualizar catálogo, matriz funcional, changelog e registro de implementação.

## Ordem das rotas

1. Shell e rotas de maior frequência: `/dashboard`, `/leads`, `/conversas`, `/equipe`, `/qualificacao`.
2. Operação: `/distribuicao`, `/vendas`, `/clientes`, `/documentos`, `/campanhas`.
3. Configuração: `/settings`, `/configuracoes`, `/integrations`, `/metas`.
4. Fora desta rodada: `/super-admin`, áreas dev/diagnóstico, autenticação e páginas públicas.

Dentro de cada grupo, o catálogo ordena primeiro rotas com controles nativos e magic values. Uma rota só recebe `COMPLETE` após preservar ações, URL, filtros, estados, permissão, escopo, responsividade e teclado.

## Gates por lote

- nenhuma regra de negócio alterada;
- nenhuma dependência nova;
- nenhuma consulta aceita `tenantId` do cliente;
- nenhuma funcionalidade válida removida;
- `ui:audit` sem regressão e baseline reduzido;
- type-check, testes focados, build e harness completos;
- QA visual em 390x844, 1366x768, 1440x900 e 1920x1080;
- documentação e roadmap atualizados.

`ui:audit:strict` está zerado para o escopo CRM. Isso certifica a adoção dos
primitives e tokens verificáveis, mas não substitui QA visual/funcional por
papel e viewport. “Todo o app” só poderá ser declarado após as ondas separadas
de Super Admin, dev, autenticação e público.
