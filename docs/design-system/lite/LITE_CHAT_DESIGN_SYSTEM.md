# Design System "Conversa" (modo Lite) · v1.0

Status: **ATIVO no modo Lite (corretor)** desde 2026-10-09 · alvo: **adoção 1:1 no modo normal (diretor/gestor)**.
Dono: Vinicios. Registro feito a partir do código em produção da branch `feat/corretor-chat`; **o código é a fonte da verdade** e este documento descreve exatamente o que está nele. Se divergir, o código vence e este arquivo se corrige.

Fontes no código:

| Camada | Arquivo |
|---|---|
| Tokens base (Arc + mapeamento Venancor) | `src/components/arc/venancor-scope.css`, `src/components/arc/foundation.css` |
| Tokens de movimento (JS) | `src/components/arc/motion-tokens.ts` |
| Kit de chat (tokens próprios + componentes) | `src/components/chat/*` (`chat.module.css`, `chat-home.module.css`, `dynamic-notice.module.css`) |
| Contrato de dados das telas | `src/components/chat/types.ts` |
| Navegação e moldura | `src/components/light/light-chrome.tsx`, `light-routes.ts`, `light-navigation.ts`, `light-back-button.tsx` |
| Roteiros (conteúdo gerado dos dados) | `src/features/broker-workspace/chat/*` |
| Plano e decisões | `docs/implementations/active/2026-10-09-corretor-chat.md` |

---

## 1. Princípios

1. **Próxima ação primeiro.** Toda tela abre dizendo o que fazer agora, em uma frase, e a primeira opção é a ação mais provável. Diretriz do Vinicios: "tudo pensado na próxima ação, informações diretas, diminuir o atrito ao máximo".
2. **Conversa, não formulário.** O usuário conversa com assistentes; cada decisão vira uma pergunta com 2 a 7 respostas sugeridas (A, B, C...). Um toque resolve. O campo de texto existe sempre (nota livre ou comando `@`), mas é o caminho secundário.
3. **Informação direta.** Dado só aparece se ajuda a decidir. Sem texto explicativo longo, sem rótulo acima de título, sem decoração.
4. **Uma ação primária por superfície.** O azul de ação marca a coisa a fazer; o resto é neutro.
5. **Sem barra lateral e sem barra de abas.** A navegação é o Início (lista de conversas) + voltar. Menu secundário em bottom sheet.
6. **Movimento explica mudança.** Mensagens entram, opções chegam em cascata, a escolhida fica e as outras saem. Sempre com `prefers-reduced-motion`.
7. **Escape para o completo.** Toda conversa tem saída para a ficha/tela completa (ex.: `?ficha=1`, `?completo=1`, `?todas=1`) quando a tarefa não cabe em conversa (upload, tabela grande, edição densa).

---

## 2. Fundações

### 2.1 Escopo dos tokens
Os tokens valem **abaixo da classe `.arc-venancor`** (não no `:root`), para não reestilizar o CRM inteiro. A moldura do Lite aplica a classe no app inteiro; componentes que abrem fora dela (bottom sheet) recebem `className="arc-venancor"`. O kit de chat adiciona seus tokens na classe `.root` do módulo.

> Adoção no modo normal: aplicar `.arc-venancor` na moldura do modo normal (ou promover o bloco para `:root` quando todo o CRM migrar). Ver §10.

### 2.2 Cor

**Superfícies e texto (Venancor, claro)**

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#f7f7f9` | fundo da tela (canvas `.light-canvas`) |
| `--surface` | `#ffffff` | telas de chat, cartões, composer |
| `--surface-raised` | `#ffffff` | camadas elevadas |
| `--surface-muted` | `#f1f1f5` | hover de linha, balão do cliente, avatar de iniciais, campo de busca |
| `--foreground` | `#0b0b12` | texto principal |
| `--text-secondary` | `#4b4b59` | texto de apoio, notas de sistema |
| `--text-muted` | `#666674` | horários, rótulos, placeholders |
| `--border` | `rgb(16 16 40 / .08)` | bordas de cartão, botão de ícone, composer |
| `--border-subtle` | `rgb(16 16 40 / .05)` | divisória interna de cartão |
| `--border-strong` | `rgb(16 16 40 / .18)` | raro |

