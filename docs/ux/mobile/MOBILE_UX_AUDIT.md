# UX-M1 — Auditoria da experiência mobile

**Data:** 05/09/2026  
**Estado:** `AUDIT_COMPLETE`  
**Escopo:** CRM autenticado; Super Admin, desenvolvimento, autenticação e páginas públicas permanecem fora.

## Método e critérios

A auditoria confrontou as rotas e componentes reais com o contrato de redesign,
o mapa de navegação, a matriz funcional e a especificação UX-M1. Afirmações antigas
de “mobile validado” não foram tratadas como evidência para teclado virtual, safe
area, orientação ou múltiplas larguras. O princípio adotado é: desktop organiza
espaço; mobile organiza prioridade.

Classificação: `KEEP_VISIBLE`, `RECOMPOSE`, `MOVE_TO_SHEET`, `MOVE_TO_MENU`,
`MOVE_TO_DETAILS`, `CONTEXTUAL`, `DESKTOP_ONLY_JUSTIFIED`, `REMOVE_LEGACY`.

## Achados transversais

1. O shell já tem bottom navigation abaixo de 560px e padding de safe area, porém
   esse breakpoint é local e não está documentado como contrato mobile.
2. Existem três famílias de header: `DashboardHeader`, headers locais e
   `LightTopNavBar`. A densidade e a ação primária variam em telas estreitas.
3. Há boa base responsiva em Leads e Conversas, mas várias tabelas administrativas
   ainda dependem de `overflow-x-auto`; isso preserva acesso técnico, não uma boa
   experiência touch.
4. `Dialog`, `Sheet` e drawers coexistem sem uma regra transversal que transforme
   formulários longos em full-height Sheet no mobile.
5. Touch target, teclado virtual, back, restauração de scroll e landscape não têm
   evidência automatizada ou manual suficiente.
6. `/tarefas` e `/metas` não possuem páginas canônicas atuais. As capacidades estão
   distribuídas em detalhe de lead, fila e dashboard; não se deve inventar rota mobile.
7. O Corretor Lite já é uma composição distinta, touch-first, e permanece sob a
   exceção visual DEC-015. UX-M1 não deve substituí-lo silenciosamente.

## Auditoria por rota

### `/dashboard`

- **Purpose:** leitura executiva/operacional por papel.
- **Primary action:** abrir o alerta ou drill-down prioritário.
- **Essential information:** período, escopo, KPIs críticos e atenção.
- **Secondary information:** gráficos, funis, tabelas por equipe/unidade/financeiro.
- **Current mobile state:** grids quebram progressivamente, tabs rolam; gráficos e
  tabelas mantêm composição próxima do desktop.
- **Problems:** excesso above-the-fold, tabs + período + KPIs antes da decisão;
  gráficos densos em 320–390px; tabelas sem representação semântica compacta.
- **Proposed composition:** header compacto, período em controle curto, até três KPIs
  acionáveis, atenção primeiro, gráficos abaixo; tabelas viram listas resumidas com
  drill-down.
- **Classification:** KPIs críticos `KEEP_VISIBLE`; filtros `MOVE_TO_SHEET`; tabelas
  `RECOMPOSE`; detalhes financeiros `MOVE_TO_DETAILS`.

### `/leads`

- **Purpose:** localizar, priorizar e operar oportunidades autorizadas.
- **Primary action:** abrir/criar lead conforme capacidade.
- **Essential information:** nome, etapa, qualificação, SLA/próxima ação.
- **Secondary information:** origem, plano, corretor/unidade, metadados e ações raras.
- **Current mobile state:** já possui cards/lista mobile, ações agrupadas, menu de
  header e bottom padding; filtros e tabs têm scroll horizontal.
- **Problems:** filtros avançados ainda alternam entre popover/dialog; chips podem
  competir com tabs; back/scroll restoration não têm teste; 320px pode acumular
  badges e ações.
- **Proposed composition:** lista semântica contínua, busca + botão `Filtros (n)`,
  filtros em Sheet, quick view full-height e ação principal persistente somente
  quando selecionado um lead.
- **Classification:** busca/lista `KEEP_VISIBLE`; filtros `MOVE_TO_SHEET`; ações de
  massa `CONTEXTUAL`; colunas secundárias `MOVE_TO_DETAILS`.

### `/leads/[id]`

