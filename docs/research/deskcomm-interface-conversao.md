# Rotas, telas e design: DeskComm e conversão para o AncoraHub

Data: 26/11/2026. Complementa `docs/research/deskcomm-crm-engenharia-reversa.md` (seções 4 e 5).

Fontes:
- **DeskComm:** clone de `github.com/melgarafael/DeskcommCRM` (commit `5e03dd7`), lido sem rodar nada. Os caminhos citados como "DC" são relativos à raiz do repositório.
- **AncoraHub:** branch `preview/3005`. Os caminhos citados como "AH" são relativos à raiz deste repositório.

Foco: como as rotas e as telas são organizadas e montadas, e o design geral. Funcionalidades e modelo de negócio estão no documento anterior.

Regra desta conversão: trazemos a **organização** do DeskComm, não a **aparência**. O visual continua o Lite ("Conversa"): Inter 400/500, azul de ação, superfícies frias e tokens só abaixo de `.arc-venancor`. Nenhuma cor, fonte ou raio do DeskComm entra.

---

## 1. Resumo

1. **Um catálogo só.** O DeskComm tem uma lista única de destinos (`NAV_CATALOG`). A sidebar, os hubs, o ⌘K e a barra do celular saem dela. O AncoraHub tem pelo menos 8 listas de rotas que não conversam entre si. Essa é a maior diferença e a raiz da maior parte dos problemas.
2. **Toda tela tem porta, e um teste cobra.** Lá, uma rota nova fora do catálogo quebra o CI. O nosso teste casa por prefixo, por isso deixa passar telas órfãs.
3. **Menu curto, hub para o resto.** Grupo com mais de 4 telas ganha um hub "Ver tudo em…" com cartões descritos, e um teste e2e garante que o menu cabe em 1280×900 sem rolar. Nós temos 64 abas, com 16 em Atendimento IA e 26 no grupo Comercial.
4. **Casca com um contêiner de rolagem e telas finas.** A `page.tsx` do servidor autentica e lê o mínimo, e o `_client.tsx` ao lado monta a tela. O `loading.tsx` tem a silhueta da tela.
5. **Detalhe com duas portas e link estável.** O mesmo componente vira gaveta ou página ("Expandir"). Um link fixo (`/app/leads/[id]`) resolve o contexto na hora.
6. **Subtela de configuração com caminho de volta, cobrado por teste.**
7. **Design:** o que vale copiar é o processo, não a cara:
   - contraste medido em teste;
   - corte de toque uniforme;
   - movimento reduzido que não trava;
   - toast com tom pela intenção;
   - doutrina destrutiva com o alvo nomeado;
   - anti-padrões documentados.

   A execução deles tem furos: pesos de fonte que não existem, primitivos que violam a própria doc, botão "Excluir" verde.
8. **O AncoraHub já é melhor em:**
   - lista com gaveta (`LiteResponsiveData` + `LiteSidePanel`);
   - padrão de feedback (`FEEDBACK.md`, `LiteActionButton`);
   - um CTA por tela;
   - experiência do corretor em conversa.

   Isso fica.

---

## 2. Como o DeskComm organiza rotas e telas

### 2.1 Árvore de rotas

Tudo do tenant mora em `app/app/**`, numa árvore rasa e previsível:

| Bloco | Rotas | Observação |
|---|---|---|
| Atendimento | `/app/inbox`, `/app/radar`, `/app/agenda`, `/app/templates` | `/app/inbox/[id]` só redireciona para `/app/inbox?id=` |
| CRM | `/app/crm` (hub), `/app/kanban`, `/app/pipelines/[id]`, `/app/leads/[id]`, `/app/contacts`, `/app/tasks`, mais cerca de 15 telas de módulo | `/app/leads/[id]` é link estável e redireciona para o funil com `?lead=` |
| IA | `/app/ai` (hub) e cerca de 20 telas | |
| Canais | `/app/connections`, `/app/webhooks` | |
| Análise | `/app/analise` (hub), `/app/metrics`, vendas, atividades, anúncios | |
| Organização | `/app/settings` (hub) e cerca de 30 subtelas `/app/settings/<sub>`, `/app/team`, `/app/ajuda` | |
| Módulos | `/app/m/[modulo]` | rota gerada |