**Ação**

| Token | Valor | Uso |
|---|---|---|
| `--chat-action` | `oklch(62% .2 255)` (azul) | ação primária do chat: enviar, pílula flutuante, link-botão, prévia "esperando você", opção escolhida, `@menção`, barra destacada |
| `--chat-action-strong` | `oklch(55% .21 258)` | fim do gradiente da pílula |
| `--chat-action-soft` | `oklch(62% .2 255 / .1)` | balão da qualificação, botão enviar desabilitado |
| `--chat-unread` | `oklch(62% .2 255)` | ponto de não lido |
| `--chat-online` | `oklch(68% .17 150)` | ponto "trabalhando" |
| `--accent` / `--control-on` (Arc) | `#3b2dff` (índigo Venancor) | controles Arc: switch, segmented, radio, checkbox, foco de teclado |
| WhatsApp | `oklch(64% .17 150)` | só no botão "Abrir WhatsApp" e balão do corretor (`/ .12`) |

> Gap aberto (G1): convivem dois azuis, o azul de ação do chat e o índigo Venancor dos controles Arc. No Lite isso é intencional (ação vs. seleção). Na adoção, manter igual (1:1) e decidir depois se unifica.

**Status** (Venancor): `--success #0f7a4d`, `--warning #a15c00`, `--danger #d4263a`. Status só significa status.

**Temperatura do lead** (anel no avatar de iniciais): quente `oklch(64% .2 30)`, morno `oklch(75% .16 75)`, frio `oklch(68% .12 235)`.

**Mascotes** (cor por matiz `h`): topo `oklch(86% .1 h)`, base `oklch(66% .17 h)`, fundo `oklch(54% .18 h)`. Matizes em uso: Leads 212, Plantão 28, Agenda 150, Cotação 268, Desempenho 330, Insights 200. Âncora usa o logo (gradiente `oklch(70% .17 250) → oklch(55% .21 258)`, âncora branca).

**Tema escuro:** o kit troca o azul de ação para `oklch(70% .17 255)` (strong `76% .15`, soft `/ .16`) sob `.dark`. Superfícies seguem os tokens Arc de `:root[data-theme="dark"]`. O aviso dinâmico é sempre escuro (`oklch(18% .01 260)`), nos dois temas. Gap (G2): tema escuro do Lite não foi validado tela a tela.

### 2.3 Tipografia
- Família única: **Plus Jakarta Sans** (`--font-jakarta-sans`) para corpo e títulos.
- Pesos: **400** (texto) e **500** (ênfase, nomes, títulos, botões). Nunca 600/700.
- Escala (`--text-*`): xs 12, sm 14, base 16, lg 18, xl 22, 2xl 28, 3xl 36.
- Uso no chat: mensagem 16/1.5; nome no cabeçalho 16/1.2 peso 500; linha da conversa 14 (nome 500, prévia 400 muted); horário 12 tabular; pergunta 16 peso 500; opção 14; dica 12 muted; data/sistema 12.
- `letter-spacing: -.01em` no corpo das mensagens; títulos grandes (`Bom dia, Ana`) usam `--tracking-display -.03em`.
- Números sempre `font-variant-numeric: tabular-nums` (horas, contagens, valores).
- Sem caixa alta, sem rótulo/overline acima de título.

