# Prévia do painel do diretor no padrão Lite

Rota: `/dev/diretor-dashboard-preview` (só em desenvolvimento, sem banco).
Parâmetros para print: `?tab=overview|quality|funnel`, `&estado=ready|loading|empty|error|off`, `&vista=simples|detalhada`, `&drill=out-of-sla` (abre o drill ao carregar).

## Mapeamento: bloco antigo para bloco novo

### Moldura e navegação
| Antigo | Novo |
|---|---|
| `CorretopSidebar` (13 itens em 5 seções, ícones coloridos, "Área de Plantão" verde, "Agente IA", perfil, "Ver como") | `LiteSidebar` com os mesmos itens, ordem e seções, ícones lucide monocromáticos, item ativo em pílula branca (`layoutId`), "Beta" e ponto do WhatsApp mantidos, plantão e Agente IA como linhas neutras com ponto `--success`, recolher (Ctrl+B) |
| Drawer do celular | `LiteDrawer` (esquerda, abaixo de 1024px), Esc fecha e devolve o foco |
| `DashboardHeader` (breadcrumb com a data, título "Olá, nome") | `LiteHeader` no estilo `LightAppHeader` (menu, título "Painel", buscar Ctrl+K, notificações com contador, ajuda, avatar; ganha borda ao rolar) + título da página "Olá, nome" e a data no subtítulo |
| `DashboardSectionTabs` (Visão da operação, Qualidade dos leads, Funil de qualificação) | `LitePills kind="tabs"` com pílula deslizante; mesmas 3 abas e mesma regra (somem com a central desligada); a aba vai para `?tab=` |
| Período: não existia na visão da operação; `PeriodSelect` na qualidade; links 7/30/90 no funil | Um controle de período no topo, com as opções de cada aba: visão (Hoje, 7, 30 dias, novo), qualidade (Hoje, 3, 7, 14, 30, 90 dias), funil (7, 30, 90 dias) |
| Unidade: não existia (o escopo vinha do papel) | `LitePick` "Unidade" (Todas, Centro, Nova Iguaçu, Barra da Tijuca): popover no desktop, BottomSheet no celular (novo, pedido do diretor) |

### Visão da operação (`CommandCenter`)
| Antigo | Novo |
|---|---|
| `LeadSearch` + "Novo lead" | Busca em pílula 48px + botão principal índigo "Novo lead" (no celular vira só o ícone com o texto acessível) |
| `TodayNumbers` (4 números desde 19h, "Pede ação", ação de cada número) | Cartão com 4 blocos cinza (`LiteNumber` odômetro, `LiteDelta` "Pede ação" entra 80ms depois, ação com seta). "Aguardando" e "Sem 1º contato" ficam "agora" em qualquer período |
| `Shortcuts` (Plantão agora ou Plantões, Escala do mês, Conversas, Nova cotação, Vendas, Convidar corretor, Relatórios) | Chips de 44px com os mesmos 7 atalhos; "Relatórios" troca para a aba de qualidade (ou vai para /relatorios com a central desligada) |
| `QueuesToday` (fila, cor da fila, aguardando, barra, número no turno) | "Leads do turno por fila": ponto e barra na paleta `--series-*` (a cor crua da fila sai), barra cresce com `scaleX`, "N aguardando" em pílula de aviso |
| `RecentLeadsCard` (tabela chegada, contato, etapa, unidade) | "Leads recentes" em linhas de 56px; unidade some abaixo de 768px; lead novo em tempo real entra no topo com destaque único |
| `DutiesNow` (plantões agora ou próximo, horário, corretores/mínimo) | "Plantões agora" com ponto ao vivo, fila do plantão, pílula `14/12` (aviso quando abaixo do mínimo) |
| `WhatsAppActivityCard` (respostas no WhatsApp por corretor, 7 dias, link para as conversas do corretor) | "Respostas no WhatsApp": total grande, corretores conectados e a lista de conversas ativas por corretor em grade (12 e "Ver todos"), barra por corretor, mesmo link `/conversas?tab=leads&brokerId=...&respondeu=7d` |
| `BrokersWhatsAppReadiness` (conectaram, não conectaram, % e lista de quem falta) | "WhatsApp dos corretores": 2 blocos, barra de progresso `--success` com `role=progressbar`, lista de quem falta e "e mais N" |
| `AttentionGrid` (4 pendências com link para `/dashboard/drill/[id]`) ou "Nenhuma pendência" | "Precisam de atenção": 4 blocos que abrem o drill no painel lateral; vazio com `EmptyState` "Nada pendente" |

### Drills (`/dashboard/drill/[drillId]`)
| Antigo | Novo |
|---|---|
| Página com título, explicação, total, tabela de corretores (ativos, capacidade, excedente) e tabela de leads (nome, status, corretor, unidade, criado em), "Exibindo x de y", voltar | `LiteLayer`: painel lateral à direita no desktop (x 24px, `spring.smooth`) e BottomSheet no celular, com explicação em pt-BR sem código cru, total, corretores com excedente em pílula, leads em lista com status, corretor, unidade, data e latência; "Abrir a página completa" mantém a rota antiga |

