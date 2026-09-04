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
