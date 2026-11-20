# Referência: Jubayer (@jubayer6910)

Status: **referência de estudo**, não substitui `docs/design-system.md`. Em conflito, vale o design system.
Data da análise: 20/11/2026. Skill derivada: `.claude/skills/interface-enxuta/SKILL.md`.

## Quem é e por que estudar

Jubayer (`x.com/jubayer6910`, 3.378 posts) desenha painéis para produtos B2B e de IA e mantém a biblioteca **Ingot UI** (`ingotui.com`): 2.652 componentes em React + Tailwind e Figma, organizados em nove sistemas visuais. É o mesmo autor do painel `jubayer910/Admin-panel`, de onde já tiramos a paleta escura em 26/09/2026 (ver "Dark Mode" em `docs/design-system.md`). Os posts recentes mostram telas de um produto fictício, "Auton", sempre no mesmo esqueleto: barra lateral, área principal densa e painéis que aparecem só quando pedidos. É exatamente a "interface enxuta" que queremos.

## Fontes e limite da análise

Na primeira passada, sem login, o X mostrava só os 5 posts mais recentes (P1 a P5). Depois o Vinicios entrou com a conta dele no navegador embutido, e a linha do tempo abriu **190 posts**, de 09/10 a 20/11/2026. Destes, **182 têm imagem ou vídeo** e estão catalogados no Apêndice A, com data, título e ID. Os demais são respostas e posts só de texto.

Passei pelos 182 na linha do tempo. O autor repete o mesmo kit (Auton, Axon, Loopo, Vantage, Veriq) em telas muito parecidas. Por isso abri em resolução cheia os posts abaixo, que são os que mudam o padrão de tabela, lista, popover, menu, modal e drawer, o que mais pesa numa interface enxuta. Os vídeos não foram analisados quadro a quadro. Também usei o catálogo público do autor em `ingotui.com/categories/popovers` (I1).

| # | Post | Link | O que mostra |
|---|---|---|---|
| P1 | "Introducing Ingot UI" (fixado, vídeo) | `x.com/jubayer6910/status/2123417304553918834` | Lançamento da biblioteca. Analisei só o texto: 1.800+ componentes, seis sistemas completos, gráficos e templates. O vídeo não foi analisado quadro a quadro |
| P2 | "settings flow UI." | `x.com/jubayer6910/status/2123718745856074204` | Quatro telas de configurações: Geral, modal "Create API key", "Billing & plan" e modal de exclusão na "Danger zone" |
| P3 | "overview flow UI." | `x.com/jubayer6910/status/2123702386887999914` | Visão geral: faixa de KPIs, gráfico de barras, "Credential health", coluna "Need Attention", tabela de agentes com abas de filtro e "Recent Activity" |
| P4 | "audit log flow UI." | `x.com/jubayer6910/status/2123669419742187668` | Log de auditoria: gráfico de volume, barra de filtros em chips, tabela densa, painel lateral de detalhe, modal de exportação e popover de período |
| P5 | "calendar modal UI." | `x.com/jubayer6910/status/2123567498620530899` | Modal de escala de plantão: grade semanal, lacuna destacada, aviso de consequência e rodapé com ação secundária à esquerda |
| P6 | "best list table design ever" (16/11) | `x.com/jubayer6910/status/2122347459443622147` | Audit log do Axon. A tabela tem subtítulo dizendo o que guarda, filtros com contagem ("Action · 2") e o total à direita ("2,184 events"). Horário em mono, resultado com ícone e texto. Faixa de rodapé com a verificação e "Verify again" |
| P7 | "customers list screen UI." (17/11) | `x.com/jubayer6910/status/2122692986152558801` | Lista de clientes: abas de status com contagem e filtros "Plan: All ▾". Nome com subtítulo, micro-barras de 12 meses e segunda linha de alerta só quando há atraso ("29 days late"). Rodapé "Showing 1–9 of 1,751 · sorted by lifetime value" |
| P8 | "filter, sort, row menu, bulk actions" (18/10) | `x.com/jubayer6910/status/2111721342316020098` | Popover de filtros com a contagem de cada opção e "3 filters · 221 workflows · Apply". Ordenação em dois grupos. Menu `⋯` com atalhos, submenu "Move to folder" e o destrutivo por último. Barra flutuante de seleção em massa |
| P9 | "date pickers and popovers." (20/10) | `x.com/jubayer6910/status/2112613918397096002` | Período com presets, popover de cliques com barra por item e CTA de segmento, "Annotation popover" e calendário de reagendamento |
| P10 | "dropdown menus." (27/10) | `x.com/jubayer6910/status/2114999122470260871` | Quatro menus com o nome da entidade no cabeçalho, em caixa alta ("AT RISK · 3,206"). Atalhos à direita, grupos separados por hairline e o destrutivo em vermelho no fim |
| P11 | "modal components" (26/10) | `x.com/jubayer6910/status/2114634027147923544` | Modais com passos numerados e escolhas em cartão com rádio. Rodapé com "Drafts save automatically" à esquerda e prévia ao vivo ao lado do formulário |
| P12 | "default and bulk select" (13/10) | `x.com/jubayer6910/status/2109978862616785340` | A mesma tabela sem e com seleção: linha selecionada em azul bem claro e barra flutuante "3 selected · Select all 284 · Run test · Pause" |
| P13 | "review queue interactions." (19/10) | `x.com/jubayer6910/status/2112204377973035085` | Popover de busca inline que sugere correspondências e popover de atribuição com a carga de cada pessoa ("2 open"). Modal de recusa com motivo em rádio e folha de atalhos de teclado |
| P14 | "team screen UI" (12/11) | `x.com/jubayer6910/status/2120869973723677052` | Equipe: papel editável na própria linha e rodapé "2 without 2FA" com a ação que resolve ("Require 2FA for everyone ↗"). Coluna lateral "On call now" |
| P15 | "subscribers full flow" (03/11) | `x.com/jubayer6910/status/2117504548298457156` | Tabela, **drawer de detalhe** (nome, chips de status, faixa de 3 métricas, dados, atividade, nota interna), importação em modal e seleção em massa |
| P16 | "admin dashboard in dark mode." (15/10) | `x.com/jubayer6910/status/2110702236091428985` | Painel escuro do kit Vantage, na mesma linha da paleta escura que já adotamos |
| I1 | Ingot UI, categoria Popovers | `ingotui.com/categories/popovers` | 78 popovers. Usei como base o "Annotation popover", o "Notifications popover", o "Workspaces popover" e o "Date range popover" |

