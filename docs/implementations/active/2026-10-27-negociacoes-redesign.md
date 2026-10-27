# Plano: redesign e refinamento da area /negociacoes (estilo Lite, com dinamica)

**Status:** implementação em andamento, pacotes P1 a P5 autorizados. P6 realtime está fora do escopo.
**Decisão:** DEC-159. As três decisões de produto estão aprovadas pelo Vinicios.

| Pacote | Estado |
|---|---|
| P1, resumo por etapa | Concluído |
| P2, trilha comercial | Concluído |
| P3, cards e tabela | Concluído |
| P4, painel lateral | Concluído |
| P5, polimento e skin | Pendente |

P1 substitui os seis KPIs equivalentes por três contadores da régua e um bloco de atenção para espera e esfriamento. O alerta "Sem conversa no CRM" fica fora da trilha. A contagem de entradas usa `stageEnteredAt` no dia de São Paulo. Testes focados: 2 arquivos, 8 testes aprovados; ESLint sem erros.

P2 adiciona a trilha clicável dos três estágios comerciais. Os botões filtram a lista sem consulta adicional, mostram proporções com `LiteProgress` e passam a uma coluna em telas estreitas. Testes focados: 2 arquivos, 9 testes aprovados; ESLint sem erros.

P3 troca a lista inicial por cartões `PeopleRow`, com etapa, responsável pela resposta, tempo desde a última troca e sinais de documento, imagem, proposta e leitura da IA. O modo tabela é opcional e enxuto, com seis colunas; ambos abrem o mesmo painel lateral. Filtros e paginação continuam no estado local.

P4 coloca a trilha mini e os sinais que explicam a situação antes do resumo e da linha do tempo. O histórico usa `LiteSkeletonToContent` com altura reservada e Skeleton do Arc; falha oferece nova tentativa. O carregamento continua limitado à abertura do painel e a lista permanece utilizável.