### 2.4 Espaço, raio, sombra, alturas
- Espaço (`--space-*`): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 px.
- Chat: margem lateral `--chat-gutter: 20px`; largura máxima da conversa `--chat-maxw: 720px`; espaço entre blocos 14px; padding da conversa 12px topo, 24px base.
- Raio: `--radius-control: 9999px` (controles e linhas são pílula), `--radius-panel: 1.5rem` (cartões, composer, menu), `--radius-surface: 1.75rem`. Balões 16px com o canto do lado de quem fala em 6px. Aviso dinâmico 28px (cartão) / 20px (pílula).
- Sombra: `--shadow-resting` (cartões e botões de ícone, sem borda pesada), `--shadow-raised` (composer), `--shadow-floating` (menus e camadas flutuantes). Pílula flutuante: `0 10px 24px oklch(55% .21 258 / .32)`.
- Toque: alvo mínimo **44px** (`--control-height-sm: 2.75rem`, opção do chat `min-height: 44px`). Botão de ícone 40px com área estendida; enviar 36px; link-botão 46px; pílula 50px.

### 2.5 Camadas (z-index)
Cabeçalho e composer do chat: 5 · pílula flutuante: 20 · bottom sheet: o do Arc · aviso dinâmico: 90.

### 2.6 Áreas seguras
Cabeçalho: `env(safe-area-inset-top) + 10px`. Composer: `env(safe-area-inset-bottom) + 12px`. Pílula: `env(safe-area-inset-bottom) + 20px`. Aviso: `env(safe-area-inset-top) + 8px`.

### 2.7 Foco
Ponteiro não desenha anel (decisão de produto). Teclado: contorno 2px na cor do acento suavizada (`color-mix(accent-strong 72%)`), offset 2px. Campos de texto mostram foco pela borda e cursor.

---

## 3. Movimento

Tokens: `--ease-enter cubic-bezier(.16,1,.3,1)`, `--ease-standard (.22,1,.36,1)`, `--ease-exit (.7,0,.84,0)`; durações 120/160/240/480ms; molas em `motion-tokens.ts` (`snappy` .26s bounce .12, `smooth` .4s bounce 0, `morph` .42s bounce .16).

| Elemento | Especificação |
|---|---|
| Mensagem nova (qualquer bloco) | sobe 8px + fade, 180ms, `ease-enter` |
| "Digitando" antes de mensagem do assistente | `min(900, 400 + caracteres × 6)` ms; três pontos 6px pulsando, 1s, defasagem 150ms |
| Opções (respostas sugeridas) | entram de 6px, atraso `50ms + i × 40ms`; ao escolher, a escolhida fica (azul, peso 500) e as outras saem em fade 120ms; a escolha vira a mensagem do usuário à direita |
| Linhas da lista de conversas | entram de 6px, 180ms, cascata 35ms (máximo 8 passos) |
| Ponto de não lido | mola `visualDuration .26, bounce .3` a partir de `scale .4` |
| Barras do gráfico | crescem de `scaleY 0`, mola `smooth`, cascata 30ms |
| Mascote "trabalhando" | respira: escala 1→1.05, sobe 1.5px, 1.6s, infinito |
| Mascote piscando | `scaleY` dos olhos, ciclo 4.2s |
| Rolagem | primeira ida ao fim é instantânea (abre na última mensagem); as próximas deslizam |
| Aviso dinâmico | desce como pílula preta 126×36 (mola `stiffness 420, damping 34, mass .9`), abre em cartão (largura `min(420, tela − 16)`) após 260ms; conteúdo entra com blur 6px → 0; sai subindo 80px em 220ms; repousa como pílula 156px |
| Cartões do Início (computador) | entram de 8px, cascata 40ms a partir de 60ms |

Redução de movimento: tudo vira aparecer/sumir sem deslocamento; o roteiro mostra tudo de uma vez; rolagem sem animação; aviso só com fade.

---

## 4. Navegação e moldura