## Padrões observados

Legenda da coluna "Cabe nos tokens?": **Sim** = dá para aplicar hoje com os tokens de `docs/design-system.md`; **Adaptar** = a ideia cabe, mas usando nosso token no lugar do dele; **Token novo** = exigiria token que não temos e depende de aprovação; **Não adotar** = conflita com uma regra nossa.

### 1. Densidade e estrutura

| Padrão | Origem | O que adotar no AncoraHub | Cabe nos tokens? |
|---|---|---|---|
| Tela = uma tarefa. A área principal tem um título curto ("Overview", "Audit log", "Settings") e quase nenhum texto de apoio | P2, P3, P4 | Título de página em uma linha. Explicação vai para tooltip ou para o drawer, não fica fixa | Sim |
| Detalhe da entidade só aparece quando pedido: clique na linha abre painel lateral com metadados, checklist e dados brutos | P4 | Já é a nossa regra (Sheet). Agora o passo anterior: **prévia ao passar o mouse** (ver §6) para quem só quer olhar | Sim |
| Coluna "Need Attention" com contador ("03") e cada item com um único link de ação ("Review Request ↗") | P3 | No painel do diretor e do corretor: um bloco "Precisa de atenção" com no máximo 3 itens, cada um com um verbo só | Sim |
| Configurações em duas colunas: rótulo + ajuda curta à esquerda, controle à direita, linhas separadas por hairline | P2 | Formulários de configuração seguem esse grid. Nada de cartão por campo | Sim |
| Rodapé que resolve: o problema contado e a ação ao lado ("2 without 2FA · Require 2FA for everyone ↗") | P14 | Rodapé da carteira: "4 leads sem resposta há 2 dias · Ver" em vez de banner fixo | Sim |
| Drawer de entidade em blocos: cabeçalho com status, faixa de 3 métricas, dados, atividade com "Ver tudo", nota interna e ações no rodapé | P15 | O `LeadDetailsDrawer` segue essa ordem. O hover card é a versão de bolso dos dois primeiros blocos | Sim |
| Atividade recente como linha do tempo compacta: marcador, título, alvo, "2 min ago", e "View Audit Log ↗" no fim | P3 | Histórico do lead (no drawer e no hover card) mostra 1 a 3 eventos e um link "Ver histórico" | Sim |
| Rodapé de tabela com contagem e retenção ("Showing 10 of 48,213 events · retention 1 year") e paginação "Newer / Older" | P4 | Rodapé do `DataTable` mostra "10 de 1.240 leads" em caption Fog | Sim |