- **Purpose:** conduzir o atendimento e avançar o lead.
- **Primary action:** próxima ação válida do estágio.
- **Essential information:** identidade mínima, status, SLA excepcional e ação.
- **Secondary information:** beneficiários, histórico, cotação, documentos e auditoria.
- **Current mobile state:** layout empilha seções e usa dialogs; o Corretor Lite tem
  uma composição própria.
- **Problems:** página Full pode produzir rolagem longa; dialogs de edição ricos não
  viram Sheet por regra; sticky actions e teclado virtual não foram certificados.
- **Proposed composition:** header compacto com voltar, resumo L1, tabs roláveis,
  seções L2 e sticky action bar com safe area; edição longa em full-height Sheet.
- **Classification:** resumo/ação `KEEP_VISIBLE`; tabs `RECOMPOSE`; formulários
  `MOVE_TO_SHEET`; auditoria `MOVE_TO_DETAILS`.

### `/conversas`

- **Purpose:** atendimento humano e contexto operacional.
- **Primary action:** responder/assumir quando permitido.
- **Essential information:** contato selecionado, histórico, composer e estado do canal.
- **Secondary information:** perfil, qualificação, notas, links e ações administrativas.
- **Current mobile state:** lista e chat já se alternam; perfil abre em Sheet; header
  reduz rótulos. O Lite é read-only e responde pelo WhatsApp externo.
- **Problems:** altura dinâmica/teclado virtual não comprovada; composer pode disputar
  espaço com bottom nav; há múltiplos scroll containers e ações comprimidas.
- **Proposed composition:** estado explícito `list | chat | context`, composer acima
  do teclado e da safe area, contexto em full-height Sheet e bottom nav ocultada
  durante chat ativo quando necessário.
- **Classification:** lista/chat `RECOMPOSE`; contexto `MOVE_TO_SHEET`; ações raras
  `MOVE_TO_MENU`.

### `/tarefas`

- **Purpose:** capacidade citada na navegação antiga, sem Home canônica atual.
- **Current mobile state:** rota ausente.
- **Problems:** documentação e prompt citam uma superfície que o código não oferece.
- **Proposed composition:** não criar rota. Mapear tarefas dentro da fila/detalhe até
  uma decisão de produto aprovar uma Home canônica.
- **Classification:** `NOT_APPLICABLE` nesta etapa.

### `/clientes` e `/clientes/[clientId]`

- **Purpose:** localizar clientes e consultar histórico/pós-venda autorizado.
- **Primary action:** abrir cliente ou contato permitido.
- **Essential information:** nome, contato, plano/status e próxima necessidade.
- **Secondary information:** detalhes cadastrais, histórico e documentos.
- **Current mobile state:** cards/grid na lista; detalhe empilha o layout e mantém tabs
  com scroll horizontal.
- **Problems:** quatro métricas comprimidas, cards excessivos e detalhe longo; busca,
  tabs e ações não possuem padrão mobile único.
- **Proposed composition:** lista com separadores, busca fixa no contexto, métricas sob
  resumo colapsável, detalhe com header voltar + tabs + ações em menu.
- **Classification:** lista `RECOMPOSE`; métricas `MOVE_TO_DETAILS`; ações raras
  `MOVE_TO_MENU`.

### `/equipe`

- **Purpose:** administrar acessos, cargos e escopo de unidade.
- **Primary action:** convidar membro quando autorizado.
- **Essential information:** pessoa, papel, unidade, disponibilidade e estado do acesso.
- **Secondary information:** e-mail, recuperação, permissões e ações administrativas.
- **Current mobile state:** tabela canônica e filtros; depende de largura/scroll para
  preservar colunas.
- **Problems:** tabela não é touch-first, ações por linha ficam distantes e selects
  grandes não foram validados com teclado/viewport.
- **Proposed composition:** lista administrativa compacta, status textual, menu por
  membro, filtros em Sheet e convite em full-height Sheet.
- **Classification:** tabela `RECOMPOSE`; convite/filtros `MOVE_TO_SHEET`; ações
  `MOVE_TO_MENU`.

### `/vendas` e `/vendas/[id]`

- **Purpose:** consultar vendas, valores e cronograma autorizado.
- **Primary action:** abrir venda; ações financeiras dependem de capacidade.
- **Essential information:** cliente, plano, valor, status e vencimento.
- **Secondary information:** comissões, beneficiários e histórico.
- **Current mobile state:** KPIs quebram em grid e detalhes empilham; tabelas de
  cronograma permanecem tabulares.