- **Sem sidebar, sem barra de abas.** O **Início** (`/dashboard`) é a lista de conversas e o hub. Desde 2026-10-09 (pedido do Vinicios).
- **Telas de chat** (`chat: true` em `light-routes.ts`) desenham o próprio cabeçalho; a moldura não põe nada em volta. Telas não-chat recebem só o cabeçalho com voltar + título.
- **Menu "Mais"** (Clientes, Cotação, Plantões, Notificações, Configurações, disponibilidade, sair): bottom sheet aberto pelo botão de iniciais no topo do Início.
- **Voltar** (`goBackInApp`): volta pelo histórico quando a tela anterior é do app (com `backToParent`, só se a anterior for o pai); senão vai para o pai **substituindo** a entrada atual. Nunca empilha, nunca entra em loop. O histórico acompanha caminho + query.
- **Saídas para o completo:** `?ficha=1` (lead), `?completo=1` (cotação), `?todas=1` (conversas).
- **Computador (≥1024px):** Início vira duas colunas: lista à esquerda (360px, fundo `--surface-muted`) e, ao centro, "Bom dia, {nome}" (36px) + cartões dos assistentes.

---

## 5. Componentes

Todos em `src/components/chat/` salvo indicação. Props resumidas; ver o arquivo para a assinatura completa.

### 5.1 AssistantAvatar
Mascote SVG brilhante (formas: mochi, onigiri, cubo, favo, nuvem, salte; `logo` para Âncora) ou **iniciais** (leads/pessoas) com anel de temperatura. Estados: `idle`, `working` (respira), `waiting` (ponto azul). Tamanhos usados: 22, 32, 40, 44, 52.

### 5.2 ThreadRow / ThreadList (`thread-row.tsx`)
Linha de conversa: grade `44px | 1fr | auto`, gap 12, padding `10px 20px`, raio pílula, hover `--surface-muted`. Nome 14/500 + selo verificado (azul, 14px) · prévia 14 muted, **azul quando espera você** · à direita hora (12, tabular) e ponto de não lido 8px. Ordenação: espera você > não lido > mais recente. Estado vazio: texto central 14 muted.

### 5.3 ChatScreen (`chat-screen.tsx`)
Tela de conversa inteira: grade `auto | 1fr | auto`, altura `100dvh`, só o meio rola.
- **Cabeçalho**: voltar (botão de ícone 40px, borda, sombra resting), avatar 32, nome 16/500, linha de estado 12 (`Esperando você` em azul; `Trabalhando...` com ponto verde; `Pronto`; `Precisa de atenção`), ação à direita opcional (ex.: ícone da ficha). Fundo `surface 92%` + `backdrop-filter: blur(12px)`.
- **Conversa**: largura máx 720, blocos com gap 14.
- **Composer** (ver 5.6).
- Comportamentos: toca o roteiro com "digitando"; perguntas abertas por outra resposta ficam ocultas até a escolha; ações `href` (externas abrem em nova aba), `next` (revela bloco), `server` (roda ação, mostra resposta, atualiza), `local` (fluxo guiado no navegador); `instant` para históricos (Âncora); `progress` e `placeholder` controláveis.

### 5.4 Blocos (`chat-blocks.tsx`, contrato em `types.ts`)
| Bloco | Aparência |
|---|---|
| `date` | centralizado, 12 muted, tabular ("Hoje, 09:41", "Ontem, 18:02", "07/10, 14:10") |
| `system` | nota central 12 secondary; parte em `strong` 500 foreground; ação textual opcional |
| `assistant` | texto corrido 16/1.5 **sem balão**, à esquerda |
| `user` | texto 16/1.5 à direita, máx 80%, sem balão |
| `whatsapp` | balão 16px de raio, padding `8 12 9`, máx 82%, rótulo 12 muted ("Cliente · 14:32"): cliente à esquerda `--surface-muted`; Qualificação (IA) à direita `--chat-action-soft`; Você à direita verde `/ .12`; canto do falante 6px |
| `facts` | cartão (borda, raio panel): título 14/500 + subtítulo 12 + link "Ver ficha"; pares rótulo (muted) / valor em grade `max-content 1fr`, gap `8 20` |
| `list` | cartão com linhas: lead (hora/valor tabular com régua de 2px), primário 14/500, secundário 12, trailing 14 tabular; cada linha pode ser link |
| `bars` | cartão com barras 120px de altura, raio `6 6 2 2`, neutras `--neutral-4`, destaque azul |
| `steps` | lista de passos com ícone feito/pendente |
| `question` | pergunta 16/500 + opções (5.5) |
| `button` | link real em forma de botão (46px, pílula, azul; tom `whatsapp` verde com ícone); texto opcional acima |