### 2. Tipografia

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| Uma família sans em tudo, de 11 a 24px. Título de página por volta de 14 a 16px semibold | P2 a P5 | Inter em toda a UI de produto. Satoshi só em 36px+, como já está | Sim |
| Rótulos de seção em caixa alta, minúsculos e espaçados: "WORKSPACE", "MANAGE", "SCOPES", "THIS WILL", "EXPIRES" | P2, P3 | `caption` (11px), Fog, `uppercase`, `tracking-wide`. Serve para agrupar sem cartão | Sim (o tracking é utilitário do Tailwind, não token novo) |
| Números grandes nos KPIs ("128", "1.2M", "$480 / month"), com o delta pequeno e colorido embaixo ("▲ +12.3% since Sep 1") | P2, P3 | `heading-sm` (24px) ou `heading` (30px) em Inter 600 para o número. O delta em caption com Forest Ink ou Rose Ink | Sim |
| Monoespaçada para dados técnicos: horários ("14:32:46"), IDs ("INV-2026-010"), escopos ("agents:read") | P2, P4 | Geist Mono para protocolo, CPF mascarado, horário em log, ID de proposta | Sim (`--font-geist-mono`) |
| Contadores com zero à esquerda ("003", "03") | P3 | Não adotar: em pt-BR "03 leads" soa como código. Usar o número puro em pílula | Não adotar |

### 3. Cor

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| Base neutra (branco, cinza muito claro no fundo da página) e um azul só para ação primária, foco e seleção | P2 a P5 | Igual ao nosso: Electric Blue para destaque e Deep Sapphire para o único CTA | Adaptar (o azul dele é um só; nós separamos destaque e CTA) |
| Status em pílula com fundo lavado e texto escuro: Allowed (verde), Blocked (vermelho), Pending (âmbar), Paid, Needs review | P2, P3, P4 | `DsStatusBadge` com Soft Mint/Forest Ink, Amber Wash/Ink, Rose Wash/Ink e Powder Blue/Electric Blue | Sim |
| Faixa de plano com gradiente verde-água ("Team plan $480 / month") | P2 | Não adotar: o design system proíbe gradiente decorativo em elemento de UI | Não adotar |
| Botão destrutivo preenchido de vermelho ("Delete workspace") | P2 | Hoje não temos vermelho de preenchimento: só Rose Wash (fundo) e Rose Ink (texto). Proposta: o botão destrutivo usa Rose Wash com texto Rose Ink. Um vermelho sólido exigiria token novo | Token novo (pendente de aprovação; recomendação: não criar) |
| Aviso de consequência em faixa clara vermelha com ícone ("Thursday night has no one on call — requests would escalate…") | P5 | `DsCallout` variante de erro: Rose Wash, Rose Ink, texto que diz o efeito, não a culpa | Sim |
| Gráficos de barras empilhadas em azul + vermelho | P3, P4 | Nosso gráfico usa uma cor em dois tons (Electric Blue 100% e 35%). Manter | Adaptar |

### 4. Raio, borda e elevação

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| Cartões e tabelas com borda fina cinza clara e sem sombra. A estrutura vem do traço | P2 a P5 | 1px Ash, como já está | Sim |
| Raios pequenos e consistentes: cartão por volta de 12px, controle 6 a 8px, pílula toda arredondada, modal por volta de 16px | P2 a P5 | 12px cartão, 8px botão, 6px input, 9999px pílula, 16px modal | Sim |
| Só o que flutua tem sombra: modal, painel lateral, popover, menu | P2, P4, P5, I1 | Popover e hover card com `--shadow-md`, Dialog e Sheet com `--shadow-lg` | Sim |
| Modal sobre um véu claro e desfocado, não preto | P2, P4, P5 | Nosso véu é Midnight Ink a 40%. Clarear seria mudar o token do scrim | Token novo (não proposto agora) |

### 5. Espaçamento

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| Linhas de tabela baixas (por volta de 40px) com 12 a 16px de respiro lateral | P3, P4 | Linha de 40px com 12px de padding horizontal no `DataTable` denso | Sim |
| Cartão com 16px de respiro; 8px entre elementos | P2, P3 | `--spacing-16` no cartão e `--spacing-8` entre itens, como já está | Sim |
| Popover com 12 a 16px de respiro, blocos separados por hairline | I1 | Hover card com 12px dentro dos blocos e divisórias Ash | Sim |