Repo: C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-lite-listas (somente leitura; nenhum codigo alterado).
Fontes lidas: src/app/(dashboard)/negociacoes/{page,loading,error}.tsx; src/features/negotiations/* (dashboard, data-views, model, queries, css, fixtures, actions); docs/implementations/completed/2026-10-26-negociacoes-area.md; src/app/dev/negociacoes-preview/page.tsx; docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md; docs/design-system/lite/2026-10-21-estudo-visor-animacoes.md; src/components/lite/motion/*; src/components/lite/status/*; referencias /leads e /leads/distribuicao (LightLeadsList, people-list, faixa de status vivos).

Regra do pedido: nenhuma consulta nova (a area e leitura calculada; layout ja barrado pelo Vigia). Tudo abaixo reaproveita NegotiationsDashboardData (queries.ts:82-91). Sem SQL. Unico ponto que exigiria SQL esta sinalizado na decisao 2.

## 1. Diagnostico do que esta hoje

Telas atuais: uma rota com duas abas (Negociacoes / Estatisticas) via query ?aba (page.tsx:27), topo com total + seletor de unidade (diretor) + abas (negotiations-dashboard.tsx:119-126), fileira de 6 KPIs clicaveis (137-148), tabela LiteResponsiveData de 10 colunas (150-175), painel lateral sob demanda com resumo IA, sinais e timeline (180-226).

Problemas de clareza / densidade / hierarquia (caminho:linha):

1. A regua existe no dominio mas nao na tela. O modelo define em_conversa > advanced > closing mais cooling e no_crm_conversation (negotiation-model.ts:8, 46-66), mas a UI entrega so uma badge de texto na celula "Nivel" (negotiations-data-views.tsx:66-73, 80). Nao ha trilha, funil ou progressao visual; quem abre nao entende em 3 segundos onde a carteira esta.
2. Duplicacao de informacao entre colunas: "Nivel" (regua) e "Etapa" (status CRM + AI stage) dizem quase a mesma coisa (data-views:80-81); "Resposta de" (84) repete o selo "Aguardando resposta" da badge (70) e o KPI (26). Dez colunas (75-88) para o que o cartao do lead precisa mostrar.
3. KPIs sem hierarquia nem gravidade: 6 botoes iguais, sem cor de atencao, sem animacao, sem "quem mudou de etapa hoje" (dashboard:137-148). Icones lucide genericos e repetidos (FileCheck2 usado para Esfriando e para Sem conversa no CRM, data-views:24-25). no_crm_conversation, que e um alerta operacional (status comercial avancado sem nenhuma mensagem do corretor no CRM, model:88), aparece misturado com as etapas na mesma fileira.
4. Zero movimento: nenhuma peca do kit motion (LiteStagger, LiteNumber, LiteSwap, LiteAttention) e usada; a area entra seca, contra o padrao das listas Lite (people-list.tsx:18,136 cascata via CSS --i).
5. "Mudou de etapa hoje" nao existe em lugar nenhum: dailyStats mostra situacao atual agrupada pelo dia de entrada na etapa (queries.ts:80; doc da entrega, linha 14), nao transicoes do dia. stageEnteredAt por lead (queries.ts:28) permite calcular "entrou nesta etapa hoje" no cliente, sem SQL; transicoes reais entre etapas (saiu de X entrou em Y) exigiriam dado novo.
6. Painel lateral: timeline e lista de eventos rotulados (kind label/detail/at, queries.ts:60-67) sem conteudo da conversa, carregando em texto puro "Carregando historico..." (dashboard:202) sem skeleton; os sinais que levaram a etapa (PDF enviado, proposta, ultima troca, tempo parado) estao disponiveis em NegotiationLead (queries.ts:38-46) mas espalhados em colunas da tabela em vez de contados como historia.
7. Tempo parado e prazo nao sao vivos: staleReplyHours 4 h e activeExchangeDays 3 d (model:1-6) sao regras de esfriamento que nao aparecem como contagem ou urgencia; "Ultima troca" e uma data estatica (data-views:83-84).
8. Estatisticas: tabela de 11 colunas por corretor (data-views:91-103) e saude da IA escondida no fim (123-134); densa para gestor, mas sem leitura rapida.
9. Mobile 390px: verificado sem overflow (doc da entrega, linha 44), mas 10 colunas viram card denso no LiteResponsiveData e a fileira de 6 KPIs empilha sem prioridade.
10. Modo escuro: a area e clareza only (design system Lite, gap G2); hoje data-skin="diretor" dentro de .arc-venancor (dashboard:116-117). Nao existe dark nos tokens; qualquer dark seria escopo novo.

## 2. Nova arquitetura da tela

Principio: manter rotas, funcoes, dados e escopo intactos; trocar a camada de apresentacao dentro de .arc-venancor (ArcScopeProvider ja no lugar, dashboard:115-116). Sem consulta nova no servidor; contadores derivam de data.counts (queries.ts:87) e stageEnteredAt.

### 2.1 Topo: "Negociacoes agora" (resumo animado)
- Substitui a linha de KPIs (dashboard:137-148) por uma faixa no padrao dos status vivos (anatomia do LiteLiveStatus, live-status.tsx:98-145), sem virar provider de live-status (nao e robô; e estado da carteira):
  - Um cartao por etapa da regua (Em conversa, Negociacao avancada, Fechamento) com: contador LiteNumber (countFromZero so na primeira carga, live-status.tsx:99-100), frase curta ("X entraram nesta etapa hoje" via stageEnteredAt >= hoje SP, funcao pura nova no client), cor de gravidade so no ponto (live-status.module.css:77-80).
  - Um cartao de atencao "Aguardando resposta" com: contador, ha quanto tempo o mais antigo espera (formatAgo, format.ts:21-29) e contagem regressiva ate as 4 h do staleReplyHours no padrao NextEventLine (role="timer", aria-live="off", hora absoluta no aria-label; ao zerar, pulso unico + LiteSwap, live-status.tsx:41-69) usando o relogio compartilhado use-countdown.ts (um setInterval de 1 s por pagina, SSR mostra hora absoluta, pausa com aba oculta, use-countdown.ts:32-60).
  - Um cartao "Esfriando" com contador e "o mais antigo parado ha X d" (lastExchangeAt + activeExchangeDays).
- Selo pequeno "Sem conversa no CRM: N" (live-seal, live-status.tsx:148-172) fora do funil: e alerta operacional, nao etapa.

### 2.2 Funil / trilha visual das etapas
- Componente novo (trilha horizontal de 3 nos + barras proporcionais com LiteProgress scaleX, progress.tsx:17-28): Em conversa > Negociacao avancada > Fechamento, contadores em cada no, largura da barra proporcional ao count da etapa (max das tres).
- Clique no no filtra a lista (substitui activeFilter atual, dashboard:38,80-81), estado aria-pressed como hoje (142). Esfriando e Aguardando resposta ficam como faixas de atencao transversais (chips warning), nao nos do funil (preserva a regua comercial de 3 etapas; ver decisao 3).
- Na aba Estatisticas, o mesmo funil resume antes das tabelas.

### 2.3 Cards de negociacao (lista)
- Lista no padrao PeopleRow / PeopleSection / PeopleEmpty (people-list.tsx:20-145; referencia LightLeadsList, light-leads-list.tsx:214-243 e PeopleRow com chip Badge, preview com tom, meta time, dot de urgencia):
  - Nome + chip da etapa com cor (level data-level como hoje, data-views:69).
  - preview: ultima troca + quem deve a resposta ("Cliente aguarda resposta do corretor ha 2 h" / "Aguardando o cliente") + tempo parado ("parado ha 3 d", daysAtStage e lastExchangeAt, queries.ts:29,40).
  - sinais que levaram a etapa: mini icones com titulo/aria-label: documento enviado (customerSentPdf), imagem (customerSentImage), proposta (status quote_sent/negotiation), IA a frente do CRM (statusBehindAi), risco (ai.risk).
  - meta: time da ultima troca (formatWhen, data-views:33-35).
  - alvo de toque >= 44px (regra Lite, LITE_CHAT_DESIGN_SYSTEM.md:92).
- Tabela densa (LiteResponsiveData atual, data-views:75-88) continua disponivel atras de um toggle "Tabela" para o gestor (ver decisao 1); reduzir de 10 para ~6 colunas (Lead, Corretor, Nivel, Dias na etapa, Ultima troca, Leitura da IA) porque o resto migra para o card/painel.

### 2.4 Detalhe lateral (mantem LiteSidePanel)
- Header: nome + trilha mini das 3 etapas com a atual destacada (mesmo componente do funil em tamanho reduzido).
- Secao nova "Sinais que levaram ate aqui": documentos enviados, proposta enviada, ultima mensagem com resumo (lastCustomerMessageAt/lastBrokerMessageAt), tempo parado, resposta pendente de quem (dados ja em NegotiationLead, queries.ts:38-46; nenhum fetch novo).
- Secao "O que a IA viu" (hoje Resumo da IA, dashboard:184-189): summary, proxima acao, intencao, risco, objeccoes e sinais de compra (186-197), com statusBehindAi como aviso (189).
- Linha do tempo (getNegotiationTimelineAction, dashboard:49-64) com skeleton-to-content (kit motion) no lugar do texto "Carregando historico..." (202) e erro com retry mantido (203-206).
- Links "Abrir conversa" / "Ver lead" mantidos (220-223).

## 3. Motion (regras do estudo Visor + kit)

- Entrada: LiteStagger nos cartoes do topo e nos PeopleRow (cascata 35 ms por item, teto 8 atrasos, stagger.tsx:19-36); entrada so transform e opacity, y 16px (reveal), duracao <= 580 ms (teto do estudo, 2026-10-21-estudo-visor-animacoes.md:58).
- Contadores: LiteNumber odometro 480 ms, countFromZero uma vez por id (number.tsx:44,75-80); quando o valor muda em refresh, LiteAttention um unico pulso (attention.tsx:24), nunca loop.
- Troca de etapa de um lead entre refreshes: LiteSwap no chip (swap.tsx:21) + troca de cor 120 ms.
- Barras do funil: scaleX 480 ms origem esquerda (LiteProgress).
- Contagem "aguardando resposta ate 4 h": so o texto troca a cada segundo (sem animar o texto); ao zerar: um pulso + LiteSwap "vencendo agora, reclassifica na proxima atualizacao" (padrao da decisao 27/10 dos status vivos).
- prefers-reduced-motion e html[data-reduce-motion="1"]: so opacidade, numero final direto, barra sem transicao, cascata vira fade <= 120 ms (reducedFade, shared.ts:11; live-status.module.css:237-243).
- Proibido: pulso infinito, gradiente, sombra empilhada, pesos > 500 na area Lite (LITE_CHAT_DESIGN_SYSTEM.md:80), entrada > 580 ms.

## 4. Estados

- Vazio: mantem os dois vazios atuais (filtro vs sem atendimentos, dashboard:167-172) no padrao PeopleEmpty com acao de limpar filtro; escopo indisponivel mantem (128-132).
- Carregando: LightPageSkeleton variant dashboard (loading.tsx:4) no primeiro carregamento; skeleton-to-content (kit motion) nas trocas de aba e no painel lateral.
- Erro: error.tsx atual mantem (botao Tentar novamente, error.tsx:14); erro do timeline mantem retry (dashboard:203-206); falha no calculo client de "entrou hoje" degrada para a contagem total (nunca tela vermelha por conta de um derivado).
- 390px: funil vira coluna vertical (3 nos empilhados), cartoes do topo em lista (padrao live-status.module.css:41-54,248-253: no celular esconde explicacao e barra), cards PeopleRow nativos do kit, painel lateral vira sheet (LiteSidePanel ja responsivo). Sem larguras fixas; tabular-nums nos numeros.
- Modo escuro: fora de escopo. O Lite e claro so (gap G2 do design system); a area usa data-skin="diretor" claro. Nao criar tema escuro aqui (decisao 3 do Vinicios confirma).

## 5. Pacotes de entrega pequenos

P1 - Topo "Negociacoes agora" (resumo animado por etapa)
Arquivos: src/features/negotiations/negotiations-dashboard.tsx (remove a linha de KPIs 137-148); novo negotiation-stage-summary.tsx (client) + secao no negotiations.module.css; funcao pura enteredToday(leads, now, tz) testavel.
Pronto quando: contadores batem com data.counts e com a lista filtrada; "entrou hoje" bate com stageEnteredAt (teste com fixtures.ts); LiteNumber + um pulso so na mudanca; reduce-motion ok; vitest de render com fixtures, tsc, eslint, check-lite-skin; capturas 1440 e 390.

P2 - Funil / trilha clicavel
Arquivos: novo negotiation-stage-trail.tsx; integracao com activeFilter no dashboard; css.
Pronto quando: clique no no filtra e o estado persiste com os outros filtros; barras proporcionais; aria-pressed; sem consulta nova; testes de interacao; 390px vira coluna.

P3 - Cards de negociacao com sinais
Arquivos: novo negotiation-lead-row.tsx usando PeopleRow; ajuste em negotiations-data-views.tsx (tabela opcional com 6 colunas); dashboard troca a lista padrao.
Pronto quando: cada card mostra etapa + quem deve responder + tempo parado + sinais (PDF/imagem/proposta/IA a frente) com aria-label; alvo 44px; toggle Tabela funciona; densidade mobile validada.

P4 - Painel lateral refinado
Arquivos: negotiations-dashboard.tsx (180-226); novo negotiation-lead-signals.tsx; timeline com skeleton-to-content.
Pronto quando: trilha mini no header; sinais que levaram a etapa antes da timeline; timeline com skeleton e retry; nao trava a lista enquanto carrega (request id atual ja protege, 50-63); teste de render + erro.

P5 - Polimento de motion e skin
Arquivos: os anteriores + ajustes finais de css.
Pronto quando: cascata, swap, odometro e countdown revisados contra o estudo Visor; zero loop infinito; video normal e com reduce-motion; check-lite-skin zero desvios; capturas 1440/390 sem overflow; bundle do client nao cresce mais que ~10 KB sobre os 14,5 KB atuais.

P6 (opcional, pos aprovacao) - Atualizacao sem recarregar
Escuta domain.invalidated leads com debounce 2 s + atualizar via useTransition (padrao light-conversations-view.tsx:100-115). Nao usar router.refresh da pagina inteira. Pronto quando: so a area do cliente atualiza e o polling so roda com aba visivel.

Cada pacote: nenhuma migration, nenhum SQL novo, nenhum teste de banco; verificacao com vitest (fixtures), tsc, eslint, check-lite-skin e previa em /dev/negociacoes-preview (fixtures.ts) atualizada junto.

## 6. Riscos

- Performance (regra dura): nada de consulta extra no layout (Vigia ja barra). Todo o topo, funil e cards derivam de NegotiationsDashboardData ja carregado; "entrou hoje" e calculo client puro sobre stageEnteredAt. Se o Vinicios quiser transicoes reais entre etapas (saiu de X, entrou em Y hoje), isso exige SQL novo ou agregacao: nao incluir sem decisao explicita (decisao 2).
- Bundle: dashboard client tem 14,5 KB hoje (doc da entrega, linha 46); novos componentes sao client pequenos; manter secoes estaticas como server quando possivel.
- Tela que mente: o countdown das 4 h e o prazo da regra, mas o reclassificamento so ocorre no proximo refresh (a area e leitura no momento da consulta). Mostrar "atualizado as HH:MM" (ja existe, dashboard:120) junto do countdown.
- Ruido visual: teto de 4 cartoes no topo + 1 selo; gravidade ok neutra; chips de atencao so quando > 0.
- Regra de negocio nao vai para a UI: a regra da regua continua em computeNegotiationLevel (model:74-121); a tela so presenta os niveis ja calculados; nunca copiar 4 h / 3 d como texto solto (importar NEGOTIATION_LIMITS).
- Fuso: derivados de "hoje" e datas usam America/Sao_Paulo no client (mesmo padrao localDayKey, queries.ts:119-123; formatAgo/formatAbsoluteTime do kit status).
- Acessibilidade: role="timer" com aria-live="off" no countdown; aria-live="polite" na mudanca do numero (padrao LiteNumber/LiveStatus); foco de teclado no painel lateral mantido.

## 7. Tres decisoes para o Vinicios (com recomendacao)

1. Lista principal: cards Lite (PeopleRow) com tabela densa opcional atras de toggle, ou so cards?
Recomendo cards como padrao + toggle "Tabela" para gestor (a tabela existe e e barata de manter; remove o risco de o gestor perder densidade).
2. "Mudou de etapa hoje": mostra "entrou nesta etapa hoje" via stageEnteredAt (sem SQL, P1) ou exige transicoes reais entre etapas (saiu de / entrou em, precisa SQL/agregacao nova)?
Recomendo comecar pelo version sem SQL (P1) e so adicionar transicoes reais se o numero nao bastar na operacao.
3. Esfriando e Aguardando resposta entram no funil ou ficam como faixas de atencao transversais? E modo escuro?
Recomendo faixas de atencao fora do funil (a regua comercial sao 3 etapas; esfriar e risco transverso) e modo escuro fora de escopo (o Lite e claro so).

Fim do plano. Nenhum arquivo do repo foi alterado.
