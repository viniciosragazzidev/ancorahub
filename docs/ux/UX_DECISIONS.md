# Registro de Decisões Visuais e Arquiteturais (UX Decisions Log)

> **Documento Vivo**: `docs/ux/UX_DECISIONS.md`  
> **Framework de Governança**: `UX-GOV-1`  
> **Fonte de Verdade**: `docs/ux/UX_REDESIGN_CONTRACT.md`  

Este documento registra formalmente todas as decisões de UX, UI, arquitetura de informação e padrões de componentes do CRM Âncora. Nenhuma alteração futura deve divergir dessas decisões sem uma revisão formal registrada aqui.

---

## DEC-001 — Sidebar Vertical Rail Compacta (5rem / 80px)

- **DECISION**: Adotar sidebar vertical rail com 80px de largura (`5rem`), tiles compactos (ícone no topo + legenda embaixo), fundo escuro `#0A1517` e tooltips contextuais instantâneos.
- **CONTEXT**: A sidebar textual antiga de 240px ocupava espaço horizontal excessivo e continha 13 itens espalhados em 4 seções, gerando sobrecarga cognitiva e roubando espaço de visualização das tabelas e do chat de conversas.
- **OPTIONS**:
  1. Manter sidebar textual de 240px colapsável por botão.
  2. Sidebar vertical rail com tiles compactos e tooltips laterais (adotada no modo Lite).
  3. Navegação exclusivamente por barra superior (TopBar).
- **CHOSEN**: Opção 2 (Sidebar Vertical Rail compacta).
- **WHY**: Maximiza o espaço útil de tela para o trabalho diário (leads, conversas, gráficos), mantém acesso direto aos módulos canônicos a 1 clique de distância e alinha o CRM com a ergonomia moderna de produtos de alta densidade.
- **IMPACT**: `app-shell.tsx`, `corretop-sidebar.tsx`, layout de todas as páginas do sistema.

---

## DEC-002 — Hierarquia de Ações de Página (Máximo 1 Primary Action no Header)

- **DECISION**: Todo `PageHeader` terá no máximo **1 ação primária** destacada (`variant="default"`). Ações secundárias, exportações, downloads e integrações devem ser agrupadas no menu `PageActions moreActions={[...]}`.
- **CONTEXT**: Diversas páginas acumulavam 3 a 5 botões coloridos no topo, competindo visualmente pela atenção do usuário e criando incerteza sobre o próximo passo.
- **OPTIONS**:
  1. Permitir múltiplos botões primários lado a lado.
  2. Permitir 1 botão primário + vários secundários horizontais.
  3. 1 botão primário de destaque + menu dropdown de 3 pontos para as demais ações.
- **CHOSEN**: Opção 3 (1 Primary + `DropdownMenu` para secundárias).
- **WHY**: Elimina a fadiga de decisão, orienta o fluxo operacional e mantém o cabeçalho limpo e responsivo mesmo em telas de notebook (1366×768).
- **IMPACT**: `<PageHeader />`, `<PageActions />`, páginas de Leads, Filiais, Campanhas e Relatórios.

---

## DEC-003 — Containers Leves (`Section` Plain) em vez de "Card-Soup"

- **DECISION**: O padrão visual estrutural de agrupamento é a `<Section variant="plain" />`, que utiliza ritmo de espaçamento vertical e tipografia em vez de colocar cada bloco dentro de um `<Card />` com borda e sombra pesadas.
- **CONTEXT**: O sistema sofria com o antipadrão "Card-Soup", onde cards eram aninhados dentro de cards, gerando bordas redundantes, excesso de caixas visuais e perda de hierarquia.
- **OPTIONS**:
  1. Manter `<Card />` com sombra e borda para qualquer bloco de conteúdo.
  2. Eliminar completamente os cards e usar apenas divisores horizontais.
  3. Usar `<Section />` leve como padrão e reservar `variant="card"` exclusivamente para blocos de dados isolados e independentes (ex: KPIs, quick view).
- **CHOSEN**: Opção 3.
- **WHY**: Cria uma interface limpa, que respira, onde os dados se destacam naturalmente através de tipografia e espaçamento sem sobrecarga de linhas e bordas.
- **IMPACT**: `<Section />`, listagens de Leads, Filiais, Configurações, Equipe.

---

## DEC-004 — Sistema de Filtros em 3 Camadas (`FilterBar` + Sheet + Chips)