### Qualidade dos leads (`LeadQualityCenter` + `LeadQualitySimple`)
| Antigo | Novo |
|---|---|
| Filtros do cabeçalho: período, intervalo, fila, exportar | Período no topo; na aba: vista Simples ou Detalhada (pílula), `LitePick` de fila, "Intervalo" e "Exportar" abrem o painel lateral (o exportar mantém período, fila, origem, PDF e Excel) |
| Simples 1: entraram, bons, frios, descartados | 4 blocos cinza com odômetro |
| Simples 2: tabela por fila (8 colunas) | Mesma tabela; no celular vira lista com rótulo e valor |
| Simples 3: hora a hora (texto de quando os bons acabaram, tabela, aviso de inversão) | Gráfico de colunas bons x frios por hora (cresce com `scaleY`, hora em que os bons acabaram marcada em `--warning-subtle`), a tabela completa em "Ver hora a hora em tabela", aviso de inversão mantido |
| Simples 4: e se não mandasse os frios (3 números, 2 turnos, vendas de frios e bons) | 3 blocos, 2 cartões de turno e a nota de vendas |
| "Ver a análise detalhada" | Botão que troca a vista com `LiteSwap` |
| Detalhada: intro com gradiente, 4 métricas com gradiente, temperatura, coorte (4 números e tempo médio de 1º contato), turnos 1 e 2, 13 tabelas de recorte em 4 seções, mapa de calor, rodapé | Intro sem gradiente, 4 blocos cinza, barra empilhada de temperatura (quente `--danger`, morno `--warning`, frio `--series-1`), coorte em blocos, turnos, as 13 tabelas com barra de volume por linha, mapa de calor (7 x 24, células em tons de `--primary`), rodapé único com as notas que se repetiam em cada tabela |
| Recorte ativo (`FocusBanner`) + "Leads deste recorte" (`FocusedLeads`) navegando por URL | Tocar numa linha de qualquer tabela ou numa célula do mapa abre o painel com o recorte ativo, quentes/mornos, convertidos e a lista dos leads (status e temperatura) |
| "Central temporariamente indisponível" | `QualityDisabled` com `EmptyState` (estado "Central desligada" da prévia) |
| "Nenhum lead neste período" (simples e detalhada) | `EmptyState` (estado "Vazio") |

### Funil de qualificação (`QualificationFunnelView`)

A prévia fornece dados sintéticos tipados por `buildFunnel`; o adaptador `FunnelTab` os encaminha ao componente compartilhado `src/features/dashboard/components/director-lite/qualification-funnel-view.tsx`.
| Antigo | Novo |
|---|---|
| 4 `StatCard` (chegaram, responderam % com mediana, qualificados %, vendas) | 4 blocos cinza com odômetro (% anima entre períodos) |
| "Do anúncio à venda" (8 etapas, % da etapa, mensagens não entregues) | Barras que se desenham em cascata de 30ms; no celular o rótulo fica sobre a barra |
| "Onde os leads estão agora" | Lista com dica de cada situação |
| "Testes da primeira mensagem" (enviadas, % de resposta com intervalo, qualificados) | Mesma tabela; o intervalo de confiança vira uma faixa com o ponto da taxa |
| "Qual mensagem trouxe a resposta" | Barras por toque com enviadas e respostas |
| "Por que os leads foram perdidos" | Barras neutras por motivo |
| "Custo na Meta" (total, marketing, utilidade, por qualificado; real ou estimado) | Blocos em R$; com uma unidade escolhida o custo some com a explicação (o tipo já diz que é só da empresa toda) |

## O que é dinâmico
- Período e unidade: os números mudam pelo odômetro (sem piscar para skeleton); as barras transitam do valor antigo para o novo com `scaleX` de origem fixa à esquerda (transição CSS nos tokens; o tamanho fica certo mesmo com o motion desligado).
- Sidebar: só a lista do menu rola quando a janela é baixa; marca, atalhos do topo e rodapé ficam fixos.
- Mapa de calor no celular: um dia por vez (pílulas Dom a Sáb, começa no dia com mais leads) e as 24 horas numa grade 6 x 4 de alvos de 44px, sem rolagem horizontal.
- Entrada: página com fade e y 8px; blocos em cascata de 35ms (máx. 8); cartões e gráficos entram ao rolar até a vista.
- Tempo real: a cada 8s chega um lead (contagem anima com anel único, linha entra no topo, sino com contador); a cada 3 leads um sai da fila para um corretor. Pausa com painel aberto, aba oculta ou fora da visão da operação. Anunciado em `aria-live`.
- Abas e segmentos com pílula deslizante (`spring.morph`); primeira visita de uma aba mostra o skeleton com o formato dela (600ms) e troca sem pulo de altura.
- Painel lateral, BottomSheet, popover de seleção com destaque deslizante, drawer do menu, botão de exportar com check desenhado.
- Seletor "Prévia" no canto: Normal, Carregando, Vazio, Erro (com "Tentar de novo" carregando no próprio botão) e Central desligada.
- Movimento reduzido (sistema ou `html[data-reduce-motion="1"]`): só opacidade, sem cascata, sem escala no toque.

## Limitações e o que precisa no código real
- Dados de exemplo tipados com `CommandCenterData`, `QualificationFunnel`, `LeadQualityReport`, `SimpleLeadQualityReportData` e `DrilldownResult` (imports só de tipo).
- Visão da operação com 7 e 30 dias e o filtro de unidade são novos: `getDashboardToday` e `getBrokerWhatsAppStatus` precisam aceitar janela e unidade.
- A moldura (sidebar e cabeçalho) é simulada só dentro da prévia; a real é a F2 do plano.
- Tokens criados no CSS module da prévia (`--series-1..6`, `--*-subtle`, `--shadow-one`, `--heat-*`) devem ir para o `director-skin.css` (C3).