### 5.5 ChoiceList (respostas sugeridas)
Opção: grade `22px | 1fr | auto`, `min-height 44`, padding `11px 6px`, raio pílula, hover `--surface-muted`. Letra A..G (12/500 muted) · rótulo 14 · dica 12 muted abaixo · chevron 14 muted. Teclado: a letra escolhe (ignorado quando o foco está num campo). Escolhida: rótulo azul 500; demais saem.

### 5.6 Composer (`composer.tsx`)
Faixa de progresso opcional acima ("Montando a cotação · 2 de 6", título 14/500 + mascote 18 + contagem 12 tabular). Caixa: borda, raio panel, sombra raised, padding `12 12 10`; textarea que cresce até 140px, 16px; ferramentas 34px; **enviar 36px azul**, desabilitado `--chat-action-soft`; vira **parar** enquanto trabalha. Enter envia, Shift+Enter quebra linha. Menu `@` (`@leads @plantao @agenda @cotacao @desempenho`): cartão flutuante, item ativo `--surface-muted`, setas navegam. `inputMode` e rótulo acessível controláveis (ex.: idades → teclado numérico).

### 5.7 TypingIndicator
Avatar + três pontos 6px `--neutral-6`.

### 5.8 FloatingPill
Fixa no pé (`safe-area + 20px`), centralizada, 50px de altura, padding 22, gradiente vertical `chat-action → chat-action-strong`, texto 16/500 branco, sombra azul. Conteúdo é a próxima ação ("Atender Maria") ou "Novo atendimento". Só no celular.

### 5.9 BottomSheet e SegmentedControl (Arc, `src/components/arc/`)
Sheet para menus e ações ("O que você quer fazer?": itens com título 16/500 + descrição 14 muted, raio control, hover muted). Segmented para 2 a 5 visões ("Assistentes | Leads"), com contador azul (18px, texto 11) quando há espera.

### 5.10 DynamicNotice (`dynamic-notice.tsx`)
Aviso estilo iPhone para eventos que pedem ação imediata (lead novo). Fundo `oklch(18% .01 260)`, texto `oklch(98% 0 0)`, sombra profunda. Cartão: mascote 40 · app 12 + "agora" · título 15/500 · mensagem 14 (2 linhas) · botão de ação 34px azul. Toque abre; arrastar para cima (>28px ou velocidade) dispensa; após 6s **repousa como pílula** ("Lead novo" / "3 novos") sem marcar como lido; toque na pílula reabre; segurar pausa o relógio. Um por vez com fila (`+2`). `role="status"`, `aria-live="polite"`. Som uma vez por item.

### 5.11 ThreadListScreen (`thread-list-screen.tsx`)
Lista em tela cheia com cabeçalho de chat (voltar + título 16/500 + subtítulo 12), busca (campo 42px, `--surface-muted`) e ThreadList.

### 5.12 ChatHome (`chat-home.tsx`)
Celular: cabeçalho (iniciais 40px → abre "Mais", "Olá, {nome}" 22/500, busca, "+"), segmented "Assistentes | Leads", lista, pílula flutuante, sheet "O que você quer fazer?". Computador: ver §4.

---

## 6. Padrões de tela

