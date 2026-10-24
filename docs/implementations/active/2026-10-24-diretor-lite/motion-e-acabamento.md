# Movimento e acabamento do diretor Lite (padrão de ponta a ponta)

> Anexo do plano `2026-10-24-diretor-lite-redesign.md`. Pedido do Vinicios (24/10): "cuidado detalhista, animações profissionais de ponta a ponta".
> Vale para TODA tela, componente e camada flutuante do diretor. Uma tela só sai do opt-out quando cumpre este anexo inteiro.

## 1. Princípios
1. **O movimento explica, não enfeita.** Cada animação responde a uma pergunta: de onde isso veio, para onde foi, o que mudou, deu certo?
2. **Rápido no uso diário.** O diretor abre as mesmas telas dezenas de vezes por dia. Entradas curtas (até 240ms), nada que atrase o clique. Nenhuma animação bloqueia interação.
3. **Uma linguagem só.** Tudo sai de `src/components/arc/motion-tokens.ts` (JS) e das variáveis `--duration-*` e `--ease-*` (CSS). Constante local (`LITE_EASE`, `duration: 0.3`) é desvio.
4. **Física coerente.** O que entra sobe (y positivo para zero) e aparece; o que sai é mais rápido que o que entra (`exit` 180ms contra `standard` 240ms); o que já está na tela e muda de lugar usa mola sem quique (`spring.smooth`); destaque compartilhado usa `spring.morph`.
5. **Só transform e opacity.** Nunca animar width, height, top, left ou box-shadow em lista. Altura que muda usa `layout` do motion ou `grid-template-rows: 0fr para 1fr`.
6. **Movimento reduzido é cidadão de primeira.** Com `prefers-reduced-motion` ou `html[data-reduce-motion="1"]`: só opacidade (até 120ms); contadores mostram o número final; nada de cascata, mola ou deslocamento.
7. **60 fps no notebook do diretor.** Cascata limitada a 8 itens; lista longa anima só o que está visível; `will-change` só durante a animação.

## 2. Tokens (fonte única)
| Token | Valor | Uso |
|---|---|---|
| `duration.instant` | 120ms | hover, troca de cor, opacidade de ícone, movimento reduzido |
| `duration.fast` | 160ms | toque, abrir menu e tooltip, chip |
| `duration.exit` | 180ms | tudo que sai |
| `duration.standard` | 240ms | entrada de página, cartão, modal, painel |
| `duration.considered` | 480ms | gráfico se desenhando, barra de meta, sucesso |
| `ease.enter` | (.16,1,.3,1) | entradas |
| `ease.exit` | (.7,0,.84,0) | saídas |
| `ease.standard` | (.22,1,.36,1) | mudanças de estado |
| `ease.inOut` | (.65,0,.35,1) | algo já na tela que se move de um ponto a outro |
| `spring.snappy` | 0.26s, bounce .12 | toque, switch, checkbox, indicador pequeno |
| `spring.smooth` | 0.4s, bounce 0 | painéis, altura, reordenar |
| `spring.morph` | 0.42s, bounce .16 | pílula de aba e filtro, destaque do menu, largura que acompanha texto |
| `stagger.item` | 35ms | cascata de linhas e cartões (máx. 8 itens = 280ms) |
| `blur.soft` | 4px | só no título da página, uma vez por navegação. Números e textos trocam só com opacidade e y de 2px (blur animado em muitos números custa caro) |

Tokens novos a criar na F0 (no mesmo arquivo, com o par CSS):
- `distance`: `{ xs: 4, sm: 6, md: 8, lg: 12, sheet: 24 }` (px de deslocamento por tipo de elemento);
- `scale`: `{ pressButton: .97, pressRow: .99, pressCard: .985, popIn: .96 }`;
- `stagger.max: 8`.