Pontos de estrutura:
- **Sem rota paralela, sem rota interceptadora, sem modal roteado.** Diálogo e gaveta são estado do cliente, às vezes refletido em search param.
- **Layout aninhado só serve de portão** de módulo ou capacidade: ele chama `notFound()` e não desenha nada (DC `app/app/companies/layout.tsx`, `app/app/proposals/layout.tsx`). O desenho fica todo na casca.
- **Telas de estado** são rotas próprias: `/403`, `/500`, `/acesso-revogado`, `/account-suspended`.

### 2.2 A casca

DC `app/app/layout.tsx` e `app/app/_components/AppShell.tsx`:
- O layout resolve os redirects (login, acesso revogado, onboarding) e lê tudo em um `Promise.all`. O estado da sidebar vem de cookie, lido no servidor para não piscar.
- **Um único contêiner de rolagem:** o `<main>`, com `min-w-0` para a tabela larga não empurrar a página.
- **TopBar de 56px:** hambúrguer, troca de empresa, busca (⌘K), avisos e usuário. **Não tem título.** Cada página escreve o próprio h1.
- **Celular:** barra inferior com 4 destinos tirados de uma lista de preferência e filtrados pela mesma régua do menu, mais "Mais", que é a gaveta com a sidebar.
- **Contrato do rodapé:** as telas de altura fixa (Inbox, quadro) leem `--rodape-ocupado` em vez de chutar um número, e há teste para isso.

### 2.3 Arquétipos de tela

| Arquétipo | Anatomia (de cima para baixo) | Exemplo DC |
|---|---|---|
| Lista | h1 e subtítulo; ações à direita; faixa de filtros; barra de lote; tabela em Card; "Carregar mais"; diálogos no fim | `app/app/contacts/_client.tsx` |
| Lista com visões | h1; Selects de filtro; interruptor Lista/Calendário/Quadro; Atualizar; Nova tarefa | `app/app/tasks/_components/TarefasClient.tsx` |
| Detalhe | h1 com identidade e etiquetas; ações; bloco de pendência; abas (Visão geral, Linha do tempo…) | `app/app/contacts/[id]/_client.tsx` |
| Negócio | **mesmo componente** em gaveta (`Sheet` à direita) e em página (`variante="pagina"`) com link Voltar | `components/kanban/LeadDossier.tsx:541-653` |
| Quadro | o h1 é um seletor de funil; visões quadro/lista/calendário em `?visao=`; filtros na URL | `app/app/pipelines/[id]/_client.tsx` |
| Inbox | grade de 3 colunas; a ficha vira `Sheet` abaixo de `xl`; a conversa vira camada cheia no celular; seleção por History API | `components/inbox/InboxLayout.tsx` |
| Hub | h1 e subtítulo de propósito; seções por intenção; cartões com ícone, nome e uma linha | `components/shell/NavHub.tsx` |
| Subtela de config. | "← Voltar para Configurações", h1 e texto; busca por GET; paginação por link | `components/settings/CabecalhoDaSubTela.tsx` |
| Painel | período; uma coluna de painéis; cada painel busca o próprio dado e tem o próprio erro | `app/app/metrics/_components/MetricsClient.tsx` |
| Wizard | layout com stepper; `page.tsx` só redireciona ao próximo passo pendente | `app/onboarding/`, `lib/onboarding/passos.ts` |

### 2.4 Navegação

- **Visão e filtros na URL** com `router.replace(..., { scroll: false })`, e um par `filtersFromParams`/`filtersToParams` (DC `lib/kanban/filters.ts`).
- **Link de volta que leva a URL de origem validada** (`?voltar=`, aceito só se começar pelo caminho esperado; DC `lib/leads/pagina-do-negocio.ts:36-74`).
- **Sem breadcrumb.** O caminho de volta é explícito: subtela de configuração, "Voltar" na página do negócio.
- **Prefetch só por intenção** (hover ou foco), cobrado por teste.
- **⌘K** indexa o catálogo, os funis, os fluxos e os agentes.

### 2.5 Como nasce uma tela nova

