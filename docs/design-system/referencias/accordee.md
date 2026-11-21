# Referência: Accordee (demo público)

Fonte: `https://demo.accordee.app` (demo com dados de exemplo, sem login), analisado em 21/11/2026 pelo navegador
embutido, em 1440×900. Medidas tiradas do DOM (`getComputedStyle`) e das variáveis CSS do próprio demo. Prints em
`side-session-notes/.../accordee-prints/` (demo-home, demo-messages, demo-inbox, demo-leads, demo-lead-detalhe e o
antes/depois do AncoraHub).

Pedido do Vinicios: converter a Home (Início do diretor) e a Inbox (Conversas) para este estilo, "1:1", com a
sidebar junto, Inter como fonte e o modo escuro verificado.

## 1. Rotas analisadas

| Rota | Layout | O que vale levar |
|---|---|---|
| `/` (Ask Rune) | Saudação central, campo de pergunta grande, atalhos em chips, cartões "Recent chats" e apps sugeridos | Saudação curta sobre um único campo; atalhos como chips de 28px |
| `/home` (Dashboard) | Barra de 44px (ícone + título), barra de abas de 44px (Overview, Revenue…) com "Edit Cards" e "+ Add Card" à direita; grade de cartões: 4 números em cima, gráficos e listas embaixo | Números em cartões separados; cartão com cabeçalho de 44px e hairline; link do cabeçalho neutro com seta ("Contracts →") |
| `/inbox` | Abas com contagem (All 50, Messages 17, Money 6…) e lista densa de uma linha: ícone de tipo, título, detalhe em cinza, chip da entidade e hora | Uma linha por item, chip da entidade à direita, hora em `tabular-nums` |
| `/messages#TH-…` | Três áreas: sidebar, lista de conversas (359px) e conversa aberta | Ver §4 (é a base da Inbox do AncoraHub) |
| `/emails` | Lista de e-mails à esquerda, leitura à direita com cabeçalho do assunto e respostas empilhadas | Mesmo esqueleto da Inbox |
| `/meetings` | Calendário semanal + minicalendário e "Up next" à direita | Painel lateral com o próximo item |
| `/tasks` | Grade de cartões por grupo de data, prioridade em pílula | (no AncoraHub a regra é tabela, não grade) |
| `/notes`, `/documents`, `/workflows`, `/leads`, `/customers`, `/contracts`, `/network`, `/invoices`, `/balances`, `/transactions` | Mesma anatomia: abas-filtro com contagem, faixa de 2 a 4 números acima da tabela, tabela densa (linha ~36px, texto 13px, cabeçalho 12px cinza com ícone), rodapé "Calculate" por coluna | Confirma o padrão de tabela da skill `interface-enxuta` |
| `/leads/LD-1003`, `/contracts/CT-1021` | Ficha: coluna esquerda com nome, ações (Email, Task, Subscribe) e "Details" em pares rótulo/valor; direita com abas (Overview, Activities, Emails…) e cartões | Ficha em duas colunas, detalhes em pares |
| `/whiteboards`, `/apps`, `/settings/general` | Grade de miniaturas; catálogo de apps em cartões com rodapé; configurações em blocos rótulo à esquerda, controle à direita | Configurações em linhas rótulo/controle |

Nenhuma rota pediu login. Nada foi digitado no demo.

## 2. Fundações medidas

