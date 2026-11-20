# Referência: Jubayer (@jubayer6910)

Status: **referência de estudo**, não substitui `docs/design-system.md`. Em conflito, vale o design system.
Data da análise: 20/11/2026. Skill derivada: `.claude/skills/interface-enxuta/SKILL.md`.

## Quem é e por que estudar

Jubayer (`x.com/jubayer6910`, 3.378 posts) desenha painéis para produtos B2B e de IA e mantém a biblioteca **Ingot UI** (`ingotui.com`): 2.652 componentes em React + Tailwind e Figma, organizados em nove sistemas visuais. É o mesmo autor do painel `jubayer910/Admin-panel`, de onde já tiramos a paleta escura em 26/09/2026 (ver "Dark Mode" em `docs/design-system.md`). Os posts recentes mostram telas de um produto fictício, "Auton", sempre no mesmo esqueleto: barra lateral, área principal densa e painéis que aparecem só quando pedidos. É exatamente a "interface enxuta" que queremos.

## Fontes e limite da análise

O X, sem login, mostra só os 5 posts mais recentes. As abas Mídia, Respostas e o restante da linha do tempo pedem login. Não entrei com conta e não usei espelhos que copiam posts. Para cobrir o padrão de popover, que o X não mostrava, complementei com o catálogo público do próprio autor em `ingotui.com/categories/popovers`.

| # | Post | Link | O que mostra |
|---|---|---|---|
| P1 | "Introducing Ingot UI" (fixado, vídeo) | `x.com/jubayer6910/status/2123417304553918834` | Lançamento da biblioteca. Analisei só o texto: 1.800+ componentes, seis sistemas completos, gráficos e templates. O vídeo não foi analisado quadro a quadro |
| P2 | "settings flow UI." | `x.com/jubayer6910/status/2123718745856074204` | Quatro telas de configurações: Geral, modal "Create API key", "Billing & plan" e modal de exclusão na "Danger zone" |
| P3 | "overview flow UI." | `x.com/jubayer6910/status/2123702386887999914` | Visão geral: faixa de KPIs, gráfico de barras, "Credential health", coluna "Need Attention", tabela de agentes com abas de filtro e "Recent Activity" |
| P4 | "audit log flow UI." | `x.com/jubayer6910/status/2123669419742187668` | Log de auditoria: gráfico de volume, barra de filtros em chips, tabela densa, painel lateral de detalhe, modal de exportação e popover de período |
| P5 | "calendar modal UI." | `x.com/jubayer6910/status/2123567498620530899` | Modal de escala de plantão: grade semanal, lacuna destacada, aviso de consequência e rodapé com ação secundária à esquerda |
| I1 | Ingot UI, categoria Popovers | `ingotui.com/categories/popovers` | 78 popovers. Usei como base o "Annotation popover", o "Notifications popover", o "Workspaces popover" e o "Date range popover" |

Para estender a análise aos posts mais antigos, alguém logado no X precisa abrir o perfil no navegador embutido. Aí basta rodar de novo o passo 1 da skill.

## Padrões observados

Legenda da coluna "Cabe nos tokens?": **Sim** = dá para aplicar hoje com os tokens de `docs/design-system.md`; **Adaptar** = a ideia cabe, mas usando nosso token no lugar do dele; **Token novo** = exigiria token que não temos e depende de aprovação; **Não adotar** = conflita com uma regra nossa.

### 1. Densidade e estrutura

| Padrão | Origem | O que adotar no AncoraHub | Cabe nos tokens? |
|---|---|---|---|
| Tela = uma tarefa. A área principal tem um título curto ("Overview", "Audit log", "Settings") e quase nenhum texto de apoio | P2, P3, P4 | Título de página em uma linha. Explicação vai para tooltip ou para o drawer, não fica fixa | Sim |
| Detalhe da entidade só aparece quando pedido: clique na linha abre painel lateral com metadados, checklist e dados brutos | P4 | Já é a nossa regra (Sheet). Agora o passo anterior: **prévia ao passar o mouse** (ver §6) para quem só quer olhar | Sim |
| Coluna "Need Attention" com contador ("03") e cada item com um único link de ação ("Review Request ↗") | P3 | No painel do diretor e do corretor: um bloco "Precisa de atenção" com no máximo 3 itens, cada um com um verbo só | Sim |
| Configurações em duas colunas: rótulo + ajuda curta à esquerda, controle à direita, linhas separadas por hairline | P2 | Formulários de configuração seguem esse grid. Nada de cartão por campo | Sim |
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
| Última coluna com `⋯` para ações da linha | P3 | Já é a nossa regra | Sim |
| Primeira coluna com ícone ou avatar + nome em peso 500 + subtítulo cinza ("data-sync / Data") | P3 | Nome do lead em 500 com a origem ou a cidade embaixo em caption Fog. **O nome é o gatilho do hover card** | Sim |

### 8. Microinterações e movimento

As imagens são estáticas, então o movimento abaixo vem do que o padrão pede e do catálogo I1, que tem demos ao vivo.

| Padrão | Origem | O que adotar | Cabe nos tokens? |
|---|---|---|---|
| Linha da tabela realçada no hover com fundo cinza muito claro | P4 (linha selecionada em destaque) | Hover da linha em Paper Mist, sem sombra | Sim |
| Confirmação forte só em ação destrutiva: lista "THIS WILL" com o que vai acontecer, digitar o nome e código de 2FA | P2 | Só para ação irreversível (excluir empresa, apagar base). O resto é nível 0 ou 1 do `FEEDBACK.md` | Sim |
| Interruptor e controle segmentado para escolhas curtas ("30 days · 90 days · 1 year · Never") | P2 | `DsSegmentedControl` em vez de select quando há até 4 opções | Sim |
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