1. Criar a `page.tsx` (servidor), com `metadata.title`, auth e portão, e delegar ao `_client.tsx`.
2. Declarar a porta no catálogo. Os campos são `href`, `label`, `description` (obrigatória, usada no hub e no ⌘K), `icon`, `group`, `section`, `minRole`, `sidebar`, `contador`, `modulo` e `capacidade`.
3. Os testes conferem:
   - completude exata, ou seja, toda rota no disco tem porta ou motivo escrito, e não há link morto;
   - menu sem rolagem em 1280×900;
   - Configurações fixa no rodapé;
   - toda subtela de configuração usa `CabecalhoDaSubTela`.

---

## 3. Design do DeskComm: o que copiar e o que não

### 3.1 Vale copiar, como processo ou regra

| # | Decisão | Por que serve para nós | Evidência DC |
|---|---|---|---|
| 1 | Contraste medido em teste (temas, cores de canal, esqueleto) | Hoje conferimos contraste no olho | `lib/aparencia/aparencia.test.ts`, `components/ui/skeleton.tsx:6-17` |
| 2 | Corte de toque uniforme: 44px com dedo, compacto com cursor | O Lite pede 44px, mas cada componente resolve de um jeito | `components/ui/button.tsx:54-66`, `globals.css:670-721` (`.ds-alvo-44`) |
| 3 | Movimento reduzido "calmo, não quebrado": spinner e esqueleto continuam, saída desmonta no mesmo quadro | Complementa a regra de `prefers-reduced-motion` do `FEEDBACK.md` | `globals.css:1494-1570` |
| 4 | Tom pela intenção: recusa esperada em aviso, quebra real em erro, sempre com o ID da requisição | Vermelho no que é rotina ensina a ignorar vermelho | `components/feedback/ApiErrorToast.tsx:93-121` |
| 5 | Confirmação destrutiva com o alvo no título ("Excluir esta cadência?") | Já temos `LiteConfirmDialog`; falta a regra do texto | `docs/doctrine/destrutivo-pede-confirmacao.md` |
| 6 | Lista de anti-padrões com motivo e alternativa | Vira memória do sistema; evita discutir de novo | `docs/design-system/09-anti-patterns.md` |
| 7 | Barril único de ícones, com a escolha de cada um comentada | Temos huge-icons, lucide, phosphor e os ícones de marcador novos misturados | `lib/ui/icons.ts` |
| 8 | Esqueleto com a silhueta da tela e atributo de teste (`data-esqueleto`) | Temos 4 implementações de carregamento | `components/ui/skeleton.tsx:43-56`, `app/app/kanban/loading.tsx` |
| 9 | Barra de progresso de navegação que não acende para a rota atual | Dá resposta imediata ao clique sem pular a tela | `components/shell/BarraDeProgressoNavegacao.tsx` |
| 10 | Vazio em 3 partes (estado, causa, próximo passo) com variantes nomeadas por tela | Temos 4 componentes de vazio | `components/empty/variants.tsx`, `docs/design-system/08-voice-and-tone.md:75-81` |

### 3.2 Não copiar

- **Paleta greige/Sage, Atkinson, Phosphor, abas em pílula, densidade "Aerada"**: são a identidade deles. O Lite tem a sua.
- **Catálogo "Aparência" com 10 temas por empresa**: reintroduz gradiente, vidro e roxo, que a própria doc deles proíbe. Para nós, que somos uma empresa só, é custo sem retorno.
- **Diálogo para criar e editar (89 arquivos)**: a nossa gaveta lateral é melhor para quem fica o dia todo, porque mantém a lista à vista.
- **Linha de tabela que não abre**: lá só o nome é link. Aqui a linha inteira abre a gaveta, e assim fica.
- **Erros deles a evitar**:
  - `font-medium` e `font-semibold` com a fonte carregada só em 400 e 700;
  - tamanhos de 10 e 11px;
  - `AlertDialogAction` verde para "Excluir";
  - contador `bg-red-600`;
  - doc que diz "vencer o código" mas está desatualizada.

---

## 4. Como o AncoraHub está hoje

Resumo do mapa de `preview/3005`. O mapa completo está nas evidências citadas abaixo.

### 4.1 Números