- **DECISION**: Padronizar toda filtragem em: 1) Input de busca ágil com debounce; 2) Chips de filtros mais frequentes na mesma linha; 3) Sheet lateral para filtros avançados/densos; 4) `ActiveFilterChips` para exibir os filtros aplicados com remoção em 1 clique.
- **CONTEXT**: Algumas telas usavam popovers estreitos que cortavam selects longos, enquanto outras espalhavam 6 inputs na horizontal que quebravam o layout em telas intermediárias.
- **OPTIONS**:
  1. Barra horizontal com todos os filtros visíveis simultaneamente.
  2. Popovers individuais para cada campo de filtro.
  3. `FilterBar` unificada (Busca + Chips rápidos + Gatilho de Sheet Avançado + Active Chips).
- **CHOSEN**: Opção 3.
- **WHY**: Oferece velocidade para buscas rotineiras (nome, status), comporta filtros complexos sem poluir a interface e funciona de forma idêntica e acessível no Desktop e Mobile.
- **IMPACT**: `<FilterBar />`, `<ActiveFilterChips />`, Leads, Conversas, Vendas, Equipe.

---

## DEC-005 — Menu de Ações de Linha (`RowActions`) com Agrupamento Semântico

- **DECISION**: Ações dentro de tabelas e listas devem ser consolidadas em um menu `<RowActions />` de 3 pontos (`•••`), organizado em 3 grupos visuais: `primary` (ações diretas), `management` (gestão/configuração) e `danger` (ações destrutivas com destaque vermelho).
- **CONTEXT**: Tabelas com 4 a 6 botões de ícone por linha poluiam a tabela, causavam cliques acidentais e quebravam a largura das colunas.
- **OPTIONS**:
  1. Vários botões de ícone soltos em cada linha.
  2. Menu genérico sem agrupamento.
  3. `<RowActions />` com agrupamento semântico e separadores visuais.
- **CHOSEN**: Opção 3.
- **WHY**: Reduz a poluição visual, protege contra cliques acidentais em ações destrutivas e mantém a coluna de ações com largura estável e previsível.
- **IMPACT**: `<RowActions />`, tabelas de Filiais, Equipe, Campanhas, Usuários.

---

## DEC-006 — Persistência Obrigatória de Estado de Navegação na URL

- **DECISION**: Abas (`?tab=`), paginação (`?page=`), períodos (`?period=`) e filtros ativos (`?status=`, `?branch=`) DEVEM ser sincronizados com a URL (search params).
- **CONTEXT**: O usuário perdia o contexto ao recarregar a página, não conseguia compartilhar links diretos com colegas e o botão "Voltar" do navegador quebrava o fluxo.
- **OPTIONS**:
  1. Estado puramente local em React (`useState`).
  2. Estado no localStorage.
  3. Estado refletido e sincronizado na URL via search params.
- **CHOSEN**: Opção 3 (URL Search Params).
- **WHY**: Permite deep linking, favoritos, histórico do navegador previsível e compatibilidade com Server Components do Next.js.
- **IMPACT**: `<PageTabs />`, `<FilterBar />`, todas as rotas canônicas.

---

## DEC-007 — Confirmação em Duas Etapas (`ConfirmDialog`) para Ações Destrutivas

- **DECISION**: Nenhuma ação de exclusão, expurgo, desconexão de canal ou redefinição operacional pode ser executada em 1 clique. É obrigatório o uso do `<ConfirmDialog />` canônico com descrição clara do impacto e botão destrutivo.
- **CONTEXT**: Operações sensíveis (ex: desconectar número WhatsApp, excluir membro da equipe) tinham modais customizados inconsistentes ou confirmações via `window.confirm`.
- **OPTIONS**:
  1. `window.confirm` do navegador.
  2. Modais ad-hoc criados em cada feature.
  3. Componente canônico `<ConfirmDialog />` acessível com Radix/Base UI.
- **CHOSEN**: Opção 3.
- **WHY**: Garante segurança de dados, auditabilidade, acessibilidade por teclado (focus trap) e consistência visual.
- **IMPACT**: `<ConfirmDialog />`, exclusão de filiais, membros, conexões Meta/WAHA e templates.

---

## DEC-008 — Matriz Semântica Universal de Status (`StatusBadge`)

