# Plano de telas: modo diretor (normal) para o estilo Lite

Data: 2026-10-24. Autor: Vigia (Claude). Status: rascunho para revisão do Maestro (ainda não revisado pelo Cinzel nem pelo Vinicios).

Fonte: os três inventários de rotas (`inv-rotas-a.md`, `inv-rotas-b.md`, `inv-rotas-c.md`), `inv-cinzel.md` (contagem de desvios por pasta), `inv-shell.md` e `inv-primitivas.md`. Repo lido em modo somente leitura: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-lite-listas` (HEAD 5026f66e). Nada foi editado, buildado nem testado.

Escopo: as **92 rotas** do grupo `(dashboard)` (contagem de `page.tsx` no repo). Também entram as 7 rotas de `(auth)`, as 10 públicas e as páginas de erro, em Onda 8. Ficam fora: 20 rotas de `(platform-admin)` (super-admin e super-dev) e 27 rotas de `/dev` e `/dev-preview` (showcase, ver seção 7).

## 0. Como ler

**Ações** (uma por componente, vinda do inventário e classificada por palavra-chave):

| Ação | Significado |
|---|---|
| Reskin por tokens | Manter o componente e trocar classes por tokens Lite (`--surface`, `--surface-muted`, `--radius-panel`, `--shadow-resting`), tirar `dark:`, cor crua, uppercase e alvos menores que 44px |
| Reskin por tokens + Arc | Reskin, mas a primitiva shadcn também troca por componente Arc (`components/arc/*`) |
| Trocar por componente Arc | Substituir a primitiva por `components/arc/*` |
| Reusar Lite existente | Já existe tela ou componente Lite equivalente; ligar para o diretor (normalmente falta escopo de unidade) |
| Criar Lite novo | Não existe Arc nem Lite equivalente; criar componente Lite |
| Nada a fazer | Redirect, ou rota que o diretor não abre |
| Código morto ou órfão | Sem import ou não renderizado; não converter (remover em PR separado) |

**Complexidade** (`Cx`): P (até meio dia), M (1 a 2 dias), G (3 dias ou mais, arquivo grande, kanban, tabela grande ou gráfico). Na rota, vale a maior complexidade dos componentes dela.

**Primitivas F3**: a lista de primitivas Lite que a rota precisa. É inferida por palavra-chave do inventário (ex.: `Dialog`, `Table`, `Select`), então é um mapa de partida, não uma lista fechada. Os rótulos seguem o plano do Maestro: tabela Lite, kanban, select/combobox, dialog de confirmação, dropdown, tooltip, popover, checkbox, barra de lote, chips de filtro, intervalo de datas, gráficos com tokens, casca de wizard, paginação.

**Desvios**: contagem por componente, a partir da coluna de desvios do inventário (gradiente, sombra, cor crua, caixa alta, dark, alvo menor que 44px). **Cinzel (pasta)**: total de desvios de `inv-cinzel.md` para a pasta da rota. O Cinzel conta por pasta de arquivo, então a soma das rotas não fecha com o total geral de 5357, e uma rota que só re-exporta outra aparece com zero.

**Fases do Maestro (F0 a F3)**: não descritas aqui. Este plano só diz qual fase cada rota precisa. F0: decisões e fundação (chave `feature_director_lite_style`, tema claro, camada de tokens, portais). F1: re-skin das primitivas `ui/*` por `data-slot`. F2: chrome (sidebar, header, overlays globais, loading e erro). F3: primitivas Lite novas.

## 1. Resumo por onda

| Onda | Foco | Rotas | Componentes (linhas dos inventários) | Complexidade das rotas (G / M / P) | Depende de |
|---|---|---|---|---|---|
| 1 | já Lite ou reuso direto | 15 | 48 | 1 / 2 / 12 | F0 (chave e tema) e F2 (header Lite) |
| 2 | uso diário do diretor (dashboard, leads, conversas) | 8 | 100 | 4 / 2 / 2 | F0, F1, F2, F3: tabela Lite, kanban, dialog, drawer, select, chips, barra de lote, gráficos |
| 3 | operação comercial | 12 | 49 | 5 / 4 / 3 | F3: tabela Lite, drawer, dialog, intervalo de datas, gráficos |
| 4 | equipe e unidades | 16 | 83 | 2 / 6 / 8 | F0, F2, F3: tabela Lite, select, checkbox, drawer; decisão de escopo multiunidade |
| 5 | distribuição e plantões | 7 | 114 | 3 / 1 / 2 | F3: tabela Lite, select, drawer, dialog, dropdown, checkbox, barra de lote, popover; uma aba por entrega |
| 6 | configuração | 18 | 71 | 6 / 4 / 1 | F1 e F3: select, dialog, checkbox, tabs, wizard, drawer |
| 7 | marketing | 6 | 14 | 3 / 1 / 0 | F3: gráficos com tokens, wizard, tabela Lite, timeline |
| 8 | resto, auth, públicas e erros | 10 | 40 | 1 / 7 / 4 | F1 (re-skin) e F2 (erro e loading); pouca F3 |
| **Total** | | **92** | **519** | | |

Rotas contadas: 92, as 92 de `(dashboard)` no repo, incluindo as que só redirecionam (nada a fazer). Também cobertos, fora dessa conta: 4 grupos (7 rotas de `(auth)`, 10 públicas, onboarding e erros) em Onda 8. A aba Unidades de `/equipe` (`?visao=unidades`) é aba, não rota. Os componentes de transversal (chrome, primitivas, compartilhados) não entram nesta conta; estão na seção 4.

## 2.1 Onda 1: já Lite ou reuso direto

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/agenda` | Só corretor Lite; diretor é redirecionado. | P | 1 | 0 | nenhuma |
| `/cotacao` | Só corretor; diretor cai em access-denied. | P | 1 | 0 | nenhuma |
| `/desempenho` | Só corretor Lite; diretor é redirecionado para /dashboard. | P | 1 | 4 | nenhuma |
| `/jornada` | Só corretor; diretor redirecionado. A jornada do diretor está em /relacionamento. | P | 7 | 6 | nenhuma |
| `/mensagens` | Só gestor e supervisor Lite; demais vão para /conversas. | P | 2 | 0 | nenhuma |
| `/mensagens/[leadId]` | Só gestor e supervisor Lite; demais vão para /conversas. | P | 1 | 0 | nenhuma |
| `/conversas/broker` | Só corretor Lite; diretor é redirecionado para /conversas. | P | 3 | 0 | nenhuma |
| `/dashboard/c/[assistant]` | Redirect para /dashboard para o diretor. | P | 1 | 0 | nenhuma |
| `/leads/distribuicao/plantao` | Redirect para /distribuicao?view=plantao. | P | 1 | 114 | nenhuma |
| `/leads/[id]/feedback` | Já renderiza LightFeedbackView para todos. | P | 1 | 0 | nenhuma |
| `/notificacoes` | Diretor vê NotificationsClient (ramo normal). | P | 3 | 19 | chips de filtro, checkbox |
| `/empresas` | Diretor vê a tela normal, se a feature estiver ligada. | P | 1 | 6 | nenhuma |
| `/relacionamento` | Diretor vê RelationshipJourneyTabs. | M | 9 | 1 | drawer lateral, chips de filtro, gráficos com tokens, dialog, timeline, checkbox |
| `/clientes` | Diretor vê a lista normal. | M | 9 | 11 | chips de filtro, paginação, select/combobox, intervalo de datas, tabela Lite, gráficos com tokens |
| `/clientes/[clientId]` | Diretor vê o perfil normal. | G | 7 | 46 | timeline |

### `/agenda`

- **Acesso hoje**: Só corretor Lite; diretor é redirecionado.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor. Confirmar que o redirect continua igual.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/agenda/page.tsx:11 (26 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | já Lite | P | nenhum detectado |

### `/cotacao`

- **Acesso hoje**: Só corretor; diretor cai em access-denied.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor. Confirmar access-denied igual ao atual.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/cotacao/page.tsx:11 (20 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | já Lite | P | nenhum detectado |

### `/desempenho`

- **Acesso hoje**: Só corretor Lite; diretor é redirecionado para /dashboard.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1. Cinzel (pasta): 4
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/desempenho/page.tsx:11 (68 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | já Lite | P | sombra 2 (l.42,53) |

### `/jornada`

- **Acesso hoje**: Só corretor; diretor redirecionado. A jornada do diretor está em /relacionamento.
- **Complexidade da rota**: P (7 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 2, alvo menor que 44px em 1. Cinzel (pasta): 6
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/jornada/page.tsx:13 (33 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor (a jornada do diretor está em /relacionamento) | já Lite | P | nenhum detectado |
| app/(dashboard)/jornada/loading.tsx:4 (22 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | já Lite | P | alvo<44px 2 (l.9,14) |
| features/journey/components/journey-screen.tsx:43 (278 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | já Lite | P | nenhum detectado |
| features/assist/components/term.tsx:15 (32 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | já Lite | P | nenhum detectado |
| features/journey/components/badge-art.tsx:21 (48 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma (cores são ilustração) | já Lite | P | cor crua 6 (l.30,31,36,37,41,...) |
| features/journey/components/level-ring.tsx:11 (38 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | já Lite | P | nenhum detectado |
| features/journey/components/podium.tsx:21 (47 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | já Lite | P | cor crua 1 (l.12) |

### `/mensagens`

- **Acesso hoje**: Só gestor e supervisor Lite; demais vão para /conversas.
- **Complexidade da rota**: P (2 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor (redirect para /conversas).
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/mensagens/page.tsx:11 (18 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | já Lite (TeamConversationsList) | P | nenhum detectado |
| app/(dashboard)/mensagens/loading.tsx:3 (6 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | já Lite | P | nenhum detectado |

### `/mensagens/[leadId]`

- **Acesso hoje**: Só gestor e supervisor Lite; demais vão para /conversas.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/mensagens/[leadId]/page.tsx:11 (20 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | já Lite (TeamConversationView) | P | nenhum detectado |

### `/conversas/broker`

- **Acesso hoje**: Só corretor Lite; diretor é redirecionado para /conversas.
- **Complexidade da rota**: P (3 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/conversas/broker/page.tsx:41 (224 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | já Lite | P | nenhum detectado |
| app/(dashboard)/conversas/broker/loading.tsx:3 (4 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | - | P | nenhum detectado |
| app/(dashboard)/conversas/loading.tsx:3 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/dashboard/c/[assistant]`

- **Acesso hoje**: Redirect para /dashboard para o diretor.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/dashboard/c/[assistant]/page.tsx:23 (73 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | já Lite (AssistantChat) | P | nenhum detectado |

### `/leads/distribuicao/plantao`

- **Acesso hoje**: Redirect para /distribuicao?view=plantao.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 114
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer; link antigo continua caindo na aba certa.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/distribuicao/plantao/page.tsx:3 (7 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | - | P | nenhum detectado |

### `/leads/[id]/feedback`

- **Acesso hoje**: Já renderiza LightFeedbackView para todos.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Mesmo visual em 390px; salvar feedback continua funcionando; nenhuma sombra ou uppercase.
- **Movimento**: Formulário longo e configuração. Campo inválido rola até ele com foco; mensagem com LiteCollapse; salvar mostra LiteSuccess no botão.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/[id]/feedback/page.tsx:11 (40 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | já Lite | P | nenhum detectado |

### `/notificacoes`

- **Acesso hoje**: Diretor vê NotificationsClient (ramo normal).
- **Complexidade da rota**: P (3 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 19
- **Primitivas F3**: chips de filtro, checkbox
- **Critério de pronto**: Lista e toggle de toast vindos de LightNotifications e LightLeadToastToggle; dados iguais; sem ds-* nem sombra; alvos 44px.
- **Movimento**: Lista com filtros. Notificação nova entra no topo com LiteListPresence e o sino recebe LiteAttention uma vez; marcar como lida faz o ponto sumir com fade; contador com LiteNumber.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/notificacoes/page.tsx:16 (132 l.) | Reusar Lite existente | Reusar LightNotifications no ramo NORMAL (mesmas props, aiConsentGranted=null) | broker-workspace/components/light-notifications.tsx | P | nenhum detectado |
| app/(dashboard)/notificacoes/notifications-client.tsx:112 (154 l.) | Reusar Lite existente | Reusar Lite existente | light-notifications.tsx (mesmas props iniciais) | P | sombra 1 (l.152); uppercase 1 (l.152); alvo<44px 3 (l.77,86,152) |
| app/(dashboard)/notificacoes/lead-toast-toggle.tsx:14 (46 l.) | Reusar Lite existente | Reusar Lite existente | broker-workspace/components/light-lead-toast-toggle.tsx | P | nenhum detectado |

### `/empresas`

- **Acesso hoje**: Diretor vê a tela normal, se a feature estiver ligada.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, alvo menor que 44px em 1. Cinzel (pasta): 6
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Mesma lista do gestor Lite (LightCompaniesList), com escopo de tenant; nada da tela normal sobra.
- **Movimento**: Lista com filtros. Linhas em cascata (até 8); busca troca os resultados com LiteSwap; contagem com LiteNumber.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/empresas/page.tsx:19 (80 l.) | Reusar Lite existente | Reusar Lite existente (passar dados do diretor) | broker-workspace/components/light-companies-list.tsx | P | sombra 2 (l.61,69); alvo<44px 3 (l.58,63,74) |

### `/relacionamento`

- **Acesso hoje**: Diretor vê RelationshipJourneyTabs.
- **Complexidade da rota**: M (9 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 3. Cinzel (pasta): 1
- **Primitivas F3**: drawer lateral, chips de filtro, gráficos com tokens, dialog, timeline, checkbox
- **Critério de pronto**: RelationshipCenterLite com as mesmas props; abas em segmentado Arc; mural do corretor não aparece para o diretor.
- **Movimento**: Lista com filtros. Abas do centro de recados com LiteHighlight; recado novo entra com LiteListPresence; a jornada do diretor não aparece aqui.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/relacionamento/page.tsx:26 (119 l.) | trocar por Arc + reskin por tokens | Envolver ramo diretor em .arc-venancor | relationship/components/relationship-center-lite.tsx | P | nenhum detectado |
| features/relationship/components/broker-mural.tsx:18 (88 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo do diretor | - | P | alvo<44px 1 (l.76) |
| features/relationship/components/relationship-center.tsx:76 (339 l.) | Reusar Lite existente | Reusar Lite existente (RelationshipCenterLite) | relationship-center-lite.tsx (mesmas props: options, history, initial*) | P | alvo<44px 1 (l.318) |
| features/relationship/components/relationship-center-lite.tsx:55 (311 l.) | Reusar Lite existente | Reusar | já Lite | P | alvo<44px 4 (l.144,159,243,292) |
| features/relationship/components/relationship-journey-tabs.tsx:13 (37 l.) | trocar por Arc | Trocar por componente Arc | arc/segmented-control | P | nenhum detectado |
| features/journey/components/director/director-journey-panel.tsx:46 (151 l.) | trocar por Arc + reskin por tokens | Re-skin + Arc tabs/gráfico | arc/metric-card | M | nenhum detectado |
| features/journey/components/director/audit-tab.tsx:22 (111 l.) | trocar por Arc + reskin por tokens | Re-skin + Arc dialog | Arc timeline | M | nenhum detectado |
| features/journey/components/director/campaigns-tab.tsx:37 (187 l.) | trocar por Arc + reskin por tokens | Re-skin + Arc drawer | - | M | nenhum detectado |
| features/journey/components/director/rules-tab.tsx:15 (71 l.) | trocar por Arc + reskin por tokens | Re-skin + arc/switch | manager-lite-settings-parts | P | nenhum detectado |

### `/clientes`

- **Acesso hoje**: Diretor vê a lista normal.
- **Complexidade da rota**: M (9 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 1. Cinzel (pasta): 11
- **Primitivas F3**: chips de filtro, paginação, select/combobox, intervalo de datas, tabela Lite, gráficos com tokens
- **Critério de pronto**: LightClientsList com management; filtro de filial e paginação conferidos; lista em PeopleRow; escopo de tenant confirmado.
- **Movimento**: Lista com filtros. Oito primeiras linhas em cascata; aplicar filtro troca a lista com LiteSwap e anima a contagem com LiteNumber; carregar mais entra com linhas novas sem reanimar as antigas.
- **Riscos e pontos de atenção**: Confirmar que o filtro de filial não mostra unidade de outro gestor.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/clientes/page.tsx:18 (187 l.) | Reusar Lite existente | Reusar LightClientsList management como base; conferir paridade (filial, paginação) | broker-workspace/components/light-clients-list.tsx (prop management, usado pelo gestor Li… | M | nenhum detectado |
| app/(dashboard)/clientes/loading.tsx:4 (7 l.) | Reusar Lite existente | Reusar Lite existente | LightPageSkeleton variant list | P | nenhum detectado |
| components/period-select.tsx:27 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/branch-select.tsx:14 (56 l.) | trocar por Arc | Trocar por componente Arc | Arc select ou PeopleFilters | P | nenhum detectado |
| app/(dashboard)/clientes/clientes-list.tsx:132 (268 l.) | Reusar Lite existente | Reusar PeopleRow | PeopleRow/PeopleSection (people-list) | M | alvo<44px 5 (l.52,118,120,216,233) |
| components/ownership-context.tsx:18 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/metric-card.tsx:59 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/mini-donut.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/metric-sparkline.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/clientes/[clientId]`

- **Acesso hoje**: Diretor vê o perfil normal.
- **Complexidade da rota**: G (7 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 2, alvo menor que 44px em 2, gradiente em 1, caixa alta em 1. Cinzel (pasta): 46
- **Primitivas F3**: timeline
- **Critério de pronto**: Base em LightClientDetail; abas Arc; eyebrows sem uppercase (9 ocorrências); sem gradiente.
- **Movimento**: Detalhe. Cabeçalho com nome e status; seções em cascata; abas com LiteHighlight; ações em sheet lateral.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/clientes/[clientId]/page.tsx:29 (571 l.) | Reusar Lite existente | Reusar LightClientDetail como base; tirar gradiente (1), sombras (8), uppercase (9) | broker-workspace/components/light-client-detail.tsx | G | gradiente 1 (l.219); sombra 8 (l.218,221,256,290,347,...); uppercase 9 (l.292,302,313,328,337,...); alvo<44px 8 (l.246,277,298,309,324,...) |
| app/(dashboard)/clientes/[clientId]/loading.tsx:4 (7 l.) | Reusar Lite existente | Reusar Lite existente | LightPageSkeleton | P | nenhum detectado |
| features/leads/components/lead-timeline.tsx:19 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/documents/components/lead-documents-section.tsx:65 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | G | - |
| features/post-sale/components/customer-renewal-status.tsx:22 (80 l.) | reskin por tokens | Re-skin | - | P | sombra 1 (l.66); alvo<44px 1 (l.74) |
| features/customer-record/components/person-record-details.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/status-badges.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |

## 2.2 Onda 2: uso diário do diretor (dashboard, leads, conversas)

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/dashboard` | Diretor vê o ramo normal com 3 abas: overview, quality e funnel. | G | 17 | 8 | tabela Lite, gráficos com tokens, chips de filtro, select/combobox, intervalo de datas, popover |
| `/dashboard/drill/[drillId]` | Diretor vê o drill normal. | M | 2 | 0 | tabela Lite |
| `/leads` | Diretor vê kanban e lista da tela normal. | G | 31 | 525 | dialog, kanban, chips de filtro, drawer lateral, select/combobox, barra de lote, tabela Lite, dropdown, tooltip, checkbox, timeline, intervalo de datas |
| `/leads/[id]` | Diretor vê LeadDetail normal (30 componentes). | G | 30 | 157 | dialog, drawer lateral, select/combobox, timeline, checkbox, dialog de confirmação, casca de wizard, tooltip, dropdown |
| `/leads/arquivados` | Diretor vê a lista normal de arquivados. | M | 1 | 4 | tabela Lite, chips de filtro |
| `/leads/dashboard` | Diretor vê o dashboard de leads normal. | P | 1 | 4 | nenhuma |
| `/conversas` | Diretor vê ConversationsWorkspace dentro de .arc-venancor parcial (ed0af666). | G | 16 | 268 | dialog, chips de filtro, drawer lateral, select/combobox, dropdown, popover, tooltip, checkbox, barra de lote |
| `/conversas/dashboard` | Diretor vê o dashboard de conversas. | P | 2 | 0 | nenhuma |

### `/dashboard`

- **Acesso hoje**: Diretor vê o ramo normal com 3 abas: overview, quality e funnel.
- **Complexidade da rota**: G (17 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 6, caixa alta em 2, cor crua em 2, dark em 2, gradiente em 1. Cinzel (pasta): 8
- **Primitivas F3**: tabela Lite, gráficos com tokens, chips de filtro, select/combobox, intervalo de datas, popover
- **Critério de pronto**: 3 abas mantidas; KPIs em MetricCard Arc; atenção e leads recentes em lista Lite (não grade de cards); 1 CTA; 390px sem scroll horizontal.
- **Movimento**: Painel. Título, depois blocos de número em cascata (até 8); número conta só na primeira carga da sessão e depois anima apenas a diferença; gráficos se desenham com LiteReveal ao entrar na vista; troca de período troca o valor sem skeleton (skeleton só após 300ms); número que muda em tempo real usa LiteNumber e LiteAttention uma vez.
- **Riscos e pontos de atenção**: Aba quality é a maior concentração de gradiente (5 em lead-quality-center).

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/dashboard/page.tsx:34 (103 l.) | trocar por Arc + reskin por tokens | Envolver o ramo NORMAL em .arc-venancor (padrão ed0af666); sem mudança de dados | ChatHomeContent / SupervisorHomeContent / ManagerHomeContent (só ramos Lite) | P | nenhum detectado |
| features/dashboard/components/command-center.tsx:247 (300 l.) | Reusar Lite existente + trocar por Arc + reskin por tokens | Re-skin por tokens + trocar Card por superfície Lite e KPIs por arc metric-card | components/chat/chat-home.tsx (resumo/stats) e arc/metric-card como base visual | M | nenhum detectado |
| features/dashboard/components/whatsapp-activity-card.tsx:9 (49 l.) | Reusar Lite existente + reskin por tokens | Reusar visual do ChatHome ou re-skin por tokens | ChatHome já recebe whatsappActivity (components/chat/chat-home.tsx) | P | nenhum detectado |
| features/dashboard/components/dashboard-widgets.tsx:57 (477 l.) | Reusar Lite existente + reskin por tokens | Reusar PeopleRow/PeopleStats para a lista; re-skin do resto | components/light/people-list (PeopleRow, PeopleStats) | M | uppercase 3 (l.88,100,124); alvo<44px 4 (l.159,163,213,463) |
| components/dashboard/funnel-chart.tsx:48 (117 l.) | trocar por Arc + reskin por tokens | Re-skin por tokens (cores de série Arc) | nenhum | P | nenhum detectado |
| app/(dashboard)/dashboard/loading.tsx:23 (50 l.) | Reusar Lite existente | Reusar Lite existente | components/light/light-page-skeleton.tsx (variant dashboard) ou arc/skeleton | P | alvo<44px 2 (l.15,30) |
| features/dashboard/components/dashboard-section-tabs.tsx:12 (44 l.) | trocar por Arc | Trocar por componente Arc (tabs ou segmented-control com href) | arc/segmented-control ou PeopleFilters (pílula com contagem) | P | nenhum detectado |
| features/reports/components/lead-quality-center.tsx:391 (630 l.) | Criar Lite novo + reskin por tokens | Criar Lite novo (re-skin pesado): remover gradientes (l.122-125, 573), cores cruas por tom, eyebrows uppercase (l.503-546) | arc/metric-card; nenhuma tela Lite equivalente | G | gradiente 5 (l.122,123,124,125,573); cor crua 7 (l.123,124,125,146,147,...); uppercase 4 (l.503,517,534,546); dark: 1 (l.467); alvo<44px 8 (l.156,271… |
| components/period-select.tsx:27 (107 l.) | trocar por Arc | Trocar por componente Arc | arc/segmented-control (2 a 5 opções) ou Arc select | P | nenhum detectado |
| features/dashboard/components/dashboard-section-tabs.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/reports/components/lead-quality-filters.tsx:19 (197 l.) | trocar por Arc | Trocar por componente Arc (popover + chip-group); alvos 44px | arc/chip-group, arc/date-picker | M | alvo<44px 7 (l.16,81,110,111,155,...) |
| features/reports/components/lead-quality-simple.tsx:24 (159 l.) | reskin por tokens | Re-skin por tokens; tirar dark: e cores cruas | arc/metric-card | M | cor crua 4 (l.9,36,111,126); dark: 4 (l.9,36,111,126) |
| features/qualification-turbo/components/qualification-funnel-view.tsx:77 (220 l.) | trocar por Arc + reskin por tokens | Re-skin por tokens; tabela para Arc data-table | arc/metric-card | M | alvo<44px 1 (l.59) |
| components/dashboard/metric-card.tsx:59 (172 l.) | trocar por Arc | Trocar por componente Arc | arc/metric-card (label, número, contexto, chip de variação) | P | alvo<44px 1 (l.106) |
| features/dashboard/components/dashboard-section-tabs.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/mini-donut.tsx:12 (100 l.) | trocar por Arc + reskin por tokens | Trocar por Arc donut-chart (instalar) ou re-skin com tokens de cor | nenhum (Arc catálogo: donut-chart) | P | nenhum detectado |
| components/dashboard/metric-sparkline.tsx:15 (53 l.) | trocar por Arc | Trocar por Arc sparkline (instalar) | nenhum (Arc catálogo: sparkline) | P | nenhum detectado |

### `/dashboard/drill/[drillId]`

- **Acesso hoje**: Diretor vê o drill normal.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1. Cinzel (pasta): 0
- **Primitivas F3**: tabela Lite
- **Critério de pronto**: Tabela de drill vira lista Lite em 390px; detalhes em drawer; sem cor crua.
- **Movimento**: Painel lateral (drill). O detalhe abre em sheet lateral no desktop (entra da direita, x 24px com fade, spring.smooth) e em BottomSheet no celular; lista do drill em cascata; trocar de métrica troca o conteúdo do painel com LiteSwap.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/dashboard/drill/[drillId]/page.tsx:1 (9 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma (herda) | - | P | nenhum detectado |
| app/(dashboard)/relatorios/drill/[drillId]/page.tsx:14 (126 l.) | trocar por Arc + reskin por tokens | Re-skin + tabela Arc (sortable-data-table) | PeopleRow para listas de leads | M | sombra 1 (l.46) |

### `/leads`

- **Acesso hoje**: Diretor vê kanban e lista da tela normal.
- **Complexidade da rota**: G (31 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 18, cor crua em 12, dark em 7, caixa alta em 4, gradiente em 1, sombra em 1. Cinzel (pasta): 525
- **Primitivas F3**: dialog, kanban, chips de filtro, drawer lateral, select/combobox, barra de lote, tabela Lite, dropdown, tooltip, checkbox, timeline, intervalo de datas
- **Critério de pronto**: Kanban arrasta com teclado (setas e espaço para pegar e soltar); coluna com SLA em token; lista vira PeopleRow em 390px; seleção em massa com barra de lote; filtros em chips; eyebrows sem uppercase.
- **Movimento**: Kanban (e lista). Colunas e cartões em cascata (até 8 por coluna); arrastar levanta o cartão (scale 1.02 e sombra floating), os outros abrem espaço com layout; soltar assenta com spring.smooth; contagem de cada coluna com LiteNumber; lead novo por tempo real entra no topo da coluna com LiteListPresence e LiteAttention; teclado: espaço pega, setas movem, espaço solta, com anúncio em aria-live.
- **Riscos e pontos de atenção**: leads-table-columns: 64 cores cruas e 38 dark; leads-workspace: 32 cores.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/page.tsx:60 (908 l.) | trocar por Arc + reskin por tokens | Envolver ramo NORMAL em .arc-venancor; botões size sm para 44px (bloco do header, l.~880) | SupervisorLeadsRadar / ManagerLiteLeadsPage / LightLeadsList (ramos Lite) | M | alvo<44px 4 (l.762,772,868,886) |
| app/(dashboard)/leads/loading.tsx:3 (6 l.) | Reusar Lite existente | Reusar Lite existente | LightPageSkeleton variant list | P | nenhum detectado |
| app/(dashboard)/leads/error.tsx:5 (15 l.) | reskin por tokens | Re-skin via RouteError comum | arc/empty-state | P | nenhum detectado |
| app/(dashboard)/leads/_components/manual-lead-sheet.tsx:11 (21 l.) | trocar por Arc | Trocar por componente Arc (drawer) | arc/bottom-sheet (mobile) ou drawer Arc | P | alvo<44px 1 (l.19) |
| app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx:21 (232 l.) | trocar por Arc | Trocar por Arc dialog + file-dropzone + select | arc/file-dropzone | M | nenhum detectado |
| app/(dashboard)/leads/_components/leads-live-sync.tsx:14 (23 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | - | P | nenhum detectado |
| app/(dashboard)/leads/_components/leads-filters.tsx:44 (570 l.) | trocar por Arc | Trocar por componente Arc; tirar uppercase (9 linhas) e botões pequenos (18) | PeopleFilters (people-list) + arc/search-field + arc/chip-group | G | uppercase 9 (l.288,317,347,363,381,...); alvo<44px 18 (l.247,264,299,303,328,...) |
| app/(dashboard)/leads/_components/leads-queue-tabs.tsx:16 (47 l.) | Reusar Lite existente | Reusar PeopleFilters | PeopleFilters (pílula com contagem) / arc/segmented-control | P | nenhum detectado |
| app/(dashboard)/leads/leads-workspace.tsx:189 (1238 l.) | Criar Lite novo + reskin por tokens | Criar Lite novo para coluna/card/SLA do kanban; re-skin do resto; 32 linhas com cor crua e 8 com dark: | Kanban: nenhum. Lista: PeopleRow. Radar: SupervisorLeadsRadar. Detalhe: light-lead-detail… | G | cor crua 32 (l.145,146,147,150,151,...); dark: 8 (l.147,152,157,162,167,...); alvo<44px 4 (l.618,812,1039,1063) |
| app/(dashboard)/leads/_components/leads-header-actions.tsx:36 (166 l.) | trocar por Arc | Trocar por Arc dropdown-menu + dialog | - | M | cor crua 2 (l.132,144); uppercase 1 (l.107); dark: 1 (l.132); alvo<44px 5 (l.92,99,103,114,119) |
| components/next-urgent-lead-button.tsx:9 (39 l.) | reskin por tokens | Re-skin por tokens; alvo 44px | broker-workspace/components/light-dashboard/next-action.tsx | P | cor crua 2 (l.24,26); uppercase 1 (l.24); dark: 1 (l.24); alvo<44px 1 (l.23) |
| app/(dashboard)/leads/_components/manual-lead-form.tsx:21 (250 l.) | trocar por Arc | Trocar campos por Arc | arc/input, arc/textarea, arc/switch, arc/button | M | cor crua 3 (l.203,204,210) |
| features/conversation-intelligence/components/negotiations-radar-tab.tsx:84 (469 l.) | reskin por tokens | Re-skin pesado usando o visual do radar Lite: tirar gradiente (2), sombras (6), cores cruas (14), dark: (7) | supervisor-workspace/supervisor-leads-radar.tsx (radar Lite) como base | G | gradiente 2 (l.335,336); sombra 6 (l.192,211,230,249,267,...); cor crua 14 (l.210,211,217,218,221,...); uppercase 4 (l.198,217,236,255); dark: 7 (l.2… |
| features/lead-distribution/queue-color-tag.tsx:9 (40 l.) | reskin por tokens | Re-skin por tokens (manter matiz da fila) | arc/badge | P | nenhum detectado |
| app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:45 (496 l.) | Reusar Lite existente + trocar por Arc | Reusar formulários Lite como base visual; trocar dialogs por Arc dialog/bottom-sheet | manager-workspace/manager-lead-transfer-form.tsx, manager-lead-status-sheet.tsx, supervis… | G | cor crua 1 (l.360); alvo<44px 4 (l.355,367,388,389) |
| app/(dashboard)/leads/_components/lead-distribution-removal.tsx:25 (119 l.) | trocar por Arc | Trocar por Arc dialog + badge | - | P | nenhum detectado |
| app/(dashboard)/leads/_components/lead-assignment-history.tsx:62 (230 l.) | trocar por Arc | Trocar por componente Arc (timeline) | Arc timeline (catálogo) | M | cor crua 1 (l.145); alvo<44px 2 (l.101,145) |
| app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:31 (230 l.) | trocar por Arc | Trocar por Arc dialog + button; tirar dark: | - | M | cor crua 3 (l.57,59,88); dark: 1 (l.57); alvo<44px 3 (l.158,170,182) |
| app/(dashboard)/leads/leads-data-table.tsx:38 (233 l.) | Reusar Lite existente + trocar por Arc | Trocar por componente Arc (data-table Lite) | PeopleRow (lista) ou Arc sortable-data-table | M | cor crua 1 (l.117); alvo<44px 2 (l.131,141) |
| components/status-badges.tsx:12 (188 l.) | trocar por Arc | Trocar por componente Arc; mapear status para tons | arc/badge (tone) | M | alvo<44px 44 (l.22,29,36,43,50,...) |
| components/ownership-context.tsx:18 (32 l.) | reskin por tokens | Re-skin por tokens | - | P | nenhum detectado |
| features/leads/components/lead-health-badge.tsx:62 (160 l.) | trocar por Arc | Trocar por Arc badge + tooltip | arc/badge | P | nenhum detectado |
| features/leads/components/lead-quick-note.tsx:22 (87 l.) | trocar por Arc | Trocar por Arc dialog/bottom-sheet + textarea | light-lead-detail/step-sheet.tsx (padrão bottom-sheet) | P | alvo<44px 3 (l.43,65,75) |
| features/leads/components/lead-reminder.tsx:29 (152 l.) | trocar por Arc | Trocar por Arc dialog + date-picker | light-lead-detail/step-sheet.tsx; arc/date-picker | M | alvo<44px 3 (l.65,129,140) |
| features/leads/components/mark-lead-in-service-button.tsx:24 (78 l.) | trocar por Arc | Trocar por Arc button + dialog | - | P | alvo<44px 1 (l.54) |
| features/leads/components/lead-details-drawer.tsx:67 (139 l.) | Reusar Lite existente + trocar por Arc | Trocar DetailDrawer por Arc drawer; reusar DetailsZone/IdentityHeader como base visual | light-lead-detail/details-panel.tsx + identity-zone.tsx | M | cor crua 1 (l.133); alvo<44px 1 (l.133) |
| components/period-select.tsx:27 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:29 (231 l.) | trocar por Arc | Trocar por Arc dialog + select; tirar 8 cores cruas e 4 dark: | - | M | cor crua 8 (l.101,105,114,118,127,...); dark: 4 (l.101,114,127,140); alvo<44px 3 (l.84,221,222) |
| app/(dashboard)/leads/_components/lead-attendance-flow-starter.tsx:18 (71 l.) | trocar por Arc | Trocar por Arc select | - | P | nenhum detectado |
| app/(dashboard)/leads/leads-table-columns.tsx:213 (556 l.) | trocar por Arc + reskin por tokens | Re-skin: mapa de status (l.44 em diante) com 64 cores cruas e 38 dark: vira tons Arc | arc/badge com tone | G | cor crua 64 (l.44,45,49,50,54,...); dark: 38 (l.45,50,55,60,65,...); alvo<44px 5 (l.251,453,454,503,510) |
| features/lead-tags/components/lead-tag-chip.tsx:9 (32 l.) | reskin por tokens | Re-skin por tokens | arc/badge | P | nenhum detectado |

### `/leads/[id]`

- **Acesso hoje**: Diretor vê LeadDetail normal (30 componentes).
- **Complexidade da rota**: G (30 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 19, caixa alta em 10, sombra em 9, cor crua em 6, dark em 5, gradiente em 4. Cinzel (pasta): 157
- **Primitivas F3**: dialog, drawer lateral, select/combobox, timeline, checkbox, dialog de confirmação, casca de wizard, tooltip, dropdown
- **Critério de pronto**: Base em LightLeadDetail e SupervisorLeadDetail; abas do perfil em Arc tabs; ActionBar com alvos 44px; edição em drawer, não em dialog; sem gradiente nem uppercase (7 em leads/[id]/page).
- **Movimento**: Detalhe. Cabeçalho com nome e status; seções em cascata; abas internas com LiteHighlight; linha do tempo entra com LiteListPresence; ações abrem sheet lateral; salvar mostra LiteSuccess no botão.
- **Riscos e pontos de atenção**: Conferir escopo de lead por unidade antes de liberar ações.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/[id]/page.tsx:70 (955 l.) | trocar por Arc + reskin por tokens | Re-skin por tokens + Arc tabs; tirar uppercase (7), dark: (8), cards amber/primary (l.694, 769); botões size xs/sm (l.536, 705) para 44px | SupervisorLeadDetail / LightLeadDetail (LeadHeaderBar, NextStepCard, LeadSocialLayout, De… | G | cor crua 2 (l.694,906); uppercase 7 (l.803,843,857,872,883,...); dark: 8 (l.472,711,732,748,801,...); alvo<44px 8 (l.536,705,772,839,853,...) |
| app/(dashboard)/leads/[id]/loading.tsx:4 (19 l.) | Reusar Lite existente | Já Lite; revisar sombra (1) | LightPageSkeleton | P | sombra 1 (l.9) |
| app/(dashboard)/leads/[id]/error.tsx:5 (15 l.) | reskin por tokens | Re-skin via RouteError comum | arc/empty-state | P | nenhum detectado |
| features/leads/components/lead-status-selector.tsx:58 (288 l.) | Reusar Lite existente + trocar por Arc | Reusar visual do status sheet Lite; Arc select/dialog | manager-workspace/manager-lead-status-sheet.tsx | M | cor crua 4 (l.220,221,226,240); dark: 2 (l.221,226); alvo<44px 1 (l.247) |
| features/leads/components/lead-timeline.tsx:19 (32 l.) | trocar por Arc | Trocar por componente Arc | Arc timeline | P | uppercase 1 (l.30); alvo<44px 1 (l.30) |
| features/leads/components/lead-tasks.tsx:20 (181 l.) | trocar por Arc + reskin por tokens | Re-skin usando o visual da Agenda Lite; Arc dialog + checkbox | broker-workspace/components/light-dashboard/agenda.tsx (lista de retornos) | M | cor crua 1 (l.167); alvo<44px 4 (l.56,62,167,172) |
| features/leads/components/lead-chat.tsx:6 (22 l.) | reskin por tokens | Re-skin por tokens | broker-workspace/chat/lead-conversation.tsx | P | sombra 1 (l.13); alvo<44px 1 (l.15) |
| app/(dashboard)/leads/[id]/start-service-button.tsx:11 (44 l.) | trocar por Arc | Trocar por Arc button | light-lead-detail/action-bar.tsx | P | alvo<44px 1 (l.42) |
| features/leads/components/mark-lead-in-service-button.tsx:24 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/[id]/supervision-panel.tsx:23 (398 l.) | Reusar Lite existente + reskin por tokens | Re-skin + reusar transfer form Lite; tirar gradiente (1) e uppercase (3) | manager-workspace/manager-lead-transfer-form.tsx | M | gradiente 1 (l.208); cor crua 1 (l.243); uppercase 3 (l.239,263,277); dark: 1 (l.243); alvo<44px 2 (l.351,352) |
| app/(dashboard)/leads/[id]/delete-lead-control.tsx:12 (38 l.) | trocar por Arc | Trocar por Arc dialog (ou confirm-morph) | - | P | alvo<44px 1 (l.31) |
| app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:31 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| features/documents/components/lead-documents-section.tsx:65 (500 l.) | reskin por tokens | Re-skin pesado; tirar gradiente (1) e sombras (4) | light-lead-detail/sale-doc-sheet.tsx + arc/file-dropzone | G | gradiente 1 (l.212); sombra 4 (l.212,258,301,388); uppercase 2 (l.244,308); alvo<44px 5 (l.261,315,400,420,485) |
| features/leads/components/lead-action-hub.tsx:83 (311 l.) | Reusar Lite existente | Reusar ActionBar Lite como base; 13 alvos pequenos | light-lead-detail/action-bar.tsx + chat/lead-screen-parts NextStepCard | M | sombra 1 (l.117); uppercase 1 (l.126); alvo<44px 13 (l.144,180,182,190,199,...) |
| app/(dashboard)/leads/[id]/beneficiaries-section.tsx:40 (236 l.) | Reusar Lite existente + trocar por Arc | Reusar PeopleDataSection como base visual; Arc dialog | light-lead-detail/people-data-section.tsx | M | alvo<44px 1 (l.144) |
| features/customer-record/components/person-record-details.tsx:15 (100 l.) | Reusar Lite existente + reskin por tokens | Reusar ClientInfoCard ou re-skin; tirar uppercase (7) | light-lead-detail/identity-zone.tsx (ClientInfoCard) | P | sombra 1 (l.36); uppercase 7 (l.43,44,56,62,73,...) |
| features/leads/components/lead-feedback-dialog.tsx:28 (76 l.) | Reusar Lite existente + trocar por Arc | Reusar visual do LightFeedbackView em Arc dialog | broker-workspace/components/light-feedback-view.tsx | P | uppercase 1 (l.61) |
| app/(dashboard)/leads/[id]/register-sale-panel.tsx:29 (301 l.) | reskin por tokens | Re-skin por tokens (beneficia Lite e Normal) | Já é importado pelo LightLeadDetail (light-lead-detail/index.tsx:9); light-lead-detail/sa… | M | cor crua 1 (l.167); uppercase 2 (l.107,176); dark: 1 (l.167) |
| features/leads/components/next-status-suggestion.tsx:24 (53 l.) | reskin por tokens | Re-skin por tokens | chat/lead-screen-parts NextStepCard | P | sombra 1 (l.44); alvo<44px 2 (l.40,44) |
| components/plugins/lead-assigned-notification-button.tsx:16 (47 l.) | reskin por tokens | Re-skin por tokens | - | P | nenhum detectado |
| features/conversation-intelligence/components/ai-conversation-insight-card.tsx:75 (285 l.) | reskin por tokens | Re-skin; tirar gradiente (2) e cores cruas (4) | components/chat/chat-blocks.tsx (blocos de insight do chat Lite) | M | gradiente 2 (l.88,166); sombra 1 (l.166); cor crua 4 (l.202,203,215,216); dark: 2 (l.203,216); alvo<44px 6 (l.92,103,170,249,270,...) |
| components/status-badges.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| features/leads/components/lead-progress-stepper.tsx:35 (125 l.) | trocar por Arc | Trocar por componente Arc | arc/stepper | P | sombra 2 (l.61,113); alvo<44px 1 (l.57) |
| features/leads/components/lead-reminder.tsx:29 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| features/leads/components/lead-quick-note.tsx:22 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/[id]/inline-feedback-form.tsx:25 (348 l.) | Reusar Lite existente | Reusar visual Lite; 10 alvos pequenos | light-feedback-view.tsx | M | alvo<44px 10 (l.88,104,116,125,132,...) |
| features/next-best-action/components/next-best-action-card.tsx:34 (130 l.) | Reusar Lite existente | Reusar NextStepCard; tirar gradiente (1) e sombras (3) | chat/lead-screen-parts NextStepCard | P | gradiente 1 (l.51); sombra 3 (l.51,110,119); uppercase 2 (l.58,68); alvo<44px 2 (l.108,117) |
| features/next-best-action/components/next-best-action-inline.tsx:21 (60 l.) | reskin por tokens | Re-skin por tokens | NextStepCard | P | alvo<44px 2 (l.30,33) |
| features/next-best-action/components/next-best-action-banner.tsx:15 (46 l.) | reskin por tokens | Re-skin por tokens | NextStepCard | P | alvo<44px 2 (l.34,38) |
| features/next-best-action/components/related-actions-menu.tsx:22 (55 l.) | trocar por Arc | Trocar por Arc dropdown-menu | - | P | uppercase 1 (l.34); alvo<44px 1 (l.28) |

### `/leads/arquivados`

- **Acesso hoje**: Diretor vê a lista normal de arquivados.
- **Complexidade da rota**: M (1 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 1, dark em 1, alvo menor que 44px em 1. Cinzel (pasta): 4
- **Primitivas F3**: tabela Lite, chips de filtro
- **Critério de pronto**: Restaurar acessível por teclado; lista vira PeopleRow em 390px; busca em search-field Arc.
- **Movimento**: Lista com filtros. Restaurar tira a linha com LiteListPresence (altura colapsa com grid-template-rows); contagem com LiteNumber; filtro aplicado troca a lista com LiteSwap.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/arquivados/page.tsx:25 (166 l.) | trocar por Arc + reskin por tokens | Re-skin; tabela para PeopleRow ou data-table Arc | PeoplePage/PeopleRow | M | cor crua 1 (l.96); dark: 1 (l.96); alvo<44px 3 (l.116,155,156) |

### `/leads/dashboard`

- **Acesso hoje**: Diretor vê o dashboard de leads normal.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 4
- **Primitivas F3**: nenhuma
- **Critério de pronto**: KPIs e gráficos com tokens de gráfico; sem sombra; alvos 44px.
- **Movimento**: Painel. Números em cascata com LiteNumber; funil e barras crescem a partir da base em cascata de 30ms; troca de período sem piscar.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/dashboard/page.tsx:10 (36 l.) | trocar por Arc + reskin por tokens | Trocar KPIs por Arc metric-card; re-skin | arc/metric-card | P | nenhum detectado |

### `/conversas`

- **Acesso hoje**: Diretor vê ConversationsWorkspace dentro de .arc-venancor parcial (ed0af666).
- **Complexidade da rota**: G (16 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 9, cor crua em 5, dark em 3, caixa alta em 2, sombra em 1. Cinzel (pasta): 268
- **Primitivas F3**: dialog, chips de filtro, drawer lateral, select/combobox, dropdown, popover, tooltip, checkbox, barra de lote
- **Critério de pronto**: Terminar o ed0af666: conversations-workspace sem 27 cores cruas, 14 dark e 22 alvos pequenos; 3 painéis viram 1 coluna em 390px; busca em search-field Arc; sem gradiente.
- **Movimento**: Conversa. Linhas da lista em cascata (já no ed0af666); mensagem nova entra de baixo (y 8px); trocar de conversa troca o painel com LiteSwap; o painel do cliente entra da direita em sheet; nenhum loop infinito, só o skeleton de carregamento.
- **Riscos e pontos de atenção**: official-broker-conversations: 10 cores e 24 alvos pequenos.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/conversas/page.tsx:50 (1161 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma no page; terminar componentes filhos | já Lite parcial | P | nenhum detectado |
| app/(dashboard)/conversas/loading.tsx:3 (25 l.) | trocar por Arc + reskin por tokens | Re-skin para arc/skeleton | LightPageSkeleton | P | alvo<44px 3 (l.7,8,12) |
| app/(dashboard)/conversas/error.tsx:5 (15 l.) | reskin por tokens | Re-skin via RouteError comum | arc/empty-state | P | nenhum detectado |
| app/(dashboard)/conversas/conversations-workspace.tsx:186 (2046 l.) | reskin por tokens | Terminar re-skin: 27 cores cruas (ex.: l.736-752), 14 dark:, 5 uppercase, 22 alvos pequenos | Parcialmente convertido via data-lite + CSS module (ed0af666). Base: light-conversations-… | G | sombra 1 (l.903); cor crua 27 (l.720,736,738,740,750,...); uppercase 5 (l.728,1197,1862,1867,1951); dark: 14 (l.736,738,740,750,752,...); alvo<44px 2… |
| app/(dashboard)/conversas/official-broker-conversations.tsx:114 (975 l.) | reskin por tokens | Re-skin seguindo ed0af666; 10 cores cruas (ex.: l.333-359), 24 alvos pequenos | team-conversations/team-conversation-view.tsx, team-conversations-list.tsx | G | cor crua 10 (l.333,354,359,555,663,...); uppercase 2 (l.576,590); dark: 3 (l.333,359,496); alvo<44px 24 (l.334,353,393,395,401,...) |
| app/(dashboard)/conversas/_components/conversas-header-nav.tsx:15 (76 l.) | trocar por Arc | Trocar por componente Arc | PeopleFilters / segmented-control | P | nenhum detectado |
| features/ai-qualification/components/bulk-qualification-dialog.tsx:28 (201 l.) | trocar por Arc | Trocar por Arc dialog + select | - | M | cor crua 4 (l.91,103,163,182); dark: 1 (l.163); alvo<44px 5 (l.91,103,115,175,179) |
| features/lead-tags/components/lead-tag-chip.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/lead-tags/components/lead-tags-picker.tsx:20 (118 l.) | trocar por Arc | Trocar por Arc popover + chip-group | arc/chip-group | P | alvo<44px 3 (l.60,72,97) |
| features/lead-distribution/queue-color-tag.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/ownership-context.tsx:18 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:29 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| features/conversations/components/quick-responses-popover.tsx:54 (92 l.) | trocar por Arc | Trocar por Arc popover | - | P | cor crua 1 (l.62); alvo<44px 1 (l.61) |
| features/conversations/components/media-bubble.tsx:31 (288 l.) | Reusar Lite existente + reskin por tokens | Reusar blocos do chat Lite onde couber; re-skin | components/chat/chat-audio.tsx, chat-blocks.tsx | M | cor crua 1 (l.208); alvo<44px 2 (l.166,174) |
| features/conversations/components/media-attach-button.tsx:40 (205 l.) | trocar por Arc | Trocar por Arc dropdown/dialog | components/chat/camera-capture.tsx, composer.tsx | M | alvo<44px 3 (l.127,186,191) |
| features/lead-tags/components/lead-tags-manager.tsx:18 (152 l.) | trocar por Arc | Trocar por Arc drawer | - | M | alvo<44px 4 (l.62,125,127,141) |

### `/conversas/dashboard`

- **Acesso hoje**: Diretor vê o dashboard de conversas.
- **Complexidade da rota**: P (2 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Gráficos com tokens; alvos 44px; sem dark.
- **Movimento**: Painel. Números com LiteNumber; gráficos com LiteReveal; troca de período com transição de valor.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/conversas/dashboard/page.tsx:6 (7 l.) | Sem ação própria (herda ou nenhuma) | Herda de DomainDashboard | arc/metric-card | P | nenhum detectado |
| features/dashboard/components/domain-dashboard.tsx:5 (6 l.) | trocar por Arc | Trocar por componente Arc | arc/metric-card | P | nenhum detectado |

## 2.3 Onda 3: operação comercial

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/vendas` | Diretor vê sales-workspace (tabela). | G | 10 | 8 | chips de filtro, select/combobox, intervalo de datas, tabela Lite, checkbox, gráficos com tokens |
| `/vendas/[id]` | Diretor vê o detalhe normal. | M | 8 | 51 | tabela Lite, tooltip, gráficos com tokens |
| `/vendas/dashboard` | Diretor vê o dashboard de vendas. | P | 2 | 0 | nenhuma |
| `/propostas` | Diretor vê propostas-client (10 cores, 9 sombras). | G | 2 | 75 | dialog, drawer lateral, tabela Lite, intervalo de datas |
| `/documentos` | Diretor vê documents-workspace (tabela). | G | 3 | 0 | tabela Lite, checkbox, chips de filtro |
| `/tarefas/dashboard` | Diretor vê o dashboard de tarefas. | P | 2 | 0 | nenhuma |
| `/noc` | Diretor vê NocClient (heatmap e alertas). | G | 9 | 24 | select/combobox, intervalo de datas, tabela Lite, tooltip, gráficos com tokens |
| `/integridade` | Diretor vê a tela normal. | M | 2 | 13 | gráficos com tokens |
| `/relatorios/drill/[drillId]` | Diretor vê o drill de relatórios. | M | 1 | 1 | nenhuma |
| `/minha-fila` | Fila pessoal do corretor, alcançável pelo diretor sem gate de papel. | M | 6 | 35 | dialog de confirmação, gráficos com tokens, tabela Lite, chips de filtro |
| `/assistente` | Diretor vê AssistantChatClient normal. | G | 2 | 130 | tooltip |
| `/relatorios` | Redirect para /dashboard para o diretor. | P | 2 | 91 | nenhuma |

### `/vendas`

- **Acesso hoje**: Diretor vê sales-workspace (tabela).
- **Complexidade da rota**: G (10 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 2, sombra em 1, caixa alta em 1. Cinzel (pasta): 8
- **Primitivas F3**: chips de filtro, select/combobox, intervalo de datas, tabela Lite, checkbox, gráficos com tokens
- **Critério de pronto**: Tabela vira Arc data-table no desktop e lista Lite em 390px; barra de lote; período em intervalo de datas.
- **Movimento**: Lista com filtros. Filtro de período em intervalo de datas com LiteCollapse para o avançado; total com LiteNumber; barra de lote sobe de baixo (y 16px, spring.smooth) ao marcar o primeiro item.
- **Riscos e pontos de atenção**: sales-workspace é G.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/vendas/page.tsx:14 (110 l.) | trocar por Arc + reskin por tokens | Envolver em .arc-venancor; re-skin | - | P | nenhum detectado |
| app/(dashboard)/vendas/loading.tsx:3 (6 l.) | Reusar Lite existente | Reusar Lite existente | LightPageSkeleton | P | nenhum detectado |
| components/period-select.tsx:27 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/branch-select.tsx:14 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/vendas/sales-workspace.tsx:41 (442 l.) | trocar por Arc + reskin por tokens | Trocar tabela por data-table Arc; re-skin | PeopleRow para mobile | G | sombra 1 (l.358); alvo<44px 6 (l.218,222,284,348,368,...) |
| components/related-actions.tsx:25 (77 l.) | reskin por tokens | Re-skin | - | P | uppercase 1 (l.36); alvo<44px 1 (l.51) |
| components/status-badges.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| components/dashboard/metric-card.tsx:59 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/mini-donut.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/metric-sparkline.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/vendas/[id]`

- **Acesso hoje**: Diretor vê o detalhe normal.
- **Complexidade da rota**: M (8 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 4, cor crua em 3, sombra em 2, caixa alta em 1, dark em 1. Cinzel (pasta): 51
- **Primitivas F3**: tabela Lite, tooltip, gráficos com tokens
- **Critério de pronto**: Abas em Arc tabs; formulário sem sombra; alvos 44px.
- **Movimento**: Detalhe. Abas internas com LiteHighlight; mudança de status com LiteSuccess no selo; ações em sheet.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/vendas/[id]/page.tsx:16 (141 l.) | trocar por Arc + reskin por tokens | Re-skin + Arc tabs | - | M | sombra 1 (l.64); uppercase 1 (l.69); alvo<44px 3 (l.93,97,101) |
| app/(dashboard)/vendas/[id]/sale-details-tabs.tsx:56 (218 l.) | trocar por Arc | Trocar por componente Arc | Arc tabs | M | cor crua 2 (l.85,90); alvo<44px 3 (l.125,150,185) |
| app/(dashboard)/vendas/[id]/sale-stats-cards.tsx:9 (102 l.) | trocar por Arc | Trocar por Arc metric-card | arc/metric-card | P | sombra 1 (l.82); cor crua 5 (l.50,60,61,71,72); dark: 5 (l.50,60,61,71,72); alvo<44px 1 (l.82) |
| app/(dashboard)/vendas/[id]/commission-schedule-table.tsx:91 (233 l.) | trocar por Arc | Trocar por data-table Arc | - | M | cor crua 2 (l.67,81); alvo<44px 6 (l.64,67,78,81,106,...) |
| components/dashboard/metric-card.tsx:59 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/status-badges.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| components/dashboard/mini-donut.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/metric-sparkline.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/vendas/dashboard`

- **Acesso hoje**: Diretor vê o dashboard de vendas.
- **Complexidade da rota**: P (2 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Gráficos com tokens; sem cor crua.
- **Movimento**: Painel. Números em cascata com LiteNumber; gráficos desenham com LiteReveal; troca de período sem skeleton rápido.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/vendas/dashboard/page.tsx:6 (7 l.) | Sem ação própria (herda ou nenhuma) | Herda de DomainDashboard | arc/metric-card | P | nenhum detectado |
| features/dashboard/components/domain-dashboard.tsx:5 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/propostas`

- **Acesso hoje**: Diretor vê propostas-client (10 cores, 9 sombras).
- **Complexidade da rota**: G (2 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, cor crua em 1, caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 75
- **Primitivas F3**: dialog, drawer lateral, tabela Lite, intervalo de datas
- **Critério de pronto**: Lista de propostas em lista Lite; dialog de confirmação Arc; sem sombra.
- **Movimento**: Lista com filtros. Linhas em cascata; confirmação de envio em dialog com foco no botão de confirmar (sem campo); envio concluído mostra LiteSuccess.
- **Riscos e pontos de atenção**: propostas: 75 desvios no inventário por pasta.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/propostas/page.tsx:10 (35 l.) | Ação livre (ver detalhe) | Trocar por DashboardHeader/lite-page-title | - | P | nenhum detectado |
| app/(dashboard)/propostas/_components/propostas-client.tsx:82 (671 l.) | Criar Lite novo | Criar Lite novo; 9 sombras, 10 cores cruas, 3 uppercase | - | G | sombra 9 (l.220,232,249,307,337,...); cor crua 10 (l.67,68,69,70,71,...); uppercase 3 (l.222,234,251); alvo<44px 10 (l.281,478,479,490,491,...) |

### `/documentos`

- **Acesso hoje**: Diretor vê documents-workspace (tabela).
- **Complexidade da rota**: G (3 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 1, dark em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: tabela Lite, checkbox, chips de filtro
- **Critério de pronto**: Tabela Arc; upload em file-dropzone Arc; sem alvos pequenos.
- **Movimento**: Lista com filtros. Upload mostra LiteProgress com scaleX a partir da esquerda; documento novo entra com LiteListPresence; remoção colapsa a linha.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/documentos/page.tsx:12 (71 l.) | reskin por tokens | Re-skin | - | P | nenhum detectado |
| features/documents/components/documents-workspace.tsx:79 (603 l.) | trocar por Arc + reskin por tokens | Re-skin + data-table Arc; 14 alvos pequenos | arc/file-dropzone | G | cor crua 3 (l.249,305,422); dark: 1 (l.249); alvo<44px 14 (l.303,312,323,376,378,...) |
| components/ownership-context.tsx:18 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/tarefas/dashboard`

- **Acesso hoje**: Diretor vê o dashboard de tarefas.
- **Complexidade da rota**: P (2 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Lista Lite; checkbox Arc; sem cor crua.
- **Movimento**: Lista com filtros. Concluir tarefa desenha o check (LiteSuccess) e a linha colapsa com LiteListPresence; contagem com LiteNumber.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/tarefas/dashboard/page.tsx:6 (7 l.) | Sem ação própria (herda ou nenhuma) | Herda de DomainDashboard | arc/metric-card | P | nenhum detectado |
| features/dashboard/components/domain-dashboard.tsx:5 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/noc`

- **Acesso hoje**: Diretor vê NocClient (heatmap e alertas).
- **Complexidade da rota**: G (9 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 3, cor crua em 3, dark em 3, alvo menor que 44px em 3, caixa alta em 2. Cinzel (pasta): 24
- **Primitivas F3**: select/combobox, intervalo de datas, tabela Lite, tooltip, gráficos com tokens
- **Critério de pronto**: Heatmap com tokens legível em light; alertas em Arc alert; tooltip Arc; sem gradiente.
- **Movimento**: Painel. Heatmap: células mudam de cor em 120ms, sem animar tamanho; alerta novo com LiteAttention uma vez; números por tempo real com LiteNumber; sem loop infinito.
- **Riscos e pontos de atenção**: Gate do servidor só bloqueia corretor; conferir papel de gestor.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/noc/page.tsx:12 (46 l.) | trocar por Arc + reskin por tokens | Envolver em .arc-venancor | - | P | nenhum detectado |
| components/next-urgent-lead-button.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/period-select.tsx:27 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/noc/noc-client.tsx:217 (705 l.) | trocar por Arc + reskin por tokens | Re-skin + gráficos Arc | arc/metric-card, arc/animated-counter | G | sombra 2 (l.109,644); cor crua 4 (l.691,695,697,698); uppercase 1 (l.650); dark: 1 (l.695); alvo<44px 5 (l.195,291,542,591,647) |
| components/dashboard/metric-card.tsx:59 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/noc/components/noc-heatmap.tsx:13 (152 l.) | reskin por tokens | Re-skin: 10 cores cruas (l.37-46), 7 dark:, 4 uppercase | Arc activity-heatmap (catálogo) | M | sombra 2 (l.23,76); cor crua 10 (l.37,38,41,42,46,...); uppercase 4 (l.101,105,109,115); dark: 7 (l.37,41,46,63,65,...); alvo<44px 2 (l.28,140) |
| features/noc/components/noc-anomaly-alerts.tsx:9 (74 l.) | reskin por tokens | Re-skin; 3 cores cruas e 3 dark: | Arc alert (catálogo) | P | sombra 1 (l.27); cor crua 3 (l.29,30,36); dark: 3 (l.29,30,36); alvo<44px 5 (l.39,52,55,60,63) |
| components/dashboard/mini-donut.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/metric-sparkline.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/integridade`

- **Acesso hoje**: Diretor vê a tela normal.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 13
- **Primitivas F3**: gráficos com tokens
- **Critério de pronto**: Re-skin por tokens; sem dark; alvos 44px.
- **Movimento**: Painel. Alertas com LiteAttention só quando mudam de estado; números com LiteNumber; listas em cascata até 8.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/integridade/page.tsx:40 (385 l.) | reskin por tokens | Re-skin; KPIs para metric-card | arc/metric-card | M | uppercase 1 (l.365); alvo<44px 3 (l.239,277,370) |
| components/dashboard/sparkline.tsx:18 (58 l.) | trocar por Arc | Trocar por Arc sparkline (instalar) | nenhum (Arc: sparkline) | P | nenhum detectado |

### `/relatorios/drill/[drillId]`

- **Acesso hoje**: Diretor vê o drill de relatórios.
- **Complexidade da rota**: M (1 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 1
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Tabela vira lista Lite em 390px; drawer de detalhe; sem cor crua.
- **Movimento**: Painel lateral (drill). Detalhe em sheet lateral no desktop e BottomSheet no celular; tabela do drill em cascata das 8 primeiras linhas; exportar mostra LiteProgress.
- **Riscos e pontos de atenção**: Reusa a tabela de Onda 3.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/relatorios/drill/[drillId]/page.tsx:14 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |

### `/minha-fila`

- **Acesso hoje**: Fila pessoal do corretor, alcançável pelo diretor sem gate de papel.
- **Complexidade da rota**: M (6 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 4, sombra em 1, caixa alta em 1, cor crua em 1. Cinzel (pasta): 35
- **Primitivas F3**: dialog de confirmação, gráficos com tokens, tabela Lite, chips de filtro
- **Critério de pronto**: Decidir antes de converter: bloquear diretor por papel (preferido) ou manter com decisão explícita do Vinicios. Se liberado, visual Lite em 390px sem alvo pequeno.
- **Movimento**: Lista com filtros (fila). Próximo lead destacado com LiteHighlight; abrir lead troca o painel lateral com LiteSwap; contador com LiteNumber; lead novo do tempo real entra no topo com LiteListPresence.
- **Riscos e pontos de atenção**: RISCO: sem gate de papel (minha-fila/page.tsx:38). Diretor entra na fila pessoal do corretor.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/minha-fila/page.tsx:38 (722 l.) | Reusar Lite existente + reskin por tokens | Re-skin ou reusar LightLeadsList; confirmar se o diretor usa essa rota | broker-workspace/components/light-leads-list.tsx (ramo LIGHT, l.446) | M | sombra 1 (l.584); uppercase 1 (l.592); alvo<44px 7 (l.589,610,631,641,659,...) |
| app/(dashboard)/minha-fila/loading.tsx:3 (24 l.) | Reusar Lite existente | Reusar Lite existente | LightPageSkeleton variant list | P | alvo<44px 4 (l.8,11,12,13) |
| app/(dashboard)/minha-fila/_components/queue-client.tsx:38 (219 l.) | Reusar Lite existente | Reusar PeopleRow | light-leads-list.tsx / PeopleRow | M | alvo<44px 2 (l.94,193) |
| app/(dashboard)/minha-fila/_components/broker-availability.tsx:20 (69 l.) | Reusar Lite existente | Reusar Lite existente | light-availability-section.tsx | P | cor crua 3 (l.15,16,17); alvo<44px 1 (l.59) |
| app/(dashboard)/minha-fila/_components/sparkline.tsx:13 (64 l.) | trocar por Arc | Trocar por componente Arc | Arc sparkline | P | nenhum detectado |
| components/status-badges.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |

### `/assistente`

- **Acesso hoje**: Diretor vê AssistantChatClient normal.
- **Complexidade da rota**: G (2 componentes no inventário)
- **Desvios do Lite (inventário)**: gradiente em 1, sombra em 1, cor crua em 1, caixa alta em 1, dark em 1, alvo menor que 44px em 1. Cinzel (pasta): 130
- **Primitivas F3**: tooltip
- **Critério de pronto**: Usa components/chat (já Lite); assistente-chat-client sem 43 cores e sem gradiente; mesmo visual do chat Lite.
- **Movimento**: Conversa. Resposta do assistente entra de baixo (y 8px, fade); indicador de digitação curto, sem loop infinito; trocar de conversa com LiteSwap.
- **Riscos e pontos de atenção**: assistente-chat-client é o maior foco de cor crua da Onda 3.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/assistente/page.tsx:11 (31 l.) | trocar por Arc + reskin por tokens | Envolver em .arc-venancor | - | P | nenhum detectado |
| app/(dashboard)/assistente/_components/assistente-chat-client.tsx:147 (826 l.) | Reusar Lite existente + reskin por tokens | Reusar o chat Lite (AssistantChat) mantendo o backend MCP; ou re-skin: 43 cores cruas (ex.: l.403-517), 5 sombras, 4 uppercase | components/chat/assistant-chat.tsx, chat-screen.tsx, composer.tsx, assistant-avatar.tsx | G | gradiente 1 (l.466); sombra 5 (l.525,578,579,631,686); cor crua 43 (l.279,280,403,409,410,...); uppercase 4 (l.633,659,732,773); dark: 1 (l.409); alv… |

### `/relatorios`

- **Acesso hoje**: Redirect para /dashboard para o diretor.
- **Complexidade da rota**: P (2 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 91
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer para o diretor.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/relatorios/page.tsx:12 (36 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | - | P | nenhum detectado |
| app/(dashboard)/relatorios/loading.tsx:3 (6 l.) | Sem ação própria (herda ou nenhuma) | Herda do comum | LightPageSkeleton | P | nenhum detectado |

## 2.4 Onda 4: equipe e unidades

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/equipe` | Diretor vê a tela normal de equipe com tabela, abas Equipe e Unidades e 4 KPIs. | G | 13 | 32 | gráficos com tokens, drawer lateral, tabela Lite, select/combobox, checkbox, barra de lote, chips de filtro, paginação, dropdown, dialog, dialog de confirmação |
| `/equipe?visao=unidades` | Visão Unidades (BranchesManager) dentro de /equipe. | M | 5 | 32 | tabela Lite, drawer lateral |
| `/equipe/[id]` | Diretor vê perfil normal; Lite só para gestor e supervisor. | M | 15 | 27 | tabela Lite, drawer lateral, popover, intervalo de datas, dialog de confirmação |
| `/equipe/cargos` | Só diretor; tela normal de cargos e permissões. | G | 8 | 38 | drawer lateral, select/combobox, chips de filtro, checkbox, dialog |
| `/equipe/convidar` | Convite pelo fluxo normal. | M | 2 | 1 | drawer lateral |
| `/equipe/recuperacoes` | Só diretor; pedidos de recuperação de senha. | M | 7 | 10 | gráficos com tokens, tabela Lite, dialog, drawer lateral |
| `/gestao` | Diretor negado; Lite só para gestor e supervisor. | M | 6 | 0 | drawer lateral, select/combobox |
| `/gestao/equipes/[supervisorId]` | Diretor negado; Lite só para gestor e supervisor. | P | 4 | 0 | drawer lateral, select/combobox |
| `/unidades/[branchId]` | Diretor vê perfil de unidade normal; loading Lite serve a todos. | M | 10 | 8 | select/combobox, intervalo de datas, dialog, drawer lateral, tabela Lite |
| `/filiais` | Diretor vê BranchesManager (lista de unidades). | - | 0 | 0 | nenhuma |
| `/equipe/dashboard` | Diretor vê dashboard normal da equipe. | P | 1 | 0 | nenhuma |
| `/equipe/desempenho` | Placar da equipe; hoje sem visão de diretor. | P | 3 | 0 | nenhuma |
| `/equipe/minha` | Supervisor Lite; diretor fora do escopo. | P | 5 | 7 | drawer lateral |
| `/equipe/minha/configurar` | Supervisor; configuração da equipe. | P | 1 | 2 | nenhuma |
| `/equipe/plantao` | Plantão da equipe, visão normal. | P | 1 | 0 | nenhuma |
| `/equipe/repassar` | Supervisor com escopo de equipe; qualquer audiência entra. | P | 1 | 0 | chips de filtro |
| `/equipe/transferencia` | Pedido de corretor de outra equipe. | P | 1 | 0 | chips de filtro |

### `/equipe`

- **Acesso hoje**: Diretor vê a tela normal de equipe com tabela, abas Equipe e Unidades e 4 KPIs.
- **Complexidade da rota**: G (13 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 5, caixa alta em 3, cor crua em 3, sombra em 1. Cinzel (pasta): 32
- **Primitivas F3**: gráficos com tokens, drawer lateral, tabela Lite, select/combobox, checkbox, barra de lote, chips de filtro, paginação, dropdown, dialog, dialog de confirmação
- **Critério de pronto**: Lista de membros vira PeopleRow, barra de lote e menu de três pontos em BottomSheet; convite em TeamInviteLiteSheet; filtro de unidade em select; abas em segmentado; 390px sem scroll horizontal.
- **Movimento**: Lista com filtros. Linhas em cascata (até 8); abas Equipe e Unidades com LiteHighlight; barra de lote sobe de baixo; menu de linha abre em BottomSheet no celular.
- **Riscos e pontos de atenção**: team-invite-form.tsx é código morto.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| Header + botões "Cargos e permissões" e "Novo funcionário" page.tsx:253-257 | Reusar Lite existente | REUSAR layout do header Lite | manager-lite-team.tsx:65-73 (header Lite com ações) | P | Button outline h-9 (<44); Title Case "Novo Funcionário" |
| TeamManagementTabs page.tsx:259; team-management-tabs.tsx:10 | trocar por Arc | ARC | segmented-control | P | ver §1 |
| 4 StatCards com sparkline page.tsx:272-275 | Criar Lite novo | ARC/NOVO LiteStatTile | blocos styles.overview em manager-lite-team.tsx:76-83 | P | ver StatCard; --chart-1..4 |
| TransferRequestsPanel features/supervisor-workspace/transfer-requests-panel.tsx:10-58 (usado em page.tsx:277) | Reusar Lite existente | REUSAR bloco do ManagerLiteTeam | **mesma função já existe em Lite**: manager-lite-team.tsx:89-108 (PeopleSection + PeopleR… | P | Button sm 30px (l47-48); borda bg-card l32 |
| TeamMembersTable (d)/equipe/team-members-table.tsx:60-452 | Reusar Lite existente | REUSAR ManagerLiteTeam estendido: filtro de unidade (segmented/LiteSelectSheet), papel no chip, LiteBulkBar | ManagerLiteTeam (lista por PeopleRow, busca, convites) cobre consulta; **não cobre** filt… | G | Button sm (l304,316,333,349,424,430); cor crua emerald l306; UserAvatar size-8; textos font-mono text-xs; Checkbox |
| TeamMemberActions (menu "⋯") (d)/equipe/member-actions.tsx:403-623; DropdownMenu l524-588 | Reusar Lite existente | REUSAR padrão sheetRow | menu Lite ••• + BottomSheet (manager-lite-team.tsx:149-158) | M | itens 32px; Button icon |
| EditMemberDialog member-actions.tsx:80-315 (Dialog l140) | Criar Lite novo | NOVO MemberEditSheet Lite (BottomSheet detents 0.9) reaproveitando os dois | parcial: manager-lite-profile-actions.tsx:38-46 (só contato); seleção de corretores em te… | G | Field/Select/Input shadcn (Select x5), alvos 32-36px, hover:bg-muted/60 |
| DeleteMemberDialog member-actions.tsx:317-401 (Dialog l346) | trocar por Arc | ARC BottomSheet + sheetDanger | my-team-page.module.css:54 (.sheetDanger) | P | bg-muted/30 l354; botões shadcn |
| ResetPasswordDialog member-actions.tsx:625-779 (Dialog l705) | Reusar Lite existente + trocar por Arc | REUSAR ação Lite + Arc Textarea | manager-lite-profile-actions.tsx:26-30,47 (gera link, sem textarea) | M | text-emerald-400 l763; textarea rounded-md l756; font-mono text-xs |
| TransferLeadsDialog member-actions.tsx:781-862 (Dialog l816) | Criar Lite novo | NOVO sheet Lite | nenhum Lite (gestor Lite não transfere carteira) | M | Title Case "Transferir Leads em Lote" l818; Select |
| TeamInviteSection (d)/equipe/team-invite-section.tsx:30-273 | Reusar Lite existente | REUSAR TeamInviteLiteSheet com audience "director" (papéis diretor/gestor/supervisor/corretor, escolha de unidade, cargo personalizado) + aba CSV em segmented-… | features/team/team-invite-lite-sheet.tsx:49-110 (convite Lite, papel corretor/supervisor,… | G | shadow-sm l157,165; emerald/amber crus l98, l118; Title Case l90,94,118,152,162,170; Select x4 |
| TeamInviteForm (d)/equipe/team-invite-form.tsx:9-108 | Código morto ou órfão: não converter | **código morto** (nenhum import); não converter, só arquivar | n/a | P | shadcn |
| Bloco legado comentado page.tsx:260-270 | Ação livre (ver detalhe) | remover junto | n/a | P | n/a |

### `/equipe?visao=unidades`

- **Acesso hoje**: Visão Unidades (BranchesManager) dentro de /equipe.
- **Complexidade da rota**: M (5 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 2. Cinzel (pasta): 32
- **Primitivas F3**: tabela Lite, drawer lateral
- **Critério de pronto**: Cards por unidade (LiteUnitsList) com 3 toggles e atalho Ver unidade; sem DataTable crua.
- **Movimento**: Lista com filtros (cards). Cards de unidade em cascata; ligar ou desligar um toggle mostra LiteSuccess curto; detalhe da unidade abre em sheet.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| UnitsView (d)/equipe/units-view.tsx:10-58 | reskin por tokens | RE-SKIN wrapper | nenhum | P | DashboardHeader |
| BranchesManager features/branches/components/branches-manager.tsx:156-253 | Criar Lite novo | NOVO LiteUnitsList (cards por unidade com 3 toggles e atalho "Ver unidade") | manager-lite-unit-profile.tsx (só uma unidade, leitura) | M | Button size="sm"/icon-sm (l94,123,144,183,227) |
| CreateBranchSheet / CreateBranchForm branches-manager.tsx:60-116 (Sheet l93-98) | trocar por Arc | ARC | components/arc/input + BottomSheet | P | Label/Input shadcn |
| EditBranchSheet branches-manager.tsx:~118-150 (gatilho l123, l144) | trocar por Arc | ARC | idem | P | icon-sm 30px |
| BranchAcceptingToggle / AutoDistribute / Hub / Legend features/branches/components/branch-distribution-controls.tsx:56,71-93 | trocar por Arc | ARC | components/arc/switch | P | shadcn Switch |

### `/equipe/[id]`

- **Acesso hoje**: Diretor vê perfil normal; Lite só para gestor e supervisor.
- **Complexidade da rota**: M (15 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 6, cor crua em 2, caixa alta em 1, gradiente em 1, sombra em 1. Cinzel (pasta): 27
- **Primitivas F3**: tabela Lite, drawer lateral, popover, intervalo de datas, dialog de confirmação
- **Critério de pronto**: SupervisorBrokerProfile para o diretor, com seção Todos os leads, Redistribuições e ranking com withoutStep; alvos 44px.
- **Movimento**: Detalhe. Faixa de métricas com LiteNumber; seções em cascata; calendário de plantão troca de mês com LiteSwap; ações em sheet.
- **Riscos e pontos de atenção**: Diretor não corretor (gestor, supervisor, diretor) cai em not-found no Lite: decidir o que mostrar.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| Header do perfil (Card transparente, avatar, badges, dados) page.tsx:220-234 | Reusar Lite existente | REUSAR | supervisor-broker-profile.tsx:232-255 (header Lite com WhatsApp) | P | Button sm; capitalize em enum cru |
| Metric (6 KPIs em faixa) page.tsx:59-66, 236-243 | Reusar Lite existente | REUSAR | supervisor-broker-profile.tsx métricas (props metrics) | P | font-mono; tons text-success/warning |
| MemberTemperaturePanel (d)/equipe/[id]/_components/member-temperature.tsx:13-37 | Reusar Lite existente | REUSAR | seção "Temperatura" em supervisor-broker-profile.tsx:396 | P | borda --radius-card-lg; cores via TEMPERATURE_UI |
| MemberOffersPanel member-temperature.tsx:39-62 | Reusar Lite existente | REUSAR | seção leadOffers supervisor-broker-profile.tsx:256-265 | P | idem |
| MemberLeadsTabs (d)/equipe/[id]/_components/member-leads-tabs.tsx:43-142 | Criar Lite novo | NOVO seção "Todos os leads" Lite (segmented + lista de linhas leadInitials) | supervisor-broker-profile.tsx:367-395 (só 5 a 8 leads ativos) | M | Table densa, sem alvo de 44 |
| SupervisorNoteHistory (Feedbacks em Card) page.tsx:255-265; features/supervisor-workspace/broker-profile/supervisor-broker-profile.tsx (exp… | Reusar Lite existente | REUSAR | seção Feedbacks supervisor-broker-profile.tsx:317-347 | P | Card shadcn em volta |
| MemberRankingPanel (d)/equipe/[id]/_components/member-ranking.tsx:4-34 | Reusar Lite existente | REUSAR (acrescentar withoutStep) | prop ranking do perfil Lite | P | sem desvio relevante |
| MemberDutyCalendar (d)/equipe/[id]/_components/member-duty-calendar.tsx:47-165 | trocar por Arc | ARC Calendar + BottomSheet do dia | seção "Dias de plantão" supervisor-broker-profile.tsx:398 (lista) ou components/arc/calen… | M | Button icon-sm 30px (l79-80); Popover |
| Resultado comercial (Card) page.tsx:268-276 | Reusar Lite existente | REUSAR | seção supervisor-broker-profile.tsx:397 | P | font-mono |
| Redistribuições (Card) page.tsx:277-280 | Criar Lite novo | NOVO seção Lite no perfil | nenhum | P | rounded-lg border, text-[11px] |
| Nota de escopo do gestor page.tsx:283 | Nada a fazer (redirect ou fora do diretor) | manter | n/a | P | n/a |
| SupervisorBrokerProfile (já Lite) features/supervisor-workspace/broker-profile/supervisor-broker-profile.tsx:1-554 + .module.css | Reusar Lite existente | REUSAR para o diretor; corrigir alvos | é o alvo | M | Button shadcn l8, l322 (pillButton 32px, module l152); windowButton 32px (module l95); color-mix ok |
| RecognizeSheet features/journey/components/recognize-sheet.tsx:1-83 + recognize-sheet.module.css | reskin por tokens | RE-SKIN (tirar gradiente dourado) | é Lite | P | gradiente l8,15,21; sombra crua l8; oklch cru l14,18; sugestão 32px l12 |
| GoalsSection / GoalSheet (meta do mês) features/team-management-extras/goals-section.tsx:78-99; goal-sheet.tsx:1-85 | trocar por Arc | ARC Button | é Lite | P | Button sm (goals-section l93) |
| LiteBrokerProfileActions features/manager-workspace/manager-lite-profile-actions.tsx:8-49 | trocar por Arc | ARC + sheets de confirmação; base para ações do diretor (soma papel/unidade/excluir) | é Lite | M | Button/Input shadcn; window.confirm l17,27; rounded-2xl border bg-card l32 |

### `/equipe/cargos`

- **Acesso hoje**: Só diretor; tela normal de cargos e permissões.
- **Complexidade da rota**: G (8 componentes no inventário)
- **Desvios do Lite (inventário)**: caixa alta em 3, alvo menor que 44px em 3, sombra em 2. Cinzel (pasta): 38
- **Primitivas F3**: drawer lateral, select/combobox, chips de filtro, checkbox, dialog
- **Critério de pronto**: Matriz de permissões em tabela Lite com checkbox Arc; sem uppercase; mesma regra de permissão, só visual.
- **Movimento**: Editor e grade. Sem cascata na matriz (acima de 8 células); células mudam de cor em 120ms; barra de alterações sobe de baixo ao editar e desce ao salvar com LiteSuccess.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| CustomRolesWorkspace (d)/equipe/cargos/workspace.tsx:582-758 | Criar Lite novo | NOVO tela Lite (lista de cargos em cards + filtro segmented) | nenhum | M | GESTÃO DE EQUIPE uppercase l624; hover:shadow-md l707; overlay shadow-sm l738; Select |
| PermissionToggle workspace.tsx:60-95 | trocar por Arc | ARC | components/arc/switch | P | h-5 w-9 l77 (<44); ring-offset l79; shadow-sm l86 |
| StatusBadge workspace.tsx:97-105 | trocar por Arc | ARC | Arc Badge | P | n/a |
| PermissionRow / PermissionsTab workspace.tsx:107-208 | reskin por tokens | RE-SKIN (sentence case, linhas 44px) | nenhum | M | text-[10px] font-bold uppercase tracking-wider l185, l225 |
| RouteVisibilityTab workspace.tsx:210-246 | Criar Lite novo | NOVO | LiteCheckRow | P | alvos pequenos |
| IdentidadeTab workspace.tsx:248-333 | trocar por Arc | ARC | Arc Input + segmented | P | Select |
| MembersTab workspace.tsx:335-368 | Reusar Lite existente | REUSAR | people-list | P | n/a |
| RoleEditorDialog workspace.tsx:370-580 (Dialog l465, Tabs l480-535) | trocar por Arc | ARC | BottomSheet + segmented-control | G | Title Case "Novo Cargo Personalizado" l469; DialogClose icon-sm l476; Button sm l556 |

### `/equipe/convidar`

- **Acesso hoje**: Convite pelo fluxo normal.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: caixa alta em 1. Cinzel (pasta): 1
- **Primitivas F3**: drawer lateral
- **Critério de pronto**: TeamInviteLiteSheet; campos em arc/input; sem sombra nem Title Case.
- **Movimento**: Wizard. Passos trocam com LiteSwap na direção do passo (x 12px); indicador com LiteHighlight; conclusão com LiteSuccess grande.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| Card wrapper convidar/page.tsx:32-48 | reskin por tokens | RE-SKIN | página Lite lite-page + título lite-page-title | P | Card shadcn; Title Case |
| TeamInviteSection ver 2.1 | Reusar Lite existente | REUSAR (aqui como página, sem sheet) | TeamInviteLiteSheet | M | - |

### `/equipe/recuperacoes`

- **Acesso hoje**: Só diretor; pedidos de recuperação de senha.
- **Complexidade da rota**: M (7 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 2, caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 10
- **Primitivas F3**: gráficos com tokens, tabela Lite, dialog, drawer lateral
- **Critério de pronto**: Lista Lite; eyebrow SEGURANÇA sem caixa alta; título em lite-page-title; ações 44px.
- **Movimento**: Lista com filtros. Pedido resolvido sai com LiteListPresence; contagem com LiteNumber; ação mostra carregando no próprio botão.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| Cabeçalho de seção page.tsx:53-60 | reskin por tokens | RE-SKIN | lite-page-title | P | SEGURANÇA caixa alta l54; título "Recuperação de Senha" Title Case l50 |
| 3 StatCards page.tsx:63-91 | trocar por Arc | ARC | MetricCard | P | text-amber-500 l67, text-emerald-500 l76, text-red-500 l86 |
| Card "Solicitações recebidas" page.tsx:94-106 | reskin por tokens | RE-SKIN | card Lite | P | Card shadcn |
| RecoveryRequestsTable (d)/equipe/recuperacoes/recovery-requests-table.tsx:48-293 | Criar Lite novo | NOVO lista Lite (PeopleRow com ações) | nenhum (o pedido de senha no Lite é por manager-lite-profile-actions) | M | Button sm + h-8 (l157,160,172,174); text-red-600 l174 |
| Dialog Rejeitar recovery-requests-table.tsx:208-262 | trocar por Arc | ARC | BottomSheet + Arc Textarea | P | shadcn |
| Dialog Detalhes da rejeição recovery-requests-table.tsx:265-290 | trocar por Arc | ARC | BottomSheet | P | shadcn |
| Estado vazio page.tsx:98-100 (texto na descrição) | Criar Lite novo | NOVO | Arc EmptyState com mascote | P | n/a |

### `/gestao`

- **Acesso hoje**: Diretor negado; Lite só para gestor e supervisor.
- **Complexidade da rota**: M (6 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 3, sombra em 2, gradiente em 1. Cinzel (pasta): 0
- **Primitivas F3**: drawer lateral, select/combobox
- **Critério de pronto**: Liberar diretor com seletor de unidade; UnitOverviewView Lite; loading e error próprios em Lite.
- **Movimento**: Painel. KPIs em cascata com LiteNumber; seletor de unidade troca os números com transição de valor, sem skeleton se a troca for rápida.
- **Riscos e pontos de atenção**: Escopo: liberar diretor só com tenantId e seletor de unidade, sem vazar outra unidade.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| UnitOverviewView features/team-management-ui/unit-overview.tsx:1-155 + unit-overview.module.css | Ação livre (ver detalhe) | para o diretor: acrescentar seletor de unidade (segmented/LiteSelectSheet) e liberar resolveGestaoAccess | é Lite | M | --shadow-resting ok; nenhum desvio relevante |
| TeamPageViewComponent (supervisor) features/team-management-ui/team-page-view.tsx:1-144 + .module.css | trocar por Arc | ARC Button | é Lite | P | Button shadcn sm l43; Badge sm ok |
| WeeklySummaryCard features/team-management-ui/weekly-summary-card.tsx:1-82 | trocar por Arc | ARC + LiteSelectSheet | é Lite com primitivas erradas | P | Card shadcn l31; Select shadcn l65; Button shadcn |
| TeamExtrasSection / InsightsSection / GoalsSection / GoalSheet features/team-management-extras/team-extras-section.tsx:1-25; insights-secti… | trocar por Arc | ARC Button | é Lite | P | Button shadcn sm (goals l37,42,59) |
| RecognizeSheet ver 2.2 | reskin por tokens | RE-SKIN | - | P | gradientes |
| Loading/erro herdados de (d)/loading.tsx e (d)/error.tsx | Criar Lite novo | NOVO gestao/loading.tsx e error.tsx Lite | light-page-skeleton.tsx | P | Card shadcn, sombras |

### `/gestao/equipes/[supervisorId]`

- **Acesso hoje**: Diretor negado; Lite só para gestor e supervisor.
- **Complexidade da rota**: P (4 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 2, gradiente em 1. Cinzel (pasta): 0
- **Primitivas F3**: drawer lateral, select/combobox
- **Critério de pronto**: Liberar diretor com escopo de tenant; perfil da equipe Lite; loading e error próprios.
- **Movimento**: Detalhe. Cabeçalho e seções em cascata; comparação de supervisores com LiteDrawLine; ações em sheet.
- **Riscos e pontos de atenção**: Escopo: checar supervisorId de outra unidade no servidor.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| TeamPageViewComponent ver 2.13 | trocar por Arc | ARC | - | P | Button sm |
| TeamExtrasSection (+Insights, Goals, GoalSheet) ver 2.13 | trocar por Arc | ARC | - | P | Button sm |
| WeeklySummaryCard + RecognizeSheet ver 2.13 | trocar por Arc + reskin por tokens | ARC + RE-SKIN | - | P | Card/Select shadcn, gradientes |
| Loading/erro herdados | Criar Lite novo | NOVO Lite (o mesmo de 2.13) | - | P | normal |

### `/unidades/[branchId]`

- **Acesso hoje**: Diretor vê perfil de unidade normal; loading Lite serve a todos.
- **Complexidade da rota**: M (10 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 5, cor crua em 2, caixa alta em 1. Cinzel (pasta): 8
- **Primitivas F3**: select/combobox, intervalo de datas, dialog, drawer lateral, tabela Lite
- **Critério de pronto**: Perfil da unidade em Lite para o diretor; loading e error próprios.
- **Movimento**: Detalhe. Abas com LiteHighlight; cards de números em cascata; ações em sheet.
- **Riscos e pontos de atenção**: unidades/[id]/loading.tsx é Lite para todos (inconsistente).

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| Header + PeriodSelect page.tsx:79; components/period-select.tsx | trocar por Arc | ARC | segmented-control | P | shadcn Select |
| UnitProfileHeader features/branches/components/unit-profile-header.tsx:1-93 | Reusar Lite existente | REUSAR + ações do diretor | header de manager-lite-unit-profile.tsx:36-60 | P | caixa alta "UNIDADE" l49; Button sm l34, l84; Badge h-3 w-3 |
| UnitReportsExporter features/branches/components/unit-reports-exporter.tsx:1-209 | Criar Lite novo | NOVO BottomSheet Lite | nenhum | M | Button sm l107; Dialog/Select |
| UnitMetricsCards features/branches/components/unit-metrics-cards.tsx:1-81 | Reusar Lite existente | REUSAR | KPIs de manager-lite-unit-profile.tsx | P | text-emerald-500 l41, text-amber-500 l43, l70 |
| Card "Membros da unidade" + UnitMembersTable page.tsx:101-113; features/branches/components/unit-members-table.tsx:1-148 | Reusar Lite existente | REUSAR lista + ação pausar em sheet | lista de membros de manager-lite-unit-profile.tsx (sem ação) | M | Button sm + h-7 (l58, l66); ícone h-8 w-8 vazio l80 |
| Card "Ranking de conversão" + UnitTopBrokers page.tsx:118-130; features/branches/components/unit-top-brokers.tsx:1-86 | Reusar Lite existente | REUSAR | "destaques" de manager-lite-unit-profile.tsx | P | círculo h-5 w-5 text-[10px] font-bold l63; text-emerald-500 l74; Button sm l50 |
| Card de leitura do corretor page.tsx:135-142 | reskin por tokens | RE-SKIN | n/a (corretor nem chega aqui no Lite) | P | Card shadcn |
| ManagerLiteUnitProfile (já Lite) features/branches/components/manager-lite-unit-profile.tsx:1-120 (usa my-team-page.module.css) | trocar por Arc | ARC Button; estender para diretor | é o alvo | M | Button shadcn ghost sm l39 |
| loading.tsx unidades/[branchId]/loading.tsx:7-17 | Nada a fazer (redirect ou fora do diretor) | manter/ARC | Arc skeleton | P | Skeleton shadcn |
| error.tsx não existe | Criar Lite novo | NOVO Lite | - | P | - |

### `/filiais`

- **Acesso hoje**: Diretor vê BranchesManager (lista de unidades).
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: LiteUnitsList com cards por unidade e 3 toggles (aceita, auto-distribuir, hub); sheets Arc para criar e editar.
- **Movimento**: Lista com filtros (cards). Toggle de aceitação ou de auto-distribuição com LiteSuccess curto; criar e editar em sheet Arc.

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/equipe/dashboard`

- **Acesso hoje**: Diretor vê dashboard normal da equipe.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Visão geral da equipe em Lite (KPIs em MetricCard, lista de membros em PeopleRow).
- **Movimento**: Painel. Números com LiteNumber; gráficos de equipe com LiteReveal; lista de membros em cascata (até 8).

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| DomainDashboard features/dashboard/components/domain-dashboard.tsx:5 | trocar por Arc | ARC (compartilhado com 2.17) | Arc MetricCard; padrão de 4 blocos do Início do gestor | P | Card shadcn shadow-none; link text-xs sem alvo |

### `/equipe/desempenho`

- **Acesso hoje**: Placar da equipe; hoje sem visão de diretor.
- **Complexidade da rota**: P (3 componentes no inventário)
- **Desvios do Lite (inventário)**: gradiente em 2, cor crua em 2, sombra em 1, caixa alta em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Decidir escopo primeiro (placar entre equipes da unidade escolhida); visual Lite depois.
- **Movimento**: Painel. Placar em cascata; reordenar ranking com layout (spring.smooth); sem animação de número que mude de posição sem motivo.
- **Riscos e pontos de atenção**: Dependência de escopo, não de visual.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| TeamStandings features/journey/components/team-standings.tsx:1-129 + team-standings.module.css | reskin por tokens | RE-SKIN module | é Lite | P | gradiente l30-31 do module; oklch cru l34 |
| Podium features/journey/components/podium.tsx:1-47 + journey.module.css | reskin por tokens | RE-SKIN | é Lite | P | cores cruas l12; gradientes e sombras no module (l23-25, 51, 70-71, 77, 83, 107); uppercase l118 |
| Estado vazio team-standings.tsx:59, 95 | Nada a fazer (redirect ou fora do diretor) | manter | - | P | ok |

### `/equipe/minha`

- **Acesso hoje**: Supervisor Lite; diretor fora do escopo.
- **Complexidade da rota**: P (5 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 4, cor crua em 1. Cinzel (pasta): 7
- **Primitivas F3**: drawer lateral
- **Critério de pronto**: Manter para supervisor; diretor só se a decisão de escopo liberar.
- **Movimento**: Lista com filtros. Linhas em cascata; ação rápida mostra LiteSuccess na linha.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| MyTeamPage features/supervisor-workspace/my-team-page.tsx:1-160 + my-team-page.module.css | trocar por Arc + reskin por tokens | ARC Button; RE-SKIN hsl | é Lite | P | Button shadcn sm (l81, l125); module: hsl por equipe l36; color-mix ok |
| TeamInviteLiteSheet features/team/team-invite-lite-sheet.tsx:49-110 | trocar por Arc | ARC | é Lite | P | Button/Input shadcn (l52-107) |
| TeamOnDutyList features/supervisor-workspace/team-on-duty-list.tsx:1-42 | trocar por Arc | ARC | é Lite | P | Button sm l36 |
| PeopleList components/light/people-list/people-list.tsx + .module.css | reskin por tokens | RE-SKIN alvo | é a base | P | segmento 36px (module l26) |
| Skeleton (loading) equipe/minha/loading.tsx:7 | trocar por Arc | ARC | components/arc/skeleton | P | h-8 (ok visual) |

### `/equipe/minha/configurar`

- **Acesso hoje**: Supervisor; configuração da equipe.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: gradiente em 1, cor crua em 1, alvo menor que 44px em 1. Cinzel (pasta): 2
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Re-skin Lite; Button e Input Arc; sem sombra.
- **Movimento**: Formulário longo e configuração. Seções com LiteReveal; campo inválido rola até ele; barra de alterações não salvas sobe de baixo; salvo mostra LiteSuccess.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| SupervisorTeamSettings features/supervisor-workspace/team-settings.tsx:1-153 + team-settings.module.css | trocar por Arc + reskin por tokens | RE-SKIN + ARC Button | é Lite | P | gradiente hsl no preview (module l8) e na barra sticky (l46); hsl cru l14; badge 26px l26; Button sm shadcn l121-122 |

### `/equipe/plantao`

- **Acesso hoje**: Plantão da equipe, visão normal.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Reusa LightDutyCalendar; sem cor crua; alvos 44px.
- **Movimento**: Lista com filtros (calendário). Dia com plantão destacado com LiteHighlight; drawer do dia abre da direita.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| TeamOnDutyList ver 2.7 | trocar por Arc | ARC | - | P | Button sm |

### `/equipe/repassar`

- **Acesso hoje**: Supervisor com escopo de equipe; qualquer audiência entra.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: chips de filtro
- **Critério de pronto**: Visual Lite dentro do chrome Lite (hoje mostra formulário Lite no chrome normal); gate de escopo de equipe confirmado.
- **Movimento**: Formulário longo e configuração. Campo inválido rola até ele com foco; envio mostra LiteSuccess no botão.
- **Riscos e pontos de atenção**: RISCO: não checa papel Lite (equipe/repassar/page.tsx:16-42). Vazio e erro caem em notFound().

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| HandoffForm features/supervisor-workspace/handoff-form.tsx:1-69 + handoff-form.module.css | trocar por Arc | ARC Button | - | P | Button shadcn l7, l62; oklch fallback l15 do module |

### `/equipe/transferencia`

- **Acesso hoje**: Pedido de corretor de outra equipe.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: chips de filtro
- **Critério de pronto**: Reusa TransferRequestForm Lite; sheet Arc; alvos 44px.
- **Movimento**: Formulário longo e configuração. Pedido enviado mostra LiteSuccess; status troca com LiteSwap.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| TransferRequestForm features/supervisor-workspace/transfer-request-form.tsx:1-50 | trocar por Arc | ARC Button | - | P | Button shadcn l5, l45; min-h-5 status l46 (não é alvo) |

## 2.5 Onda 5: distribuição e plantões

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/distribuicao` | Re-exporta /leads/distribuicao; gestor entra sem o layout que bloqueia. | G | 38 | 0 | drawer lateral, tabela Lite, select/combobox, dialog, casca de wizard, checkbox, barra de lote, chips de filtro, dialog de confirmação, dropdown, tooltip, intervalo de datas |
| `/distribuicao/dashboard` | Dashboard de distribuição, diretor vê normal. | - | 0 | 0 | nenhuma |
| `/leads/distribuicao` | Layout bloqueia gestor (manager redirect); diretor vê a central. | G | 28 | 161 | chips de filtro, dialog, tabela Lite, checkbox, kanban, dropdown, tooltip, select/combobox, intervalo de datas, drawer lateral, gráficos com tokens, casca de wizard |
| `/leads/distribuicao/plantao/[scheduleId]` | Diretor vê o editor de escala (29 componentes). | G | 29 | 29 | tabela Lite, popover, drawer lateral, timeline, gráficos com tokens, dialog |
| `/plantoes` | Calendário de plantões do corretor, visão normal para o diretor. | P | 1 | 0 | drawer lateral, intervalo de datas |
| `/plantoes/agora` | Meu plantão agora. | M | 3 | 0 | nenhuma |
| `/plantoes/corretor/[brokerId]` | Já Lite dentro do chrome normal (gestor, supervisor). | P | 15 | 0 | nenhuma |

### `/distribuicao`

- **Acesso hoje**: Re-exporta /leads/distribuicao; gestor entra sem o layout que bloqueia.
- **Complexidade da rota**: G (38 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 15, cor crua em 5, dark em 4, sombra em 1. Cinzel (pasta): 0
- **Primitivas F3**: drawer lateral, tabela Lite, select/combobox, dialog, casca de wizard, checkbox, barra de lote, chips de filtro, dialog de confirmação, dropdown, tooltip, intervalo de datas
- **Critério de pronto**: Mesmo bloqueio de gestor em /distribuicao e /leads/distribuicao; UMA aba por vez; sem tabela crua em 390px.
- **Tamanho e abas**: página de 927 linhas (`leads/distribuicao/page.tsx`) mais os componentes filhos; abas a confirmar, pois não foram contadas neste catálogo.
- **Movimento**: Editor e grade. Mesmo que /leads/distribuicao (reexporta a página). Grade sem cascata grande; células mudam em 120ms; barra de alterações; troca de aba com LiteSwap e LiteHighlight; uma aba por entrega.
- **Riscos e pontos de atenção**: RISCO: /distribuicao/page.tsx re-exporta a página, mas o layout que bloqueia gestor fica só em /leads/distribuicao (layout.tsx:4-8). Gestor entra em /distribuicao.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| Header com contadores leads/distribuicao/page.tsx:611-628 | reskin por tokens | RE-SKIN | chrome Lite | P | bg-ds-vivid-green l617 (ds-) |
| DistributionStages page.tsx:59-82 | reskin por tokens | RE-SKIN | expandable-card | P | text-[10px] font-semibold l73 |
| DistributionTabsContainer leads/distribuicao/_components/distribution-tabs-container.tsx:14-117 | trocar por Arc | ARC | segmented-control (rolável) | M | gatilho min-h-10 (40px) l84; text-xs; backdrop-blur l72 |
| **Aba Resumo:** BrokerDailySummaryPanel leads/distribuicao/_components/broker-daily-summary-panel.tsx:45-493 | Criar Lite novo | NOVO lista Lite por corretor + KPIs | nenhum | G | Button/alvos sm (l256-295, 328, 476); text-[1xpx] |
| AvailabilityToggle components/availability-toggle.tsx:39,51,63 | reskin por tokens | RE-SKIN | Badge Arc | P | cores cruas + dark: |
| **Aba Entradas e regras:** DisqualifiedLeadsRoutingPanel leads/distribuicao/_components/disqualified-leads-routing-panel.tsx:1-91 | trocar por Arc | ARC | Arc Switch + card Lite | P | Card/Switch shadcn |
| DddRoutingPanel leads/distribuicao/_components/ddd-routing-panel.tsx:1-160 | trocar por Arc | ARC | - | M | Button sm l149; text-[10px] |
| RoutingMatrixPanel leads/distribuicao/_components/routing-matrix-panel.tsx:61-763 | Criar Lite novo | NOVO editor de regra em BottomSheet (passos com stepper) | nenhum | G | 13 alvos sm (l301-414...); text-emerald-500 l420; 14 usos text-[10/11px] |
| **Aba Operação:** DistributionMetrics leads/distribuicao/_components/distribution-dashboard.tsx:1-54 | trocar por Arc | ARC | MetricCard | P | StatCard |
| DistributionInbox leads/distribuicao/_components/distribution-inbox.tsx:344-1189 | Criar Lite novo | NOVO inbox Lite (lista + LiteBulkBar + sheet de atribuição) | manager-lead-transfer-form.tsx (atribuição Lite de um lead) | G | emerald/amber + dark: (l139, l612, l718); 9 alvos sm (l249, 601, 610, 638, 662, 839, 884, 927...) |
| ManualAssignmentChoiceDialog / ChoiceSubmitForm distribution-inbox.tsx:231-342 (Dialog l248-290) | trocar por Arc | ARC | radio-cards em BottomSheet | P | shadcn |
| Dialog "Escolha quais leads arquivar" distribution-inbox.tsx:~1015-1100 (título l1025) | trocar por Arc | ARC | BottomSheet + LiteCheckRow | M | shadcn |
| CampaignConflictDialog distribution-inbox.tsx:1103-1189 (título l1144) | trocar por Arc | ARC | BottomSheet | P | shadcn |
| **Aba Filas (diretor):** ColdLeadRequalificationPanel leads/distribuicao/_components/cold-lead-requalification-panel.tsx:17-129 | trocar por Arc | ARC | - | P | Button sm (l87, 98-102) |
| QueueControlCenter leads/distribuicao/_components/queue-control-center.tsx:108-1379 | Criar Lite novo | NOVO "Filas" Lite: lista de filas + sheet de detalhe + editor em passos | nenhum | G | 12 cores cruas emerald/amber + 4 dark: (l647-779, 1158-1186); 24 usos text-[10/11px]; 6 alvos sm (l489, 495, 614, 860, 1010, 1029) |
| QueuesTable leads/distribuicao/_components/queues/queues-table.tsx:33-151 | Criar Lite novo | NOVO (parte do item acima) | - | M | Button sm l119 |
| QueueDetailSheet / PanelSheet leads/distribuicao/_components/queues/queue-detail-sheet.tsx:46-181 | trocar por Arc | ARC | BottomSheet | M | Button sm l116, l138 |
| ColdAgeReleaseSection leads/distribuicao/_components/queues/cold-age-release-section.tsx:1-55 | trocar por Arc | ARC | Arc Switch/Input | P | Button sm l46 |
| MetaEntries leads/distribuicao/_components/queues/meta-entries.tsx:1-71 | reskin por tokens | RE-SKIN | - | P | text-[10/11px] |
| QueueColorTag features/lead-distribution/queue-color-tag.tsx:1-40 | reskin por tokens | RE-SKIN | Arc Badge com cor de dado | P | cor dinâmica por fila (dado) |
| BrokerAcceptanceSlaPanel (dentro de PanelSheet) leads/distribuicao/_components/broker-acceptance-sla-panel.tsx:1-156 | trocar por Arc | ARC | chip-group (presets) | P | Button sm l142; font-semibold ok |
| DistributionPolicyPanel (dentro de PanelSheet) (d)/settings/_components/distribution-policy-panel.tsx:1-124 | trocar por Arc | ARC | - | M | shadcn |
| **Aba Plantões:** DutyOperationsWorkspace leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1273-1603 | Criar Lite novo | NOVO workspace de escala Lite (base visual do light-duty-calendar) | features/broker-workspace/components/light-duty-calendar.tsx (calendário Lite do corretor… | G | 7 alvos sm (l349, 882, 1017, 1073, 1470, 1473, 1542); bg-muted/% x9; text-[10/11px] x6 |
| DutyFormSheet duty-operations-workspace.tsx:185-~720 (Sheet l323-326, AppSelect l338, Checkbox l397) | trocar por Arc | ARC | BottomSheet | G | Sheet lateral, checkbox, selects |
| DutyInspector duty-operations-workspace.tsx:722-~1270 (SheetTitle l869; Dialogs l1198-1260: escalar fora, arquivar, excluir) | trocar por Arc | ARC | BottomSheet + sheetDanger | G | toggle de turno bg-background l974 |
| StatusBadge (plantão) duty-operations-workspace.tsx:179-183 | trocar por Arc | ARC | Arc Badge | P | - |
| DutyMonthCalendar leads/distribuicao/plantao/_components/duty-month-calendar.tsx:23-161 | trocar por Arc | ARC | Arc Calendar (components/arc/calendar/calendar.tsx:105) | M | shadow-[inset...] + dark: l98; text-[1xpx] x5 |
| MonthlyDutyPlanner leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:127-~925 (Sheet l414-417, Stepper l116/l567, SearchAddLi… | Criar Lite novo | NOVO wizard Lite em BottomSheet de tela cheia | components/arc/stepper, components/arc/slider | G | 8 alvos sm (l120, 122, 434, 479, 544, 569, 573, 659) |
| EscalaPdfDialog monthly-duty-planner.tsx:926-977 (DialogTitle l951) | trocar por Arc | ARC | BottomSheet + radio-cards | P | shadcn |
| DutyTypeDialog / DutyTypesSheet leads/distribuicao/plantao/_components/duty-type-ui.tsx:40-191 (Dialog l99), 193-249 (Sheet l214) | trocar por Arc | ARC | BottomSheet | M | alvos sm l135, l231-232 |
| DutyTypeTag leads/distribuicao/plantao/_components/duty-type-tag.tsx:1-33 | trocar por Arc | ARC | Arc Badge | P | ok |
| SearchAddList components/ui/search-add-list.tsx:88 | reskin por tokens | RE-SKIN | search-field | P | alvo l88 |
| Link para /leads/distribuicao/plantao/[scheduleId] (rota fora do Grupo B) | Ação livre (ver detalhe) | registrar dependência com o grupo dono de /leads/* | - | n/a | broker-occurrence-card, broker-live-status etc. vivem lá |
| **Aba Saúde:** Histórico auditável page.tsx:768-816 | trocar por Arc + reskin por tokens | RE-SKIN para tokens Arc | thread-row/people-list | M | 17 usos de tokens ds-* (font-ds-inter, text-ds-charcoal, text-ds-fog, gap-ds-*) |
| Automação da fila page.tsx:819-865 | trocar por Arc | ARC | Arc Badge + MetricCard | P | ds-*, text-destructive ok |
| Efeitos pendentes + Reprocessar page.tsx:866-918 | trocar por Arc + reskin por tokens | RE-SKIN + Arc Button | - | P | rounded-ds-cards border-ds-ash bg-ds-paper-mist l893; botão !py-ds-4 (<44) l906 |
| Estado "Unidade não definida" page.tsx:108-122 | trocar por Arc | ARC | Arc EmptyState + mascote | P | ds-* |
| Loading/erro herdados | Criar Lite novo | NOVO Lite | - | P | - |

### `/distribuicao/dashboard`

- **Acesso hoje**: Dashboard de distribuição, diretor vê normal.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Gráficos com tokens; KPIs em MetricCard; alvos 44px.
- **Movimento**: Painel. Barras de fila crescem a partir da base; números com LiteNumber; troca de período com transição de valor.

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/leads/distribuicao`

- **Acesso hoje**: Layout bloqueia gestor (manager redirect); diretor vê a central.
- **Complexidade da rota**: G (28 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 15, cor crua em 4, dark em 4, sombra em 1. Cinzel (pasta): 161
- **Primitivas F3**: chips de filtro, dialog, tabela Lite, checkbox, kanban, dropdown, tooltip, select/combobox, intervalo de datas, drawer lateral, gráficos com tokens, casca de wizard
- **Critério de pronto**: queue-control-center, distribution-inbox e routing-matrix-panel em lista Lite; uma aba por vez; sem tabela crua; matriz de roteamento editável em lista.
- **Movimento**: Editor e grade. Matriz de roteamento: células mudam de cor em 120ms; troca de aba com LiteSwap; barra de alterações sobe ao editar; lead frio novo entra com LiteListPresence.
- **Riscos e pontos de atenção**: queue-control-center: 12 cores e 4 dark; routing-matrix-panel sem equivalente Lite.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/distribuicao/layout.tsx:4 (9 l.) | Sem ação própria (herda ou nenhuma) | Nenhuma | - | P | nenhum detectado |
| app/(dashboard)/leads/distribuicao/page.tsx:88 (927 l.) | trocar por Arc + reskin por tokens | Re-skin por tokens; abas via Arc tabs | - | G | alvo<44px 1 (l.73) |
| app/(dashboard)/leads/distribuicao/_components/distribution-dashboard.tsx:13 (54 l.) | reskin por tokens | Re-skin | arc/metric-card | P | nenhum detectado |
| app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx:344 (1189 l.) | Criar Lite novo | Criar Lite novo (lista + dialogs Arc); 11 alvos pequenos | PeopleRow para a lista | G | cor crua 3 (l.139,612,718); dark: 3 (l.139,612,718); alvo<44px 11 (l.249,601,610,638,662,...) |
| components/dashboard/metric-card.tsx:59 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:108 (1379 l.) | Criar Lite novo | Criar Lite novo; tirar 12 cores cruas e 4 dark: | - | G | cor crua 12 (l.647,669,670,671,678,...); dark: 4 (l.647,670,701,779); alvo<44px 5 (l.489,495,614,860,1029) |
| app/(dashboard)/leads/distribuicao/_components/distribution-tabs-container.tsx:14 (118 l.) | trocar por Arc | Trocar por componente Arc | arc/segmented-control ou Arc tabs | P | nenhum detectado |
| app/(dashboard)/settings/_components/distribution-policy-panel.tsx:23 (124 l.) | Reusar Lite existente + trocar por Arc + reskin por tokens | Re-skin com linhas de ajuste Lite + arc/switch | manager-workspace/manager-lite-settings-parts.tsx (linhas de ajuste) | P | nenhum detectado |
| app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:61 (763 l.) | Criar Lite novo | Criar Lite novo; 13 alvos pequenos | - | G | cor crua 1 (l.420); alvo<44px 13 (l.301,312,321,352,388,...) |
| app/(dashboard)/leads/distribuicao/_components/ddd-routing-panel.tsx:32 (160 l.) | trocar por Arc + reskin por tokens | Re-skin + Arc select/switch | manager-lite-settings-parts | M | alvo<44px 1 (l.149) |
| app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:45 (493 l.) | trocar por Arc + reskin por tokens | Re-skin + data-table Arc | arc/date-picker | G | alvo<44px 8 (l.256,264,272,280,290,...) |
| app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1273 (1603 l.) | Criar Lite novo | Criar Lite novo (sheets para Arc drawer), reusando calendário/lista Lite | broker-workspace/components/light-duty-calendar.tsx, duty-now-view.tsx, supervisor-worksp… | G | alvo<44px 7 (l.349,882,1017,1073,1470,...) |
| app/(dashboard)/leads/distribuicao/_components/broker-acceptance-sla-panel.tsx:25 (156 l.) | reskin por tokens | Re-skin por tokens | manager-lite-settings-parts | P | alvo<44px 1 (l.142) |
| app/(dashboard)/leads/distribuicao/_components/disqualified-leads-routing-panel.tsx:13 (91 l.) | reskin por tokens | Re-skin por tokens | manager-lite-settings-parts | P | nenhum detectado |
| app/(dashboard)/leads/distribuicao/_components/cold-lead-requalification-panel.tsx:17 (129 l.) | trocar por Arc + reskin por tokens | Re-skin + Arc dialog | - | P | alvo<44px 4 (l.98,99,101,102) |
| components/status-badges.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| components/dashboard/mini-donut.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/metric-sparkline.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/lead-distribution/queue-color-tag.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/distribuicao/_components/queues/meta-entries.tsx:18 (71 l.) | reskin por tokens | Re-skin | arc/badge | P | nenhum detectado |
| app/(dashboard)/leads/distribuicao/_components/queues/queue-detail-sheet.tsx:46 (181 l.) | trocar por Arc | Trocar por Arc drawer | - | M | alvo<44px 2 (l.116,138) |
| app/(dashboard)/leads/distribuicao/_components/queues/queues-table.tsx:33 (151 l.) | trocar por Arc | Trocar por data-table Arc + dropdown-menu | - | M | alvo<44px 1 (l.119) |
| components/availability-toggle.tsx:8 (72 l.) | Reusar Lite existente + reskin por tokens | Reusar Lite existente ou re-skin (3 cores cruas, 3 dark:) | broker-availability/components/light-availability-section.tsx, broker-workspace/component… | P | cor crua 3 (l.39,51,63); dark: 3 (l.39,51,63) |
| app/(dashboard)/leads/distribuicao/plantao/_components/duty-month-calendar.tsx:23 (161 l.) | Reusar Lite existente | Reusar calendário Lite como base | broker-workspace/components/light-duty-calendar.tsx | M | sombra 1 (l.98); dark: 1 (l.98); alvo<44px 1 (l.113) |
| app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:62 (977 l.) | Criar Lite novo | Criar Lite novo; Stepper local para arc/stepper | arc/stepper; light-duty-calendar | G | alvo<44px 8 (l.120,122,434,479,544,...) |
| app/(dashboard)/leads/distribuicao/plantao/_components/duty-type-ui.tsx:40 (249 l.) | trocar por Arc | Trocar por Arc drawer/dialog + campos Arc | - | M | alvo<44px 3 (l.135,231,232) |
| app/(dashboard)/leads/distribuicao/_components/queues/cold-age-release-section.tsx:12 (55 l.) | trocar por Arc + reskin por tokens | Re-skin + arc/switch | - | P | alvo<44px 1 (l.46) |
| app/(dashboard)/leads/distribuicao/plantao/_components/duty-type-tag.tsx:8 (33 l.) | reskin por tokens | Re-skin | arc/badge | P | nenhum detectado |

### `/leads/distribuicao/plantao/[scheduleId]`

- **Acesso hoje**: Diretor vê o editor de escala (29 componentes).
- **Complexidade da rota**: G (29 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 10, caixa alta em 1. Cinzel (pasta): 29
- **Primitivas F3**: tabela Lite, popover, drawer lateral, timeline, gráficos com tokens, dialog
- **Critério de pronto**: duty-operations-workspace e monthly-duty-planner convertidos uma aba por vez; calendário com LightDutyCalendar; drawer por dia.
- **Movimento**: Editor e grade. Escala mensal como Wizard por passo quando a escala é nova; grade sem cascata grande; célula muda em 120ms; conflito com LiteAttention uma vez; barra de alterações ao salvar.
- **Riscos e pontos de atenção**: Maior tela do plano (G). Quebrar em 3 entregas.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:89 (629 l.) | reskin por tokens | Re-skin; 11 alvos pequenos; uppercase (1) | supervisor-workspace/team-on-duty-list.tsx, broker-workspace/components/duty-now-view.tsx | G | uppercase 1 (l.465); alvo<44px 11 (l.128,135,152,155,323,...) |
| components/status-badges.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| app/(dashboard)/leads/distribuicao/plantao/_components/broker-live-status.tsx:30 (74 l.) | reskin por tokens | Re-skin | broker-workspace/components/connection-badge.tsx | P | alvo<44px 1 (l.48) |
| app/(dashboard)/leads/distribuicao/plantao/_components/broker-presence-invite-button.tsx:11 (37 l.) | trocar por Arc | Trocar por Arc button | - | P | alvo<44px 1 (l.19) |
| app/(dashboard)/leads/distribuicao/plantao/_components/broker-pause-button.tsx:11 (37 l.) | trocar por Arc | Trocar por Arc button | - | P | alvo<44px 1 (l.19) |
| components/dashboard/metric-card.tsx:59 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/distribuicao/plantao/_components/broker-presence-release-button.tsx:19 (77 l.) | trocar por Arc | Trocar por Arc popover + textarea | - | P | alvo<44px 4 (l.46,61,70,71) |
| app/(dashboard)/leads/distribuicao/plantao/_components/duty-lead-details-trigger.tsx:11 (87 l.) | trocar por Arc | Trocar por Arc drawer | PeopleRow | P | nenhum detectado |
| app/(dashboard)/leads/distribuicao/plantao/_components/broker-day-history-trigger.tsx:28 (143 l.) | trocar por Arc | Trocar por Arc drawer + timeline | Arc timeline | M | nenhum detectado |
| app/(dashboard)/leads/distribuicao/plantao/_components/broker-occurrence-card.tsx:24 (261 l.) | reskin por tokens | Re-skin; 5 alvos pequenos | supervisor-workspace/team-on-duty-list.tsx (linha de corretor) | M | alvo<44px 5 (l.183,184,185,228,238) |
| app/(dashboard)/leads/distribuicao/plantao/_components/pending-roster.tsx:21 (73 l.) | reskin por tokens | Re-skin | PeopleRow | P | alvo<44px 2 (l.51,67) |
| app/(dashboard)/leads/distribuicao/plantao/_components/schedule-escalar-button.tsx:25 (77 l.) | trocar por Arc | Trocar por Arc button/input | - | P | alvo<44px 1 (l.59) |
| components/dashboard/mini-donut.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| components/dashboard/metric-sparkline.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/leads/components/lead-details-drawer.tsx:67 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| app/(dashboard)/leads/distribuicao/plantao/_components/duty-swap-picker.tsx:21 (141 l.) | trocar por Arc | Trocar por componente Arc | arc/radio-cards | M | alvo<44px 3 (l.70,87,88) |
| app/(dashboard)/leads/distribuicao/plantao/_components/plantao-occurrence-sheet.tsx:26 (150 l.) | trocar por Arc | Trocar por Arc drawer/bottom-sheet | arc/bottom-sheet | M | alvo<44px 5 (l.110,111,114,130,131) |
| components/ownership-context.tsx:18 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:45 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | G | - |
| app/(dashboard)/leads/_components/lead-distribution-removal.tsx:25 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/_components/lead-assignment-history.tsx:62 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:31 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| features/leads/components/lead-health-badge.tsx:62 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/leads/components/mark-lead-in-service-button.tsx:24 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/leads/components/lead-quick-note.tsx:22 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| features/leads/components/lead-reminder.tsx:29 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| features/lead-distribution/queue-color-tag.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |
| app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:29 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | M | - |
| app/(dashboard)/leads/_components/lead-attendance-flow-starter.tsx:18 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | P | - |

### `/plantoes`

- **Acesso hoje**: Calendário de plantões do corretor, visão normal para o diretor.
- **Complexidade da rota**: P (1 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: drawer lateral, intervalo de datas
- **Critério de pronto**: LightDutyCalendar; drawer por dia; sem sombra.
- **Movimento**: Lista com filtros (calendário). Dia com plantão destacado com LiteHighlight; drawer do dia abre da direita.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| LightDutyCalendar features/broker-workspace/components/light-duty-calendar.tsx:1-346 (+ light-duty-calendar-motion.module.css) | Sem ação própria (herda ou nenhuma) | nenhuma; é referência visual para 2.17 Plantões | - | P | sombra por token l24 (ok); Arc Button sm = 44px (falsos positivos do scanner) |

### `/plantoes/agora`

- **Acesso hoje**: Meu plantão agora.
- **Complexidade da rota**: M (3 componentes no inventário)
- **Desvios do Lite (inventário)**: gradiente em 2, alvo menor que 44px em 2, sombra em 1, caixa alta em 1, dark em 1, cor crua em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: DutyNowView Lite; hero sem gradiente.
- **Movimento**: Painel. Número de quem está de plantão com LiteNumber; entrada da página com LitePageEnter; hero sem gradiente.
- **Riscos e pontos de atenção**: Hero com gradiente em duty-now-view.module.css:9.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| PresenceCalloutList components/chat/presence-callout.tsx (+ camera-capture.tsx, assistant-avatar.tsx, light-motion.tsx, chat.module.css) | reskin por tokens | RE-SKIN (arquivo compartilhado com o chat inteiro; coordenar com o grupo do chat) | - | M | chat.module.css: gradientes l200, 230, 279, 332, 347-349, 368, 390; sombras empilhadas l238-240; .dark l22, l362; uppercase l444; vários alvos < 44 (… |
| DutyNowView features/broker-workspace/components/duty-now-view.tsx:1-193 + duty-now-view.module.css | reskin por tokens | RE-SKIN | - | P | gradiente no hero (module l9); oklch cru l16, 22, 45, 46; .choice 40px l6; .count 22px l33 |
| Estado "não está de plantão" agora/page.tsx:37-47 | reskin por tokens | RE-SKIN | - | P | link sem alvo de 44px (l44) |

### `/plantoes/corretor/[brokerId]`

- **Acesso hoje**: Já Lite dentro do chrome normal (gestor, supervisor).
- **Complexidade da rota**: P (15 componentes no inventário)
- **Desvios do Lite (inventário)**: gradiente em 1, cor crua em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Visual Lite dentro do chrome Lite; TeamOnDutyList; escopo com tenantId e papel confirmados no servidor.
- **Movimento**: Detalhe. Cabeçalho do corretor; dias de plantão em cascata; abas com LiteHighlight.
- **Riscos e pontos de atenção**: RISCO: visual Lite aparece dentro do chrome normal (B:371). Checar escopo do brokerId.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| DutyNowView ver 2.20 | reskin por tokens | RE-SKIN (o mesmo de 2.20) | é Lite | P | gradiente/oklch cru |
| AssistantAvatar components/chat/assistant-avatar.tsx | Nada a fazer (redirect ou fora do diretor) | manter | é Lite | P | ok |
| Estado idle page.tsx:24-33 | reskin por tokens | RE-SKIN | - | P | link pequeno |
| /filiais | Nada a fazer (redirect ou fora do diretor) | redirect | - | - | - |
| /equipe/minha, /minha/configurar, /plantao, /desempenho, /transferencia, /repassar | Reusar Lite existente | já Lite (supervisor) | - | - | - |
| /plantoes, /plantoes/agora, /plantoes/corretor/[id] | Reusar Lite existente | já Lite | - | - | - |
| /gestao, /gestao/equipes/[id] | Reusar Lite existente | já Lite (gestor/supervisor); diretor negado | - | - | - |
| /equipe/dashboard, /distribuicao/dashboard | Sem ação própria (herda ou nenhuma) | normal, 1 componente | - | - | - |
| /equipe/convidar | Sem ação própria (herda ou nenhuma) | normal | - | - | - |
| /equipe/recuperacoes | Sem ação própria (herda ou nenhuma) | normal | - | - | - |
| /unidades/[id] | Ação livre (ver detalhe) | Lite do gestor existe | - | - | - |
| /equipe/[id] | Ação livre (ver detalhe) | Lite de gestor/supervisor existe | - | - | - |
| /equipe (+ visão Unidades) | Ação livre (ver detalhe) | Lite do gestor existe | - | - | - |
| /equipe/cargos | Sem ação própria (herda ou nenhuma) | normal | - | - | - |
| /distribuicao | Sem ação própria (herda ou nenhuma) | normal, sem nenhum Lite | - | - | - |

## 2.6 Onda 6: configuração

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/settings` | Diretor vê abas normais: conta, empresa, unidade, atendimento, whatsapp, integrações, segurança e extensão. | M | 26 | 153 | chips de filtro, dialog, select/combobox, casca de wizard, dialog de confirmação |
| `/settings/extension` | Diretor vê a aba de extensão. | - | 0 | 2 | nenhuma |
| `/settings/feedback-templates` | Diretor vê modelos de feedback. | M | 2 | 7 | nenhuma |
| `/settings/waha-diagnostic` | Diagnóstico WAHA para o diretor. | - | 0 | 1 | nenhuma |
| `/settings/integrations` | Redirect para /integrations. | - | 0 | 0 | nenhuma |
| `/settings/meta` | Redirect para /integrations/meta. | - | 0 | 0 | nenhuma |
| `/settings/whatsapp` | Redirect para /integrations/whatsapp. | - | 0 | 0 | nenhuma |
| `/configuracoes/comissoes` | Comissões, tela normal. | G | 2 | 0 | drawer lateral, checkbox |
| `/integrations` | Diretor vê catálogo; layout bloqueia gestor. | P | 2 | 0 | nenhuma |
| `/integrations/whatsapp` | Diretor vê 3 visões por ?visao=. | G | 13 | 22 | dialog, drawer lateral, select/combobox, tabela Lite, chips de filtro, casca de wizard |
| `/integrations/whats_alt` | Redirect para /integrations/whatsapp?visao=diretoria. | - | 0 | 25 | nenhuma |
| `/atendimento` | Hub de atendimento; diretor vê as abas. | - | 0 | 0 | nenhuma |
| `/atendimento/situacoes` | Situações de atendimento. | G | 4 | 15 | tabela Lite, dropdown, chips de filtro, dialog de confirmação, drawer lateral, select/combobox |
| `/atendimento/mensagens` | Mensagens de atendimento. | G | 5 | 13 | drawer lateral, tabela Lite, dropdown, chips de filtro, casca de wizard, select/combobox, dialog, dialog de confirmação |
| `/atendimento/fluxo` | Fluxo de atendimento. | M | 2 | 6 | nenhuma |
| `/qualificacao` | Hub com 5 abas; layout bloqueia gestor. | G | 10 | 212 | tabela Lite, dialog, select/combobox, checkbox, barra de lote, chips de filtro |
| `/qualificacao/turbo` | Turbo de qualificação. | M | 2 | 0 | drawer lateral, tabela Lite |
| `/fluxos-whatsapp` | Fluxos de WhatsApp; só a lista renderiza (studio órfão). | G | 3 | 0 | dialog, dialog de confirmação, tooltip, casca de wizard |

### `/settings`

- **Acesso hoje**: Diretor vê abas normais: conta, empresa, unidade, atendimento, whatsapp, integrações, segurança e extensão.
- **Complexidade da rota**: M (26 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 11, sombra em 8, cor crua em 7, dark em 2, caixa alta em 2, gradiente em 1. Cinzel (pasta): 153
- **Primitivas F3**: chips de filtro, dialog, select/combobox, casca de wizard, dialog de confirmação
- **Critério de pronto**: LightSettings com as 8 seções para o diretor via ?tab=; sem ThemeToggle; sem dark; alvos 44px; FeedbackTab e SecurityTab em Arc.
- **Movimento**: Formulário longo e configuração. Seções com LiteReveal; campo inválido rola até ele; barra de alterações não salvas sobe de baixo; salvo mostra LiteSuccess.
- **Riscos e pontos de atenção**: Órfãos: ai-settings-tab.tsx e waha-connections-card.tsx não são renderizados.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| settings/page.tsx:165-192 ramo diretor | Reusar Lite existente | LITE-REUSO: montar sections do diretor e renderizar LightSettings | light-settings.tsx | M | SHADCN (Card/Button no whatsapp inline :86), SOMBRA :120 (shadow-(--shadow-resting) ok) |
| _components/settings-tabs.tsx:68-112 | trocar por Arc | Substituído pelo LightSettings (manter só se quiser abas no desktop largo: virar arc/tabs) | light-settings.tsx (lista) | P | SHADCN, PEQ no desktop :92 (sem min-h), font-semibold ok |
| _components/light-settings.tsx + .module.css | Nada a fazer (redirect ou fora do diretor) | MANTER | Ele mesmo | - | Já Lite |
| _components/minha-conta-tab.tsx:30 → features/user-profile/components/perfil-tabs.tsx (111 l., :75 SOMBRA) | trocar por Arc + reskin por tokens | RESKIN + arc/segmented-control | parcial: features/manager-workspace/manager-lite-profile-actions.tsx | M | SOMBRA, SHADCN |
| ↳ user-profile/components/profile-header.tsx:28,49 | trocar por Arc + reskin por tokens | ARC avatar + RESKIN | arc/avatar, manager-lite-settings-parts.tsx (header) | P | SOMBRA ×2, SHADCN Avatar |
| ↳ user-profile/components/personal-data-section.tsx:108 | trocar por Arc | ARC | arc/input, arc/avatar | M | SOMBRA, SHADCN Field/Input |
| ↳ user-profile/components/security-summary-section.tsx:94 | trocar por Arc | ARC | arc/password-field | P | COR emerald-500 |
| ↳ user-profile/components/sessions-section.tsx:89,112,125 | reskin por tokens | RESKIN | PeopleRow | P | COR, PEQ |
| ↳ user-profile/components/activity-log-section.tsx | reskin por tokens | RESKIN | PeopleRow / lista simples | P | SHADCN |
| ↳ _components/account-tab.tsx (18 l.) | reskin por tokens | RESKIN | arc/panel | P | SHADCN |
| _components/empresa-tab.tsx (85 l.) | trocar por Arc | ARC | arc/input | P | SHADCN Field/Input/Button |
| ↳ _components/color-picker.tsx:6-11,21 (hex de presets), :36 SOMBRA | reskin por tokens | RESKIN (manter hex como valor, tirar sombra, swatch 44px) | arc/chip-group como base | P | COR (hex é dado do usuário, legítimo), SOMBRA |
| ↳ _components/logo-upload.tsx (90 l.) | trocar por Arc | ARC | arc/file-dropzone | P | inputs crus |
| _components/unit-tab.tsx:110 | Reusar Lite existente | LITE-REUSO (já mostra a mesma unidade no gestor) | manager-lite-settings-parts.tsx (ManagerLiteUnitSection) | P | PEQ, SHADCN |
| _components/feedback-tab.tsx (202 l.) | trocar por Arc | ARC | arc/input, arc/switch, arc/slider | M | SHADCN Field/Input |
| features/conversation-intelligence/components/ai-stage-mode-card.tsx (91 l.) | trocar por Arc | ARC | arc/radio-cards | P | SHADCN Card/SectionCardHeader |
| whatsapp inline settings/page.tsx:86 | Reusar Lite existente | LITE-REUSO | _components/light-whatsapp-section.tsx (Lite, usa ConnectionBadge) | P | SHADCN, PEQ |
| _components/light-whatsapp-section.tsx:12 | Nada a fazer (redirect ou fora do diretor) | MANTER | Ele mesmo | - | Já Lite |
| _components/integrations-tab.tsx (383 l.) | Criar Lite novo | LITE-NOVO (lista Lite + arc/dialog) | nenhuma | M | COR :206,207,230,231,349-354, DARK :207,231, PEQ ×12 (:180-272), SHADCN Tabs/Dialog/Select |
| _components/security-tab.tsx (128 l.) | trocar por Arc + reskin por tokens | RESKIN + ARC | arc/input, arc/stepper | M | COR :86,101, CAIXA :104, PEQ :104,105 |
| ↳ _components/passkey-section.tsx (348 l.) | Criar Lite novo | LITE-NOVO (lista + ações 44px) | nenhuma | M | **GRAD :132**, SOMBRA :132,162,217,252, CAIXA :231, COR/DARK :298, PEQ ×11 |
| extension/extension-tab.tsx (54 l.) | reskin por tokens | RESKIN | arc/panel | P | SHADCN |
| features/assist/components/accessibility-preferences.tsx | Reusar Lite existente | LITE-REUSO (adicionar seção para o diretor) | Ele mesmo | P | Já Lite (usado só no Lite hoje) |
| features/notifications/components/push-notification-manager.tsx (337 l.) | reskin por tokens | RESKIN do modo compact | modo compact usado no Lite gestor (settings/page.tsx:120) | M | PEQ ×12 (:194-284), SHADCN |
| **Ramos não-diretor já Lite** (settings/page.tsx:41-161): SupervisorLiteSettings (features/supervisor-workspace/supervisor-lite-settings.ts… | reskin por tokens | RESKIN pontual (hex → --success, sombras arbitrárias → --shadow-resting) | Eles mesmos | P | pequenos resíduos de COR/SOMBRA |
| features/broker-availability/components/broker-availability-settings.tsx + broker-availability-schedule-editor.tsx:77-103 | Reusar Lite existente | LITE-REUSO (fora do diretor) | light-availability-section.tsx | P | PEQ, SOMBRA |

### `/settings/extension`

- **Acesso hoje**: Diretor vê a aba de extensão.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 2
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Card com passos e ajuda em Arc panel; dialog de ajuda Arc.
- **Movimento**: Formulário longo e configuração. Passos com LiteReveal; conexão concluída mostra LiteSuccess.

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/settings/feedback-templates`

- **Acesso hoje**: Diretor vê modelos de feedback.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 1. Cinzel (pasta): 7
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Editor em Arc input e switch; sem sombra.
- **Movimento**: Formulário longo e configuração. Variantes do modelo abrem com LiteCollapse; salvar mostra LiteSuccess.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| settings/feedback-templates/page.tsx:14,23 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | via filhos |
| settings/feedback-templates/client.tsx (275 l.) | Criar Lite novo | ARC + LITE-NOVO lista | - | M | PEQ ×5 (:133,152,172,232,246), SHADCN Card/Input/Label/Badge |

### `/settings/waha-diagnostic`

- **Acesso hoje**: Diagnóstico WAHA para o diretor.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 1
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Lista de diagnóstico em Lite; sem cor crua.
- **Movimento**: Painel. Itens do diagnóstico entram em cascata; status muda com LiteAttention só na mudança de estado.

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/settings/integrations`

- **Acesso hoje**: Redirect para /integrations.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/settings/meta`

- **Acesso hoje**: Redirect para /integrations/meta.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/settings/whatsapp`

- **Acesso hoje**: Redirect para /integrations/whatsapp.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/configuracoes/comissoes`

- **Acesso hoje**: Comissões, tela normal.
- **Complexidade da rota**: G (2 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: drawer lateral, checkbox
- **Critério de pronto**: commission-rules-manager em Lite (regras em lista e drawer); tabela de comissões em Arc data-table; sem sombra.
- **Movimento**: Editor e grade. Regras em lista com cascata até 8; alteração mostra barra de alterações; salvar mostra LiteSuccess.
- **Riscos e pontos de atenção**: commission-rules-manager é G.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| features/commissions/components/commission-rules-manager.tsx (585 l.) | Criar Lite novo | LITE-NOVO (form em arc/side-sheet, lista com expandable-card) | - | G | CAIXA :223, SOMBRA :349,471, PEQ ×11 (:160-380), SHADCN Input/Label/Card |
| features/post-sale/components/post-sale-settings.tsx (69 l.) | trocar por Arc | ARC | - | P | SHADCN Checkbox/Input |

### `/integrations`

- **Acesso hoje**: Diretor vê catálogo; layout bloqueia gestor.
- **Complexidade da rota**: P (2 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Catálogo em grade Lite de tamanho uniforme; layout de bloqueio mantido.
- **Movimento**: Lista com filtros (catálogo). Cards em cascata até 8; ativar integração mostra LiteSuccess no card.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| integrations/page.tsx:14,16 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/communication-channels/components/integrations-catalog.tsx (111 l.) | reskin por tokens | RESKIN | - | P | SOMBRA :57,85, SHADCN Card/Badge |

### `/integrations/whatsapp`

- **Acesso hoje**: Diretor vê 3 visões por ?visao=.
- **Complexidade da rota**: G (13 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 8, sombra em 5, cor crua em 3, caixa alta em 2, dark em 1. Cinzel (pasta): 22
- **Primitivas F3**: dialog, drawer lateral, select/combobox, tabela Lite, chips de filtro, casca de wizard
- **Critério de pronto**: Visões diretoria, pessoal e canal em Lite; tenant-channel-card com QR em fundo token (sem shadow-md); alvos 44px.
- **Movimento**: Painel (três visões). Estado de conexão muda com LiteAttention só ao mudar (QR gerado, conectado); troca de visão por ?visao= com LiteSwap; QR sem animação infinita.
- **Riscos e pontos de atenção**: Inventário por pasta: 22 desvios.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| integrations/whatsapp/whatsapp-integration-heading.tsx:12 | trocar por Arc | ARC | - | P | SHADCN |
| **Visão oficial** settings/whatsapp-page.tsx (187 l.) | reskin por tokens | RESKIN | - | M | SHADCN Tabs/Card/Badge |
| ↳ communication-channels/components/meta-cloud-setup-card.tsx (111 l.) | reskin por tokens | RESKIN | - | P | COR amber-800 :38-46, CAIXA :98, PEQ :102 |
| ↳ meta-embedded-signup-card.tsx (181 l.) | reskin por tokens | RESKIN | - | P | SHADCN |
| ↳ coexistence-numbers-card.tsx (177 l.) | Criar Lite novo | LITE-NOVO sheet | - | M | PEQ :148,149, SHADCN ×7 |
| ↳ whatsapp-test-message-card.tsx (151 l.) | trocar por Arc | ARC | - | P | COR :121,129, PEQ :110 |
| **Visão diretoria** integrations/whatsapp/director-whatsapp-view.tsx:55-58 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ↳ integrations/whats_alt/_components/tenant-channel-card.tsx (269 l.) | reskin por tokens | RESKIN | - | M | SOMBRA :198, PEQ ×6 (:224-260) |
| ↳ whats_alt/_components/team-notices-card.tsx (294 l.) | Criar Lite novo | LITE-NOVO sheet | - | M | PEQ :91,236, SHADCN Sheet/Select/Switch |
| ↳ whats_alt/_components/tenant-channel-routing-card.tsx (178 l.) | Código morto ou órfão: não converter | Órfão: não converter | - | - | SOMBRA :67,135, PEQ :128,145 |
| **Visão materiais** integrations/whatsapp/materials-whatsapp-view.tsx (152 l.) | reskin por tokens | RESKIN | - | P | SOMBRA :83,104,124 |
| ↳ whats_alt/_components/material-groups-card.tsx (164 l.) | Criar Lite novo | LITE-NOVO lista | - | M | SOMBRA :84, PEQ :94,117,144, SHADCN Table |
| integrations/whatsapp/_components/template-builder-wizard.tsx (371 l.) | Criar Lite novo | LITE-NOVO (wizard com arc/stepper, preview usando bolha do chat Lite) | - | G | COR :309 (bg-emerald-950), CAIXA :310, SOMBRA :311, COR/DARK :321,339, PEQ :226,351-361 |

### `/integrations/whats_alt`

- **Acesso hoje**: Redirect para /integrations/whatsapp?visao=diretoria.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 25
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer; componentes ficam em /integrations/whatsapp.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/atendimento`

- **Acesso hoje**: Hub de atendimento; diretor vê as abas.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada próprio: abas em segmentado Arc; redirecionar para a primeira aba.
- **Movimento**: Painel (hub de abas). Abas com LiteHighlight; conteúdo troca com LiteSwap.

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/atendimento/situacoes`

- **Acesso hoje**: Situações de atendimento.
- **Complexidade da rota**: G (4 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 3. Cinzel (pasta): 15
- **Primitivas F3**: tabela Lite, dropdown, chips de filtro, dialog de confirmação, drawer lateral, select/combobox
- **Critério de pronto**: Lista e drawer Lite; sem sombra; alvos 44px.
- **Movimento**: Lista com filtros e drawer. Situação abre em drawer da direita; salvar mostra LiteSuccess; reordenar com layout (spring.smooth).
- **Riscos e pontos de atenção**: Inventário por pasta: 15 desvios.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| atendimento/situacoes/page.tsx:33-36 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| situacoes/_components/situations-workspace.tsx (260 l.) | Criar Lite novo | LITE-NOVO | - | G | PEQ :209,222, SHADCN ×9 |
| situacoes/_components/situation-drawer.tsx (278 l.) | Criar Lite novo | LITE-NOVO | - | G | PEQ :55,87,182, SHADCN Sheet/Select/Switch |
| situacoes/_components/suggestion-drawer.tsx (171 l.) | Criar Lite novo | LITE-NOVO | - | M | PEQ :81, SHADCN |

### `/atendimento/mensagens`

- **Acesso hoje**: Mensagens de atendimento.
- **Complexidade da rota**: G (5 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 3, sombra em 1. Cinzel (pasta): 13
- **Primitivas F3**: drawer lateral, tabela Lite, dropdown, chips de filtro, casca de wizard, select/combobox, dialog, dialog de confirmação
- **Critério de pronto**: Lista Lite de mensagens; editor em Arc textarea; sem sombra.
- **Movimento**: Formulário longo e configuração. Lista de variáveis com LiteCollapse; salvar mostra LiteSuccess.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| atendimento/mensagens/page.tsx:26-29 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| mensagens/_components/messages-workspace.tsx (220 l.) | Criar Lite novo | LITE-NOVO | - | G | PEQ :133,148, SHADCN ×9 |
| mensagens/_components/message-drawer.tsx (306 l.) | Criar Lite novo | LITE-NOVO | - | G | PEQ :83,95,138,257, SHADCN Sheet/Select/Textarea |
| qualificacao/_components/message-policies-panel.tsx (478 l.) | Criar Lite novo | LITE-NOVO | - | G | SOMBRA :319, PEQ :450,451, SHADCN ×10 |
| integrations/whatsapp/_components/template-builder-wizard.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | G | - |

### `/atendimento/fluxo`

- **Acesso hoje**: Fluxo de atendimento.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 1. Cinzel (pasta): 6
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Visual de fluxo em Lite; sem cor crua nem dark.
- **Movimento**: Editor e grade. Passos do fluxo: nós mudam em 120ms; sem cascata em grade grande; barra de alterações.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| atendimento/fluxo/page.tsx:22-25 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| fluxo/_components/flow-editor.tsx (135 l.) | trocar por Arc + reskin por tokens | ARC + RESKIN (estrutura simples) | - | M | PEQ (todos os botões), SHADCN Card/SectionCardHeader |

### `/qualificacao`

- **Acesso hoje**: Hub com 5 abas; layout bloqueia gestor.
- **Complexidade da rota**: G (10 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 7, alvo menor que 44px em 7, dark em 3, caixa alta em 3. Cinzel (pasta): 212
- **Primitivas F3**: tabela Lite, dialog, select/combobox, checkbox, barra de lote, chips de filtro
- **Critério de pronto**: Quebrar por aba (hub de 1095 linhas); cada aba vira uma entrega; alvos 44px; sem cor crua; sem uppercase.
- **Movimento**: Formulário longo e configuração (hub de 5 abas). Troca de aba com LiteSwap; campos com LiteReveal; salvar com barra de alterações e LiteSuccess; cada aba é uma entrega.
- **Riscos e pontos de atenção**: qualification-hub-client: 1095 linhas, G. situational-playbooks-panel é órfão.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| qualification-hub-client.tsx casca + abas :541-563 | Criar Lite novo | LITE-NOVO abas | - | G (arquivo grande, convém quebrar por aba) | PEQ (abas 40px, botões :524,533), COR :529 |
| aba overview :567-718 | trocar por Arc + reskin por tokens | ARC + RESKIN | - | M | COR ×5, DARK :618, color swatch :597 (bg-white border-gray-300) |
| aba whatsapp_diag :719-779 | reskin por tokens | RESKIN | - | P | COR :726,735,759 |
| aba agent_triggers :780-848 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | COR :786 |
| ↳ qualificacao/_components/agent-triggers-panel.tsx (386 l.) | Criar Lite novo | LITE-NOVO | - | G | COR ×13 (:143-149,161-170,186,221,246,280), DARK ×7, CAIXA :185,218,245,280, PEQ ×8 |
| ↳ settings/_components/agent-training-tab.tsx (240 l.) | trocar por Arc | ARC | - | M | PEQ :204,213,222, SHADCN ×8 |
| aba followup_rules :849-980 | Criar Lite novo | LITE-NOVO | - | M | CAIXA :864, COR :854,925, PEQ |
| aba simulator :981-1095 | Reusar Lite existente | LITE-REUSO (bolhas e composer do chat Lite) | - | M | CAIXA :1076, PEQ |
| features/ai-qualification/components/bulk-qualification-dialog.tsx (201 l.) | Criar Lite novo | LITE-NOVO | - | M | COR :91,103,163,182 (bg-emerald-600 text-white), DARK :163, PEQ ×4 |
| components/dashboard/data-table/data-table-frame + ui/table :794-843 | Criar Lite novo | LITE-NOVO | - | P | PEQ |

### `/qualificacao/turbo`

- **Acesso hoje**: Turbo de qualificação.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: drawer lateral, tabela Lite
- **Critério de pronto**: Fluxo turbo com passos Lite; wizard com casca Arc; sem sombra.
- **Movimento**: Wizard. Passos trocam com LiteSwap (x 12px); indicador com LiteHighlight; conclusão com LiteSuccess grande.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| qualificacao/turbo/page.tsx:18-20 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/qualification-turbo/components/turbo-admin.tsx (209 l.) | Criar Lite novo | LITE-NOVO (lista + side-sheet) | - | M | PEQ :70,151, SHADCN ×8 |

### `/fluxos-whatsapp`

- **Acesso hoje**: Fluxos de WhatsApp; só a lista renderiza (studio órfão).
- **Complexidade da rota**: G (3 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 2, dark em 2, alvo menor que 44px em 2, gradiente em 1, sombra em 1, caixa alta em 1. Cinzel (pasta): 0
- **Primitivas F3**: dialog, dialog de confirmação, tooltip, casca de wizard
- **Critério de pronto**: Lista de fluxos em Lite; studio órfão não converter; sem cor crua (slate e dark).
- **Movimento**: Lista com filtros. Lista de fluxos em cascata até 8; ativar fluxo mostra LiteSuccess; sem o estúdio (órfão).
- **Riscos e pontos de atenção**: workflow-automation-studio.tsx é órfão (1134 linhas).

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| whatsapp-flows-client.tsx | Criar Lite novo | LITE-NOVO | - | M | COR/DARK ×12 (slate-* em :128-200), COR :286, PEQ :153,189,192, confirm() |
| **Órfão relevante**: features/workflow-automation/components/workflow-automation-studio.tsx (1134 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo (nenhuma rota). Se for religado: LITE-NOVO, G+ | - | G | COR/DARK :179-184,855,856,1024, SOMBRA ×8, GRAD :679, CAIXA :581,1041,1101, PEQ ×22 |
| Órfãos: features/automations/components/automations-client.tsx (464 l., COR ×15, DARK ×6), ai-agent-wizard-client.tsx (320 l.) | Nada a fazer (redirect ou fora do diretor) | Fora do escopo | - | - | - |

## 2.7 Onda 7: marketing

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/marketing` | Redirect para /marketing/campanhas. | - | 0 | 0 | nenhuma |
| `/marketing/campanhas` | Diretor vê dashboard de campanhas. | G | 4 | 1 | select/combobox, tabela Lite |
| `/marketing/campanhas/[id]` | Diretor vê detalhe da campanha. | G | 3 | 0 | tabela Lite, select/combobox |
| `/marketing/importacoes` | Diretor vê importações. | M | 2 | 41 | drawer lateral, select/combobox |
| `/marketing/meta` | Redirect para /marketing/campanhas. | - | 0 | 0 | nenhuma |
| `/integrations/meta` | Diretor vê meta-integration-view (wizard). | G | 5 | 0 | dialog, drawer lateral, checkbox, casca de wizard, select/combobox |

### `/marketing`

- **Acesso hoje**: Redirect para /marketing/campanhas.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/marketing/campanhas`

- **Acesso hoje**: Diretor vê dashboard de campanhas.
- **Complexidade da rota**: G (4 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 2, alvo menor que 44px em 2, dark em 1. Cinzel (pasta): 1
- **Primitivas F3**: select/combobox, tabela Lite
- **Critério de pronto**: campaigns-dashboard-view em Lite; gráficos com tokens; tabela de campanhas em Arc data-table.
- **Movimento**: Painel. Números com LiteNumber; gráfico de desempenho com LiteDrawLine; troca de período com transição de valor.
- **Riscos e pontos de atenção**: campaigns-tab usa drawer.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| marketing/campanhas/page.tsx:36-60 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | SHADCN Badge |
| meta-ads/components/meta-sync-badge.tsx | trocar por Arc | ARC | - | P | SHADCN |
| meta-ads/components/meta-capture-controls.tsx (95 l.) | trocar por Arc | ARC | - | P | COR :85 (bg-emerald-600 text-white), PEQ :81,85 |
| meta-ads/components/campaigns-dashboard-view.tsx (338 l.) | Criar Lite novo | LITE-NOVO (KPIs Arc + arc/data-list) | - | G | COR :74,136,239, DARK :99,136,239, PEQ :84,112,188,250 |

### `/marketing/campanhas/[id]`

- **Acesso hoje**: Diretor vê detalhe da campanha.
- **Complexidade da rota**: G (3 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, cor crua em 1, caixa alta em 1, dark em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: tabela Lite, select/combobox
- **Critério de pronto**: campaign-detail-view Lite com abas Arc; timeline Arc; sem sombra.
- **Movimento**: Detalhe. Cabeçalho com status; métricas com LiteNumber; linha do tempo com LiteListPresence; abas com LiteHighlight.
- **Riscos e pontos de atenção**: campaign-detail-view é G.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| marketing/campanhas/[id]/page.tsx:204-206 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| marketing/campanhas/[id]/error.tsx:13 | reskin por tokens | RESKIN | - | P | ver §0.2 |
| meta-ads/components/campaign-detail-view.tsx (382 l.) | Criar Lite novo | LITE-NOVO | - | G | SOMBRA :174, CAIXA :206, COR :221, DARK :237, PEQ ×6 |

### `/marketing/importacoes`

- **Acesso hoje**: Diretor vê importações.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1, cor crua em 1, caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 41
- **Primitivas F3**: drawer lateral, select/combobox
- **Critério de pronto**: Upload em file-dropzone Arc; lista de importações Lite; sem sombra.
- **Movimento**: Lista com filtros e upload. Upload mostra LiteProgress com scaleX; linhas do arquivo em cascata até 8; importação concluída mostra LiteSuccess.
- **Riscos e pontos de atenção**: Inventário por pasta: 41 desvios.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| marketing/importacoes/page.tsx:31-41 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| marketing/importacoes/_components/marketing-import-client.tsx (340 l.) | Criar Lite novo | ARC (dropzone) + LITE-NOVO (histórico) | - | M | COR ×11 (:83-85,200-227,316-322), SOMBRA :192, CAIXA :262, PEQ :109,132,145,301 |

### `/marketing/meta`

- **Acesso hoje**: Redirect para /marketing/campanhas.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Nada a fazer.
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/integrations/meta`

- **Acesso hoje**: Diretor vê meta-integration-view (wizard).
- **Complexidade da rota**: G (5 componentes no inventário)
- **Desvios do Lite (inventário)**: caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: dialog, drawer lateral, checkbox, casca de wizard, select/combobox
- **Critério de pronto**: Wizard em casca Lite; passos em stepper Arc; sem gradiente.
- **Movimento**: Wizard. Passos com LiteSwap (x 12px); indicador com LiteHighlight; conexão concluída com LiteSuccess grande; enquanto espera o retorno do OAuth, estado estático com texto, sem animação infinita.
- **Riscos e pontos de atenção**: meta-marketing-wizard é G.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| integrations/meta/page.tsx:28-30 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| communication-channels/components/meta-integration-hub.tsx (28 l.) | reskin por tokens | RESKIN | - | P | SHADCN |
| meta-ads/components/meta-integration-view.tsx (384 l.) | Criar Lite novo | LITE-NOVO | - | G | CAIXA :245,279,305, SHADCN Dialog/Card |
| meta-ads/components/meta-marketing-wizard.tsx (634 l.) | Criar Lite novo | LITE-NOVO (wizard em tela cheia/bottom-sheet com arc/stepper) | - | G | PEQ :403,417, SHADCN Dialog/Checkbox |
| meta-ads/components/meta-conversions-card.tsx (144 l.) | trocar por Arc | ARC | - | M | SHADCN ×8 |

## 2.8 Onda 8: resto, auth, públicas e erros

| Rota | Acesso hoje | Cx | Componentes | Cinzel (pasta) | Primitivas F3 |
|---|---|---|---|---|---|
| `/ferramentas` | Hub de ferramentas. | P | 2 | 0 | nenhuma |
| `/ferramentas/materiais-operadoras` | Materiais por operadora. | M | 6 | 0 | drawer lateral, dropdown, tabela Lite, select/combobox, dialog de confirmação |
| `/ferramentas/validador-comprovante` | Validador de comprovante (12 componentes). | M | 2 | 0 | nenhuma |
| `/assinatura` | Tela de assinatura. | M | 1 | 9 | nenhuma |
| `/guia` | Guia do sistema. | M | 4 | 0 | nenhuma |
| `/guia/webhook` | Guia de webhook. | - | 0 | 6 | nenhuma |
| `/roadmap` | Redirect incondicional para /dashboard. Nada para o diretor; código morto (D12). | M | 1 | 48 | select/combobox |
| `/welcome` | Tela de boas-vindas (animada). | G | 2 | 0 | nenhuma |
| `/internal/design-system` | Catálogo interno de design. | M | 2 | 5 | select/combobox |
| `/internal/design-system/motion` | Catálogo de movimento. | - | 0 | 9 | nenhuma |
| `(auth) 7 rotas` | login, 2fa, access-denied, admin/login, invite/accept, recuperar-senha, verify (casca Lite). | P | 7 | - | checkbox |
| `/onboarding e /primeiro-acesso` | Onboarding e primeiro acesso; onboarding-wizard Lite existe. | P | 5 | - | casca de wizard |
| `Públicas (links curtos)` | /l, /lead, /compartilhado, /confirm_presence, /termos e /onboarding/[token]. | M | 5 | - | tabela Lite, dialog de confirmação |
| `Erros` | error.tsx, not-found.tsx e global-error.tsx. | P | 3 | - | nenhuma |

### `/ferramentas`

- **Acesso hoje**: Hub de ferramentas.
- **Complexidade da rota**: P (2 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Cards Lite de ferramenta em lista; sem sombra.
- **Movimento**: Lista com filtros (cards). Cards em cascata até 8; entrada da página com LitePageEnter.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| ferramentas/page.tsx:14-16 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/tools/components/tools-catalog.tsx (74 l.) | reskin por tokens | RESKIN | - | P | SOMBRA :39 |

### `/ferramentas/materiais-operadoras`

- **Acesso hoje**: Materiais por operadora.
- **Complexidade da rota**: M (6 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 3. Cinzel (pasta): 0
- **Primitivas F3**: drawer lateral, dropdown, tabela Lite, select/combobox, dialog de confirmação
- **Critério de pronto**: Lista Lite com busca em search-field Arc; drawer de material; sem cor crua.
- **Movimento**: Lista com filtros. Busca troca os resultados com LiteSwap; drawer de material abre da direita.
- **Riscos e pontos de atenção**: Inventário por pasta: 23 desvios.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| ferramentas/materiais-operadoras/page.tsx:26-28 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| operator-catalog/components/materials-workspace.tsx (185 l.) | Criar Lite novo | ARC + LITE-NOVO | - | M | PEQ :132,143, SHADCN ×7 |
| operator-catalog/components/materials-panel.tsx (199 l.) | Criar Lite novo | LITE-NOVO | - | M | PEQ :150,154 |
| operator-catalog/components/catalog-panel.tsx (170 l.) | Criar Lite novo | LITE-NOVO | - | M | SHADCN |
| operator-catalog/components/review-panel.tsx (263 l.) | Criar Lite novo | LITE-NOVO | - | M | PEQ ×5 (:24,170,211,214,239) |
| operator-catalog/components/broker-quotes-sheet.tsx (98 l.) | reskin por tokens | RESKIN | - | P | SHADCN Sheet |

### `/ferramentas/validador-comprovante`

- **Acesso hoje**: Validador de comprovante (12 componentes).
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Upload em file-dropzone Arc; resultado em lista Lite; sem sombra.
- **Movimento**: Formulário longo e configuração (upload e resultado). Upload mostra LiteProgress; resultado entra com LiteReveal; válido mostra LiteSuccess; inválido abre o motivo com LiteCollapse.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| ferramentas/validador-comprovante/page.tsx:14-16 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/payment-proof-validator/components/payment-proof-validator.tsx (293 l.) | trocar por Arc + reskin por tokens | ARC + RESKIN | - | M | PEQ :120,124, SHADCN Card/SectionCardHeader |

### `/assinatura`

- **Acesso hoje**: Tela de assinatura.
- **Complexidade da rota**: M (1 componentes no inventário)
- **Desvios do Lite (inventário)**: caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 9
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Re-skin por tokens; sem sombra.
- **Movimento**: Painel. Cartão do plano com LiteNumber nos valores; entrada com LitePageEnter.
- **Riscos e pontos de atenção**: Inventário por pasta: 9 desvios.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| assinatura/page.tsx (346 l., tudo inline, server) | reskin por tokens | RESKIN | - | M | CAIXA :182 (uppercase tracking-wider), PEQ :201,254 (size="sm"), SHADCN Card/Badge |

### `/guia`

- **Acesso hoje**: Guia do sistema.
- **Complexidade da rota**: M (4 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 2, caixa alta em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Re-skin por tokens; sem uppercase.
- **Movimento**: Detalhe (leitura). Seções com LiteReveal ao rolar; índice com LiteHighlight.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| guia/page.tsx:11-13 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/guide/components/system-guide.tsx (182 l.) | trocar por Arc + reskin por tokens | RESKIN + ARC | - | M | CAIXA :105,154, PEQ ×5 (:94-172) |
| guia/webhook/page.tsx:7-8 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| guia/webhook/webhook-tutorial.tsx (355 l.) | reskin por tokens | RESKIN | - | M | PEQ :109, SHADCN Card/Separator |

### `/guia/webhook`

- **Acesso hoje**: Guia de webhook.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 6
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Re-skin por tokens; blocos de código com tokens.
- **Movimento**: Detalhe (leitura). Blocos de código com LiteCollapse; copiar mostra LiteSuccess no botão.

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `/roadmap`

- **Acesso hoje**: Redirect incondicional para /dashboard (`roadmap/page.tsx:51`). Nada para o diretor; o código abaixo do redirect é morto.
- **Complexidade da rota**: M (1 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 1, caixa alta em 1, alvo menor que 44px em 1. Cinzel (pasta): 48
- **Primitivas F3**: select/combobox
- **Critério de pronto**: Nada a fazer para o diretor. Remover o código morto no D12 (em PR próprio).
- **Movimento**: não se aplica ao diretor (redirect ou só corretor). Se a rota voltar, usar o arquétipo do destino
- **Riscos e pontos de atenção**: Inventário por pasta: 48 desvios.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| roadmap/page.tsx (458 l., server, inline) | trocar por Arc + reskin por tokens | RESKIN + ARC | - | M | COR ×11 (:24-35 mapa de status, :346-443), CAIXA :186,276, PEQ :287,436,438, SHADCN Tabs/Card/Select |

### `/welcome`

- **Acesso hoje**: Tela de boas-vindas (animada).
- **Complexidade da rota**: G (2 componentes no inventário)
- **Desvios do Lite (inventário)**: gradiente em 1, sombra em 1, cor crua em 1, caixa alta em 1, dark em 1, alvo menor que 44px em 1. Cinzel (pasta): 0
- **Primitivas F3**: nenhuma
- **Critério de pronto**: welcome-screen sem gradiente nos ícones; cores por token; CTA único; movimento com light-motion.
- **Movimento**: Público e auth (cartão central). Entrada com LitePageEnter; passos com LiteStagger (até 8); um único CTA; movimento reduzido só com opacidade.
- **Riscos e pontos de atenção**: welcome-screen.tsx: 14 gradientes.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| welcome/page.tsx:49 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/onboarding/components/welcome-screen.tsx (551 l.) | Reusar Lite existente | LITE-REUSO do padrão lite-welcome (reescrever conteúdo do diretor sobre ele) | - | G | **GRAD ×14** (:48,64,80,96,160-175), COR ×15, DARK ×7, SOMBRA ×8 (:50,66,82,98,364,378,460,473), CAIXA :249, PEQ :281,378 |

### `/internal/design-system`

- **Acesso hoje**: Catálogo interno de design.
- **Complexidade da rota**: M (2 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 2, alvo menor que 44px em 2, sombra em 1. Cinzel (pasta): 5
- **Primitivas F3**: select/combobox
- **Critério de pronto**: Vira catálogo Lite para QA (tokens e componentes Lite); sem cor crua.
- **Movimento**: Editor e grade (catálogo). Cada peça mostra seus estados sem animação própria além da peça; sem loop; cada estado tem legenda.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| internal/design-system/page.tsx (151 l.) | trocar por Arc | Recomendo trocar o conteúdo para catalogar os componentes Arc/Lite (vira o QA visual da migração) | - | M | COR :139, PEQ :93 |
| internal/design-system/motion/page.tsx (224 l.) | reskin por tokens | RESKIN | - | P | SOMBRA :93, COR :151, **PESO :180 (font-extrabold)**, PEQ ×5 |

### `/internal/design-system/motion`

- **Acesso hoje**: Catálogo de movimento.
- **Complexidade da rota**: - (0 componentes no inventário)
- **Desvios do Lite (inventário)**: nenhum desvio marcado no inventário. Cinzel (pasta): 9
- **Primitivas F3**: nenhuma
- **Critério de pronto**: Vira catálogo Lite de movimento para QA.
- **Movimento**: Editor e grade (catálogo de movimento). Cada peça do kit roda uma vez com botão de reproduzir; versão com movimento reduzido ao lado.

_Sem componente próprio no inventário (ver nota de acesso acima)._

### `(auth) 7 rotas`

- **Acesso hoje**: login, 2fa, access-denied, admin/login, invite/accept, recuperar-senha, verify (casca Lite).
- **Complexidade da rota**: P (7 componentes no inventário)
- **Desvios do Lite (inventário)**: cor crua em 2, caixa alta em 2, dark em 2
- **Primitivas F3**: checkbox
- **Critério de pronto**: Contraste de verify corrigido; sem sombra; alvos 44px; mesmo light-auth-shell.
- **Movimento**: Público e auth. Cartão central com LitePageEnter; erro de senha com LiteCollapse; entrar com botão carregando e a transição de saída já existente (login-transition).
- **Riscos e pontos de atenção**: verify: bug de contraste (inventário C).

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| (auth)/login/page.tsx (258 l.) | Nada a fazer (redirect ou fora do diretor) | MANTER | - | - | Já Lite (só toast shadcn :12) |
| (auth)/recuperar-senha/page.tsx | Nada a fazer (redirect ou fora do diretor) | MANTER | - | - | Já Lite |
| (auth)/2fa/page.tsx (98 l.) | trocar por Arc | ARC | - | P | COR/DARK zinc-* :41,42,47,72,91, COR red-* :78, CAIXA :59, SHADCN ×5 |
| (auth)/admin/login/page.tsx (140 l.) | trocar por Arc | ARC | - | P | CAIXA :123, SHADCN ×4 |
| (auth)/invite/accept/page.tsx (27 l.) | trocar por Arc | ARC | - | P | SHADCN ×4 |
| (auth)/verify/page.tsx (17 l.) | reskin por tokens | RESKIN | - | P | **COR hex escuro de tema dark** #F5F5F5 #A1A1AA #52525B (:4,7,11) dentro da casca clara: texto quase invisível (bug visual) |
| (auth)/access-denied/page.tsx (13 l.) | reskin por tokens | RESKIN | - | P | text-sm underline link pequeno |

### `/onboarding e /primeiro-acesso`

- **Acesso hoje**: Onboarding e primeiro acesso; onboarding-wizard Lite existe.
- **Complexidade da rota**: P (5 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 2
- **Primitivas F3**: casca de wizard
- **Critério de pronto**: Wizard Lite com casca Arc; sem gradiente nem uppercase; mensagem de erro em token.
- **Movimento**: Wizard. Passos trocam com LiteSwap na direção do passo (x 12px); indicador com LiteHighlight; conclusão com LiteSuccess grande.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| primeiro-acesso/page.tsx:17,51,66,73 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| primeiro-acesso/onboarding-wizard.tsx (349 l.) | Nada a fazer (redirect ou fora do diretor) | MANTER (revisar sombra flutuante) | - | P | Já Lite; :321 shadow-(--shadow-floating) |
| primeiro-acesso/onboarding-notice.tsx | Nada a fazer (redirect ou fora do diretor) | MANTER | - | - | Já Lite |
| onboarding/page.tsx (77 l.) | Reusar Lite existente | LITE-REUSO (trocar ErrorMessage por OnboardingNotice) | - | P | SOMBRA :71 (shadow-sm no card de erro), fora da LightAuthShell |
| onboarding/[token]/page.tsx:8 | Nada a fazer (redirect ou fora do diretor) | MANTER | - | - | - |

### `Públicas (links curtos)`

- **Acesso hoje**: /l, /lead, /compartilhado, /confirm_presence, /termos e /onboarding/[token].
- **Complexidade da rota**: M (5 componentes no inventário)
- **Desvios do Lite (inventário)**: alvo menor que 44px em 3, sombra em 1
- **Primitivas F3**: tabela Lite, dialog de confirmação
- **Critério de pronto**: Casca pública Lite; sem cor crua; alvos 44px.
- **Movimento**: Público e auth. Cartão central com LitePageEnter; confirmação de presença com LiteSuccess; página de compartilhado só com opacidade.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| l/[id]/page.tsx:8, lead/[id]/page.tsx:17 | Nada a fazer (redirect ou fora do diretor) | MANTER | - | - | - |
| l/[id]/feedback/page.tsx:31 → features/broker-workspace/components/light-feedback-view.tsx (135 l.) | Nada a fazer (redirect ou fora do diretor) | MANTER | - | - | Já Lite; :86,111 shadow-(--shadow-resting) ok |
| compartilhado/[token]/page.tsx (329 l., client) | Criar Lite novo | LITE-NOVO (gate Lite + tabela Lite) | - | M | PEQ ×6 (:147,246,307-320), SHADCN Card/Input/Label/Button |
| confirm_presence/page.tsx (61 l.) | reskin por tokens | RESKIN | - | P | PEQ :52,57, SHADCN Card |
| termos/page.tsx (57 l.) | reskin por tokens | RESKIN | - | P | PEQ :29, SHADCN Card |

### `Erros`

- **Acesso hoje**: error.tsx, not-found.tsx e global-error.tsx.
- **Complexidade da rota**: P (3 componentes no inventário)
- **Desvios do Lite (inventário)**: sombra em 2, cor crua em 1
- **Primitivas F3**: nenhuma
- **Critério de pronto**: RouteError e RouteNotFound em Lite (EmptyState Arc e Button Arc); sem sombra.
- **Movimento**: Estado de erro (seção 4 do motion). arc/empty-state com fade; Tentar de novo mostra carregando no próprio botão; sem animação infinita.
- **Riscos e pontos de atenção**: RouteError: sombra em shadow-sm e hover.

| Componente (arquivo:linha) | Ação | Detalhe da ação | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/error.tsx:6, (dashboard)/error.tsx:6, qualificacao/error.tsx:7, marketing/campanhas/[id]/error.tsx:13 | trocar por Arc + reskin por tokens | RESKIN do RouteError (1 lugar), base arc/empty-state | - | P | SOMBRA :74,82 |
| app/not-found.tsx:4, (dashboard)/not-found.tsx:5 | reskin por tokens | RESKIN (1 lugar) | - | P | SOMBRA :50 |
| app/global-error.tsx (85 l.) | trocar por Arc + reskin por tokens | RESKIN com valores literais do Arc (neutros oklch, accent oklch(33% 0 0)), pois tokens não carregam aqui | - | P | COR hex inline :51,67,74 (#3b2dff, #e4e4e7) |

## 4. Transversal: chrome, primitivas e compartilhados

Estes itens não pertencem a uma rota só. Quem executa é a fase do Maestro indicada (F1 primitivas, F2 chrome, F3 primitivas novas). A coluna Ação segue a mesma classificação das rotas.

### 3. Primitivas Lite: o que já existe e o que falta

Fase: F1 e F3. Linhas: 17.

| Componente (arquivo:linha) | Ação | Detalhe | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| Arc dialog | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc drawer (lateral desktop) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc sortable-data-table | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc select / combobox | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc tabs | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc dropdown-menu | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc popover | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc checkbox | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc tooltip | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc toast (ou re-skin do ui/sonner.tsx) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc charts (line-chart, bar-chart, donut-chart, sparkline, activity-heatmap) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc timeline | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc filter-toolbar | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| Arc alert, progress, scroll-area, number-field | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **Kanban Lite (criar, não existe no Arc)** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **Superfície/cartão Lite (criar)** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **Header de página Lite** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |

### Primitivas atuais (`components/ui` e afins) alcançadas pelo Grupo A

Fase: F1 (re-skin das ui/*) e F3 quando a troca for por Arc novo. Linhas: 78.

| Componente (arquivo:linha) | Ação | Detalhe | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| components/ui/card.tsx | Reusar Lite existente | superfície Lite (classe utilitária ou componente LiteCard: bg surface-muted, radius-panel, shadow-resting) | - | - | - |
| components/ui/input.tsx | trocar por Arc | arc/input | - | - | sombra 1 (l.129); dark: 1 (l.129); alvo<44px 1 (l.129) |
| components/ui/button.tsx | trocar por Arc | arc/button (min 44px) | - | - | - |
| components/ui/skeleton.tsx | trocar por Arc | arc/skeleton | - | - | - |
| components/ui/badge.tsx | trocar por Arc | arc/badge (tone) | - | - | cor crua 6 (l.31,32,33,34); dark: 6 (l.31,32,33,34) |
| components/ui/scroll-area.tsx | trocar por Arc | Arc scroll-area (instalar) | - | - | - |
| components/ui/sonner.tsx | trocar por Arc + reskin por tokens | Arc toast (instalar) ou re-skin do sonner | - | - | sombra 2 (l.20,45) |
| components/motion/animated-page-title.tsx | Ação livre (ver detalhe) | lite-page-title | - | - | - |
| components/ui/separator.tsx | Ação livre (ver detalhe) | borda token --border-subtle | - | - | - |
| components/ui/select.tsx | trocar por Arc | Arc select (instalar) | - | - | - |
| components/ui/table.tsx | trocar por Arc | Arc sortable-data-table (instalar) | - | - | - |
| components/motion/count-up.tsx | trocar por Arc | arc/animated-counter | - | - | - |
| components/ui/chart.tsx | trocar por Arc | Arc charts (instalar) | - | - | sombra 1 (l.194); cor crua 1 (l.68); dark: 1 (l.10) |
| components/ui/label.tsx | trocar por Arc | label do arc/input | - | - | - |
| components/motion/animated-badge.tsx | trocar por Arc | arc/badge | - | - | cor crua 2 (l.52,53); dark: 2 (l.52,53); alvo<44px 2 (l.59,60) |
| components/ui/dialog.tsx | trocar por Arc | Arc dialog (instalar) | - | - | sombra 1 (l.49) |
| components/ui/tabs.tsx | trocar por Arc | Arc tabs (instalar) | - | - | - |
| components/ui/tooltip.tsx | trocar por Arc | Arc tooltip (instalar) | - | - | sombra 1 (l.66) |
| components/ui/textarea.tsx | trocar por Arc | arc/textarea | - | - | sombra 1 (l.5) |
| components/ui/sheet.tsx | trocar por Arc | Arc drawer (instalar) / arc bottom-sheet | - | - | sombra 1 (l.56); alvo<44px 2 (l.69,70) |
| components/ui/checkbox.tsx | trocar por Arc | Arc checkbox (instalar) | - | - | sombra 1 (l.13); dark: 1 (l.13) |
| components/ui/user-avatar.tsx | trocar por Arc | arc/avatar | - | - | sombra 1 (l.54) |
| components/ui/section-card-header.tsx | Criar Lite novo | cabeçalho de seção Lite (criar) | - | - | - |
| components/ui/ds-status-badge.tsx | trocar por Arc | arc/badge (tone) | - | - | - |
| components/ui/data-table/data-table-frame.tsx | trocar por Arc | Arc sortable-data-table (instalar) | - | - | - |
| components/ui/data-table/index.ts | trocar por Arc | Arc sortable-data-table (instalar) | - | - | - |
| components/ui/ds-empty-state.tsx | trocar por Arc | arc/empty-state | - | - | - |
| components/foundations/page-tabs.tsx | trocar por Arc | Arc tabs ou arc/segmented-control | - | - | sombra 4 (l.56,59,90,93) |
| components/ui/popover.tsx | trocar por Arc | Arc popover (instalar) | - | - | sombra 1 (l.40) |
| components/ui/dropdown-menu.tsx | trocar por Arc | Arc dropdown-menu (instalar) | - | - | sombra 2 (l.44,162); uppercase 1 (l.72); dark: 2 (l.99,115) |
| components/ui/ds-button-variants.ts | trocar por Arc | arc/button variants | - | - | sombra 2 (l.11,17) |
| components/motion/interface-motion-provider.tsx | Ação livre (ver detalhe) | light-motion | - | - | - |
| components/ui/selection-toolbar.tsx | Criar Lite novo | barra Lite (criar) | - | - | sombra 1 (l.30); alvo<44px 1 (l.39) |
| components/ui/button-variants.ts | trocar por Arc | arc/button variants | - | - | sombra 2 (l.4,12); cor crua 1 (l.10); dark: 2 (l.4,12); alvo<44px 5 (l.28,29,31,33) |
| components/foundations/confirm-dialog.tsx | trocar por Arc | Arc dialog (instalar) / confirm-morph | - | - | sombra 1 (l.78); alvo<44px 2 (l.64,75) |
| components/ui/responsive-data-view.tsx | trocar por Arc | PeopleRow (mobile) + data-table Arc | - | - | - |
| components/ui/ds-bar-chart.tsx | trocar por Arc | Arc bar-chart (instalar) | - | - | sombra 1 (l.109); cor crua 2 (l.16,20) |
| components/ui/ds-segmented-control.tsx | trocar por Arc | arc/segmented-control | - | - | sombra 2 (l.31,96) |
| components/motion/copy-check-icon.tsx | trocar por Arc | Arc copy-button (instalar) | - | - | - |
| components/ui/context-note.tsx | trocar por Arc | Arc alert (instalar) | - | - | - |
| components/ui/drag-scroll-table.tsx | trocar por Arc | Arc sortable-data-table (instalar) | - | - | - |
| components/foundations/detail-drawer.tsx | trocar por Arc | Arc drawer (instalar) | - | - | - |
| components/motion/file-upload.tsx | trocar por Arc | arc/file-dropzone | - | - | cor crua 2 (l.84,357); dark: 1 (l.84); alvo<44px 5 (l.232,287,320,332) |
| components/motion/attachment-upload.tsx | trocar por Arc | arc/file-dropzone | - | - | sombra 3 (l.304,417,432); cor crua 3 (l.196,393,496); dark: 2 (l.196,496); alvo<44px 3 (l.292,532,620) |
| components/ui/ds-outlined-action-button.tsx | trocar por Arc | arc/action-button | - | - | cor crua 1 (l.15) |
| components/ui/switch.tsx | trocar por Arc | arc/switch | - | - | sombra 1 (l.30); alvo<44px 1 (l.22) |
| components/ui/search-add-list.tsx | trocar por Arc | arc/search-field + lista Lite | - | - | alvo<44px 1 (l.88) |
| components/ui/progress.tsx | trocar por Arc | Arc progress (instalar) | - | - | - |
| components/ui/stateful-button.tsx | trocar por Arc | arc/button (loading) | - | - | - |
| components/foundations/filter-bar.tsx | trocar por Arc | Arc filter-toolbar (instalar) / PeopleFilters | - | - | sombra 1 (l.113); alvo<44px 3 (l.92,124,145) |
| components/foundations/active-filter-chips.tsx | trocar por Arc | arc/chip-group | - | - | alvo<44px 2 (l.63,65) |
| components/ui/bulk-status-dialog.tsx | trocar por Arc | Arc dialog (instalar) | - | - | alvo<44px 1 (l.73) |
| components/ui/bulk-reassign-dialog.tsx | trocar por Arc | Arc dialog (instalar) | - | - | cor crua 4 (l.209,305,306,320); dark: 1 (l.306); alvo<44px 7 (l.159,172,175,186) |
| components/data-table/data-table.tsx | trocar por Arc | Arc sortable-data-table (instalar) | - | - | - |
| components/data-table/data-table-column-header.tsx | trocar por Arc | Arc sortable-data-table (instalar) | - | - | alvo<44px 2 (l.38,39) |
| components/motion/success-overlay.tsx | reskin por tokens | re-skin | - | - | sombra 1 (l.40) |
| components/ui/currency-input.tsx | trocar por Arc | Arc number-field (instalar) ou arc/input | - | - | sombra 1 (l.118); dark: 1 (l.122); alvo<44px 1 (l.117) |
| components/ui/info-tooltip.tsx | trocar por Arc | Arc tooltip (instalar) | - | - | sombra 1 (l.46) |
| components/ui/field.tsx | trocar por Arc | label do arc/input | - | - | - |
| components/ui/bubble.tsx | Ação livre (ver detalhe) | components/chat (bolhas Lite) | - | - | cor crua 1 (l.30); dark: 4 (l.30,32,34,36) |
| components/ui/message.tsx | Ação livre (ver detalhe) | components/chat (bolhas Lite) | - | - | - |
| components/ui/marker.tsx | reskin por tokens | re-skin | - | - | - |
| components/ui/filter-toolbar.tsx | trocar por Arc | Arc filter-toolbar (instalar) | - | - | - |
| components/foundations/skeletons.tsx | trocar por Arc | arc/skeleton | - | - | alvo<44px 6 (l.17,18,36,69) |
| components/ui/avatar.tsx | trocar por Arc | arc/avatar | - | - | dark: 1 (l.20); alvo<44px 2 (l.20,94) |
| components/illustrations/voxel-illustration.tsx | Nada a fazer (redirect ou fora do diretor) | manter (ilustração) | - | - | dark: 1 (l.25) |
| components/unlumen-ui/shimmer-skeleton.tsx | trocar por Arc | arc/skeleton | - | - | - |
| components/ui/ds-tabs.tsx | trocar por Arc | Arc tabs (instalar) | - | - | - |
| components/ui/ds-count-up.tsx | trocar por Arc | arc/animated-counter | - | - | - |
| components/ui/ds-dashboard-card.tsx | trocar por Arc | arc/metric-card | - | - | cor crua 1 (l.8) |
| components/ui/ds-donut-chart.tsx | trocar por Arc | Arc donut-chart (instalar) | - | - | sombra 1 (l.57) |
| components/ui/ds-section-header.tsx | Criar Lite novo | cabeçalho de seção Lite (criar) | - | - | - |
| components/ui/ds-stat-tile.tsx | trocar por Arc | arc/metric-card | - | - | - |
| components/ui/ds-dialog.tsx | trocar por Arc | Arc dialog (instalar) | - | - | sombra 1 (l.32) |
| components/ui/ds-filled-dark-cta.tsx | trocar por Arc | arc/button primary | - | - | - |
| components/ui/ds-input-field.tsx | trocar por Arc | arc/input | - | - | sombra 1 (l.23); cor crua 2 (l.9,11) |
| components/ui/ds-sheet.tsx | trocar por Arc | Arc drawer (instalar) | - | - | sombra 2 (l.13,41) |
| components/ui/ds-switch.tsx | trocar por Arc | arc/switch | - | - | sombra 2 (l.10,24) |

### 4. Shell comum (fora das tabelas de rota, mas afeta todas)

Fase: F2 (chrome). Linhas: 56.

| Componente (arquivo:linha) | Ação | Detalhe | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| app/(dashboard)/layout.tsx:37 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| app/(dashboard)/loading.tsx:3 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| app/(dashboard)/error.tsx:5 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| app/(dashboard)/not-found.tsx:3 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/app-shell.tsx:44 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | cor crua 1 |
| features/onboarding/components/tenant-onboarding-dialog-loader.tsx:8 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/onboarding/components/director-wizard-loader.tsx:6 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/providers/realtime-sync-provider.tsx:73 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1 |
| components/providers/notification-count-provider.tsx:17 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/leads/components/feedback-toast-handler.tsx:41 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/passkey-toast-handler.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, alvo<44px 4 |
| features/onboarding/components/route-onboarding-loader.tsx:10 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/broker-availability/components/broker-availability-onboarding-loader.tsx:7 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/command-palette.tsx:13 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, cor crua 1, uppercase 1, alvo<44px 2 |
| components/system-feedback-drawer.tsx:16 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | uppercase 1, alvo<44px 3 |
| components/agent-drawer/agent-drawer-provider.tsx:20 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/agent-drawer/agent-drawer.tsx:32 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | gradiente 1, sombra 3, cor crua 1, uppercase 2, alvo<44px 13 |
| components/whatsapp/whatsapp-plantao-notice.tsx:36 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/whatsapp/whatsapp-link-handler.tsx:15 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/route-loading.tsx:4 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 2 |
| components/route-error.tsx:21 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 2 |
| components/route-not-found.tsx:7 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1 |
| components/corretop-sidebar.tsx:261 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, cor crua 27, uppercase 2, dark: 17, alvo<44px 4 |
| components/corretop-financeiro-sidebar.tsx:48 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 1 |
| features/super-admin/components/view-as.tsx:26 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/onboarding/onboarding-provider.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/onboarding/onboarding-welcome-dialog.tsx:4 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/whatsapp/whatsapp-missing-banner.tsx:20 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/onboarding/components/tenant-onboarding-dialog.tsx:104 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 1 |
| features/onboarding/components/director-wizard.tsx:134 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | gradiente 1, sombra 1, cor crua 4, uppercase 3, alvo<44px 2 |
| components/notifications/incoming-lead-card.tsx:14 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/huge-icons.tsx:302 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/onboarding/components/route-onboarding-dialog.tsx:52 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 2, cor crua 1, uppercase 3, dark: 1, alvo<44px 5 |
| features/broker-availability/components/broker-availability-onboarding.tsx:14 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | uppercase 1, alvo<44px 1 |
| components/agent-drawer/agent-shortcut-chips.tsx:13 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/whatsapp/whatsapp-connect-dialog.tsx:80 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 3 |
| components/experience-mode-toggle.tsx:18 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 2, alvo<44px 2 |
| components/super-admin-role-switcher.tsx:35 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, alvo<44px 3 |
| components/sidebar-collapsible-group.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 1 |
| components/onboarding/onboarding-card.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, uppercase 1, alvo<44px 6 |
| features/onboarding/components/onboarding-hero.tsx:17 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 1 |
| features/onboarding/components/onboarding-benefits.tsx:10 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | uppercase 1 |
| features/onboarding/components/onboarding-preview.tsx:3 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | gradiente 1, alvo<44px 2 |
| features/onboarding/components/onboarding-step-list.tsx:11 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| features/broker-availability/components/broker-availability-schedule-editor.tsx:26 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, alvo<44px 2 |
| components/whatsapp/whatsapp-pairing-panel.tsx:50 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | cor crua 2, dark: 1, alvo<44px 7 |
| components/ancora-logo.tsx:8 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | dark: 1 |
| features/onboarding/components/onboarding-step-item.tsx:12 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 3 |
| features/onboarding/components/onboarding-progress.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/dashboard-header.tsx:20 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 3 |
| components/theme-toggle.tsx:9 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/global-search.tsx:14 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, uppercase 1, alvo<44px 2 |
| components/notification-popover.tsx:38 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | sombra 1, cor crua 1, dark: 1, alvo<44px 4 |
| components/theme-provider.tsx:21 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| components/empty-state.tsx:78 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 1 |
| features/notifications/components/push-notification-manager.tsx:36 | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | alvo<44px 12 |

### 1. Componentes compartilhados (aparecem em várias rotas; converter uma vez)

Fase: Por rota: entrar com a primeira rota que usar. Linhas: 24.

| Componente (arquivo:linha) | Ação | Detalhe | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| DashboardHeader components/dashboard-header.tsx:1-66 | Reusar Lite existente | REUSAR chrome Lite; títulos das rotas do diretor entram em RULES | components/light/light-app-header.tsx + light-chrome.tsx (título vem de light-routes.ts R… | G (fora deste grupo, dependência de todas as rotas) | shadcn Button <44 (l35, l57); theme-toggle (tema escuro, proibido); sidebar do modo normal |
| StatCard components/dashboard/metric-card.tsx:1-172 (+ mini-donut.tsx, metric-sparkline.tsx, motion/count-up.tsx) | Criar Lite novo | ARC (MetricCard) ou NOVO LiteStatTile com sparkline opcional | components/arc/metric-card/metric-card.tsx:43 (sem sparkline) e blocos cinza de manager-l… | M | ícone size-8 l106; sparkline usa --chart-*; Card shadcn |
| RouteLoading components/route-loading.tsx:1-32 | Reusar Lite existente | REUSAR light-page-skeleton | components/light/light-page-skeleton.tsx, components/arc/skeleton | P | Card shadcn, h-8 l12-13 |
| RouteError components/route-error.tsx:1-104 | Criar Lite novo | NOVO LiteRouteError (EmptyState + Arc Button) | nenhum Lite de erro; components/arc/empty-state serve de base | P | shadow-sm hover:shadow l74, l82; Button shadcn |
| status-badges (RoleBadge, MemberStatusBadge) components/status-badges.tsx:1-188 | trocar por Arc | ARC (mapear status para tone) | components/arc/badge/badge.tsx (tones neutral/success/warning/danger/info) | P | alturas h-5 em 44 variantes (l22..), cores próprias |
| UserAvatar components/ui/user-avatar.tsx:54 | trocar por Arc | ARC | components/arc/avatar/avatar.tsx | P | sombra l54 |
| EmptyState (normal) components/empty-state.tsx | trocar por Arc | ARC | components/arc/empty-state + AssistantAvatar (mascote) | P | ícone Phosphor, Card |
| DataTable / DataTableColumnHeader components/ui/data-table/* | Criar Lite novo | NOVO LiteDataList (lista em cards + busca + paginação "carregar mais") ou REUSAR people-list | **não existe tabela Arc**; padrão Lite é lista components/light/people-list/people-list.t… | G | shadcn, densidade alta, botões <44 |
| Dialog / DialogPopup components/ui/dialog.tsx | trocar por Arc | ARC (BottomSheet) | components/arc/bottom-sheet/bottom-sheet.tsx (sheet com detents, vira modal no desktop) | por tela | shadcn |
| Sheet lateral components/ui/sheet.tsx | trocar por Arc | ARC | BottomSheet Arc | por tela | shadcn |
| Select / AppSelect components/ui/select.tsx | Criar Lite novo | NOVO LiteSelectSheet (lista de opções em BottomSheet com busca) | **não existe Select Arc**; usar chip-group (poucas opções), radio-cards, segmented-contro… | M | shadcn, h-9 |
| DropdownMenu components/ui/dropdown-menu.tsx | Reusar Lite existente | REUSAR padrão sheetRow | padrão Lite: botão ••• 44px + BottomSheet com sheetRow (features/supervisor-workspace/my-… | P por uso | shadcn, itens 32px |
| Tabs / RouteSectionTabs components/ui/tabs.tsx, components/ui/route-section-tabs.tsx:1-36 | trocar por Arc | ARC | components/arc/segmented-control | P | gatilhos min-h-10 (40px), text-xs |
| Checkbox components/ui/checkbox.tsx | Criar Lite novo | NOVO LiteCheckRow | **não existe Checkbox Arc**; components/arc/switch, chip-group multiple, ou checkbox nati… | P | shadcn ~16px |
| Switch components/ui/switch.tsx | trocar por Arc | ARC | components/arc/switch/switch.tsx:23 | P | shadcn |
| Popover / Tooltip / InfoTooltip components/ui/popover.tsx, tooltip.tsx, info-tooltip.tsx:46 | Criar Lite novo | NOVO/ARC por uso | sem Arc; usar BottomSheet ou expandable-card | P | sombra l46; alvo pequeno |
| Card / SectionCardHeader components/ui/card.tsx, section-card-header.tsx | Criar Lite novo + reskin por tokens | RE-SKIN ou NOVO LiteCard | card Lite = --surface + --radius-panel + --shadow-resting (team-page-view.module.css:16-2… | P | borda + variant="overview" |
| SelectionToolbar components/ui/selection-toolbar.tsx:30,39 | Criar Lite novo | NOVO barra fixa inferior Lite (como a de disponibilidade em settings) | nenhum | M | sombra l30, botão <44 l39 |
| ContextNote components/ui/context-note.tsx | reskin por tokens | RE-SKIN | bloco --surface-muted | P | tokens ok |
| PeriodSelect components/period-select.tsx:1-107 | trocar por Arc | ARC | segmented-control (7/30/90) | P | shadcn Select |
| AvailabilityToggle components/availability-toggle.tsx:39,51,63 | reskin por tokens | RE-SKIN | light-availability-context.tsx / Badge Arc | P | cor crua + dark: l39, l51, l63 |
| SearchAddList components/ui/search-add-list.tsx:88 | reskin por tokens | RE-SKIN | components/arc/search-field + people-list | P | botão <44 l88 |
| ds-* (DsStatusBadge, DsEmptyState, DsOutlinedActionButton) components/ui/ds-status-badge.tsx, ds-empty-state.tsx, ds-outlined-action-button… | trocar por Arc | ARC | Badge, EmptyState, Button Arc | P | tokens ds-*, cor crua l15 |
| TeamManagementTabs (d)/equipe/team-management-tabs.tsx:4-12 | trocar por Arc | ARC | segmented-control | P | ver Tabs |

### 0.1 Primitivos que o Arc NÃO tem e que este grupo exige (dependência bloqueante)

Fase: F3 e F1 (primitivos que o Arc não tem). Linhas: 26.

| Componente (arquivo:linha) | Ação | Detalhe | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| ui/card.tsx (Card, CardHeader, CardTitle...) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/button.tsx + button-variants.ts:4,12 (shadow, dark), :27-35 (h-9, sm 30px, icon 32px) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/input.tsx:129 (shadow, dark, h pequeno) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/textarea.tsx:5 (shadow) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/switch.tsx:22,30 (shadow, 20px) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/checkbox.tsx:13 (shadow, dark) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/select.tsx / AppSelect | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/tabs.tsx:175,220 (shadow) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/dialog.tsx:49 (shadow) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/sheet.tsx:56,69 / ui/drawer.tsx:75 (dark) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/table.tsx, ui/data-table/* (paginação PEQ em data-table-pagination.tsx:41-87) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/dropdown-menu.tsx:44,162 (shadow), :72,268 (CAIXA), :99,115 (DARK) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/badge.tsx:31-36 (COR + DARK) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/ds-status-badge.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/ds-segmented-control.tsx:31,96 (shadow) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/section-card-header.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/field.tsx, ui/label.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/sonner.tsx:45 (shadow) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/route-section-tabs.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/search-add-list.tsx:88 (PEQ) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/stateful-button.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/scroll-area.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/avatar.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/separator.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/chart.tsx:10,68,194 (DARK, COR, shadow no tooltip) | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| ui/skeleton.tsx | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |

### 0.2 Cromo compartilhado (aparece em quase toda rota do grupo)

Fase: F2 (cromo compartilhado). Linhas: 8.

| Componente (arquivo:linha) | Ação | Detalhe | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| components/dashboard-header.tsx (66 l.) e filhos: theme-toggle.tsx (tema escuro!), global-search.tsx:104,114, notification-popover.tsx:129,… | Ação livre (ver detalhe) | Trocar por components/light/light-app-header.tsx no modo Lite do diretor; remover ThemeToggle (regra sem tema escuro) | - | M | SOMBRA, CAIXA, DARK, PEQ |
| components/related-actions.tsx:36 (CAIXA), :51 (PEQ) | reskin por tokens | RESKIN para lista de links estilo light-settings.tsx:53-65 | - | P | CAIXA, PEQ |
| components/route-error.tsx:74,82 (SOMBRA) | trocar por Arc + reskin por tokens | RESKIN + arc/empty-state | - | P | SOMBRA, SHADCN |
| components/route-not-found.tsx:50 | trocar por Arc + reskin por tokens | RESKIN + arc/empty-state | - | P | SOMBRA |
| components/route-loading.tsx:12,13 | Reusar Lite existente | LITE-REUSO light/light-page-skeleton.tsx | - | P | PEQ, SHADCN |
| components/foundations/confirm-dialog.tsx:64,75,78 | trocar por Arc | Depende do arc/dialog | - | P | PEQ, SOMBRA |
| components/dashboard/metric-card.tsx (StatCard) :106 + mini-donut.tsx (svg) + metric-sparkline.tsx (recharts) + motion/count-up.tsx | trocar por Arc | ARC arc/metric-card + arc/animated-counter | - | M | PEQ, COR via iconClassName dos chamadores |
| components/empty-state.tsx | trocar por Arc | ARC arc/empty-state | - | P | SHADCN |

### 0.3 Terceiros com estilo próprio e como tematizar

Fase: Terceiros (recharts, react-flow, QR) com tema. Linhas: 8.

| Componente (arquivo:linha) | Ação | Detalhe | Lite de referência | Cx | Desvios |
|---|---|---|---|---|---|
| **@xyflow / react-flow** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **recharts 3.8** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **motion/react 12** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **sonner** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **react-day-picker 10** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **@dnd-kit** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **QR code (img)** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |
| **Embedded Signup da Meta (SDK FB)** | Sem ação aqui: compartilhado (ver rota de origem) ou fase da seção 4 | - | - | - | - |

### Anexo A: chrome do modo diretor (inv-shell.md)

Fonte: `inv-shell.md`. Fase: F2. Linhas como estão no inventário (cortadas em 260 caracteres).

| Item | Conteúdo do inventário |
|---|---|
| getExperienceMode | features/broker-workspace/experience-mode.ts:39-83 · Gestor com flag MANAGER_LITE: sempre LIGHT (58-61). Depois cookie ancora_experience_mode (63), depois tenantMemberships.preferredExperienceMode (67-74), depois default: corretor LIGHT, supervisor Lite LIGHT… |
| setExperienceModeAction | experience-mode.ts:89-131 · Grava DB + cookie 1 ano. Gestor com flag não pode voltar a NORMAL (94-99). |
| isSupervisorLiteAvailable | features/broker-workspace/lite-audience.ts:8-12 · role supervisor + supervisorTeamScope + flag SUPERVISOR_LITE. |
| isManagerLiteAvailable | lite-audience.ts:15-19 · role manager + flag MANAGER_LITE. |
| getLiteAudience | lite-audience.ts:21-27 · broker, manager ou supervisor; **diretor nunca** (retorna null). |
| isCleanUiOperationalEnabled | features/clean-ui/feature.ts:25-29 · Liga por padrão (só desliga se a setting for "false" ou o tenant estiver na lista legado). Vira data-ui-refinement="clean" no SidebarProvider (app-shell.tsx:146,195), que ativa styles/operational-ui.css (tokens em :root:ha… |
| Layout | app/(dashboard)/layout.tsx:168-173 · isLightBroker (broker+LIGHT), isLightSupervisor, isLightManager; qualquer um deles manda AppShell para o ramo LightChrome (layout.tsx:222). |
| Guarda de rotas Lite | layout.tsx:178-182 + light/light-routes.ts:78-88 · Só para audiência Lite. Diretor não tem allowlist. |
| Overlays por modo | layout.tsx:249-250, 257, 266-268 · Diretor recebe: RouteOnboardingLoader, BrokerAvailabilityOnboardingLoader (retorna null p/ não-corretor), toasts de lead estilo "toast", CommandPalette, SystemFeedbackDrawer, AgentDrawer. |
| LightChrome | light/light-chrome.tsx:38-178 · Shell Lite: rail desktop (.lite-split, 106-142), telas de chat sem header (145-154), demais telas com LightAppHeader + <main> (156-177), sheet "Mais" (79-96). · Padrão de escopo arc-venancor só no chrome; divisão desktop/mobile. |
| useDesktopChatRail | light-chrome.tsx:180-227 · Busca /api/chat/rail só em ≥1024px, refaz em evento realtime (máx. a cada 3s) e CHAT_RAIL_REFRESH_EVENT. · Não se aplica ao diretor (rail é lista de conversas). Se quiser, o diretor poderia ter o rail do chat como 2ª coluna, mas iss… |
| LightAppHeader | light/light-app-header.tsx:19-78 · Header 60px, voltar, título, pílula de disponibilidade, "Mais" só <md. · Base do novo DashboardHeader. |
| LightBackButton | light/light-back-button.tsx:15-31 · Voltar com fallback ao pai (sem loop). · Usar em telas de detalhe do diretor (lead, cliente, venda, membro). |
| LightMoreSheet | light/light-more-sheet.tsx:22-147 · BottomSheet Arc (detents 0.62/0.92): perfil, destinos, tour, disponibilidade, Sair, Ver como. · Modelo do menu do perfil/overflow no 390px. |
| light-routes.ts | light/light-routes.ts · Allowlists (8-88), destinos "Mais" por audiência (91-139), abas (118-122), títulos e pais (184-265). · Criar director-routes.ts análogo só para título/pai/voltar (sem allowlist). |
| LightBottomNav | light/light-bottom-nav.tsx · Barra flutuante em pílula (37-39). **Não usada** desde 2026-10-09. · Opção para o 390px (decisão §7.4). |
| LightSideRail | light/light-side-rail.tsx · Rail 72px. **Não usado**. · Referência de modo recolhido. |
| LightPageSkeleton | light/light-page-skeleton.tsx · Esqueletos. · Base do RouteLoading. |
| LightAvailabilityPill / useLightAvailability | components/light-top-nav.tsx:13, 42 · Pílula de disponibilidade. · Diretor não recebe lead: não usar. |
| Arc | components/arc/* · avatar, badge, bottom-sheet, button, chip-group, empty-state, input, metric-card, search-field, segmented-control, skeleton, switch etc. · **Faltam no Arc:** dropdown menu, tooltip, dialog, sheet lateral, popover, command. Usar os de ui/* c… |
| Principal | Painel / Dashboard & Visão Geral · /dashboard · acessar_dashboard · prefetch |
| Principal | Conversas / Atendimento e WhatsApp · /conversas · acessar_conversas · prefetch |
| Principal | Leads / Leads & Oportunidades · /leads · acessar_leads · prefetch |
| Operação | Distribuição / Distribuição de leads e roletas · /distribuicao (= /leads/distribuicao) · acessar_qualificacao_ia · |
| Operação | Vendas / Vendas e propostas · /vendas · acessar_vendas · prefetch |
| Operação | Equipe / Equipe & Unidades · /equipe · convidar_corretor ou acessar_configuracoes_unidade · abas: Equipe /equipe, Unidades /equipe?visao=unidades |
| Operação | Relacionamento / Central de relacionamento · /relacionamento · convidar_corretor · só com flag RELATIONSHIP_CENTER (relationshipCenterEnabled) |
| Marketing | Qualificação / Qualificação IA · /qualificacao · acessar_qualificacao_ia · |
| Marketing | Atendimento / situações e mensagens · /atendimento/situacoes · acessar_qualificacao_ia · abas: Situações, Mensagens /atendimento/mensagens, Fluxo /atendimento/fluxo |
| Marketing | WhatsApp / Conexões WhatsApp · /integrations/whatsapp · acessar_configuracoes_pessoais · Beta + ponto verde; abas: Oficial (Meta), Diretoria (WAHA) ?visao=diretoria, Materiais ?visao=materiais |
| Marketing | Campanhas / Campanhas de Marketing · /marketing/campanhas · acessar_campanhas_meta · ativo para todo /marketing/* |
| Ferramentas | Ferramentas / de conferência · /ferramentas · acessar_ferramentas · |
| Administração | Ajustes / Configurações do Sistema · /settings · acessar_configuracoes_pessoais · |

### Anexo B: primitivas (inv-primitivas.md)

Fonte: `inv-primitivas.md`. Fase: F1 e F3. Linhas como estão no inventário (cortadas em 260 caracteres).

| Item | Conteúdo do inventário |
|---|---|
| P1 | Carregar venancor-scope.css globalmente · src/app/layout.tsx ou globals.css · Hoje só carrega nas rotas Lite (achado 1) |
| P2 | Pôr arc-venancor no shell do diretor (AppShell/[data-slot=app-content]) e no container de portal · app-shell.tsx, layout · Tokens Arc passam a valer para todas as primitivas CRM que já leem --primary/--card/--muted... |
| P3 | Forçar tema claro no modo Lite · layout.tsx:104-107, theme-provider.tsx · Achado 6 |
| P4 | Neutralizar font-size: 97% dentro do Lite, ou declarar alvos em px · globals.css:404 · Achado 2 |
| P5 | Completar o mapeamento de tokens que o escopo ainda não cobre (--sidebar-*, --chart-*, --info, --warning-foreground, --surface-* CRM, --background) · venancor-scope.css · Seção 2 |
| P6 | Camada "primitivas Lite" escopada: um bloco .arc-venancor [data-slot=...] por primitiva (button, input, card, badge, tabs...) · novo arquivo, ex. src/components/arc/venancor-primitives.css · Permite estratégia A sem tocar nos 300+ chamadores |
| --background | #ffffff (86) · #09090b (321) · --background (#f7f7f9, 78) · **colisão de valor**: dentro do escopo bg-background vira cinza. Lite usa --surface (#fff) como canvas (.light-canvas, 140). Sugestão: no diretor, --background: var(--surface) |
| --foreground | #09090b (87) · #fafafa · --foreground (#0b0b12, 82) · colisão de nome, mesmo papel; ok |
| --card / --card-foreground | #fff / #09090b (89-90) · #18181b · --surface / --foreground · remapeado (86-87) |
| --popover / -foreground | oklch(1 0 0) (92-93) · #27272a · --surface-raised · remapeado (88-89) |
| --primary / -foreground | #3b2dff / #fff (96-97) · #1f6fe5 · --accent (#3b2dff) · remapeado (90-91), mesmo valor |
| --secondary / -foreground | #f4f3f0 (99-100) · #27272a · --surface-muted (#f1f1f5) · remapeado (92-93) |
| --accent / -foreground | #f4f3f0 / #09090b (102-103) · #27272a · **sem par semântico**: Arc --accent = marca #3b2dff · **COLISÃO CRÍTICA** (achado 3). Par correto do papel CRM: --surface-muted / --foreground |
| --muted / -foreground | #f4f3f0 / #71717a (105-106) · #27272a / #a1a1aa · --surface-muted / --text-muted (#666674) · remapeado (94-95) |
| --muted-text | #8d8d8d (107) · #6b6b6b · --text-muted · herda; nome confunde com --text-muted |
| --warning / -foreground | #f59e0b / #fff (110-112) · igual · --warning (#a15c00, 111) · **colisão de valor** (Arc é âmbar escuro legível); -foreground herda #fff |
| --success / -foreground | #10b981 / #fff (113-115) · igual · --success (#0f7a4d, 110) · colisão de valor; -foreground remapeado (100) |
| --destructive / -foreground | #ef4444 / #fafafa (116-117) · igual · --danger (#d4263a) · remapeado (98-99) |
| --info / -foreground | #3b82f6 / #fff (118-119) · igual · Arc Badge "info" usa --accent (badge.module.css:46); texto azul Lite = --chat-action-text · **herda** (não remapeado). Sugestão: --info: var(--accent) |
| --border | #e4e4e7 (122) · #27272a · --border (rgb(16 16 40/.08), 101) · colisão de nome, mesmo papel; ok |
| --border-strong | #afb0b1 (124) · #353535 · --border-strong (rgb(16 16 40/.18)) · colisão de nome, mesmo papel; ok |
| --input | #e4e4e7 (125) · #27272a · --border-strong · remapeado (96): bordas de campo ficam mais escuras |
| --ring | #3b2dff (126) · #1f6fe5 · --accent-strong (#2a1fd1) · remapeado (97) |
| --surface-base/-card/-secondary/-elevated/-overlay | 76-84 · 315-319 · --background / --surface / --surface-muted / --surface-raised · **herda**: card.tsx:12 (variant subtle) usa --surface-secondary. Sugestão: mapear no escopo |
| --ct-blue / --ct-blue-strong | #3b82f6 / #1f6fe5 (139-140) · igual · --chat-action / --chat-action-strong · herda |
| --color-deep-sapphire | #1e40af literal em @theme inline (26) · sem dark · --accent-strong · **não escopável** (valor fixo no utilitário). 4 usos de variant="deep-sapphire" |
| --sync-local/-confirmed/-error/-surface | 301-304 · via base · --warning / --accent / --danger / --surface-muted · herda, mas aponta para tokens remapeados; ok |
| --tabs-text-muted/-active/-pill-bg | oklch literais (297-300) · sem dark · --text-muted / --foreground / --surface · herda; trocar por var() |
| --dashboard-canvas | #fff (305) · sem dark · --surface · herda |
| --sidebar | var(--card) · --surface-muted (igual .lite-rail, 154) · herda (resolve para --card remapeado = branco) |
| --sidebar-foreground | var(--card-foreground) · --foreground · herda, ok |
| --sidebar-primary / -foreground | var(--primary) · --accent / --accent-foreground · herda, ok |
| --sidebar-accent / -foreground | #f4f3f0 / #09090b · --accent-subtle / --accent-strong (item ativo Lite) ou --surface-muted / --foreground (hover) · herda literal; decidir |
| --sidebar-warning / -foreground | oklch(.965 .003 260) / oklch(.22 .012 260) · sem par (falta --warning-subtle no Arc) · herda; **C**: criar --warning-subtle |
| --sidebar-border | #e4e4e7 · --border · herda literal |
| --sidebar-ring | #3b2dff · --accent-strong · herda literal |
| --chart-1 | #3b2dff · var(--accent) |
| --chart-2 | #3b82f6 · var(--chat-action) |
| --chart-3 | #f59e0b · var(--warning) (#a15c00) |
| --chart-4 | #10b981 · var(--success) (#0f7a4d) |
| --chart-5 | #94a3b8 · var(--neutral-6) |
| --radius | 1rem (58, 306, 379) · sem par · herda |
| --radius-sm | calc(1rem - .5rem) = .5rem (59) · sem par · herda |
| --radius-md | var(--radius-card) (60) · --radius-panel (1.5rem) para card Lite · herda (1rem) |
| --radius-lg | 1.25rem (61) · sem par · herda |
| --radius-xl | var(--radius-panel) (62) · --radius-panel · ok, mesmo valor (1.5rem) |
| --radius-control | 999px (189) · --radius-control 9999px (116) · **colisão de nome**, mesmo efeito (pílula) |
| --radius-card | 1rem (190) · --radius-panel (1.5rem) · herda; card do diretor fica com 16px enquanto Lite usa 24px |
| --radius-panel | 1.5rem (191) · --radius-panel 1.5rem (117) · colisão de nome, mesmo valor |
| --border-radius-pill / -rounded / -circle | 999px / var(--radius-control) / 50% (192-194) · --radius-pill · herda |
| --radius-2lg, --radius-notification-card | 10px (theme.css:66-67) · --radius-control / --radius-panel · herda; usados por base/* (morto) |
| --radius-ds-* | 6/8/12/16/9999px (tokens.css:99-103) · --radius-control / --radius-panel · herda (ds) |
| (Arc) --radius-surface | 1.75rem · sem par CRM · só Arc |
| --shadow-xs | 196 · 2 (empilhada) · --shadow-resting · herda; usada por switch.tsx thumb, user-avatar, selection-toolbar, foundations/* |
| --shadow-sm | 197 (e theme.css:74, duplicado) · 2 · --shadow-resting · herda; **conflito interno CRM** (dois valores) |
| --shadow-md | 198 (theme.css:75) · 2 · --shadow-raised · herda; duplicado |
| --shadow-lg | 199 (theme.css:76) · 2 · --shadow-floating · herda; duplicado |
| --shadow-xl | 200 (theme.css:77) · 2 · --shadow-floating · herda; duplicado |
| --shadow-action | none (201) · 0 · (nenhuma) · ok |
| --shadow-card | none (202) vs 0 1px 1px (theme.css:105) · 1 · --shadow-resting · **conflito interno CRM** |
| --shadow-dialog | 0 16px 48px (203) · 1 · --shadow-floating (1 camada no mapeamento, 115) · herda; mesmo papel. Usada por dialog, sheet, popover, dropdown, tooltip, sonner |
| .ct-notification-popover | globals.css:964-979 · 3 · --shadow-floating · viola "sem sombra empilhada" |
| --shadow-sidebar/-nav-selected/-checkbox-selected/-dropdown/-waitlist | theme.css:84-117 · várias · sem par · herda; usados por base/* (morto) |
| --shadow-ds-* | tokens.css · · · herda (ds) |
| (Arc) --shadow-resting | venancor 114 · **2** · · decisão (achado 7) |
| (Arc) --shadow-raised | venancor 55 · **2** · · idem |
| (Arc) --shadow-floating | venancor 115 · 1 · · ok |
| --font-sans | Jakarta (globals 54/154); theme.css:52 diz Inter · --font-body (Jakarta, 119) · ok; **conflito interno CRM** (Inter em theme.css) |
| --font-heading | Jakarta (56/155) · --font-display (Jakarta, 120) · ok |
| --font-logo | Amil (57/156) · sem par · manter (marca) |
| --font-mono | JetBrains/Geist Mono (55/158) · sem par · manter; dropdown-menu.tsx:72 usa mono em rótulo, trocar |
| --font-inter-sans | Jakarta (157) · --font-body · herda |
| --text-{xxl..xs}-font-size/-line-height/-letter-spacing | 242-261 · --text-*, --leading-*, --tracking-* · sem colisão de nome; mapear se usados |
| --text-weight-extra-bold | 800 (265) · sem par · **fora da regra** (400 a 700) |
| Tailwind --text-xl..5xl | padrão TW · Arc redefine · **colisão** (achado 4) |
| --duration-fast | 250ms (162) · 160ms · **colisão de valor** (primitivas CRM ficam mais rápidas no escopo) |
| --ease-in-out | ease-in-out (179) · cubic-bezier(.65,0,.35,1) · **colisão de valor** (afeta utilitário ease-in-out) |
| --duration-quick/-medium/-slow, --motion-*, --dialog-* | 159-206 · --duration-*, --ease-* · sem colisão; herda |
| --mobile-touch-target | 2.75rem (235) · --control-height-sm (2.75rem) · mesmo valor; ambos sofrem o 97% |
| --size-spacing-01..12 | 218-229 · --space-1..24 · sem colisão; herda (Card usa) |
| (Arc) --focus-ring transparente + outline 2px | venancor 50, 132-136 · CRM :where(...):focus-visible 2px --ring (globals 459-462) · convivem; resultado igual |
| ui/button.tsx + ui/button-variants.ts | 303 (248); buttonVariants direto em 6 · variant: default, primary, deep-sapphire, success, outline, secondary, ghost, accent, destructive, link. size: default h-9, xs h-6, sm h-7.5, lg h-10, icon 32, icon-xs 24, icon-sm 30, icon-lg 40. Props: loading, asChild… |
| ui/ds-button-variants.ts | 7 (3) · dsVariant: filled-dark, outlined-action, ghost-nav, outlined-nav · Hex ds-*, raio 8px, shadow-ds-subtle · ui/button · **D**: filled-dark para default, outlined-* para outline, ghost-nav para ghost |
| ui/ds-filled-dark-cta.tsx | 2 (2) · (usa dsVariant) · idem · ui/button · **D** |
| ui/ds-outlined-action-button.tsx | 4 (4) · idem · idem · ui/button variant outline · **D** |
| ui/ds-ghost-nav-button.tsx | 0 · · · · **D** |
| ui/ds-outlined-nav-button.tsx | 0 · · · · **D** |
| ui/magnetic-button.tsx | 0 · · Efeito magnético (movimento decorativo) · · **D** |
| ui/stateful-button.tsx | 2 (2): leads-filters, confirm-duty-presence · state idle/loading/success/error · · arc/action-button (label, successLabel, pendingLabel, onAction) · **B** (2 chamadores) |
| base/buttons/button.tsx, icon-button.tsx | 0 reais (cadeia morta) · h-6/8/9, shadow-xs, rounded-2lg · · · **D** |
| related-actions.tsx | 4 (4) · · Card subtle + título uppercase tracking-wider font-bold (36), rounded-xl · · **A** + sentence case na linha 36 |
| foundations/page-actions.tsx | 0 reais (só barrel) · · shadow-xs, size-8 · · **D** |
| foundations/row-actions.tsx | 0 reais · · rótulo uppercase text-[10px] (77), size-8 · · **D** |
| ui/badge.tsx | 172 (151) · variant (14): default, secondary, success, warning, destructive, info, indigo, purple, pink, cyan, orange, outline, ghost, link; status: neutral, info, success, warning, danger, loading; size sm h-6 / md h-8 · Paleta crua + dark: (31-36), não toke… |
| motion/animated-badge.tsx | 4 (1) · status 6; size sm h-6, md h-8 · emerald/amber + dark: (53-54) · motor do badge · **A** (mesma troca) |
| status-badges.tsx | 17 (17) · LeadTemperature, LeadQualificationBadge, LeadStatusBadge, SaleStatusBadge, ScheduleStatusBadge, DocumentStatusBadge, RecoveryStatusBadge, MemberStatusBadge, RoleBadge · Herda do AnimatedBadge · · **A** (domínio; herda o re-skin) |
| ui/ds-status-badge.tsx | 6 (5) · status (pending/completed/warning/success...) · ds-* hex · ui/badge com status · **D** (codemod 6 arquivos) |
| ui/ds-pill-badge.tsx | 0 · · · · **D** |
| ui/ds-pill-feature-tag.tsx | 0 · · · · **D** |
| foundations/status-badge.tsx | 1 (branches-manager via barrel) · · · ui/badge · **D** |
| base/badges/chip.tsx, status-dot.tsx | 0 reais · · · · **D** |
| ui/marker.tsx | 2 (conversas) · cva variant · · chat Lite (components/chat) · **A** |
| ui/card.tsx | 167 (156) · variant: default, subtle, overview, compact, kanban; size default/sm · Borda 1px + raio 1rem + sem sombra (11-15). Lite: sem borda, raio --radius-panel, --shadow-resting ou fundo --surface-muted (venancor-scope.css:113, 139). subtle usa --surface-… |
| dashboard-card.tsx | 3 (3, relatorios) · força variant="overview" · rounded-none · ui/card overview · **D** (duplicado de Card overview) |
| ui/ds-dashboard-card.tsx | 1 (director-journey-panel) · · ds-* · ui/card · **D** |
| ui/ds-elevated-feature-card.tsx | 0 · · shadow-ds-subtle-2 · · **D** |
| dashboard.tsx (DashboardGrid) | 5 (5) · · só grid · · **A** |
| dashboard/metric-card.tsx (StatCard) | 20 (20) · variant default/overview; badge de variação; CountUp · size-8 ícone; overview sem borda à direita · arc/metric-card (label, value number, suffix, context, change; 1 uso) · **A** (API Arc é estreita demais para 20 telas) |
| ui/ds-stat-tile.tsx | 1 · tone default/success/warning/destructive · ds-* · StatCard · **D** |
| ui/ds-trend-stat-card.tsx | 0 · · · · **D** |
| ui/section-card-header.tsx | 22 (22) · · herda Card · · **A** |
| ui/ds-section-header.tsx | 4 (4, journey director) · title/description/actions/as · ds-* · section-card-header ou .lite-page-title · **D** |
| ui/ds-page-header.tsx | 1 (components/app-page-header.tsx) · · ds-* · .lite-page-title/-subtitle (venancor-scope.css:188-189) · **A** via remap --color-ds-* ou reescrever o app-page-header |
| ui/page-header.tsx | 0 · · · · **D** |
| foundations/page-header.tsx | 0 reais · · · · **D** |
| ui/form-section.tsx | 0 · · · · **D** |
| foundations/section.tsx, settings-section.tsx | 0 reais · · rounded-xl/2xl, shadow-xs · · **D** |
| ui/context-note.tsx | 4 (4) · variant info (cva) · rounded-md · · **A** |
| ui/ds-callout.tsx | 0 · tone 5 · · · **D** |
| operational-placeholder.tsx | 0 · · · · **D** |
| ui/selection-toolbar.tsx | 4 (4) · · shadow-xs 2 camadas, rounded-xl · · **A** |
| ui/ds-selection-bar.tsx | 0 · · · · **D** |
| illustrations/voxel-illustration.tsx | 3 (3) · · 1 dark: · ilustrações 3D (memória: modal 2 colunas com ilustração) · **A** (tirar dark:) |
| ui/input.tsx | 130 (119) · máscaras format (cpf, cnpj, phone, cep, currency, date...), autodetecção por id/name · h-8 (32px), text-xs, bg-card, pílula (129) · arc/input (exige label, traz descrição/erro próprios, sem máscara) · **A**: altura 44px e 16px no celular (o escopo… |
| ui/textarea.tsx | 30 (28) · · rounded-2xl, text-xs (5) · arc/textarea (exige label) · **A** (escopo já ajusta raio, 182) |
| ui/label.tsx | 57 (53) · · · · **A** |
| ui/field.tsx | 12 (12) · Field, FieldLabel, FieldDescription, FieldError, FieldSuccess · · label embutido do Arc · **A** |
| ui/currency-input.tsx | 3 (3) · · h-8, 1 dark: · · **A** |
| ui/ds-input-field.tsx | 3 (3) · · ds-* · ui/input · **D** |
| ui/checkbox.tsx | 23 (23) · · 16px com hit area after:-inset-x-3 -inset-y-2 (~40x32px), rounded-md, 1 dark: · não existe (Arc tem radio-cards, chip-group; tokens --control-on/-glyph existem) · **A**: marcado em --control-on, hit area 44px |
| ui/ds-checkbox.tsx | 0 · · · · **D** |
| ui/switch.tsx (Base UI) | 19 (18) · · h-5 w-9 (20x36px), thumb shadow-xs 2 camadas (22-30) · arc/switch (Radix; checked/onCheckedChange/disabled + label; 42px de trilho) · **B** (props compatíveis; 19 arquivos) ou **A** se quiser zero risco |
| ui/ds-switch.tsx | 1 (rules-tab) · · shadow-ds-subtle · · **D** |
| ui/select.tsx | 85 (78) · Select (motion), MorphSelect; size default; Trigger !rounded-full (31,35) · lista via motion/select.tsx createPortal(document.body) (324-353), shadow-lg, rounded-[10px], h-7/h-8 · não existe select no Arc (Lite usa BottomSheet + radio-cards/chip-gro… |
| motion/select.tsx | 1 (ui/select) · · idem · · **A** |
| motion/select-morph.tsx | 1 (ui/select) · · shadow-lg · · **A** |
| period-select.tsx | 10 (10) · · usa ui/select · · **A** (herda) |
| branch-select.tsx | 2 (2) · · usa ui/select · · **A** (herda) |
| ui/combobox.tsx | 1 (internal/design-system) · · shadow-xl, h-8, 1 dark: · · **A** (herda popover) ou **D** |
| ui/command.tsx (cmdk) | 2, ambos mortos (faceted, data-table-faceted-filter) · · shadow-lg, tracking-widest (140) · · **D** (se command-palette.tsx não usar; ele não importa este arquivo) |
| ui/slider.tsx | 1 (cadeia morta) · · · arc/slider · **D** |
| ui/calendar.tsx | 1 (cadeia morta) · · shadow-xs · arc/calendar, arc/date-picker · **D** |
| ui/search-add-list.tsx | 3 (3) · · rounded-lg · arc/search-field (busca) · **A** |
| ui/toggle.tsx | 1 (toggle-group) · variant default/outline; size default h-8, sm h-7, lg h-9 · bg-accent (9), alvos < 44 · arc/chip-group · **D** |
| ui/toggle-group.tsx | 0 · · · · **D** |
| ui/form.tsx | 0 · · · · **D** |
| base/input/*, base/checkbox/*, base/select/*, base/dropdown/* | 0 reais · · gradiente em base/checkbox/checkbox.tsx, shadow-dropdown · · **D** |
| ui/tabs.tsx | 17 (17) · variant pill, underline (padrão), segment, line (25) · indicador com mola; --tabs-* literais (globals 297-300) · arc/segmented-control para pill/segment · **A** (underline/line); usos segment/pill com até 4 opções podem ir para **B** |
| ui/ds-tabs.tsx | 2 (2) · · ds-* · ui/tabs · **D** |
| ui/ds-segmented-control.tsx | 7 (6) · options {value,label,count,disabled}, value, onValueChange, aria-label · ds-*, shadow-ds-subtle · arc/segmented-control (options {value,label,accessory}, value, onValueChange, label) · **B**: count para accessory, aria-label para label; 7 arquivos |
| base/segmented-control/* | 0 reais · · · · **D** |
| ui/route-section-tabs.tsx | 3 (3) · · min-h-10 (40px), text-xs · · **A** (44px) |
| foundations/page-tabs.tsx | 3 (2) · tabs com badge, href ou onTabChange · Button outline/secondary + Badge, shadow-xs · arc/segmented-control · **A** (herda Button/Badge) |
| ui/sidebar.tsx | 12 (0, só shells) · variant sidebar/floating/inset; side; collapsible · --sidebar-*; h-7/h-8, size-9 · light/light-side-rail.tsx · **A** via mapeamento --sidebar-* (seção 2.2); troca de shell é de outro inventário |
| ui/ds-sidebar-nav-item.tsx | 0 · · · · **D** |
| ui/breadcrumb.tsx | 0 · · · · **D** |
| ui/dock.tsx | 0 · · · · **D** |
| ui/scroll-area.tsx | 16 (12) · ScrollArea, ScrollBar · · · **A** |
| ui/separator.tsx | 11 (6) · · · · **A** |
| ui/dialog.tsx (Base UI) | 60 (52) · Dialog, DialogPopup (overlayClassName), Header, Footer, Title, Description, Portal · Overlay bg-foreground/28 backdrop-blur-sm (29); popup rounded-[--radius-panel] + borda + --shadow-dialog (48); título text-lg font-bold (94), descrição text-xs (104… |
| ui/sheet.tsx (Base UI) | 31 (27) · side top/right/bottom/left; showCloseButton; Body, Section · Fechar size-8 com aria-label="Fechar painel" (72): fora da regra de 44px do escopo, que só cobre "Fechar" (146-147) · arc/bottom-sheet · **A** + incluir "Fechar painel" na regra de hit area |
| ui/drawer.tsx (Base UI drawer) | 2 (2) · · 1 dark: · ui/sheet ou arc/bottom-sheet · **D** |
| ui/ds-dialog.tsx | 1 (audit-tab) · · shadow-ds-lg · ui/dialog · **D** |
| ui/ds-sheet.tsx | 1 (campaigns-tab) · · shadow-ds-lg+shadow-lg · ui/sheet · **D** |
| foundations/detail-drawer.tsx | 5 (4) · · envolve ui/sheet · · **A** (herda) |
| foundations/confirm-dialog.tsx | 4 (3) · · envolve ui/dialog, shadow-xs · · **A** (herda) |
| ui/bulk-reassign-dialog.tsx, ui/bulk-status-dialog.tsx | 1 cada (leads-workspace) · · h-8, 1 dark: · · **A** (são features; mover para features/leads) |
| ui/popover.tsx (Base UI) | 12 (5) · · rounded-[--radius-card] borda + --shadow-dialog (39) · · **A** + escopo |
| ui/dropdown-menu.tsx (Base UI Menu) | 28 (14) · Content, Item (variant destructive), CheckboxItem, RadioItem, Sub, Label, Shortcut · Label font-mono text-[11px] uppercase tracking-wider (72); focus:bg-accent (99,140,186,228,268); dark: x2 · · **A** + trocar accent por muted + sentence case |
| ui/tooltip.tsx (Base UI) | 16 (10) · · rounded-xl + borda + --shadow-dialog (65) · · **A** + escopo |
| ui/info-tooltip.tsx | 1 · · shadow-md · · **A** |
| motion/tooltip.tsx | 1 (attachment-upload) · · shadow-md · ui/tooltip · **D** |
| ui/sonner.tsx | 171 (156) · toast.success/error/warning/info/loading/message; Toaster bottom-right · AnimatedToast com !shadow-[--shadow-dialog] (43) · · **A** + escopo no Toaster |
| motion/animated-toast.tsx | 1 (sonner) · · shadow-2xl, shadow-xs, 6 dark: · · **A** |
| arc/bottom-sheet | 23 (20) · detents, trigger, title/description · · canônico mobile · (já Lite) |
| ui/skeleton.tsx | 10 (5) · Skeleton, SkeletonReveal · ct-skeleton bg-muted rounded-[--radius-card] (9) · arc/skeleton (API por linhas: label, lines, avatar) · **A** (canônico por forma livre); cor e pulso iguais ao Arc (color-mix(--border-strong 38%, --surface)) |
| ui/ds-skeleton.tsx | 0 · · · · **D** |
| unlumen-ui/shimmer-skeleton.tsx | 1 (minha-fila/loading) · · shimmer em gradiente · ui/skeleton · **D** |
| foundations/skeletons.tsx | 2 (vendas/loading + barrel) · · h-6..h-9 · ui/skeleton / light-page-skeleton · **A** ou **D** |
| data-table/data-table-skeleton.tsx | 0 · · · · **D** |
| empty-state.tsx (raiz) | 11 (9) · variant default, card, ghost, inline; icon ComponentType; action; loading; animated · Borda tracejada rounded-[--radius-card] (37-41) · arc/empty-state (title, description obrigatório, action, icon ReactNode) · **B-adaptador**: renderizar Arc EmptySt… |
| ui/empty-state.tsx | 0 · actionLabel/actionHref/secondaryAction · · · **D** |
| foundations/empty-state.tsx | 1 (branches-manager) · · shadow-xs · arc/empty-state · **D** |
| ui/ds-empty-state.tsx | 6 (6) · icon, title, description, action, bordered · ds-* · arc/empty-state · **B** (API quase igual) |
| ui/progress.tsx | 3 (3) · · bg-primary · · **A** |
| motion/count-up.tsx | 2 (1) · · · arc/animated-counter · **A** |
| ui/ds-count-up.tsx | 2 (1) · · · motion/count-up · **D** |
| motion/success-overlay.tsx + success-moment.tsx | 3 (3) / 1 · · --shadow-dialog, size-5/8 · · **A** |
| motion/copy-check-icon.tsx | 4 (3) · · · · **A** |
| motion/file-upload.tsx, motion/attachment-upload.tsx | 1 cada (lead-documents-section) · · shadow-2xl/xl, dark:, createPortal próprio, size-7..9 · arc/file-dropzone · **B** (1 chamador) |
| motion/interface-motion-provider.tsx, use-interface-animation.ts, stagger.tsx, route-view-transition.tsx, animated-page… | 28 / 35 / 1 / 1 / 2 · · infraestrutura de movimento, sem visual · arc/motion-tokens.ts · **A** (garantir que respeitem html[data-reduce-motion], venancor-scope.css:169-171) |
| ui/animated-theme-toggler.tsx | 1 (theme-toggle) · · troca de tema · Lite sem dark · **D** no Lite (esconder) |
| ui/animated-icons/hugeicons/* (35 ícones + index) | via huge-icons.tsx (244 importadores) · · só SVG animado · · **A** (nada a re-skin) |
| ui/table.tsx | 44 (41) · Table, Header, Body, Footer, Row, Head, Cell, Caption · bg-card, text-sm; regras globais por slot (globals.css:508-522) · light/people-list (lista, não tabela) · **A** |
| ui/data-table/* (index, data-table, frame, column-header, pagination, view-options) | index 15 (14), frame 17 (14) · dataTableFrameVariants · raios --radius-control/--radius-card, size-8, h-7/h-9 · · **A** |
| ui/drag-scroll-table.tsx | 4 (2) · · · · **A** |
| ui/responsive-data-view.tsx | 7 (7) · MobileDataList, MobileDataListItem, MobileDataRow · rounded-[--radius-card] · light/people-list · **A** |
| data-table/data-table.tsx (dice-ui) + column-header, pagination | 1 cada (leads-data-table) · · h-8 · ui/data-table · **A** ou **D** (fundir no ui/data-table) |
| data-table/ toolbar, advanced-toolbar, filter-list, filter-menu, sort-list, view-options, faceted-filter, date-filter,… | 0 reais (advanced-toolbar tem 0 e puxa o resto) · · h-6..h-8 · · **D** |
| base/table, base/pagination | 0 reais · · · · **D** |
| ui/ds-data-row.tsx | 0 · · · · **D** |
| ui/chart.tsx (Recharts) | 7 (3) · THEMES light/dark (10); tooltip shadow-xl (194) · · · **A** + --chart-* (seção 2.3) |
| ui/ds-bar-chart.tsx | 1 (dashboard-widgets) · · shadow-ds-md, hex · ui/chart · **D** |
| ui/ds-donut-chart.tsx | 1 (director-journey-panel) · · shadow-ds-md, hex · ui/chart · **D** |
| dashboard/funnel-chart.tsx | 1 · · **gradiente SVG** (70-79) · · **A** (trocar por cor chapada) |
| dashboard/sparkline.tsx | 1 (integridade) · · **gradiente SVG** de área (37-50) · · **A** (preenchimento chapado com opacidade) |
| dashboard/metric-sparkline.tsx, mini-donut.tsx | 1 cada (metric-card) · · · · **A** |
| dashboard/lead-trend-chart.tsx, backlog-overlay.tsx | 0 · · · · **D** |
| ui/avatar.tsx (Base UI) | 4 (3) · size default/sm/lg; Image, Fallback, Badge, Group, GroupCount · 1 dark: · arc/avatar (name, src, size sm/md/lg/xl, status) · **A**; regra Lite já existe: .light-avatar fundo --accent-subtle (venancor-scope.css:143) |
| ui/user-avatar.tsx | 13 (10) · size sm/default/lg; DiceBear styles · shadow-xs 2 camadas · arc/avatar · **B-adaptador** (iniciais chapadas, sem DiceBear no Lite) |
| base/avatar | 0 reais · · · · **D** |
| ui/bubble.tsx, ui/message.tsx | 2 cada (conversas) · bubble variant (cva) · 4 dark: em bubble · components/chat (Lite) · **A** (ou trocar pelo chat Lite no inventário de telas) |
| foundations/filter-bar.tsx | 2 (leads-filters) · · shadow-lg 2 camadas · · **A** |
| foundations/active-filter-chips.tsx | 2 (leads-filters) · · chips h-6 (24px) · arc/chip-group · **A** (44px) |
| ui/filter-toolbar.tsx | 1 (conversas) · · · foundations/filter-bar · **D** |
| ui/faceted.tsx, ui/sortable.tsx, ui/inline-group.tsx | 0 · · · · **D** |
| foundations/icons/chevrons.tsx | 2, ambos mortos · · · · **D** |
| foundations/index.ts (barrel) | 1 real (branches-manager) + dev · · · · **D** após migrar branches-manager |
| Botão | ui/button (303), ds-*-button x4 + ds-button-variants (13 usos), magnetic-button (0), stateful-button (2), base/buttons (0), arc/button (29) · **ui/button re-skinado (A)** para o diretor; arc/button continua nas telas Lite já feitas · ds-* para ui/button (D);… |
| Botão com estado | stateful-button, arc/action-button · **arc/action-button** · stateful (B) |
| Card | ui/card (167), dashboard-card (3), ds-dashboard-card (1), ds-elevated-feature-card (0), foundations/section (0) · **ui/card re-skinado** · demais (D) |
| Métrica | dashboard/metric-card StatCard (20), ds-stat-tile (1), ds-trend-stat-card (0), arc/metric-card (1) · **StatCard re-skinado** · ds (D); arc/metric-card fica para Lite |
| Estado vazio | components/empty-state (11), ui/empty-state (0), foundations/empty-state (1), ds-empty-state (6), arc/empty-state (25) · **arc/empty-state** (com adaptador no components/empty-state para não tocar 11 chamadores; variante inline fica local) · ui/foundations (D… |
| Skeleton | ui/skeleton (10), ds-skeleton (0), unlumen shimmer (1), foundations/skeletons (2), data-table-skeleton (0), arc/skeleton (5), light-page-skeleton · **ui/skeleton** para forma livre (re-skin com a cor/pulso do Arc) + **arc/skeleton** para blocos de texto · ds,… |
| Segmentado / abas | ui/tabs (17, 4 variantes), ds-tabs (2), ds-segmented-control (7), base/segmented-control (0), route-section-tabs (3), foundations/page-tabs (3), toggle-group (0), arc/segmented-control (13) · **arc/segmented-control** para escolha de 2 a 5 filtros; **ui/tabs… |
| Modal / painel | ui/dialog (60), ds-dialog (1), ui/sheet (31), ds-sheet (1), ui/drawer (2), foundations/detail-drawer (5), arc/bottom-sheet (23) · **ui/dialog** (confirmação curta), **ui/sheet** lado direito no desktop, **arc/bottom-sheet** no celular. detail-drawer e confirm… |
| Badge / status | ui/badge (172), animated-badge (4), ds-pill-badge (0), ds-status-badge (6), foundations/status-badge (1), status-badges (17, domínio), base/badges (0), arc/badge (23) · **ui/badge re-skinado** (motor animated-badge); status-badges segue como camada de domínio… |
| Campo de texto | ui/input (130), ds-input-field (3), base/input (0), arc/input (11) · **ui/input re-skinado** (máscaras) · ds, base (D) |
| Switch | ui/switch (19), ds-switch (1), arc/switch (5) · **arc/switch** (B) ou ui/switch re-skinado · ds (D) |
| Contagem animada | motion/count-up (2), ds-count-up (2), arc/animated-counter (3) · **motion/count-up** no diretor · ds (D) |
| Tooltip | ui/tooltip (16), info-tooltip (1), motion/tooltip (1), base/tooltip (0) · **ui/tooltip** · motion/base (D) |
| Callout | context-note (4), ds-callout (0) · **context-note** · ds (D) |
| Barra de filtro | foundations/filter-bar (2), ui/filter-toolbar (1) · **foundations/filter-bar** · filter-toolbar (D) |
| Tabela | ui/table + ui/data-table/*, components/data-table/* (dice-ui), base/table · **ui/table + ui/data-table** · dice-ui parcial e base (D) |
| Gráfico | ui/chart, ds-bar-chart, ds-donut-chart, dashboard/* · **ui/chart** · ds (D) |
| Avatar | ui/avatar (4), user-avatar (13), base/avatar (0), arc/avatar (16) · **arc/avatar** via adaptador no user-avatar · base (D) |
| ui/dialog.tsx | Base UI Dialog · DialogPortal (16-17), usado em DialogPopup (44) · classe no DialogPrimitive.Popup (47) **e** no Backdrop (27) para o véu usar --foreground Lite; ou container no DialogPortal |
| ui/sheet.tsx | Base UI Dialog · SheetPortal (22-23), em SheetContent (50) · classe no Popup (53) e no Backdrop (29) |
| ui/drawer.tsx | Base UI Drawer · DrawerPortal (59-60, 110) · classe no Popup (120); mas aposentar (D) |
| ui/popover.tsx | Base UI Popover · PopoverPrimitive.Portal (29) direto, sem prop de container · classe no PopoverPrimitive.Popup (38) |
| ui/dropdown-menu.tsx | Base UI Menu · MenuPrimitive.Portal (34) e SubContent (161) · classe no Popup (43) e no SubContent (161) |
| ui/select.tsx | motion custom · motion/select.tsx:324-353 createPortal(..., document.body); idem select-morph · trocar o alvo do createPortal pelo container escopado, ou classe no div do listbox (344) |
| ui/tooltip.tsx | Base UI Tooltip · TooltipPrimitive.Portal (55), Positioner isolate z-50 · classe no Popup (64); o Arrow usa bg-popover e herda |
| ui/command.tsx | cmdk dentro de DialogPopup · herda do ui/dialog · resolve junto com dialog (e é D) |
| ui/combobox.tsx | usa ui/popover · herda do popover · resolve junto com popover |
| ui/sonner.tsx | Sonner · **não é portal**: o <section> renderiza onde o <Toaster/> está (layout.tsx:115, fora do shell) · adicionar arc-venancor ao className do Toaster (hoje "ct-toaster", linha 15) quando o modo for Lite, ou ao className do AnimatedToast (43) |
| motion/attachment-upload.tsx | createPortal próprio · body · classe no nó do portal (ou B para arc/file-dropzone) |
| ui/sortable.tsx | createPortal (DragOverlay) · body · morto (D) |
| foundations/confirm-dialog, detail-drawer, bulk-*-dialog | usam dialog/sheet · herdam · nada a fazer |
| arc/bottom-sheet | Radix Dialog Portal (bottom-sheet.tsx:100) · body · já padronizado: chamador passa className="arc-venancor". Sugestão: embutir a classe no próprio componente para parar de repetir |

## 5. Código morto ou órfão (não converter)

| Arquivo | Origem | Motivo |
|---|---|---|
| `(d)/equipe/team-invite-form.tsx` | inv-rotas-b §2.1 | Nenhum import. Substituído por TeamInviteLiteSheet. |
| components/corretop-sidebar: `corretor-sidebar.tsx`, `workspace-rail.tsx`, `quick-actions-menu.tsx` | inv-shell §0 | Sem import; só usados pelo rail morto. |
| `app-page-header.tsx`, `ui/page-header.tsx`, `ui/breadcrumb.tsx` | inv-shell §0 | Sem import. |
| `degraded-state.tsx`, `loading/app-boot-loader.tsx`, `onboarding/onboarding-checklist.tsx`, `onboarding-help-button` | inv-shell §0 | Sem import. |
| `corretop-financeiro-sidebar.tsx` | inv-shell §0 | Sem import (morto). |
| `qualificacao/_components/situational-playbooks-panel.tsx` (605 linhas) | inv-rotas-c §15 | Não importado por nenhuma rota. |
| `settings/_components/ai-settings-tab.tsx` (297 linhas) | inv-rotas-c §1 | Não renderizado por rota. |
| `settings/_components/waha-connections-card.tsx` (395 linhas) | inv-rotas-c §1 | Não renderizado por rota. |
| `features/ai-qualification/.../followup-rules-panel.tsx` | inv-rotas-c §5 | Órfão; lógica duplicada inline na aba. |
| `features/workflow-automation/.../workflow-automation-studio.tsx` (1134 linhas) | inv-rotas-c §7 | Órfão; canvas próprio sem rota. |
| `features/automations/.../automations-client.tsx` (464 linhas), `ai-agent-wizard-client.tsx` (320 linhas) | inv-rotas-c §7 | Órfãos. |
| `integrations/whats_alt/_components/tenant-channel-routing-card.tsx` (178 linhas) | inv-rotas-c §3.3 | Órfão confirmado (sem import fora do arquivo). |

Para cada um, o inventário diz não converter. A remoção é PR à parte, não parte do re-skin.

## 6. Riscos de segurança e escopo

Achados dos inventários, para checar antes de converter a tela. Não são mudanças de visual; são pontos que o re-skin não deve esconder.

| Rota | Risco | Evidência | Ação sugerida |
|---|---|---|---|
| /distribuicao | Gestor entra sem o bloqueio que existe em /leads/distribuicao. | inv-rotas-b §2.17: `(d)/distribuicao/page.tsx` re-exporta `leads/distribuicao/page.tsx`; o `layout.tsx` que bloqueia gestor (`leads/distribuicao/layout.tsx:4-8`, `role === 'manager'`) não vale para /distribuicao. | Mover o bloqueio para o page de /distribuicao ou para um layout comum. Decidir antes da Onda 5. |
| /minha-fila | Fila pessoal do corretor sem gate de papel; diretor alcança. | inv-rotas-a, minha-fila/page.tsx:38 (722 linhas): sem gate de papel. | Bloquear por papel ou decidir com o Vinicios. Não converter antes dessa decisão. |
| /equipe/repassar | Supervisor com escopo de equipe; a página aceita qualquer audiência e não checa Lite. | inv-rotas-b §2.11: `(d)/equipe/repassar/page.tsx:16-42`. | Checar papel e escopo de equipe no servidor; visual Lite dentro do chrome Lite. |
| /plantoes/corretor/[brokerId] | Visual Lite dentro do chrome normal; escopo do brokerId a confirmar. | inv-rotas-b §2.21 (nota de riscos). | Confirmar que o brokerId é checado contra o tenant e a unidade no servidor. |
| /noc | Gate do servidor só bloqueia corretor; papel de gestor não confirmado. | inv-rotas-a, noc/page.tsx:12 (gate corretor). | Confirmar o gate para gestor e supervisor antes de converter. |
| /gestao, /gestao/equipes/[supervisorId], /unidades/[branchId] | Liberar o diretor exige escopo de tenant e de unidade no servidor. | inv-rotas-b §2.13 a §2.15 (diretor negado hoje). | Checar tenantId e unidade em cada query antes de liberar. |
| /integrations, /marketing, /qualificacao | Layouts bloqueiam gestor. Converter o visual não pode remover esse bloqueio. | inv-rotas-c §3, §4, §5 (layout.tsx:6). | Manter o bloqueio de gestor ao trocar o visual; checar depois da conversão. |
| /unidades/[branchId] | loading.tsx em Lite serve a todos os papéis, inclusive quem não deveria ver o perfil. | inv-rotas-b, nota de riscos. | Alinhar loading e page no mesmo gate. |
| /equipe/[id] | Diretor sem visão Lite de não corretor cai em not-found (decisão de produto, não bug). | inv-rotas-b §2.2. | Decidir o que o diretor vê no perfil de gestor e supervisor. |
| /dev e /dev-preview | 27 páginas de showcase. Em src/app/dev, 26 de 26 páginas chamam notFound(); a condição lida em agenda/page.tsx:23 é NODE_ENV diferente de development. dev-preview/placar não foi verificada. | Busca em src/app/dev e leitura de agenda/page.tsx:23. | Nenhuma ação para o modo diretor; confirmar que o build de produção não expõe as duas pastas. |
| Todo o modo diretor | Botão shadcn tem 30 a 36px; alvo menor que 44px em toda rota que usa `ui/button`. | inv-rotas-b §0 (button-variants.ts:26-35). | Trocar por Arc Button (sm = 44px no escopo Lite) na F1. |

## 7. Conferência

### 7.1 Rotas e componentes por onda

| Onda | Rotas (as 92 do repo) | Componentes | Rotas sem linha de componente (nada a fazer ou só redirect) |
|---|---|---|---|
| 1 | 15 | 48 | 0 |
| 2 | 8 | 100 | 0 |
| 3 | 12 | 49 | 0 |
| 4 | 16 | 83 | 1 |
| 5 | 7 | 114 | 1 |
| 6 | 18 | 71 | 7 |
| 7 | 6 | 14 | 2 |
| 8 | 10 | 40 | 2 |
| **Total** | **92** | **519** | |

Fora da conta de 92 (no repo, mas fora do modo diretor): 7 rotas de `(auth)` e 10 públicas e erros, contados na Onda 8; 20 de `(platform-admin)` e 27 de `/dev`/`/dev-preview`, fora do plano (seção 7.3).

### 7.2 Cobertura dos inventários

| Fonte | Linhas de componente | Onde está no plano |
|---|---|---|
| inv-rotas-a.md (rotas) | 254 | Seções 2 (ondas) |
| inv-rotas-b.md (rotas) | 140 | Seções 2 (ondas) |
| inv-rotas-c.md (rotas) | 125 | Seções 2 (ondas) |
| Transversal (A §3 e §4, B §1, C §0) | 217 | Seção 4 |
| inv-shell.md | 33 | Anexo A |
| inv-primitivas.md | 250 | Anexo B |
| inv-cinzel.md | 1 total por pasta (não por componente) | Coluna Cinzel de cada rota, e 7.4 |
| inv-alvo-lite.md | não é lista de componentes; é o alvo do design Lite | Usado como referência da seção 0 e dos critérios |

### 7.3 Não inventariado nem convertido

| Grupo | Rotas | Motivo |
|---|---|---|
| `(platform-admin)` (super-admin, super-dev) | 20 | Não é modo diretor. Fora deste plano. |
| `/dev` e `/dev-preview` | 27 | Showcase de desenvolvimento. Em `/dev`, bloqueadas por NODE_ENV (verificado em 26 páginas). Sem inventário. |
| `/settings/integrations`, `/settings/meta`, `/settings/whatsapp`, `/marketing`, `/marketing/meta`, `/integrations/whats_alt` | 6 | Redirects. Nada a fazer. |

### 7.4 Desvios: total do Cinzel e onde estão

- Total de sinais no Cinzel: 5357 em 483 de 825 arquivos (`inv-cinzel.md`).
- Maiores pastas de rota: `/leads` (525), `/conversas` (268), `/qualificacao` (212), `/leads/distribuicao` (161), `/leads/[id]` (157), `/settings` (153), `/assistente` (130), `/leads/distribuicao/plantao` (114), `/relatorios` (91), `/propostas` (75).
- Pastas que não são rota e pesam muito: `components` (raiz, 372), `components/ui` (305), `features/onboarding` (140), `features/automations` (139), `features/leads` (185). Essas são primitivas e features, cobertas pela F1 e pela F3 e pelas rotas que as usam.
- `/distribuicao` aparece com zero no Cinzel porque re-exporta `/leads/distribuicao`. Para as rotas com zero, o número real está nos inventários A e B.

### 7.5 Lacunas e decisões pendentes

- `leads/distribuicao` e `/distribuicao` são duas rotas com o mesmo conteúdo. Decidir se `/distribuicao` vira redirect para `/leads/distribuicao` antes da Onda 5.
- Decisão de escopo para `/minha-fila`, `/equipe/desempenho`, `/gestao` e `/gestao/equipes`: liberar para o diretor ou não.
- `clientes` foi para a Onda 1 conforme a revisão (LightClientsList com management); filtro de filial e paginação a conferir antes da entrega.