- 152 `page.tsx` em `(dashboard)`, 11 áreas e 64 abas (`AH src/shared/navigation/nav-registry.ts:61-214`).
- Abas por área:

  | Área | Abas |
  |---|---|
  | Atendimento IA | 16 |
  | Financeiro | 10 |
  | Comercial | 8 |
  | Operação ERP | 8 |
  | Distribuição | 5 |
  | Configurações | 5 |
  | Equipe | 4 |
  | Leads | 3 |
  | Início | 2 |
  | Marketing | 2 |
  | Conversas | 1 |

  O grupo Comercial soma 26 abas de 3 áreas.
- Visões internas por query, além das abas: `/leads` 7, `/qualificacao` 5, `/conversas` 4, `/dashboard` 3, `/equipe?visao=`.
- 96 páginas montam o próprio `DashboardHeader`, e 34 arquivos têm `<h1` próprio.

### 4.2 Os 10 problemas de organização

1. **Duas interfaces vivas por tela.** O gestor está no visual antigo (`AH src/features/broker-workspace/experience-mode.ts`, `lite-audience.ts:19` com `isManagerLiteAvailable` sempre `false`). Há 63 arquivos com `isDirectorLitePageOnServer`, 55 com `useDirectorLitePage` e 88 `*-lite.tsx`. Isso contraria "Lite é a única versão".
2. **Pelo menos 8 listas de rotas:**
   - `nav-registry.ts`;
   - `light-routes.ts` (rotas permitidas, títulos e "Mais");
   - `director-routes.ts` (títulos que ninguém lê);
   - `director-lite-routes.ts` (opt-out);
   - `manager-routes.ts`;
   - o catálogo de cargos;
   - `feature-search-index.ts`;
   - cerca de 50 `layout.tsx` com `redirectManagerAway`.
3. **Telas mortas e órfãs que ainda compilam:**
   - 5 `*/dashboard`;
   - `/minha-fila` (731 linhas atrás de um redirect);
   - `/gestao`, `/empresas` e o trilho do gestor Lite;
   - `LightBottomNav` e `LightSideRail`.
4. **Mesmo assunto em várias rotas:**
   - Plantão em 7 endereços;
   - WhatsApp em 5;
   - detalhe de equipe em 2 (`/equipe/equipes/[id]` e `/gestao/equipes/[id]`);
   - drill do painel em 2.
5. **URL que não bate com a área.** Propostas fica em `/vendas?tab=` e Comissões em `/settings?tab=` (`AH vendas/page.tsx:23-27`, `settings/page.tsx:63-67`). Por isso a sidebar acende Configurações quando se está em Comissões (`AH src/components/corretop-sidebar.tsx:132`).
6. **Excesso de abas e 3 a 4 níveis de hierarquia.** Exemplo em `/leads`: header, abas da área, 7 visões, filtros, filas e só então o conteúdo.
7. **Quatro jeitos de guardar a visão** (`?view` no servidor, `inPlace` com `pushState`, `replaceState` nas Configurações, painel por URL do ERP) e **quatro tipos de painel lateral** (`LiteSidePanel` 30, `ui/sheet` 40, `DetailDrawer` 4, `BottomSheet` 43).
8. **Título sem dono.** Cada página passa título e breadcrumb livres. Há três tabelas de títulos, e páginas com título duplicado (`AH tarefas/page.tsx:55,65`).
9. **Kits paralelos e doc desencontrada:**
   - Density manda `DataTable + SectionCardHeader + Sheet`, mas as telas Lite usam `LiteResponsiveData + LiteSidePanel`.
   - Convivem `erp-kit`, `foundations/*`, `ui/ds-*`, 2 `DataTable`, 4 vazios e 4 carregamentos.
10. **Busca quebrada:**
    - dois índices;
    - `/automacoes`, que não existe (`AH src/shared/feature-search-index.ts:146-150`);
    - `/clientes?leadId=`, que a página não lê;
    - setas prometidas no rodapé e não implementadas (`AH src/components/command-palette.tsx:228`).

Bugs pequenos achados no caminho:
- `isPlantaoActive` procura `view=plantao` no `pathname`, que não tem query, então o item nunca acende (`AH corretop-sidebar.tsx:128-130`).
- O teste de completude casa por prefixo (`AH nav-registry.test.ts:86-91`), então não pega órfãs.