- **DECISION**: Eliminar o uso arbitrário de cores em badges e padronizar toda sinalização de status em 5 tons semânticos: `neutral` (inativo/rascunho), `info` (em andamento), `success` (concluído/aprovado), `warning` (atenção/pendência) e `danger` (erro/crítico).
- **CONTEXT**: Badges usavam paletas conflitantes (roxo, laranja, azul claro) sem critério funcional, gerando confusão sobre o real estado operacional do lead ou entidade.
- **OPTIONS**:
  1. Cores livres customizadas por desenvolvedor.
  2. Paleta semântica estrita de 5 tons (`StatusBadge`).
- **CHOSEN**: Opção 2.
- **WHY**: Toda cor na interface passa a ter um significado claro e intuitivo, reduzindo o tempo de leitura do operador.
- **IMPACT**: `<StatusBadge />`, `<StatusDot />`, Leads, Filiais, Qualificação IA, Webhooks.
## DEC-009 — Refinamento Clean UI com rollout reversível

- **DECISION**: O refinamento visual transversal usa os primitives existentes e é
  habilitado pelo controle auditável `feature_clean_ui_operational_enabled`.
- **SCOPE**: shell, rail, controles, abas, cards e composições do dashboard; não
  altera autorização, métricas, distribuição ou transporte de mensagens.
- **RULES**: bordas discretas, sombra apenas quando comunica ação, cor reservada a
  estado, uma gramática de controle e foco visível. O estado `classic` permanece
  como rollback por tenant.
- **VALIDATION**: cada rota continua sujeita ao gate visual e funcional próprio;
  nenhuma aprovação é inferida apenas pela existência dos tokens.

## DEC-010 — Cards de métrica e tabelas compartilham o baseline de Campanhas

- **DECISION**: o cartão de métrica de `/campanhas` é o baseline visual para
  indicadores compactos em todas as rotas. A composição compartilhada usa
  superfície neutra, borda discreta, raio de card, tile tonal de ícone,
  rótulo de origem monoespaçado e valor tabular.
- **TABLES**: `DataTable` adota a mesma superfície e a mesma gramática de
  cabeçalho/linhas da tabela de campanhas; a composição continua responsável
  por sorting, filtering, pagination, selection e ações.
- **OPTIONS**: estilos locais por rota; novo componente por feature; classe
  compartilhada governada pelo contrato visual existente.
- **CHOSEN**: classe compartilhada (`ui-metric-card`) e slots semânticos no
  `DataTable`, preservando `Card`, `Table` e tokens existentes.
- **WHY**: reduz drift visual sem transformar a camada de apresentação em
  regra de negócio e permite rollout/rollback pelo flag Clean UI.
- **IMPACT**: `/campanhas`, `StatCard`/`MetricCard`, KPIs de relatórios,
  `DataTable` e `/leads`.

## DEC-011 — Relatórios como dashboard canônico

- **DECISION**: `/dashboard` passa a renderizar o Reporting Center de
  `/relatorios`, com abas, período e escopo por papel. `/relatorios` permanece
  apenas como redirecionamento de compatibilidade para evitar duas experiências
  concorrentes.
- **NAVIGATION**: o item incorreto “Tarefas” que apontava para relatórios é
  removido; “Qualificação IA” passa a aparecer explicitamente em `/qualificacao`.
- **WHY**: o painel de gestão e o centro de relatórios eram a mesma intenção
  operacional; uma única entrada reduz ambiguidade e custo cognitivo.
- **IMPACT**: dashboard, links de drill-down, onboarding e sidebar. Não altera
  cálculos, permissões ou escopo de tenant.

## DEC-012 — Primitives visuais como ponto único de refinamento

- **DECISION**: o refinamento de cards e tabelas deve acontecer nos primitives
  compartilhados (`Section`, `Card`, `Table`, `DataTable` e `StatCard`) antes de
  receber classes específicas em uma rota.
- **WHY**: `/filiais`, `/equipe`, `/vendas`, `/unidades` e `/leads` passam a
  compartilhar a mesma superfície, hierarquia e estados da experiência
  canônica sem duplicar CSS ou introduzir drift por feature.
- **GUARDRAIL**: estados semânticos (warning, success, destructive), ações e
  regras de negócio permanecem definidos pela feature e não são sobrescritos
  pelo tratamento visual comum.

## DEC-013 — Canvas claro e Qualificação alinhada ao Dashboard