### 6. Popover, hover e prévia

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| "Annotation popover": ícone + título + meta na primeira linha, ações em ícone no canto, uma frase de contexto, faixa de 3 métricas e um link de ação no rodapé ("View campaign ›") | I1 | **Modelo do hover card do lead**: nome + status, uma linha de contexto, faixa de 3 dados (operadora/plano, valor, último contato), e atalhos no rodapé | Sim |
| Popover de atribuição com busca e a carga de cada pessoa ("Priya Nair · 2 open") | P13 | Ao reatribuir um lead, mostrar a carga de cada corretor ao lado do nome | Sim |
| Popover de sugestão inline: ao focar um campo, aparecem as correspondências com estado ("Best match", "Closed") | P13 | Aviso de lead duplicado enquanto se digita o telefone | Sim |
| "Workspaces popover": lista curta com avatar de letra, item atual marcado com ✓, e ações ("Create workspace") separadas por hairline | I1 | Menus de troca (empresa, carteira) seguem esse formato | Sim |
| "Date range popover": presets à esquerda ("Today", "Last 7 days"…), calendário duplo à direita, "Cancel" e "Apply" | P4, I1 | Filtro de período das tabelas: presets primeiro, calendário só em "Personalizado" | Sim |
| Tooltip de gráfico pequeno, branco, borda fina, número em destaque | I1 | Já previsto em "Chart" no design system | Sim |

### 7. Tabela

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| Abas de filtro com contagem acima da tabela ("All Agents 139 · Needs Review 7 · Revoked 4") | P3 | Na carteira: "Todos 240 · Sem resposta 12 · Retorno hoje 5". Troca a tabela sem recarregar a página | Sim (`DsSegmentedControl` ou `DsTabs`) |
| Busca inline curta + botão de filtro em ícone, ao lado das abas | P3 | Busca dentro do `SectionCardHeader`, filtros avançados num popover | Sim |
| Resultado de busca explicado embaixo: "2 of 7 agents that need review match 'data' · Clear search ×" | P3 | Abaixo da tabela filtrada: "3 de 12 leads sem resposta contêm 'silva' · Limpar busca" | Sim |
| Barra de filtros em chips com rótulo e valor ("Event All ▾", "Result All ▾") + "Live" e "Export" à direita | P4 | Filtros da distribuição e do diretor em chips do tipo "Etapa: Todas ▾" | Sim |
| Última coluna com `⋯` para ações da linha | P3, P8 | Já é a nossa regra. Dentro do menu: o nome da entidade no cabeçalho em caption Fog, grupos separados por hairline, atalho à direita e o item destrutivo sempre por último (P10) | Sim |
| Filtros num popover, com a contagem de cada opção e um resumo no rodapé ("3 filters · 221 workflows · Apply") | P8 | O filtro de etapa e origem mostra quantos leads cada opção traz antes de aplicar | Sim |
| Seleção em massa como barra flutuante no rodapé ("3 selected · Select all 284 · …"), com a linha selecionada em azul bem claro | P8, P12 | Já temos `DsSelectionBar`. A linha selecionada usa Powder Blue | Sim |
| Segunda linha de alerta só quando há problema ("Jul 30 / 29 days late") | P7 | A coluna de último contato ganha "há 3 dias sem resposta" em Rose Ink só quando passa do SLA | Sim |
| Edição pequena direto na linha (select de papel) | P14 | Trocar corretor ou etapa na linha só onde a ação é frequente; o resto vai para o drawer | Sim |
| Primeira coluna com ícone ou avatar + nome em peso 500 + subtítulo cinza ("data-sync / Data") | P3 | Nome do lead em 500 com a origem ou a cidade embaixo em caption Fog. **O nome é o gatilho do hover card** | Sim |

### 8. Microinterações e movimento

As imagens são estáticas, então o movimento abaixo vem do que o padrão pede e do catálogo I1, que tem demos ao vivo.

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| Linha da tabela realçada no hover com fundo cinza muito claro | P4 (linha selecionada em destaque) | Hover da linha em Paper Mist, sem sombra | Sim |
| Confirmação forte só em ação destrutiva: lista "THIS WILL" com o que vai acontecer, digitar o nome e código de 2FA | P2 | Só para ação irreversível (excluir empresa, apagar base). O resto é nível 0 ou 1 do `FEEDBACK.md` | Sim |
| Interruptor e controle segmentado para escolhas curtas ("30 days · 90 days · 1 year · Never") | P2 | `DsSegmentedControl` em vez de select quando há até 4 opções | Sim |
| Modal com passos numerados, escolhas em cartão com rádio e prévia ao vivo ao lado | P11 | Assistentes de criação (campanha, fila) mostram os passos. Escolha de tipo em cartão só quando há até 4 opções | Sim |
| Atalhos de teclado visíveis no menu e numa folha de atalhos | P8, P10, P13 | Atalhos só nas telas de uso intenso (fila de distribuição), exibidos à direita do item do menu | Sim |
| Rodapé de modal: meta ou ação secundária à esquerda ("Owner: you · Maya Chen", "Sync to Google Calendar"), "Cancel" e o primário à direita | P2, P5 | Rodapé de Dialog e Sheet: contexto à esquerda, ações à direita | Sim |
| Popover que aparece sem salto: fade curto e pequena translação a partir do gatilho | I1 | Hover card abre com 300 a 400ms de atraso, fade + 4px em 120 a 160ms; com `prefers-reduced-motion`, só fade | Sim (`motion-tokens.ts`) |