## 3. Kit de movimento (componentes da F1b, em `src/components/lite/motion/`)
Todos com `useReducedMotion` embutido, testes e página no catálogo.
| Componente | Faz | Base |
|---|---|---|
| `LitePageEnter` | entrada da página: fade + y 8px, 240ms | já existe em `light/light-motion.tsx`; mover para o kit |
| `LiteStagger` / `LiteStaggerItem` | cascata de filhos (35ms, máx. 8; do 9º em diante entram juntos) | renomeia `LiteList` / `LiteListItem` de `light-motion.tsx`, com alias de compatibilidade |
| `LitePress` | escala de toque por tipo (botão, linha, cartão) | idem |
| `LiteReveal` | entra ao rolar até a vista (uma vez), y 12px | IntersectionObserver; do estudo Visor |
| `LiteSwap` | troca de conteúdo no mesmo lugar (carregando para pronto, aba A para B): sai com fade 120ms, entra com fade + y 4px | `AnimatePresence mode="popLayout"` |
| `LiteSkeletonToContent` | o skeleton se desfaz enquanto o conteúdo entra, sem pulo de altura (reserva a altura do skeleton) | `LiteSwap` + `min-height` |
| `LiteNumber` | número que muda: odômetro por dígito com `tabular-nums` (só `transform` e `opacity`, sem blur); formato pt-BR (milhar com ponto, moeda, %) | `arc/animated-counter` em pt-BR |
| `LiteDelta` | pílula de variação (+12%) que entra depois do número (80ms) | novo |
| `LiteHighlight` | destaque compartilhado (pílula ativa de menu, aba, filtro, linha selecionada) | `layoutId` + `spring.morph` |
| `LiteCollapse` | abrir e fechar altura (seção, linha expandida, filtro avançado) | `grid-template-rows` ou `layout` |
| `LiteListPresence` | linha que entra (y -4px + fade) e sai (fade + espaço fechando com `grid-template-rows` de 1fr para 0fr, 180ms); reordenar com `layout` | `AnimatePresence` + `layout` |
| `LiteSuccess` | confirmação: ícone de check que se desenha (`pathLength` 0 para 1, 320ms) + texto | novo |
| `LiteProgress` | barra que cresce com `scaleX` a partir da esquerda (origem fixa), 480ms | novo |
| `LiteDrawLine` | linha de gráfico e sparkline que se desenha (`pathLength`), 480ms | do estudo Visor |
| `LiteAttention` | pulso único (não infinito) para chamar atenção a algo que mudou: pseudo-elemento de 2px atrás do item, animado só com `transform: scale` (1 para 1,04) e `opacity` (0,5 para 0), 600ms, uma vez | novo; substitui `animate-pulse` |