| Padrão | Quando usar | Estrutura | Exemplo no Lite |
|---|---|---|---|
| **Home de conversas** | ponto de entrada de um perfil | ChatHome: assistentes + entidades (leads) com quem espera você no topo | `/dashboard` |
| **Conversa de assistente** | uma área do trabalho (fila, plantão, agenda, números, avisos) | ChatScreen com roteiro gerado dos dados: abre com a situação em 1 frase, mostra cartão se ajudar, termina numa pergunta com a próxima ação | `/dashboard/c/{leads,plantao,agenda,desempenho,ancora}` |
| **Conversa de entidade** | um registro (lead, cliente) | cabeçalho com iniciais + temperatura; chegada e origem (sistema); ficha (`facts`); histórico + WhatsApp em balões; próxima ação por etapa; nota livre no composer; ícone para a ficha completa | `/leads/{id}` |
| **Fluxo guiado** | tarefa em passos (cotar, configurar) | perguntas uma a uma com progresso "x de y"; respostas por opção ou digitadas; resultado em cartões; ações finais (enviar, copiar, refazer) | `/cotacao` |
| **Fila de prioridades** | "o que fazer primeiro" | contagem + o primeiro item com contexto e sugestão + ação de 1 toque + lista "Depois" | `/conversas/broker` (Insights) |
| **Lista em tela cheia** | ver tudo de um tipo | ThreadListScreen com busca | `/conversas/broker?todas=1` |
| **Ficha completa** | upload, edição densa, tabelas | tela tradicional dentro da moldura, alcançável por saída explícita | `/leads/{id}?ficha=1` |
| **Ação contextual** | "o que você quer fazer?" | BottomSheet com 3 a 5 itens (título + descrição) | "+" do Início |
| **Evento urgente** | algo chegou e pede ação | DynamicNotice | lead novo |

Regras de roteiro (conteúdo gerado): funções puras sobre os dados (`build*Script`), ids de bloco únicos, ações só por nome (o servidor executa a ação existente, com as mesmas checagens), testes por roteiro.

---

## 7. Conteúdo e linguagem

- Português do Brasil, tom de colega: "Maria está esperando você.", "Pronto, etapa: Cotação enviada."
- **Nunca travessão (—).** Use vírgula, dois-pontos, parênteses ou ponto.
- Frases curtas; uma ideia por mensagem. Pergunta termina com "?" ("Vamos atender?", "Como quer seguir?").
- Rótulo de opção é a ação em primeira pessoa ou verbo: "Aceitar e chamar no WhatsApp", "Agendar retorno", "Não deu certo". Resposta registrada pode reescrever ("Vou chamar no WhatsApp").
- Estado no cabeçalho: "Esperando você", "Trabalhando...", "Pronto", "Precisa de atenção", "Em dia", "Pausado".
- Horas `HH:mm` (24h, São Paulo); datas "Hoje", "Ontem", `dd/mm`; dinheiro `R$` com `Intl` pt-BR.
- Valores demonstrativos são sempre avisados ("Valores demonstrativos", "sujeitos à análise da operadora").
- Erro diz o que fazer: "Não consegui concluir agora. Tente de novo em instantes."
- Confirmação acontece na própria conversa (resposta do assistente), não em toast.

---

## 8. Acessibilidade

- Alvos de toque ≥ 44px; botões pequenos estendem a área com pseudo-elemento.
- Conversa com `aria-live="polite"` (`aria-relevant="additions"`); estado do cabeçalho `aria-live`.
- Opções são `<button>`; link-botão é `<a>` real (`target="_blank"` + `noopener` só para http).
- Atalho de letra não dispara com foco em campo.
- Composer com `aria-label` (padrão = placeholder; fluxos guiados definem rótulo próprio e `inputMode`).
- Avatares decorativos `aria-hidden`; com significado, `role="img"` + rótulo.
- Aviso dinâmico `role="status"` com rótulo completo.
- `prefers-reduced-motion` respeitado em todos os componentes.
- Contraste: textos sobre `--surface` usam foreground/secondary/muted da tabela §2.2.

---

## 9. Contrato de dados (resumo de `types.ts`)

- `ChatBlock`: `date | system | assistant | user | whatsapp | facts | list | bars | steps | question | button`.
- `ChatChoice`: `{ id, label, hint?, reply?, action }`.
- `ChatAction`: `href` · `next` (revela bloco oculto) · `server` (nome registrado, payload simples) · `local` (fluxo no navegador).
- `ChatScript`: `{ blocks, progress?, composerPlaceholder?, status? }`.
- `ThreadSummary`: linha do Início (`waitingYou`, `unread`, `preview`, `at`, `shape/hue` ou `initials/temperature`).
- Ações de servidor: `chat-actions.ts` valida o nome com `z.enum` e o payload com zod, e chama a ação existente.