## O que adotar primeiro (ordem)

1. **Hover card do lead** nas tabelas do desktop (§6). Tira o drawer do caminho de quem só quer conferir.
2. **Abas de filtro com contagem** na carteira e na distribuição (§7).
3. **Frase de resultado da busca com "Limpar busca"** em todo `DataTable` com busca (§7).
4. **Rótulos de seção em caixa alta** no drawer e nas configurações, no lugar de cartões aninhados (§2).
5. **Bloco "Precisa de atenção"** com até 3 itens no painel do diretor (§1).

## Decisões pendentes (token novo)

Nada abaixo foi criado. Cada item depende de aprovação do Vinicios.

| Pedido | Por quê | Recomendação |
|---|---|---|
| Vermelho sólido para botão destrutivo | O autor usa botão vermelho cheio em "Delete workspace" (P2) | **Não criar.** Usar Rose Wash + Rose Ink, que já existem, e reservar o peso para o texto da confirmação |
| Véu de modal claro com desfoque | P2, P4 e P5 usam véu claro | **Não criar agora.** Muda todas as modais de uma vez; pede rodada própria |
| Gradiente na faixa de plano | P2 | **Não adotar.** Contraria a regra de gradiente só na marca |

## Apêndice A: catálogo dos posts com imagem ou vídeo (09/10 a 20/11/2026)

Link de cada um: `x.com/jubayer6910/status/<ID>`. Títulos no idioma original do post, resumidos.