---

## 5. Conversão: o modelo alvo para o AncoraHub

Regra herdada (memória "Route reorg keeps design"): **regrupar não muda nome, visual nem informação na tela.** Toda URL antiga vira redirect para a nova.

### 5.1 Um catálogo só: `nav-registry.ts` vira a fonte de tudo

Hoje `NAV_AREAS` já tem áreas, abas, `permission`, `roles`, `paths` e `hub`. Faltam cinco campos para ele substituir as outras listas:

| Campo novo na aba | Para quê | Substitui |
|---|---|---|
| `description` (obrigatória, uma linha) | cartão do hub e resultado do Ctrl+K | `feature-search-index.ts` |
| `title` (o que vai no cabeçalho) | título da página saindo do cadastro | títulos livres das 96 chamadas e de `director-routes.ts` / `light-routes.ts` |
| `parent` (href) | botão voltar | `parentHref` de `director-routes.ts` |
| `audiences` (`director`, `manager`, `supervisor`, `broker`) | quem vê, no menu e no "Mais" | `light-routes.ts` (rotas permitidas e "Mais"), `manager-routes.ts` |
| `counter` (`ofertas`, `conversas`, `alertas`…) | número no menu, que some no zero | não existe hoje |

Projeções, como funções puras no mesmo arquivo:
- `sidebarGroups(context)`
- `hubSections(areaId)`
- `searchable(context)` para o Ctrl+K
- `moreSheet(context)` para o "Mais" do corretor e do supervisor
- `routeMeta(pathname, search)`, que devolve título, voltar e área ativa **com a query**. Isso corrige o bug de Comissões e o do Plantão.

Depois disso, `director-routes.ts`, a parte de títulos de `light-routes.ts` e `feature-search-index.ts` são apagados.

### 5.2 Regra do menu: no máximo 5 abas na fileira, o resto em hub

Copiamos a regra do DeskComm, adaptada ao Lite: **área com mais de 5 telas mostra na fileira só as de uso diário e põe o resto num hub** ("Ver tudo em…"). O hub é uma página Lite com seções por intenção e cartões com nome e uma linha de descrição.

Atendimento IA já funciona assim (4 na fileira e 12 no hub, `AH nav-registry.ts:171-188`). Vira o modelo para as outras:

| Área | Fica na fileira (uso diário) | Vai para o hub, por seção |
|---|---|---|
| Atendimento IA (16) | Início, Leads na qualificação, Alertas, Execuções | já feito |
| Financeiro (10) | Lançamentos, Recebíveis, Despesas, Caixa | **Conferir:** Conciliação, Fechamentos. **Pagar o time:** Comissões, Repasses, Adiantamentos, Recibos |
| Comercial (8) | Vendas, Propostas, Negociações, Clientes | **Vender mais:** Venda Automatizada, Ferramentas. **Papéis:** Documentos, Comissões |
| Operação ERP (8) | Implantação, Metas, Indicações | **Acompanhar:** Inteligência, Modo TV, Incentivos. **Montar:** Importações, Módulos |
| Distribuição (5) | sem mudança | |

Os nomes das abas não mudam. Só sai da fileira o que não é diário. Os números de cada área são decisão de produto, e a tabela acima é a proposta.

### 5.3 Sidebar do diretor

Mantém a ordem "operar antes de ajustar" já feita (seção 6 do documento anterior) e acrescenta três coisas:
1. **Contadores** em Distribuição (ofertas sem aceite), Conversas (sem resposta) e Atendimento IA (alertas abertos). Mostram número ou nada, em `tabular-nums`, sem cor de status no menu: o número basta. Isso respeita "status só com texto".
2. **Configurações fixa no rodapé**, junto do Agente IA e do perfil, como lá.
3. **Teste de altura:** o menu inteiro cabe em 1280×900 sem rolar.

### 5.4 Uma casca e um cabeçalho