---

## 10. Guia de adoção 1:1 no modo normal (diretor e gestor)

Objetivo: o diretor usar o CRM com o mesmo visual, movimento, navegação e linguagem do Lite.

### 10.1 Mapa de telas (proposta para validar com o Vinicios)
| Tela atual do diretor | Padrão alvo | Assistentes / conteúdo |
|---|---|---|
| `/dashboard` (central de ações) | Home de conversas | **Distribuição** (leads parados, filas sem corretor), **Plantões** (cobertura de hoje, quem está pausado, presença a liberar), **Equipe** (quem está online, desempenho), **Leads** (novos, SLA), **Vendas** (aprovações pendentes), **Âncora** (avisos) |
| `/leads` (lista) | Lista em tela cheia + filtros em segmented | linhas = leads com prévia da próxima ação |
| `/leads/{id}` | Conversa de entidade | mesma do Lite + ações de gestão (reatribuir, mudar unidade, supervisão) como opções |
| `/leads/distribuicao` e plantões | Conversa de assistente + Ficha completa | resumo e próximas ações na conversa; editor de escala e quadros continuam como "ficha completa" |
| `/equipe/{id}` | Conversa de entidade (pessoa) | ficha do corretor, números, plantões |
| Relatórios, configurações | Ficha completa dentro da moldura nova | sem sidebar; acesso pelo "Mais" |
| Toasts de evento | DynamicNotice | lead chegou, venda para aprovar, plantão sem cobertura |

### 10.2 Ordem de implantação
1. **Tokens e moldura:** aplicar `.arc-venancor` na moldura do modo normal; remover sidebar/abas; Início como hub; "Mais" em sheet; `goBackInApp` em todos os voltar.
2. **Kit:** reutilizar `src/components/chat/*` sem bifurcar (nada de cópia para o diretor). Novos assistentes = novos roteiros em `features/<área>/chat/` + novos nomes em `ChatServerActionName`.
3. **Home do diretor** (padrão Home de conversas) com os assistentes de 10.1.
4. **Conversa do lead** com ações de gestão.
5. **Assistentes de Distribuição e Plantões** com saída para os editores existentes (ficha completa).
6. **DynamicNotice** para eventos de gestão.
7. Telas densas restantes dentro da moldura nova (sem refazer agora).

### 10.3 O que o Lite ainda não tem e o diretor precisa (gaps)
- **G3 Tabelas densas:** não há padrão de tabela no estilo conversa. Até decidir, tabelas ficam como "ficha completa" (Arc `sortable-data-table` dentro da moldura).
- **G4 Filtros e período:** o Lite não filtra por unidade/período. Proposta: segmented + sheet de filtros.
- **G5 Permissões na conversa:** opções de gestão precisam esconder o que o papel não pode (a ação de servidor já checa; a UI deve omitir).
- **G1 / G2:** ver §2.2 (dois azuis; tema escuro não validado).

### 10.4 Checklist de cada tela migrada
- [ ] Abre dizendo a próxima ação em 1 frase; primeira opção = ação mais provável.
- [ ] Tokens só da tabela §2; sem cor solta, sem peso 600/700, sem caixa alta.
- [ ] Movimento conforme §3 e reduced motion testado.
- [ ] Voltar com `goBackInApp`; sem loop.
- [ ] Alvos ≥ 44px; teste em 390px; leitor de tela nos blocos novos.
- [ ] Sem travessão no texto; pt-BR.
- [ ] Roteiro puro com testes; ações de servidor por nome com zod.
- [ ] Saída para a tela completa quando a tarefa não cabe em conversa.

---

## 11. Histórico
- 2026-10-09 · v1.0 · registro inicial a partir do modo Lite (fases F0 a F6 + ajustes do mesmo dia: sem sidebar, voltar sem loop, aviso dinâmico em pílula, balões do WhatsApp).