| Item | Demo | No AncoraHub (token existente) |
|---|---|---|
| Fonte | Inter em tudo; pesos 400 e 440 ("medium") | Inter (`--font-inter`, já no `design-system.md`). Peso 500 no lugar de 440 |
| Texto principal | `#09090b` | Midnight Ink `#0a0a0a` / `--foreground` do skin (`#09090b`) |
| Texto secundário | `#52525b` | Steel `#525252` |
| Texto apagado | `#71717a` | Fog `#737373` |
| Fundo da sidebar | `#fafafa` | Muted Alt Card `#fafafa` |
| Item ativo / hover | `#f0f0f1` / `#f4f4f5` | Paper Mist `#f5f5f5` |
| Borda | `rgba(0,0,0,.1)` (≈ `#e6e6e6` sobre branco) | Ash `#e5e5e5` |
| Azul de destaque (não lido, ponto) | `#3b82f6` | `--series-1` / Electric Blue |
| Ação primária | preto `#09090b`, texto branco | Primary Action Fill `#000000` (no diretor, a cor da marca do tenant segue) |
| Tamanhos | 11 (rótulo de grupo, caixa alta), 12 (caption), 13 (rótulo/lista), 14 (corpo de mensagem), 16 (título), 20, 24 (número) | Todos na escala Inter do documento |
| Alturas | controle 28px, botão 30px, controle grande 32px, barra 44px, barra de abas 48px | Escala de 4px: 28, 32, 44, 48 |
| Raios | chip 4, botão/controle 6, cartão 8, painel/compositor 12, popover 10 | Ver "Decisões pendentes" |
| Sombra | só `0 1px 2px rgba(0,0,0,.05)` no painel principal e nos botões | `--shadow-subtle` |
| Movimento | `cubic-bezier(.16,1,.3,1)`; 150/200/240/280/300ms; mensagens entram com `slide-up` 280ms | `motion-tokens.ts` já tem curva e durações equivalentes |
| Escuro | `#0a0a0a` fundo, `#171717` painel, texto `#fafafa`/`#a3a3a3`, borda `rgba(255,255,255,.1)` | Tabela "Dark Mode" do `design-system.md` (`#151515`, `#1c1c1c`, `#252525`, `#2a2a2a`…) |

## 3. Moldura (sidebar e topo)

- **Sidebar** de 204px (menu de 180px + 12px de cada lado), fundo `#fafafa`, borda direita hairline.
  Topo: logo de 20px + nome da empresa em 13px/440 + seletor ▾ e botão de recolher. Busca de 28px com `⌘K`.
  Itens de 28px, ícone de 16px, rótulo de 13px em cinza secundário, contagem à direita em 14px; ativo com fundo
  `#f0f0f1` e texto principal. Grupos ("Your Space ▾", "Company ▾") em 12px Fog, recolhíveis. Rodapé: perfil em 32px.
- **Área principal** é um painel branco com borda 1px, raio 8px e sombra sutil, solto 8px da borda da janela sobre o
  fundo da sidebar. Por isso a tela parece "uma folha" sobre a moldura.
- **Topo** de 44px com hairline: ícone + título em 13px/440 à esquerda; à direita "Quick Chat", avatares e ajuda em
  controles de 28px.
- **Abas** de 28px sem trilho; a ativa ganha fundo `#f4f4f5` e peso 440. Grupo de período (3M/6M/12M) num trilho com
  borda, itens de 22px, ativo em `#f4f4f5`.

## 4. Messages (base da Inbox)

- **Lista** (359px): barra de 44px com "All 68 · Unread 17" (botões de 28px, ativo com borda e fundo `#f4f4f5`) e
  "New Message". Busca de 32px com borda e "Sort". Grupos por data ("TODAY", "YESTERDAY") em 11px/440, caixa alta,
  `tracking .04em`, fixos no topo ao rolar (fundo branco 95% com desfoque).
- **Linha da conversa**: `px 16 / py 12`, borda inferior hairline, avatar de 32px; linha 1 nome 13px/440 + empresa em
  12px Fog + hora 12px Fog à direita; linha 2 assunto 13px secundário; linha 3 prévia 12px Fog numa linha e ponto azul
  de 8px quando não lido. Selecionada: fundo `#f4f4f5`. **Hover**: a hora some e aparece `⋯` no lugar.
- **Conversa aberta**: topo de 44px com avatar 20px, nome, assunto em cinza e chips da entidade à direita (24px, borda,
  raio 6). Mensagens **sem balão**: avatar 32px, nome 13px/440 + hora 12px Fog, texto 14px/24px; hover da linha em
  `#f4f4f5` a 50%. Separador de dia: pílula central com borda ("Yesterday", "Today").
- **Compositor**: cartão de raio 12 com borda e sombra leve, campo de 14px/28px que cresce até 200px, barra de baixo com
  `+`, `@`, canal ("Message ▾") e rascunho; enviar em botão quadrado escuro de 28px à direita.
- **Começo da conversa**: título "Chat with …" em 16px/440, uma frase de contexto e ações em cartões lavados (tarefa,
  documento, ligação), cada um com ícone, título e uma linha.