- **O cabeçalho sai do cadastro.** `DashboardHeader` passa a ler `routeMeta()` para título, voltar e área. A página só passa o resumo e as ações (`rightSlot`). Isso elimina os breadcrumbs livres e os h1 duplicados.
- **Uma fileira de abas no máximo.** Visões internas (as 7 de `/leads`, Operação/Qualidade/Funil no painel) viram um `LiteUrlSelect` ou um segmented na própria barra de filtros, nunca uma segunda fileira de abas.
- **Um contêiner de rolagem** e telas de altura fixa (Conversas, Kanban) lendo uma variável de reserva, como `--rodape-ocupado` deles.

### 5.5 Arquétipos canônicos do Lite

Um componente por papel. Os outros entram em desuso, migrados tela a tela.

| Arquétipo | Peças | Substitui |
|---|---|---|
| Lista | `LiteResponsiveData` + `LiteSidePanel` + `LiteFilterChips` + `LitePagination` + `LiteBulkBar` | `ui/data-table`, `SectionCardHeader`, `ErpList`, `DetailDrawer`, `ui/sheet` em lista |
| Detalhe | **um componente com duas variantes**: gaveta (na lista) e página ("Expandir"), com link estável `/leads/[id]` | o drawer de lead e a página de lead, que hoje são dois códigos |
| Hub | `LiteHub` novo: seções por intenção e cartões com nome e descrição, lidos de `hubSections()` | a página `/ia` atual vira a primeira usuária |
| Subtela de configuração | `LiteSubpageHeader` com "Voltar para Configurações" | cabeçalhos soltos em `/settings/*` |
| Painel | uma coluna de painéis, cada um com o próprio carregamento e erro | |
| Conversas | sem mudança de estrutura; só passa a ler o cadastro | |
| Vazio | um só (`arc/empty-state`) com variantes nomeadas por tela e texto em 3 partes | `components/empty-state`, `ui/ds-empty-state`, `.empty` |
| Carregamento | um só (`LitePageLoading`) com a silhueta do arquétipo | `RouteLoading`, `LightPageSkeleton`, `Skeleton` solto |
| Erro | um só (`RouteError`) com "Tentar de novo" e o ID para suporte | os 12 `error.tsx` próprios |

Isso precisa ser refletido em `docs/design-system.md` § Product Density e em `DESIGN.md`, que ainda mandam `DataTable + SectionCardHeader`.

### 5.6 Estado de navegação: um jeito só

- **Visão e filtros na URL**, sempre com um único helper `useViewParam` (`replaceState`, sem ida ao servidor), no lugar dos 4 jeitos de hoje.
- **Link de volta com origem** (`?voltar=`), aceito só se for caminho interno da mesma área.
- **Prefetch só por intenção** no menu.

### 5.7 Mapa de consolidação de rotas

Toda linha abaixo mantém a tela e o conteúdo. Muda só o endereço canônico, e o antigo vira redirect.

| Assunto | Hoje | Canônica proposta |
|---|---|---|
| Plantão (diretor) | `/distribuicao?view=plantao`, `/leads/distribuicao/plantao/[id]` | `/distribuicao/plantoes` e `/distribuicao/plantoes/[id]` |
| Plantão (gestor) | `/equipe/plantoes` | igual, com `audiences: manager` |
| Plantão (supervisor e corretor) | `/equipe/plantao`, `/plantoes`, `/plantoes/agora`, `/plantoes/corretor/[id]` | ficam, mas o voltar sai do cadastro (hoje `/plantoes/corretor/x` volta para uma tela que redireciona) |
| Distribuição | `/distribuicao` reexporta `/leads/distribuicao` | só `/distribuicao` |
| Propostas | `/vendas?tab=propostas` | `/propostas` (hoje é redirect ao contrário) |
| Comissões | `/settings?tab=comissoes` | `/comissoes`, na área Comercial |
| Detalhe de equipe | `/equipe/equipes/[id]` e `/gestao/equipes/[id]` | só `/equipe/equipes/[id]` |
| WhatsApp | `/integrations/whatsapp`, `/settings?tab=whatsapp`, `/settings/whatsapp`, `/integrations/whats_alt`, `/settings/waha-diagnostic` | `/integrations/whatsapp`, com o diagnóstico como visão dele |
| Drill do painel | `/dashboard/drill/[id]` e `/relatorios/drill/[id]` | só `/dashboard/drill/[id]` |
| Integridade | `/integridade` e `/super-dev/integridade` | só `/super-dev/integridade` |