## 4. Coreografia por componente
| Componente | Entrada | Interação | Saída / mudança |
|---|---|---|---|
| Botão | nenhuma | hover: fundo muda em 120ms; toque: scale .97 com `spring.snappy`; carregando: rótulo vira spinner com `LiteSwap`, largura acompanha com `spring.morph` (sem pulo) | sucesso: `LiteSuccess` por 1,2s e volta |
| Link e botão fantasma | nenhuma | sublinhado ou fundo em 120ms | |
| Campo de texto | nenhuma | foco: borda e anel em 120ms; erro: borda `--danger` + mensagem entra com `LiteCollapse` (sem tremer) | erro corrigido: mensagem sai com fade |
| Select, combobox, menu | popover: opacity + scale .96 para 1 + y 4px, 160ms, origem no gatilho | item em foco: fundo `--surface-muted` com `LiteHighlight` deslizando entre itens | fecha em 120ms; no celular vira BottomSheet |
| Tooltip | atraso de 400ms na primeira vez e 0 nas seguintes (modo "aquecido" por 600ms); fade + y 2px, 120ms | | fade 80ms |
| Checkbox e switch | | check se desenha (`pathLength`) e polegar com `spring.snappy` | |
| Abas e segmentos | | pílula ativa desliza (`LiteHighlight`); conteúdo troca com `LiteSwap` (direção da aba: y 4px, sem deslizar lateral longo) | |
| Chips de filtro | chip novo entra com scale .96 + fade | remover: chip sai e os vizinhos fecham o espaço com `layout` | contagem do resultado muda com `LiteNumber` |
| Cartão | cascata na entrada da página | hover no desktop: sobe 1px e a sombra fica no mesmo token; toque: scale .985 | |
| Bloco de número (KPI) | número conta de 0 só na primeira carga da sessão; depois só anima a diferença | | mudança por tempo real: `LiteNumber` + `LiteAttention` uma vez |
| Tabela e lista | cascata das 8 primeiras linhas | hover: fundo `--surface-muted` 120ms; seleção: fundo `--accent-subtle` + check; ordenar: linhas reordenam com `layout` (`spring.smooth`) | linha nova por tempo real entra no topo com `LiteListPresence` + `LiteAttention`; linha removida colapsa |
| Barra de lote | sobe de baixo (y 16px + fade, `spring.smooth`) quando o 1º item é marcado | contagem com `LiteNumber` | desce quando a seleção zera |
| Kanban | colunas em cascata | arrastar: cartão levanta (scale 1.02 + sombra floating), os outros abrem espaço com `layout`; soltar: assenta com `spring.smooth`; teclado: espaço pega, setas movem, espaço solta, com anúncio para leitor de tela | contagem da coluna com `LiteNumber` |
| Modal (dialog) | véu fade 160ms; painel opacity + scale .96 para 1 + y 8px, 240ms | foco vai para o primeiro campo; em confirmação destrutiva, para o botão de cancelar | sai em 180ms (scale .98); foco volta ao gatilho |
| Painel lateral (sheet desktop) | entra da direita x 24px + fade, `spring.smooth` | | sai em 180ms |
| BottomSheet (celular) | mola com detents (já pronto) | arrastar para fechar | |
| Toast | entra de baixo y 12px + fade, `spring.smooth`; empilhados reorganizam com `layout` | pausa com hover | sai em 180ms |
| Sidebar | itens do menu sem cascata (navegação é ferramenta, não vitrine) | item ativo: pílula desliza (`LiteHighlight`); recolher: coluna da sidebar em `grid-template-columns` com transição de 180ms (`ease.standard`) e rótulos com fade de 120ms; sem animar `width` | |
| Cabeçalho | | ao rolar: ganha borda inferior `--border` em 120ms (sem sombra) | título da página troca com `LiteSwap` na navegação |
| Notificações | painel como popover | nova notificação: sino com `LiteAttention` e badge com `LiteNumber` | marcar como lida: ponto some com fade |
| Gráfico | barras SVG crescem animando o atributo `height` e `y` de cada `rect` (não `scaleY`, que distorce o raio dos cantos), em cascata de 30ms; linhas com `LiteDrawLine`; pizza não está no catálogo, usar barras | hover: barra em foco, outras a 60% de opacidade; tooltip segue o ponteiro com `spring.snappy` | dado novo: transição entre valores, sem redesenhar do zero |
| Estado vazio | ilustração entra com fade + y 8px e a ação depois (80ms) | | |
| Carregando | `LiteSkeletonToContent`; brilho do skeleton 1,2s, só enquanto carrega | | |
| Erro de tela | `arc/empty-state` com fade; "Tentar de novo" mostra carregando no próprio botão | | |
| Navegação entre páginas | `LitePageEnter` no conteúdo; chrome parado; rola ao topo antes da entrada | | crossfade do `app-shell` (150ms) mantido |

## 5. Coreografia por tipo de tela (arquétipos)
| Arquétipo | Rotas exemplo | Sequência |
|---|---|---|
| Painel (dashboard) | `/dashboard`, `/noc`, `/vendas/dashboard`, `/equipe/dashboard` | 1) título; 2) blocos de número em cascata, cada número conta; 3) gráficos se desenham (480ms) quando entram na vista (`LiteReveal`); 4) listas abaixo com cascata. Troca de período: números e gráficos transicionam do valor antigo para o novo (sem piscar para skeleton se a troca for rápida; skeleton só depois de 300ms) |
| Lista com filtros | `/leads` lista, `/vendas`, `/equipe`, `/clientes`, `/documentos` | filtros fixos; linhas em cascata; aplicar filtro: lista faz `LiteSwap` e a contagem anima; paginação ou "carregar mais": novas linhas entram sem reanimar as antigas |
| Kanban | `/leads` | colunas em cascata; cartões em cascata por coluna (máx. 8); arrastar como na seção 4 |
| Detalhe | `/leads/[id]`, `/clientes/[id]`, `/vendas/[id]`, `/equipe/[id]` | cabeçalho com nome e status; seções em cascata; abas internas com `LiteHighlight`; ações abrem sheet; salvar mostra `LiteSuccess` no botão |
| Formulário longo e configuração | `/settings`, `/atendimento/*`, `/qualificacao` | seções com `LiteReveal`; campo inválido: rola até ele, foco nele, mensagem com `LiteCollapse`; salvar: barra de "alterações não salvas" sobe de baixo; salvo: `LiteSuccess` |
| Wizard | convite, escala mensal, Meta, template | passos trocam com `LiteSwap` na direção do passo (x 12px); indicador de passo com `LiteHighlight`; conclusão com `LiteSuccess` grande |
| Editor e grade | `/distribuicao` (escala, roteamento), cargos | sem cascata em grade grande; células mudam de cor em 120ms; salvar com barra de alterações |
| Conversa | `/conversas` | linhas em cascata (já no `ed0af666`); mensagem nova entra de baixo; trocar de conversa: painel com `LiteSwap`; painel do cliente entra da direita |
| Público e auth | login, 2FA, convite | cartão central com `LitePageEnter`; erro de senha com `LiteCollapse`; entrar: botão carregando e transição de saída (já em `login-transition`) |