| Data | Título | Mídia | ID |
|---|---|---|---|
| 2026-11-20 | settings flow UI. | 1 img | 2123718745856074204 |
| 2026-11-20 | overview flow UI. | 1 img | 2123702386887999914 |
| 2026-11-20 | audit log flow UI. | 1 img | 2123669419742187668 |
| 2026-11-20 | calendar modal UI. | 1 img | 2123567498620530899 |
| 2026-11-19 | system settings full UI flow. | 1 img | 2123538557574730013 |
| 2026-11-19 | It's a huge response, pepoles grabing the LTD Launch offer s | vídeo | 2123534993133801944 |
| 2026-11-19 | billing plan modal UI. | 1 img | 2123507855525597285 |
| 2026-11-19 | Grab it before LTD offers end | vídeo | 2123462711011127422 |
| 2026-11-19 | You guys asked me about, what design system I use. | vídeo | 2123428096540119298 |
| 2026-11-19 | Introducing Ingot UI. (fixado) | vídeo | 2123417304553918834 |
| 2026-11-19 | template details modal UI. | 1 img | 2123397377851629612 |
| 2026-11-19 | team and performance screens flow. | 1 img | 2123360131924803594 |
| 2026-11-19 | integration modal. | 1 img | 2123338981752680711 |
| 2026-11-19 | audience screen. | 1 img | 2123291429091025096 |
| 2026-11-18 | settings screen flow | 1 img | 2123194037356069277 |
| 2026-11-18 | reports screen. | 1 img | 2123170129840148573 |
| 2026-11-18 | full flow of performance overview. | 1 img | 2123140182559916387 |
| 2026-11-18 | applications and API screen. | 1 img | 2123112751795159146 |
| 2026-11-18 | clean UI work. | 1 img | 2123079029691687417 |
| 2026-11-18 | repositories flow UI. | 1 img | 2123048327440728521 |
| 2026-11-18 | revenue screen UI. | 1 img | 2123009320925188356 |
| 2026-11-18 | settings flow UI. | 1 img | 2122982141126406632 |
| 2026-11-18 | integrations screen UI. | 1 img | 2122953368935305698 |
| 2026-11-17 | subscribers screens flow | 1 img | 2122820325461086449 |
| 2026-11-17 | projections screen UI. "SO DETAILS" | 1 img | 2122782324790264109 |
| 2026-11-17 | clean segments screen UI. | 1 img | 2122764205153485094 |
| 2026-11-17 | every details of analytics screens flow UI. | 1 img | 2122735767651008725 |
| 2026-11-17 | customers list screen UI. | 1 img | 2122692986152558801 |
| 2026-11-17 | revenue screen UI. | 1 img | 2122663290186649937 |
| 2026-11-17 | full automations flow → not just a screen. | 1 img | 2122631833456427354 |
| 2026-11-17 | performance overview screen UI. | 1 img | 2122604905466626060 |
| 2026-11-17 | the quality work I do | 1 img | 2122572693153206439 |
| 2026-11-17 | sooo clean UI. | 1 img | 2122482347815629024 |
| 2026-11-16 | clean automation flow UI. | 1 img | 2122457685677232281 |
| 2026-11-16 | (sem texto) | 1 img | 2122402823853723714 |
| 2026-11-16 | integration UI. | 1 img | 2122384956051829199 |
| 2026-11-16 | best list table design ever | 1 img | 2122347459443622147 |
| 2026-11-16 | clean members flow UI. | 1 img | 2122296875806060979 |
| 2026-11-16 | so clean UI. | 1 img | 2122252080597594406 |
| 2026-11-16 | overview screen UI. | 1 img | 2122219868334481816 |
| 2026-11-16 | AI configuration flow UI. | 1 img | 2122192437460324860 |
| 2026-11-16 | security screen UI | 1 img | 2122163749452734871 |
| 2026-11-16 | clean UI design. | 1 img | 2122138331110879562 |
| 2026-11-15 | credential flow UI. | 1 img | 2122102596278403514 |
| 2026-11-15 | this is how a clean UI should look | 1 img | 2122035654628675712 |
| 2026-11-15 | so clean UI. | 1 img | 2121960157613576344 |
| 2026-11-15 | this is called quality UI work. | 1 img | 2121916871951700305 |
| 2026-11-15 | reports screen UI | 1 img | 2121861507265015950 |
| 2026-11-15 | clean UI design. | 1 img | 2121830804926103973 |
| 2026-11-14 | integrations screen UI. | 1 img | 2121701955579896010 |
| 2026-11-14 | just look at the details of this UI | 1 img | 2121668068514631946 |
| 2026-11-13 | this is called quality work | 1 img | 2121333276581548365 |
| 2026-11-13 | numbers screen UI. | 1 img | 2121300560884412495 |
| 2026-11-13 | clean UI design. | 1 img | 2121278414879424702 |
| 2026-11-13 | analytics screen | 1 img | 2121257158432206919 |
| 2026-11-12 | templates screen UI. | 1 img | 2121000836277157959 |
| 2026-11-12 | audit log | vídeo | 2120971391864537415 |
| 2026-11-12 | billing and plan screen UI. | 1 img | 2120925590433730802 |
| 2026-11-12 | auton overview flow | 1 img | 2120916781883625848 |
| 2026-11-12 | full connectors flow | 1 img | 2120899669203288545 |
| 2026-11-12 | team screen UI | 1 img | 2120869973723677052 |
| 2026-11-12 | i love clean dashboard | 1 img | 2120834490352427241 |
| 2026-11-12 | full integration flow UI → | 1 img | 2120789424187564251 |
| 2026-11-12 | reports screen UI. | 1 img | 2120766040548237531 |
| 2026-11-12 | performance overview | 1 img | 2120742131153113556 |
| 2026-11-11 | wth is this? | 1 img | 2120612873408065681 |
| 2026-11-11 | complex things should be easy — attack path UI | 1 img | 2120608500833239261 |
| 2026-11-11 | everything's work so perfect. | vídeo | 2120578553905320446 |
| 2026-11-11 | revenue screen UI. | 1 img | 2120544076361568515 |
| 2026-11-11 | security overview screen UI. | 1 img | 2120513625609891936 |
| 2026-11-11 | performance screen UI | 1 img | 2120481916730446189 |
| 2026-11-11 | full flow → not just a screen. | 1 img | 2120447710860042610 |
| 2026-11-10 | vulnerabilities flow | 1 img | 2120249132694593577 |
| 2026-11-10 | security run scan | vídeo | 2120215159008276933 |
| 2026-11-10 | automations list UI. | 1 img | 2120177411140538588 |
| 2026-11-10 | automation builder UI. | 1 img | 2120143436552814593 |
| 2026-11-10 | overview flow UI. | 1 img | 2120095118346883545 |
| 2026-11-10 | workflow flow UI. | 1 img | 2120057117474246712 |
| 2026-11-09 | audit log ui. | 1 img | 2119896811217506701 |
| 2026-11-09 | see how complex things work | vídeo | 2119832889877733737 |
| 2026-11-09 | automation system | vídeo | 2119799419537338614 |
| 2026-11-09 | approvals screen ui. | 1 img | 2119756889160634542 |
| 2026-11-09 | access policies | 1 img | 2119711500692828404 |
| 2026-11-08 | Revenue screen UI. | 1 img | 2119527880925606235 |
| 2026-11-08 | Register Agent | 1 img | 2119500198280139083 |
| 2026-11-08 | not just a static screen → see how it works | vídeo | 2119464462256058840 |
| 2026-11-08 | see how every function works in veriq | vídeo | 2119426965522219427 |
| 2026-11-08 | credentials deploy UI. | 1 img | 2119376633685774391 |
| 2026-11-08 | policy modal | 1 img | 2119332338425561260 |
| 2026-11-07 | security screen | 1 img | 2119158949433823595 |
| 2026-11-07 | notifications and profile | vídeo | 2119125227015909775 |
| 2026-11-07 | Axon product features showcase | vídeo | 2119089995394728231 |
| 2026-11-07 | workflow builder flow UI. | 1 img | 2119054545489969346 |
| 2026-11-06 | deploy agent screen UI. | 1 img | 2118825766859239728 |
| 2026-11-06 | Review queue works | vídeo | 2118785236716618155 |
| 2026-11-06 | exceptions full flow → | 1 img | 2118762839032701228 |
| 2026-11-06 | approvals screen | 1 img | 2118720069031043544 |
| 2026-11-06 | search function | vídeo | 2118683175430033555 |
| 2026-11-06 | data sources full flow → | 1 img | 2118621914956808384 |
| 2026-11-06 | Exceptions screen | 1 img | 2118531315188605424 |
| 2026-11-05 | review queue full flow | 1 img | 2118335025322025054 |
| 2026-11-05 | access policies | 1 img | 2118284688523686255 |
| 2026-11-05 | audit log flow → | 1 img | 2118245457885622523 |
| 2026-11-04 | see the dashboard UI details | 1 img | 2118070781087244710 |
| 2026-11-04 | full agents workflow UI | 1 img | 2118033031747490278 |
| 2026-11-04 | AI configuration screen. | 1 img | 2117972634365550745 |
| 2026-11-04 | security overview dashboard | vídeo | 2117942437230559347 |
| 2026-11-04 | full flow test run → | 1 img | 2117890776705425644 |
| 2026-11-03 | full settings flow → | 1 img | 2117708394777780673 |
| 2026-11-03 | B2B security platform dashboard UI. | 1 img | 2117673323379532206 |
| 2026-11-03 | see how connectors works | vídeo | 2117604068701188404 |
| 2026-11-03 | subscribers full flow (table, detail, import) | 4 img | 2117504548298457156 |
| 2026-11-03 | peak details | 1 img | 2117454216394416147 |
| 2026-11-02 | form editor with preview | 1 img | 2117348519795450307 |
| 2026-11-02 | cleanest analytics flow you have ever seen. | 4 img | 2117298188205826493 |
| 2026-11-02 | access policies full flow | 4 img | 2117255419563479226 |
| 2026-11-02 | aproovals flow of auton. | 1 img | 2117217662703190032 |
| 2026-11-02 | templates flow → | 1 img | 2117169976268538346 |
| 2026-11-01 | engagement screen. | 1 img | 2116970231793058125 |
| 2026-11-01 | failures grouped by root cause | vídeo | 2116895877587755165 |
| 2026-11-01 | segments flow → | 1 img | 2116828392821870957 |
| 2026-10-31 | automation dashboard. | 1 img | 2116584036215001126 |
| 2026-10-31 | automation flow builder | 1 img | 2116538180187123969 |
| 2026-10-31 | audience screen. | 1 img | 2116492885977604206 |
| 2026-10-31 | modals | 4 img | 2116438563722330193 |
| 2026-10-30 | full learning flow | 4 img | 2116260590004080896 |
| 2026-10-30 | runs & logs | vídeo | 2116193746878615971 |
| 2026-10-29 | full campaigns flow | 4 img | 2115884163794645427 |
| 2026-10-29 | how an agentic product works after design | vídeo | 2115803317628739610 |
| 2026-10-29 | audience screen. | 1 img | 2115712649107476767 |
| 2026-10-28 | full content flow | 4 img | 2115515223432138937 |
| 2026-10-28 | doesn't just look, see how it works | vídeo | 2115395835064361416 |
| 2026-10-28 | payments screen with many details | 1 img | 2115363546959864283 |
| 2026-10-27 | reports screen. | 1 img | 2115129314303939035 |
| 2026-10-27 | templates system. | vídeo | 2115063425563001297 |
| 2026-10-27 | dropdown menus. | 4 img | 2114999122470260871 |
| 2026-10-26 | engagement screen. | 1 img | 2114804543674548312 |
| 2026-10-26 | workflows features. | vídeo | 2114680778701566056 |
| 2026-10-26 | modal components | 4 img | 2114634027147923544 |
| 2026-10-25 | setup modals | 4 img | 2114413291535786173 |
| 2026-10-25 | create and manage workflow | vídeo | 2114319131034194077 |
| 2026-10-25 | it's so crazy guys | vídeo | 2114251232936337483 |
| 2026-10-25 | insights screen details | 1 img | 2114248045361803694 |
| 2026-10-24 | Vantage processes screen | 1 img | 2114042645987393859 |
| 2026-10-24 | workflows list, clean and structured | 1 img | 2113950077266120778 |
| 2026-10-24 | workflow builder | 1 img | 2113908822318420404 |
| 2026-10-23 | (sem texto) | 4 img | 2113672861210812714 |
| 2026-10-22 | (sem texto) | 4 img | 2113298858101100952 |
| 2026-10-22 | revenue screen. | 1 img | 2113167662083866629 |
| 2026-10-21 | Automations flow. | 1 img | 2112956432756977813 |
| 2026-10-21 | introducing 4 more screens from Loopo. | 4 img | 2112811100974821536 |
| 2026-10-20 | date pickers and popovers. | 4 img | 2112613918397096002 |
| 2026-10-20 | email analytics. | 3 img | 2112507699296600206 |
| 2026-10-20 | analytics dashboard. | 1 img | 2112455785301332321 |
| 2026-10-19 | review queue interactions. | 5 img | 2112204377973035085 |
| 2026-10-19 | review queue. | 3 img | 2112104741069316161 |
| 2026-10-18 | modal components. | 4 img | 2111894401622712344 |
| 2026-10-18 | integrations page | 1 img | 2111805022770249880 |
| 2026-10-18 | filter, sort, row menu, bulk actions | 4 img | 2111721342316020098 |
| 2026-10-17 | (sem texto) | 4 img | 2111519203694100840 |
| 2026-10-17 | team insights dashboard | 1 img | 2111431247780274543 |
| 2026-10-17 | (sem texto) | 4 img | 2111370979205410966 |
| 2026-10-16 | imagine if your admin panel looked this good | 3 img | 2111137594620723449 |
| 2026-10-16 | create alert modal | 1 img | 2111072167794479545 |
| 2026-10-16 | network tree dashboard | 1 img | 2111011766419570991 |
| 2026-10-15 | (sem texto) | 4 img | 2110770177428058596 |
| 2026-10-15 | admin dashboard in dark mode. | 3 img | 2110702236091428985 |
| 2026-10-15 | (sem texto) | 4 img | 2110631655031681328 |
| 2026-10-14 | pop-up form editor. | 1 img | 2110410786606878815 |
| 2026-10-14 | (sem texto) | 4 img | 2110329320669692011 |
| 2026-10-14 | new segment modal | 1 img | 2110244448647135654 |
| 2026-10-13 | (sem texto) | 4 img | 2110048821409689795 |
| 2026-10-13 | default and bulk select | 2 img | 2109978862616785340 |
| 2026-10-12 | analytics screen design, clean and minimal | 3 img | 2109703488712352192 |
| 2026-10-12 | (sem texto) | 4 img | 2109569616557314195 |
| 2026-10-11 | templates gallery worth bookmarking | 1 img | 2109331043304280516 |
| 2026-10-11 | exceptions screen, so clean and calm | 1 img | 2109274156575732187 |
| 2026-10-11 | (sem texto) | 4 img | 2109231926351741287 |
| 2026-10-11 | AI automation dashboard should look like this | 3 img | 2109192351071801368 |
| 2026-10-10 | built the FlowPilot dashboard in Next.js in a day | vídeo | 2108846893384217081 |
| 2026-10-09 | (sem texto) | 4 img | 2108583311081959893 |
| 2026-10-09 | two steps to connect Notion. | 2 img | 2108469361279418860 |