**Apagar** (telas mortas, conferir uso antes):
- `/leads/dashboard`, `/tarefas/dashboard`, `/conversas/dashboard`, `/vendas/dashboard`, `/distribuicao/dashboard`, `/equipe/dashboard`;
- o código de `/minha-fila` atrás do redirect;
- `/gestao`, `/empresas`;
- `LightBottomNav` e `LightSideRail`;
- `/assistente`;
- `LIGHT_MANAGER_*`, se o Lite do gestor não voltar (ver 6.1).

### 5.8 Testes-guardião

| Teste | O que garante | Inspiração |
|---|---|---|
| Completude exata | toda `page.tsx` tem porta no cadastro ou motivo escrito (mínimo 20 caracteres); sem casar por prefixo; sem link morto no cadastro | DC `tests/unit/navegacao-completude.test.ts` |
| Altura do menu | sidebar do diretor sem rolagem em 1280×900 | DC `tests/e2e/navegacao.spec.ts:222-238` |
| Subtela com volta | toda `page.tsx` em `/settings/*` usa `LiteSubpageHeader` | DC `tests/unit/volta-das-subtelas-de-configuracoes.test.ts` |
| Busca do cadastro | o Ctrl+K só oferece destinos que existem e que o papel vê | |
| Um carregamento | todo `loading.tsx` usa `LitePageLoading` | |
| Título único | nenhuma página passa `title` ao `DashboardHeader` (vem do cadastro) | |

---

## 6. Decisões que são suas

O CLAUDE.md manda parar e perguntar quando o design system não cobre. Estes pontos não estão cobertos:

1. **Gestor no Lite.** Hoje o gestor vê o visual antigo (`isManagerLiteAvailable` = `false`). Ou o gestor ganha a casca do diretor com escopo de unidade, que é o caminho mais curto e apaga as telas `/gestao` e `/empresas`, ou volta o Lite em chat que foi desligado. Sem essa decisão, o item 1 da seção 4.2 não fecha.
2. **Barra inferior no celular do diretor.** O DeskComm tem, com 4 destinos e "Mais". O Lite diz "sem barra de abas" para o corretor, mas não fala do diretor, que hoje usa a gaveta e o "Mais" no avatar.
3. **Quantas telas ficam na fileira por área** (proposta na tabela da seção 5.2).
4. **Contador no menu:** aparência do número (neutro, `tabular-nums`) e quais filas contam.

---

## 7. Lotes de implementação

Cada lote é uma branch, com teste, merge no preview e push para produção, uma rota de cada vez.

| Lote | O quê | Esforço | Depende de |
|---|---|---|---|
| 1 | Campos novos no cadastro (`description`, `title`, `parent`, `audiences`, `counter`) e `routeMeta()` com query. Corrige os bugs de Comissões e Plantão na sidebar | Baixo | |
| 2 | Ctrl+K lendo só `searchable()`: apaga `feature-search-index.ts`, corrige links de cliente e equipe, implementa as setas | Baixo | 1 |
| 3 | Teste de completude exato e de altura do menu, com a lista de exceções escrita | Baixo | 1 |
| 4 | `DashboardHeader` lendo título e voltar do cadastro; tira títulos livres e h1 duplicados | Médio | 1 |
| 5 | Apagar telas mortas e órfãs (lista da 5.7) | Baixo | 3 |
| 6 | `LiteHub` e hubs de Financeiro, Comercial e Operação ERP | Médio | 1, decisão 3 |
| 7 | Contadores no menu | Médio | 1, decisão 4 |
| 8 | Consolidação de rotas da 5.7 com redirects | Médio | 4 |
| 9 | Um vazio, um carregamento, um erro; `LiteSubpageHeader` e teste | Médio | |
| 10 | Detalhe de lead com duas variantes (gaveta e página) e link estável | Médio | |
| 11 | `useViewParam` e segunda fileira de abas virando seletor (`/leads`, `/dashboard`, `/conversas`) | Médio | 4 |
| 12 | Gestor no Lite | Alto | decisão 1 |

Os lotes 1, 2, 3 e 5 dão o maior ganho pelo menor esforço: tudo achável no Ctrl+K, nenhuma tela órfã, menu que acende certo.