- **Problems:** quatro KPIs consomem a primeira viewport; números/colunas podem gerar
  largura excessiva; ações financeiras exigem distância contra toque acidental.
- **Proposed composition:** resumo financeiro compacto, lista de vendas, detalhe em
  tabs e cronograma como timeline/lista.
- **Classification:** KPIs `RECOMPOSE`; tabela `RECOMPOSE`; detalhes `MOVE_TO_DETAILS`.

### `/metas`

- **Purpose:** capacidade individual exibida em componentes, sem Home canônica atual.
- **Current mobile state:** rota ausente.
- **Proposed composition:** manter no dashboard/resumo pessoal até decisão de produto.
- **Classification:** `NOT_APPLICABLE` nesta etapa.

### `/qualificacao`

- **Purpose:** configurar, simular e monitorar a IA de qualificação.
- **Primary action:** salvar/publicar a configuração do contexto ativo.
- **Essential information:** estado da IA, seção atual e consequência da alteração.
- **Secondary information:** playbooks, triggers, templates e simulador.
- **Current mobile state:** KPIs empilham; navegação lateral vira tabs horizontais;
  formulários usam grids responsivos.
- **Problems:** cinco KPIs antes do conteúdo, tabs extensas e dialogs de configuração
  longos; risco de teclado cobrir footer.
- **Proposed composition:** status compacto, seletor de seção, formulários em uma
  coluna, footer de salvar com safe area e editores longos em full-height Sheet.
- **Classification:** status/ação `KEEP_VISIBLE`; KPIs `MOVE_TO_DETAILS`; navegação
  `RECOMPOSE`; editores `MOVE_TO_SHEET`.

### `/settings`

- **Purpose:** preferências pessoais e do tenant conforme papel.
- **Primary action:** salvar a seção atual.
- **Essential information:** seção, consequência e estado atual.
- **Secondary information:** configurações dependentes e diagnósticos.
- **Current mobile state:** tabs e formulários responsivos de forma heterogênea.
- **Problems:** formulários longos, múltiplas ações, selects e dialogs sem contrato de
  teclado; disclosure variável entre seções.
- **Proposed composition:** seletor compacto de seção, grupos progressivos, uma coluna,
  action footer seguro e diagnósticos movidos para detalhes.
- **Classification:** seção/estado `KEEP_VISIBLE`; dependências `CONTEXTUAL`; ações
  secundárias `MOVE_TO_MENU`.

### `/integrations`, `/integrations/meta`, `/integrations/whatsapp`

- **Purpose:** conectar e administrar canais autorizados do tenant.
- **Primary action:** conectar, retomar ou diagnosticar o canal atual.
- **Essential information:** estado, ativo selecionado, bloqueio e próxima ação.
- **Secondary information:** IDs, logs seguros, templates e configurações avançadas.
- **Current mobile state:** cards e assistentes empilham, mas wizards/dialogs conservam
  densidade desktop.
- **Problems:** CTAs e status duplicados, passos longos, tabelas de templates e
  popups externos; risco de perda de contexto após retorno da Meta.
- **Proposed composition:** uma integração por bloco, status + ação, detalhes em
  accordion, wizard full-height e retorno preservado por URL.
- **Classification:** status/ação `KEEP_VISIBLE`; técnico `MOVE_TO_DETAILS`; wizard
  `MOVE_TO_SHEET` quando interno.

## Priorização

| Prioridade | Problema | Rotas |
|---|---|---|
| P0 | Shell, safe area, viewport e contrato de scroll | todas |
| P0 | Composer + teclado virtual | `/conversas` |
| P0 | Tabelas administrativas sem composição mobile | `/equipe`, `/vendas`, dashboard |
| P1 | Filtros e formulários longos em Sheet | `/leads`, `/qualificacao`, `/settings` |
| P1 | Header e ação principal acima da dobra | dashboard, detalhe, integrações |
| P2 | Scroll/back/orientação/rede lenta | todas as rotas críticas |

## Gate da auditoria

`MOBILE_AUDIT_COMPLETE = YES`  
`MOBILE_UX_READY = NO` — implementação e QA ainda não concluídos.  
`BUSINESS_RULE_CHANGED = NO`  
`AUTHORIZATION_CHANGED = NO`