## 5. Como cada padrão cabe nos tokens

| Padrão | Cabe? | Como |
|---|---|---|
| Inter em tudo | Sim | `--font-inter` no layout; Satoshi segue só em 36px+ |
| Sidebar `#fafafa`, ativo cinza | Sim | Muted Alt Card + Paper Mist. Diverge da regra "Sidebar Nav Item ativo em Powder Blue": adotado o cinza do demo a pedido ("1:1") |
| Linhas e controles de 28px | Sim, com mouse | `--spacing-28`; no toque continua 44px (regra de área de toque do Lite) |
| Painel principal com borda e sombra sutil | Sim | Ash + `--shadow-subtle`, raio 12 (cartão) |
| Cabeçalho de cartão de 44px com hairline | Sim | Ash, padding 16 |
| Números em 24px/400 | Sim | Inter 24px; a skill pedia 600, o demo usa 400 (adotado 400) |
| Mensagem sem balão | Sim | Só layout |
| Ponto azul de não lido | Sim | `--series-1` |
| Grupos de data fixos com desfoque | Sim | fundo `--surface` a 95% |
| Modo escuro | Sim | tabela "Dark Mode" do documento |

## 6. Decisões pendentes (token novo: precisa de aprovação)

1. **Raio de cartão 8px e de botão 6px** (demo) contra 12px e 8px (tokens). **Aprovado pelo Vinicios em 21/11/2026 para
   o modo diretor**: `--radius-card: 8px` e botões com 6px em `director-accordee.css`. Pílula segue para status e contagem.
2. **Peso 440** (o "medium" do demo) contra 500. Mantido 500.
3. **Cinza zinco** (`#09090b`, `#52525b`, `#71717a`, `#f4f4f5`) contra o neutro do documento (`#0a0a0a`, `#525252`,
   `#737373`, `#f5f5f5`). Diferença invisível a olho; mantido o documento.
4. **Borda translúcida** `rgba(0,0,0,.1)` contra Ash sólido. Mantido Ash.

## 7. O que entrou no AncoraHub (21/11/2026)

- `src/components/arc/director-accordee.css`: moldura do diretor (sidebar, painel principal, topo de 44px, controles
  de 28px com mouse) e o **tema escuro do diretor**, que antes não existia (a tela ficava branca com a sidebar ilegível).
- Inter como fonte do app (`layout.tsx`, `globals.css`, `venancor-scope.css`).
- Início (Visão da operação): números em cartões, painéis com cabeçalho de 44px, abas e período no padrão do demo.
  Mesmo conteúdo e ações.
- Abas de seção (`route-tabs`) no padrão de 28px com mouse.
- Conversas (Inbox do diretor), no padrão do §4: lista, conversa e perfil numa folha só com hairlines; linhas da
  lista de borda a borda (12/16, selecionada em Paper Mist); mensagens sem balão (rótulo + hora numa linha, texto
  14/24); separador de dia em pílula com borda; compositor em cartão de raio 12. Mesmas ações e informações.
  No toque, alvos de 44px mantidos.
- Laboratório: `/dev/laboratorio` → "Estilo Accordee", com Início/Conversas e o interruptor de modo escuro.

- Segunda rodada (21/11/2026): grupos por data na lista ("Hoje", "Ontem", "Esta semana", "Mais antigas", fixos ao
  rolar); topo da conversa numa linha de 44px (com o perfil aberto ao lado, telefone, dono e status de qualificação
  ficam só no perfil, sem repetir; botão de tags só com ícone com mouse); perfil em pares rótulo/valor com hairline,
  sem caixas cinza; mensagens enviadas com avatar da equipe (pessoa) ou da IA (brilho), ao lado do rótulo.

- Terceira rodada (21/11/2026): fala da equipe/IA num bloco em Paper Mist com barra de 2px à esquerda, fala do
  cliente solta no branco; nada cortado na coluna estreita (topo esconde telefone/status inteiros por container query,
  lista com 320px entre 1024 e 1279px, abas e selos quebram linha, nome do cliente antes do nome do corretor).

## 8. Fica para depois

- A hora que vira `⋯` no hover da linha (demo) pede um menu de ações por conversa que a lista ainda não tem.