- **DECISION**: no tema claro, o canvas operacional usa branco como superfície
  base; áreas de conteúdo e tabelas continuam separadas por espaçamento,
  bordas discretas e superfícies compartilhadas, não por um fundo cinza escuro.
  Os cinco indicadores de `/qualificacao` usam `StatCard`, o mesmo primitive do
  dashboard, e a navegação da configuração recebe slots semânticos e estado
  acessível.
- **WHY**: reduzir contraste ambiental e variação entre rotas melhora leitura
  de dados e torna o centro de qualificação reconhecível como parte do mesmo
  produto.
- **SCOPE**: somente apresentação; tema escuro, permissões, métricas, estados de
  IA e regras de tenant permanecem inalterados.
- **ROLLBACK**: a flag Clean UI continua sendo a fronteira de ativação dos
  tokens claros; não há migração de dados nem dependência nova.

## DEC-014 — Biblioteca única e conversão transversal auditável

- **DECISION**: `src/components/ui` é a fonte única de primitives e
  `src/components/foundations` é a fonte única de composições de página.
  Componentes de feature podem compor essas bases, mas não redefinir sua
  aparência. DataTables com modelos de estado diferentes compartilham
  `DataTableFrame` enquanto os adapters são migrados.
- **ICONOGRAPHY**: emoji é proibido como chrome, status ou decoração; conteúdo
  do cliente e corpos de mensagem permanecem dados do domínio.
- **PERFORMANCE**: Motion é opt-in. Primitives estruturais devem ser
  server-safe e o rollout continua resolvido no servidor.
- **GOVERNANCE**: `ui:audit` impede regressão sobre baseline e
  `ui:audit:strict` define o estado-alvo zero. Nenhuma etapa global será
  marcada completa antes de o catálogo por rota e os gates confirmarem.
- **WHY**: uma biblioteca declarada sem adoção verificável não impede drift.
  Catálogo, baseline e adapters permitem conversão gradual com rollback e sem
  misturar redesign com regras de domínio.

## DEC-015 — Preservação da experiência clássica do Corretor Lite

- **DECISION**: o workspace do Corretor Lite mantém a composição visual anterior
  ao lote UX-H1. A exceção abrange somente `LightTopNavBar` e os componentes
  `Light*` efetivamente usados em dashboard, fila, leads, clientes, detalhe,
  feedback e insights.
- **WHY**: após comparar a versão padronizada com a experiência anterior, o usuário
  aprovou explicitamente o retorno da linguagem clássica por ser mais adequada ao
  uso cotidiano do corretor.
- **BOUNDARY**: a restauração é somente visual. Roteamento por papel e modo,
  isolamento de tenant/carteira, permissões, leitura WAHA e regras operacionais
  continuam inalterados. Gestor, Diretor, Super Admin e demais rotas não herdam
  esta exceção.
- **MOBILE**: o Corretor Lite conserva a barra superior clássica e expõe os mesmos
  destinos primários no menu compacto. Diretor, Gestor e Supervisor usam a rail no
  desktop e a mesma navegação em `Sheet` lateral sobreposto no mobile, sem uma
  segunda barra inferior concorrente.
- **ROLLBACK**: reaplicar a migração dos componentes Lite sobre os primitives
  canônicos em um lote próprio, somente após nova aprovação visual.

## DEC-016 — UX-M1 como fundação transversal mobile

- **DECISION**: mobile não terá rotas, APIs, autorização ou regras de negócio
  paralelas. As mesmas rotas e fontes de dados serão recompostas por prioridade,
  usando CSS responsivo e comportamento distinto somente quando a interação exigir.
- **SEQUENCE**: auditoria e matriz funcional antecedem M1.1 Foundations; depois seguem
  shell, dashboard, leads, lead workspace, conversas, clientes, equipe/vendas,
  settings/integrações e QA transversal.
- **PATTERNS**: tabelas operacionais viram listas semânticas quando necessário;
  filtros avançados usam Sheet; contexto de conversas usa Sheet; formulários longos
  usam full-height Sheet no mobile.
- **NAVIGATION**: a navegação principal do CRM é única. A rail fica fora do fluxo
  no mobile e abre como `Sheet` lateral fixo, com backdrop, fechamento explícito,
  foco contido e transição compatível com `prefers-reduced-motion`. O shell não
  renderiza `MobileBottomNav` em paralelo.
- **BOUNDARY**: `/tarefas` e `/metas` não serão inventadas porque não existem como
  Homes canônicas no código atual. O Corretor Lite continua protegido pela DEC-015.