## 6. Acabamento (o detalhe que separa o profissional)
### 6.1 Texto e números
- Números sempre `tabular-nums`; moeda `R$ 1.234,56`; % sem espaço (`12%`); milhar com ponto; datas relativas até 7 dias ("há 2 h", "ontem 14:30"), depois `dd/mm` e ano só se for outro.
- Plural certo em toda contagem ("1 lead", "2 leads", "nenhum lead"); zero vira frase ("Nenhum lead hoje").
- Nome longo trunca com reticências e mostra o nome inteiro no tooltip; nunca quebrar o layout.
- Títulos sem ponto final; frases de ajuda com ponto final; sentence case; sem travessão; pt-BR de colega.
- Erro diz o que aconteceu e o que fazer ("Não deu para salvar. Confira a conexão e tente de novo.").

### 6.2 Alinhamento e ritmo
- Grade de 4px; nenhum valor arbitrário (`p-[13px]`).
- Ícone alinhado opticamente ao texto (centro da altura x); ícone e texto com 8px de espaço.
- Cabeçalho de tabela alinhado à mesma coluna do conteúdo; números à direita, texto à esquerda.
- Mesma distância entre título e conteúdo em todas as telas (16px), entre seções (32px desktop, 24px celular).

### 6.3 Estados de todo controle
Todo controle tem e foi conferido: normal, hover, foco por teclado (contorno visível), pressionado, desabilitado (com motivo em tooltip quando não for óbvio), carregando e, quando couber, erro e sucesso.

### 6.4 Dados de borda
Cada tela é conferida com: zero itens, 1 item, muitos itens (200+), texto longo, número grande (R$ 1.234.567,89), sem permissão, offline ou erro do servidor, tempo real chegando enquanto o usuário rola.

### 6.5 Rolagem e camadas
- Sem sombra de rolagem; cabeçalho fixo ganha borda ao rolar.
- Tabela larga no desktop: cabeçalho fixo e primeira coluna fixa; no celular vira lista.
- Áreas seguras do celular (`env(safe-area-inset-*)`) em barras de baixo e sheets.
- z-index por camada documentada: conteúdo, cabeçalho fixo, sidebar, popover e menu, sheet e modal, toast, aviso dinâmico.

### 6.6 Acessibilidade junto do movimento
- Foco nunca se perde: abrir camada leva o foco para dentro; fechar devolve ao gatilho.
- Mudança feita por animação também é anunciada (`aria-live` em contagem de resultado, sucesso e erro).
- Nada pisca mais de 3 vezes por segundo; nenhum movimento infinito além do skeleton.

## 7. Orçamento de desempenho
- Entrada da página: conteúdo útil visível em até 240ms depois dos dados.
- Nenhuma tarefa longa (mais de 50ms) causada por animação; medir com o Performance do navegador em `/dashboard`, `/leads` e `/conversas` antes e depois.
- Listas com mais de 50 itens: animar só os visíveis.
- `motion` importado por componente cliente; telas de servidor não viram cliente só para animar (usar CSS `@keyframes rise` com `--i`, como o `people-list.module.css`).

## 8. Como conferir (entra no portão da seção 8 do plano)
1. Vídeo curto (gravação de tela) de cada tela nova: entrar, filtrar, abrir uma camada, salvar, voltar.
2. O mesmo com movimento reduzido ligado.
3. Revisor marca: alguma animação atrasou um clique? alguma constante fora dos tokens? alguma animação infinita? algum pulo de layout (CLS) na troca de skeleton para conteúdo?
4. Guarda-corpo (seção 9 do plano) também acusa `duration:` e `ease:` numéricos fora de `motion-tokens.ts`, `animate-pulse`, `animate-bounce`, `animate-spin` fora do spinner oficial, e `transition-all`.
