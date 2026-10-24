# Alvo da conversão: o sistema de design Lite como ele existe hoje no código

Repo: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-lite-listas` (HEAD `5026f66e`, leitura apenas).
Data da leitura: 2026-10-24. Todas as referências são `arquivo:linha` relativas a `src/` quando não indicado.

> Regra de leitura: o código é a fonte da verdade. Onde a documentação diverge, está marcado em "Divergência doc x código" (seção 6).

---

## 0. Resumo executivo

1. **O Lite é uma camada de tokens escopada**, não um tema global. Tudo vive em `.arc-venancor` (`components/arc/venancor-scope.css:8-129`). O arquivo `components/arc/foundation.css` (o `:root` original do Arc, com tema escuro, 8 acentos, gradientes e paleta de gráfico) **não é importado em lugar nenhum** (nenhum `import` encontrado em `src/`). Só o `venancor-scope.css` está em produção.
2. O escopo carrega **dois azuis**: o índigo Venancor `#3b2dff` (`--accent`, `--primary`, `--control-on`) para seleção/controles, e o azul de ação `oklch(62% .2 255)` (`--chat-action`) para a ação principal do chat e telas Lite. Isto é intencional (gap G1 do doc), mas o código recente já usa os dois como "pílula de ação principal" (ver 4.4).
3. **Colisões críticas com `app/globals.css`** dentro do escopo: `--accent` vira `#3b2dff` com texto branco (no CRM é o cinza-quente de hover `#f4f3f0`), `--text-xl..5xl` crescem (22/28/36/52/72px contra 20/24/30/36/48px do Tailwind), `--duration-fast` cai de 250ms para 160ms, `--ease-in-out` muda de curva, `--success`/`--warning` escurecem, `--border` vira translúcida. Qualquer `hover:bg-accent`, `focus:bg-accent`, `data-[state=on]:bg-accent` de shadcn renderizado **dentro** do escopo fica índigo sólido.
4. **Portais saem do escopo.** Dialog, Sheet, Drawer, Popover, DropdownMenu, Tooltip (Base UI, `@base-ui/react`), o Select próprio (`components/motion/select.tsx:324-353`, `createPortal(..., document.body)`) e o `<Toaster />` (`app/layout.tsx:115`) renderizam no `body`, fora de `.arc-venancor`, e voltam a usar os tokens do CRM. No Lite isso foi resolvido só para o BottomSheet do Arc, passando `className="arc-venancor"` na própria camada (convenção em 10 usos, ver 5.3).
5. O precedente `ed0af666` (Conversas do diretor) **não trocou componentes**: envolveu a página em `.arc-venancor` + um CSS module, marcou elementos com `data-lite="..."` e sobrescreveu bordas/fundos/raios por seletor de atributo (com `!important` onde o Tailwind vencia), e adicionou `motion` (cascata, pílula deslizante, entrada de mensagens). Select, Sheet e DropdownMenu da tela continuam com a cara do CRM porque abrem em portal.
6. **O Lite não tem**: tabela de dados, kanban, gráficos (além de barras simples em CSS), date range, combobox, multi-select com busca, dropdown menu, tooltip, popover genérico, dialog de confirmação centralizado, toast, paginação, breadcrumbs, sidebar de desktop com navegação (a `LightSideRail` existe mas está sem uso), command palette, checkbox, select. Detalhe na seção 3.5.
7. Já houve uma tentativa de "pele do Lite no modo normal" por tokens globais (`3fdd31a0` a `c78cb73b`, 2026-10-09) **revertida no mesmo dia** (`338eb958`) a pedido do Vinicios. O doc do Lite ainda diz que o modo normal está fora de escopo (`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md:253-255`).

---

## 1. Como o escopo funciona hoje

| Peça | Onde | O que faz |
|---|---|---|
| Classe de escopo | `components/arc/venancor-scope.css:8` | `.arc-venancor { color-scheme: light; ... }` declara todos os tokens Arc e, em seguida, o mapeamento Venancor (`:77-128`), que sobrescreve parte dos valores dentro do mesmo bloco |
| Comentário de intenção | `components/arc/venancor-scope.css:1-7` | "Arc ships these on :root (foundation.css), which would restyle the whole CRM, and several names collide with the CRM tokens (--border, --accent, --radius-control...)" |
| Import do CSS | `components/light/light-chrome.tsx:10`, `components/light/light-auth-shell.tsx:3`, `app/(dashboard)/conversas/page.tsx:5`, `features/assist/a11y-prefs.tsx`, `features/broker-workspace/components/light-duty-calendar.tsx`, `app/dev-preview/placar/preview.tsx`, várias `app/dev/*` | CSS global importado por componente cliente/servidor; no App Router ele entra quando o módulo é carregado. Uma tela do diretor fora dessas árvores precisa importar o arquivo (como fez `conversas/page.tsx:5`) |
| Onde a classe é aplicada | `light-chrome.tsx:109` (rail), `:147` (telas de chat); `light-app-header.tsx:43`; `light-auth-shell.tsx:15`; `people-list.tsx:22` (`PeoplePage`); `light-page-skeleton.tsx:13`; páginas como `app/(dashboard)/agenda/page.tsx:17`, `desempenho/page.tsx:32`, `equipe/plantao/page.tsx:17`, `jornada/page.tsx:22`, `leads/page.tsx:72`, `settings/_components/light-settings.tsx:49`, `conversas/page.tsx:1071` | Aplicada por tela ou por peça da moldura. Nota em `light-chrome.tsx:34-36`: a moldura escopa só as peças do chrome, "never to the screens inside", e cada tela entra no escopo quando é convertida |
| Camadas em portal | `BottomSheet ... className="arc-venancor"` em `chat-home.tsx:257`, `week-ranking.tsx:77`, `light-more-sheet.tsx:65`, `features/manager-workspace/manager-lead-status-sheet.tsx:23`, `manager-lead-transfer-form.tsx:38`, `manager-lite-team.tsx:149`, `features/supervisor-workspace/my-team-page.tsx:105`, `features/team/team-invite-lite-sheet.tsx:51`, `features/team-management-extras/goal-sheet.tsx:62` | O BottomSheet usa `DialogPrimitive.Portal` (`components/arc/bottom-sheet/bottom-sheet.tsx:100`), então a classe vai no próprio painel (`:374`) |
| Tokens JS de movimento | `components/arc/motion-tokens.ts:1-23` (reexportado em `components/arc/lib/motion-tokens.ts:1`) | Durações, curvas, molas, cascata, blur para `motion/react` |

---

## 2. Tokens

Convenção: "Arc base" é o valor declarado primeiro no bloco; "Lite efetivo" é o valor final depois do mapeamento Venancor no mesmo bloco (é o que vale na tela).

### 2.1 Escala neutra (só existe no escopo)

| Token | Valor | Linha |
|---|---|---|
| `--neutral-0` | `oklch(100% 0 0)` | `venancor-scope.css:10` |
| `--neutral-1` | `oklch(99% 0 0)` | `:11` |
| `--neutral-2` | `oklch(97.8% 0 0)` | `:12` |
| `--neutral-3` | `oklch(95.8% 0 0)` (hover de cartão cinza: `chat-home.module.css:31,55`, `week-ranking.module.css:9`) | `:13` |
| `--neutral-4` | `oklch(91.5% 0 0)` (barras neutras, trilhos: `chat.module.css:176`, `chat-home.module.css:20`, `week-ranking.module.css:26`) | `:14` |
| `--neutral-5` | `oklch(84% 0 0)` | `:15` |
| `--neutral-6` | `oklch(72% 0 0)` (pontos do "digitando": `chat.module.css:224`) | `:16` |
| `--neutral-7` | `oklch(59% 0 0)` | `:17` |
| `--neutral-8` | `oklch(46% 0 0)` | `:18` |
| `--neutral-9` | `oklch(34% 0 0)` | `:19` |
| `--neutral-10` | `oklch(23% 0 0)` | `:20` |
| `--neutral-11` | `oklch(15% 0 0)` | `:21` |

### 2.2 Superfície e texto

| Token | Arc base | Lite efetivo | Linhas | Uso no código |
|---|---|---|---|---|
| `--background` | `--neutral-0` | `#f7f7f9` | `:22`, `:78` | canvas atrás das áreas (conversas do diretor: `conversas-lite.module.css:11,16`); a moldura Lite usa branco (`.light-canvas`, `:140`) |
| `--surface` | `--neutral-0` | `#ffffff` | `:23`, `:79` | folha da tela, cartões, linhas |
| `--surface-raised` | `--neutral-0` | `#ffffff` | `:24`, `:80` | sheet, popover do date picker |
| `--surface-muted` | `--neutral-2` | `#f1f1f5` | `:25`, `:81` | blocos cinza de número, hover de linha, balão do cliente, trilho do segmented, fundo do rail desktop |
| `--foreground` | `--neutral-11` | `#0b0b12` | `:26`, `:82` | texto principal; também fundo do botão primário Arc (`button.module.css:13`) |
| `--text-secondary` | `--neutral-8` | `#4b4b59` | `:27`, `:83` | apoio, notas de sistema |
| `--text-muted` | `--neutral-7` | `#666674` | `:28`, `:84` | horários, rótulos, placeholders |
| `.light-canvas` | | `background: var(--surface)` | `:140` | "Every Lite screen is one white sheet (Vinicios, 2026-10-10)" (`:139`) |

### 2.3 Borda

| Token | Arc base | Lite efetivo | Linhas |
|---|---|---|---|
| `--border` | `oklch(93.5% 0 0)` | `rgb(16 16 40 / 0.08)` | `:29`, `:101` |
| `--border-subtle` | `oklch(96.5% 0 0)` | `rgb(16 16 40 / 0.05)` | `:30`, `:102` |
| `--border-strong` | `oklch(82% 0 0)` | `rgb(16 16 40 / 0.18)` | `:31`, `:103` |

Bordas são translúcidas sobre o canvas: sobre `#f1f1f5` ou `#f7f7f9` elas praticamente somem. Cartões não usam borda (ver 4.2).

### 2.4 Acento, primária e azul de ação

| Token | Arc base | Lite efetivo | Linhas | Papel |
|---|---|---|---|---|
| `--accent` | `oklch(33% 0 0)` | `#3b2dff` | `:32`, `:104` | seleção (chip, calendário, stepper, barra de upload), linha ativa (`conversas-lite.module.css:47`), pílula "Agora" (`chat-home.module.css:93,100`) |
| `--accent-strong` | `oklch(24% 0 0)` | `#2a1fd1` | `:33`, `:105` | hover do acento, texto de selo info, foco de teclado |
| `--accent-subtle` | `oklch(33% 0 0 / .1)` | `rgb(59 45 255 / 0.1)` | `:34`, `:106` | avatar de iniciais (`:143`), fundo de linha ativa, anel do stepper |
| `--accent-foreground` | `var(--background)` | `#ffffff` | `:35`, `:107` | texto sobre acento |
| `--primary` | (ponte shadcn) | `#3b2dff` | `:90` | igual ao CRM |
| `--primary-foreground` | | `#ffffff` | `:91` | |
| `--chat-action` | | `oklch(62% 0.2 255)` | `:124` (e `chat.module.css:7`) | ação principal do chat: enviar, pílula flutuante, link-botão, CTA da dica, barras e trilhos de meta |
| `--chat-action-strong` | | `oklch(55% 0.21 258)` | `:125` (e `chat.module.css:8`) | fim do gradiente da pílula; botão primário de formulários Lite (`handoff-form.module.css:18`, `supervisor-broker-profile.module.css:63`) |
| `--chat-action-soft` | | `oklch(62% 0.2 255 / 0.1)` | `:126` (e `chat.module.css:9`) | balão da qualificação, enviar desabilitado, ícone de bloco vivo |
| `--chat-action-text` | | `oklch(48% 0.2 258)` | `:128` | azul para texto (links, destaques, foco das listas), contraste 4.5:1 |
| `--chat-unread` | | `oklch(62% 0.2 255)` | `chat.module.css:10` | ponto de não lido (só dentro do módulo de chat) |
| `--chat-online` | | `oklch(68% 0.17 150)` | `chat.module.css:11` | ponto "trabalhando" |
| `--chat-tip`, `--chat-tip-border`, `--chat-tip-text` | | `oklch(96% .05 90)`, `oklch(86% .09 85)`, `oklch(42% .1 65)` | `chat.module.css:13-15` | balão de dica amarelo |
| WhatsApp | | `oklch(64% 0.17 150)` / `#1fa855` | `chat.module.css:60`, `:327` | só botão de WhatsApp e balão do corretor |

Dark: `:global(.dark) .root` troca só os azuis do chat (`chat.module.css:22-30`). O resto do escopo é sempre claro (`color-scheme: light`, `:9`).

### 2.5 Controles de seleção

| Token | Arc base | Lite efetivo | Linha |
|---|---|---|---|
| `--control-on` | `oklch(23% 0 0)` | `#3b2dff` | `:38`, `:108` |
| `--control-glyph` | `oklch(100% 0 0)` | igual | `:39` |
| `--control-track` | `oklch(89.5% 0 0)` | igual | `:40` |
| `--control-track-hover` | `oklch(86% 0 0)` | igual | `:41` |
| `--control-thumb`, `--control-thumb-on` | `oklch(100% 0 0)` | igual | `:42-43` |
| `--control-thumb-shadow` | `0 0 0 .5px .07, 0 1px 2px .14, 0 2px 6px .06` | igual | `:44` |
| `--control-on-subtle` | `color-mix(control-on 10%)` | índigo 10% | `:45` |
| `--control-fill` | `var(--control-on)` | `#3b2dff` | `:47`, `:109` |
| `--control-height-sm` | `2.25rem` | **`2.75rem`** (44px, "touch targets are at least 44px") | `:61`, `:121` |
| `--control-height-md` | `2.75rem` (44px) | igual | `:61` |
| `--control-height-lg` | `3.125rem` (50px) | igual | `:61` |

### 2.6 Status

| Token | Arc base | Lite efetivo | Linha |
|---|---|---|---|
| `--success` | `oklch(49% .19 150)` | `#0f7a4d` | `:51`, `:110` |
| `--warning` | `oklch(58% .18 75)` | `#a15c00` | `:52`, `:111` |
| `--danger` | `oklch(54% .21 25)` | `#d4263a` | `:53`, `:112` |
| `--destructive` (ponte) | | `var(--danger)` | `:98` |
| `--destructive-foreground`, `--success-foreground` | | `#ffffff` | `:99-100` |

Uso: tons de selo por `color-mix` a 10 a 27% sobre a superfície (`badge.module.css:44-48`), números em alerta em `--danger` (`people-list.module.css:19`, `supervisor-broker-profile.module.css:80`). Não há `--info` no escopo: o tom "info" do Badge usa o acento (`badge.module.css:46`).

### 2.7 Ponte para os primitivos do CRM (shadcn) dentro do escopo

`venancor-scope.css:85-100`: "Keep shared CRM primitives aligned with the Arc light palette in this scope."

| Token CRM | Valor no escopo |
|---|---|
| `--card` / `--card-foreground` | `var(--surface)` / `var(--foreground)` (`:86-87`) |
| `--popover` / `--popover-foreground` | `var(--surface-raised)` / `var(--foreground)` (`:88-89`) |
| `--primary` / `--primary-foreground` | `#3b2dff` / `#fff` (`:90-91`) |
| `--secondary` / `--secondary-foreground` | `var(--surface-muted)` / `var(--foreground)` (`:92-93`) |
| `--muted` / `--muted-foreground` | `var(--surface-muted)` / `var(--text-muted)` (`:94-95`) |
| `--input` | `var(--border-strong)` (`:96`) |
| `--ring` | `var(--accent-strong)` = `#2a1fd1` (`:97`) |
| `--destructive` | `var(--danger)` (`:98`) |

Ausentes na ponte (continuam com o valor do CRM herdado do `:root`): `--info`, `--info-foreground`, `--warning-foreground`, `--sidebar-*`, `--chart-1..5`, `--surface-base`, `--surface-card`, `--surface-secondary`, `--muted-text`, `--shadow-xs..xl`, `--shadow-card`, `--shadow-dialog`, `--radius`, `--radius-card`. Atenção: `--accent` **não** foi mapeado para o papel shadcn (hover neutro), e sim para o índigo Arc (ver 2.19).

### 2.8 Sombras

| Token | Arc base | Lite efetivo | Linha | Uso |
|---|---|---|---|---|
| `--shadow-resting` | `0 1px 2px oklch(0 0 0 / .035)` | `0 1px 2px rgb(16 16 40 / .04), 0 8px 24px rgb(16 16 40 / .05)` | `:54`, `:114` | cartões e linhas brancas, botões de ícone, pílula ativa do segmented |
| `--shadow-raised` | `0 6px 18px / .065, 0 1px 3px / .035` | **não remapeado** (fica o Arc) | `:55` | composer (`chat.module.css:205`), bolha do slider, `presence` |
| `--shadow-floating` | `0 20px 48px / .105, 0 3px 10px / .045` | `0 16px 40px rgb(16 16 40 / 0.14)` | `:56`, `:115` | sheet, popover, barra inferior, menu `@`, dica |
| Pílula flutuante | | `0 10px 24px oklch(55% .21 258 / .32)` | `chat.module.css:231` | sombra azul colorida, exceção |
| Aviso dinâmico | | `0 18px 40px -12px / .45, 0 2px 6px / .2` | `dynamic-notice.module.css:11` | sempre escuro |

Regra escrita no próprio token: "Cards rest on one soft shadow, no border. Only floating layers use --shadow-floating." (`:113`).

### 2.9 Espaçamento

`--space-1 .25rem` (4), `--space-2 .5rem` (8), `--space-3 .75rem` (12), `--space-4 1rem` (16), `--space-5 1.25rem` (20), `--space-6 1.5rem` (24), `--space-8 2rem` (32), `--space-10 2.5rem` (40), `--space-12 3rem` (48), `--space-16 4rem` (64), `--space-20 5rem` (80), `--space-24 6rem` (96). `venancor-scope.css:57-59`.

Medidas de layout recorrentes (hardcoded nos módulos, não tokenizadas):

| Medida | Valor | Onde |
|---|---|---|
| Largura da página Lite | `max-width: 860px` | `.lite-page` `venancor-scope.css:186`; `people-list.module.css:9`; `my-team-page.module.css:2`; `team-settings.module.css:2` |
| Padding da página | `24px 16px 48px`; a partir de 720px `32px 24px 56px` | `venancor-scope.css:186-187`; repetido em `people-list.module.css:9-10`, `my-team-page.module.css:2,69`, `team-settings.module.css:2,49` |
| Página larga (perfil) | `max-width: 1080px`, padding `20px 16px 40px` | `supervisor-broker-profile.module.css:11-13` |
| Formulário estreito | `max-width: 560px` | `handoff-form.module.css:2` |
| Gap entre blocos | 16px (lista), 20px (config), 8px (linhas), 10px (stats) | `people-list.module.css:9,15,37`, `team-settings.module.css:2` |
| Calha do chat | `--chat-gutter: 20px`, `--chat-maxw: 720px` | `chat.module.css:16-17` |
| Rail desktop | 360px | `venancor-scope.css:153`, `chat-home.module.css:47` |

### 2.10 Raios

| Token | Arc base | Lite efetivo | Linha |
|---|---|---|---|
| `--radius-control` | `1.125rem` | **`9999px`** (todo controle é pílula) | `:60`, `:116` |
| `--radius-panel` | `1.625rem` | `1.5rem` (24px) | `:60`, `:117` |
| `--radius-surface` | `2.125rem` | `1.75rem` (28px) | `:60`, `:118` |
| `--radius-pill` | `9999px` | igual | `:60` |
| Exceção textarea | | `1.125rem` (pílula cortava letras) | `:180-182` |

Raios hardcoded recorrentes: `1.25rem` (20px) linha de lista e bloco de número (`people-list.module.css:16,38`, `conversas-lite.module.css:39`, `my-team-page.module.css:36`); `1rem` (16px) bloco de número pequeno (`my-team-page.module.css:21`, `supervisor-broker-profile.module.css:76,99`); `20px` RadioCards (`radio-cards.module.css:22,34`); `28px` cartão de boas-vindas (`lite-welcome.module.css:10`); balões `16px` com canto de 6px (`chat.module.css:33-36`) e `4px 18px 18px 18px` (`:129,134`).

### 2.11 Tipografia

| Token | Valor | Linha |
|---|---|---|
| `--font-body` | Arc `Inter Variable`; Lite `var(--font-jakarta-sans), ui-sans-serif, system-ui` | `:63`, `:119` |
| `--font-display` | Arc `Geist Variable`; Lite = Jakarta | `:62`, `:120` |
| `--text-xs` | `.75rem` (12) | `:64` |
| `--text-sm` | `.875rem` (14) | `:64` |
| `--text-base` | `1rem` (16) | `:64` |
| `--text-lg` | `1.125rem` (18) | `:64` |
| `--text-xl` | `1.375rem` (22) | `:65` |
| `--text-2xl` | `1.75rem` (28) | `:65` |
| `--text-3xl` | `2.25rem` (36) | `:65` |
| `--text-4xl` | `3.25rem` (52) | `:66` |
| `--text-5xl` | `4.5rem` (72) | `:66` |
| `--tracking-display` | `-.03em` | `:67` |
| `--tracking-body` | `-.01em` | `:67` |
| `--leading-display` | `1.1` | `:68` |
| `--leading-body` | `1.4` | `:68` |
| Título de página | `.lite-page-title`: `--text-xl`, peso 500, `line-height 1.25`, `--tracking-display` | `:188` |
| Subtítulo | `.lite-page-subtitle`: margem 6px, `--text-muted`, `--text-sm` | `:189` |
| Campos no celular | 16px abaixo de 768px (evita zoom do iOS) | `:193-197` |

### 2.12 Movimento

CSS (`venancor-scope.css`):

| Token | Valor | Linha |
|---|---|---|
| `--ease-enter` | `cubic-bezier(.16,1,.3,1)` | `:69` |
| `--ease-standard` | `cubic-bezier(.22,1,.36,1)` | `:70` |
| `--ease-exit` | `cubic-bezier(.7,0,.84,0)` | `:71` |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | `:72` |
| `--ease-spring` | `linear(...)` com assentamento leve (bounce .15) | `:74` |
| `--duration-instant` | 120ms | `:75` |
| `--duration-fast` | 160ms | `:75` |
| `--duration-standard` | 240ms | `:75` |
| `--duration-considered` | 480ms | `:75` |
| `--duration-spring` | 580ms | `:75` |

JS (`components/arc/motion-tokens.ts`):

| Grupo | Valores | Linha |
|---|---|---|
| `duration` | instant .12, fast .16, exit .18, standard .24, considered .48 (s) | `:2` |
| `ease` | enter `[.16,1,.3,1]`, exit `[.7,0,.84,0]`, standard `[.22,1,.36,1]`, inOut `[.65,0,.35,1]` | `:3-9` |
| `spring.responsive` | stiffness 520, damping 38 | `:11` |
| `spring.gentle` | stiffness 340, damping 34 | `:12` |
| `spring.snappy` | visualDuration .26, bounce .12 (pressões, toggles) | `:14` |
| `spring.smooth` | visualDuration .4, bounce 0 (painéis, altura) | `:16` |
| `spring.morph` | visualDuration .42, bounce .16 (forma, highlight compartilhado, largura) | `:18` |
| `stagger` | char .016, word .04, line .08, item .035 ("Keep total stagger under roughly 0.4s") | `:20-21` |
| `blur` | subtle 2, soft 4, text 8 (px) | `:23` |

Padrões de movimento derivados em `components/light/light-motion.tsx`: `LitePageEnter` (fade + y 8px, `duration.standard`, `ease.enter`; `:13-26`), `LiteList`/`LiteListItem` (cascata `stagger.item`, y 6px, `whileTap scale .99`; `:28-56`), `LitePress` (`whileTap scale .985`; `:58-66`).

### 2.13 Foco

| Regra | Linha |
|---|---|
| `--focus-ring: transparent` (ponteiro não desenha anel, decisão de produto) | `venancor-scope.css:48-50` |
| `:focus:not(:focus-visible) { outline: none }` | `:132` |
| `:focus-visible` (exceto input, textarea, option, menuitem, tabindex -1): `outline 2px solid color-mix(accent-strong 72%)`, offset 2px; ajustável por `--focus-outline`, `--focus-outline-width`, `--focus-outline-offset` | `:133-136` |
| Campos: foco só pela borda (`border-color: var(--foreground)`) | `input.module.css:7`, `search-field.module.css:6`, `password-field.module.css:6` |
| Listas Lite: `outline 2px solid var(--chat-action-text)` | `people-list.module.css:28,31,45` |
| Precedente diretor: mantém `focus-visible:ring-2 ring-ring/50` do Tailwind (com `--ring` índigo escuro) | `conversations-workspace.tsx:893,1615` |

### 2.14 Camadas (z-index efetivos; não há token de z-index no Lite)

| Camada | z-index | Linha |
|---|---|---|
| cabeçalho e composer do chat | 5 | `chat.module.css:95,200` |
| popover do DatePicker | 20 | `date-picker.module.css:20` |
| pílula flutuante | 20 | `chat.module.css:227` |
| app header Lite | `z-30` | `light-app-header.tsx:43` |
| side rail / bottom nav | `z-30` / `z-40` | `light-side-rail.tsx:23`, `light-bottom-nav.tsx:18` |
| overlay / painel do BottomSheet | 50 / 51 | `bottom-sheet.module.css:1,10` |
| dica (TipHost) | 60 | `chat.module.css:421` |
| cartão de boas-vindas | 80 | `lite-welcome.module.css:3` |
| vídeo de boas-vindas | 90 | `welcome-video.module.css:3` |
| tour | 95 | `lite-tour.module.css:2` |
| aviso dinâmico | 100 (o doc diz 90) | `dynamic-notice.module.css:7` |
| câmera | 1000 | `chat.module.css:407` |

Comparação: o CRM tem `--zindex-*` de -1 a 1050 (`app/globals.css:208-216`) e os overlays shadcn usam `z-50` (`components/ui/dialog.tsx:29,49`, `popover.tsx:31,40`, `dropdown-menu.tsx:36,44`, `tooltip.tsx:61,66`, `sheet.tsx:31`). Overlay do BottomSheet (50) empata com o `z-50` do shadcn: a ordem passa a depender da ordem no DOM.

### 2.15 Preferências de acessibilidade aplicadas ao escopo

| Preferência | Efeito | Linha |
|---|---|---|
| `html[data-text-scale="115"|"130"]` | `font-size` 115% / 130% no `html` (atinge o CRM inteiro) | `venancor-scope.css:167-168` |
| `html[data-reduce-motion="1"] .arc-venancor *` | zera duração de transição/animação dentro do escopo | `:169-171` |
| `html[data-contrast="high"] .arc-venancor` | escurece `--text-muted`, `--text-secondary`, `--border`, `--border-subtle`, `--chat-action-text` | `:172-178` |

### 2.16 Outros utilitários globais do escopo

`.lite-rail`, `.lite-split`, `.lite-main` (desktop 2 colunas, `:150-159`), `.lite-rail-skeleton` (`:160-164`), `.light-avatar` (avatar plano em acento suave, `:143`), área de toque estendida de `button[aria-label="Fechar"]` e `[data-grabber]` (`:146-147`), `input[type=date]` contido no iOS (`:199`).

### 2.17 O que existe em `foundation.css` mas NÃO está ativo

`components/arc/foundation.css` não é importado. Ficam de fora: tema escuro `:root[data-theme="dark"]` (`foundation.css:82-120`), 8 acentos por `data-accent` (`:122-137`) e respectivos `--control-on` (`:141-156`), gradiente de marca `--arc-gradient*` (`:50-60`), paleta de séries de gráfico `--series-1..4` com derivação relativa ao acento (`:162-177`) e o foco global com `!important` (`:187-192`). Consequência: **o Lite não tem paleta de gráficos ativa** nem tema escuro validado.

### 2.18 Tokens locais por módulo

- `chat.module.css:6-20` (`.root`): `--chat-action*`, `--chat-unread`, `--chat-online`, `--chat-tip*`, `--chat-gutter`, `--chat-maxw`, `font-family: var(--font-body)`.
- `people-list.module.css`: `--i` (índice da cascata, `:5`), `--cols` (`:15`), `--hue` do avatar (`:51`, calculado em `people-list.tsx:16`).
- `my-team-page.module.css` / `team-settings.module.css`: `--team-hue` (`my-team-page.module.css:19,36`, `team-settings.module.css:8,14`).
- `chat.module.css`: `--paused-hue` (`:347-362`), `--presence-hue: 28` (`:365`), `--tone` (`:273-277`).

### 2.19 Colisões com `app/globals.css` e o que acontece ao envolver telas do diretor em `.arc-venancor`

Mecânica: o Tailwind 4 do projeto usa `@theme inline` (`app/globals.css:17-63`), então `bg-accent`, `border-border`, `text-muted-foreground`, `ring-ring` etc. compilam para `var(--accent)`, `var(--border)`... (confirmado no CSS compilado: `.bg-accent { background-color: var(--accent) }`). As utilidades de tamanho de texto do tema padrão também apontam para variáveis (`.text-xl { font-size: var(--text-xl); line-height: var(--tw-leading, var(--text-xl--line-height)) }`). Logo, **qualquer variável redefinida em `.arc-venancor` muda a renderização de qualquer componente shadcn/Tailwind dentro dele**.

| Token | CRM (`globals.css`) | Escopo Lite | Efeito dentro do escopo | Gravidade |
|---|---|---|---|---|
| `--accent` / `--accent-foreground` | `#f4f3f0` / `#09090b` (`:102-103`): cinza-quente de hover | `#3b2dff` / `#fff` (`venancor-scope.css:104,107`) | `hover:bg-accent`, `focus:bg-accent` (`components/ui/dropdown-menu.tsx:99,115,140,186,228`), `data-[selected=true]:bg-accent` (`command.tsx:124`), `hover:bg-accent` e `bg-accent/70 text-primary` (`combobox.tsx:132-133`), `aria-pressed:bg-accent` (`toggle.tsx:9`), faixa de intervalo (`calendar.tsx:107-113,204`) ficam **índigo sólido com texto branco**. Fora de `ui/`: 47 ocorrências de `*-accent*` em 25 arquivos de `app/`, `features/`, `components/` | Alta |
| `--text-xl` a `--text-5xl` | padrão Tailwind 20/24/30/36/48px | 22/28/36/52/72px (`:65-66`) | títulos e KPIs crescem; `line-height` continua a razão do Tailwind (`--text-xl--line-height`). 208 usos de `text-xl..5xl` em `.tsx` | Alta (layout de dashboard) |
| `--text-xs/sm/base/lg` | 12/14/16/18 | iguais | nenhum | |
| `--duration-fast` | 250ms (`:162`) | 160ms (`:75`) | tudo que usa `var(--duration-fast)` fica mais rápido; inclui `--tabs-dur` (`globals.css` bloco `--tabs-dur: var(--duration-fast)`) e 32 usos fora de arc/light/chat | Média |
| `--ease-in-out` | `ease-in-out` (`:179`) | `cubic-bezier(.65,0,.35,1)` (`:72`) | utilitário `ease-in-out` (6 usos) e animações que leem a variável mudam de curva | Baixa |
| `--border` | `#e4e4e7` (`:122`) | `rgb(16 16 40 / .08)` (`:101`) | `border-border` vira translúcida e mais clara; tabelas e divisórias perdem contraste | Média |
| `--border-strong` | `#afb0b1` (`:124`) | `rgb(16 16 40 / .18)` (`:103`) | idem, mais leve | Baixa |
| `--input` | `#e4e4e7` (`:125`) | `var(--border-strong)` (`:96`) | campos shadcn ficam com borda mais escura que o CRM (igual ao Arc) | Baixa (desejado) |
| `--ring` | `#3b2dff` (`:126`) | `#2a1fd1` (`:97`) | foco um tom mais escuro | Baixa |
| `--background` | `#ffffff` (`:86`) | `#f7f7f9` (`:78`) | `bg-background` vira cinza-claro: a página "afunda" e os cartões brancos aparecem | Média (desejado) |
| `--foreground` | `#09090b` (`:87`) | `#0b0b12` (`:82`) | imperceptível | |
| `--muted` / `--secondary` | `#f4f3f0` quente (`:99,105`) | `#f1f1f5` frio (`:92,94`) | todos os cinzas de fundo mudam de temperatura | Média (desejado) |
| `--muted-foreground` | `#71717a` (`:106`) | `#666674` (`:95`) | texto secundário um pouco mais escuro | Baixa |
| `--success` | `#10b981` (`:113`) | `#0f7a4d` (`:110`) | verdes ficam escuros; `bg-success` com texto branco ganha contraste, mas tintas `bg-success/10` mudam | Média |
| `--warning` | `#f59e0b` (`:110`) | `#a15c00` (`:111`) | âmbar vira marrom-ocre | Média |
| `--destructive` | `#ef4444` (`:116`) | `#d4263a` (`:98,112`) | vermelho mais fechado | Baixa |
| `--radius-control` | `999px` (`:189`) | `9999px` (`:116`) | equivalente | Nenhuma |
| `--radius-panel` | `1.5rem` (`:191`) | `1.5rem` (`:117`) | igual (o `rounded-xl` do CRM aponta para ela, `:62`) | Nenhuma |
| `--primary` | `#3b2dff` | `#3b2dff` | igual | Nenhuma |
| `--card`, `--popover` | branco | branco | igual | Nenhuma |
| `--font-*` | `--font-sans` Jakarta | `--font-body`/`--font-display` Jakarta | nomes diferentes, mesma família; sem colisão | Nenhuma |
| Tokens só do Lite (`--surface`, `--surface-muted`, `--text-muted`, `--text-secondary`, `--danger`, `--neutral-*`, `--space-*`, `--shadow-resting/raised/floating`, `--control-*`, `--chat-*`) | não existem no CRM | definidos só no escopo | **fora do escopo ficam indefinidos**: um componente Arc ou um CSS module Lite renderizado sem ancestral `.arc-venancor` (por exemplo em portal) perde fundo, borda e cor | Alta para portais |

Também importante: dentro do escopo, `color-scheme: light` (`:9`) e valores claros fixos. Se o CRM estiver com `.dark` (`app/globals.css:309`), utilitários `dark:` do Tailwind (`@custom-variant dark (&:is(.dark *))`, `:15`) continuam disparando por cima de tokens claros. O escopo não tem modo escuro.

**Implicações para envolver telas do diretor:**

1. Antes de envolver qualquer tela, neutralizar `--accent` para componentes shadcn. Opções: (a) no escopo do diretor, redefinir `--accent: var(--surface-muted); --accent-foreground: var(--foreground)` e usar um nome próprio para o índigo Arc (exige trocar `var(--accent)` nos módulos Arc e Lite por um novo token, por exemplo `--arc-accent`); ou (b) um modificador `.arc-venancor.is-crm` que só reverte `--accent`/`--accent-foreground`/`--text-xl..5xl`/`--duration-fast`/`--ease-in-out`. A opção (b) é a menos invasiva.
2. Fixar `--text-xl..5xl` com os valores do Tailwind na camada do diretor, ou aceitar e revisar cada título/KPI (208 usos).
3. Decidir explicitamente `--success`/`--warning` (o Lite é mais escuro e acessível; o CRM é o Tailwind 500).
4. Bloquear o modo escuro nas telas convertidas, ou portar o `:root[data-theme="dark"]` do `foundation.css` para `.dark .arc-venancor`.

---

## 3. Catálogo de componentes Lite

Legenda de maturidade: **Consolidado** (muitos usos em produção, já ajustado ao Lite), **Em uso** (alguns usos), **Pontual** (1 ou 2 usos), **Sem uso** (existe, não é importado em produção). Contagens = arquivos de produção que importam (sem testes e sem `app/dev`).

### 3.1 Arc (`components/arc/*`)

| Componente | Arquivo | Props principais | Quando usar | Maturidade | Observações para o diretor |
|---|---|---|---|---|---|
| Button | `arc/button/button.tsx:13-17`, CSS `button.module.css` | `variant` primary/secondary/ghost/danger, `size` sm/md/lg (44/44/50px no escopo), `loading` | qualquer ação; rótulo troca com morph de largura | Consolidado (29) | **Primário é preto** (`--foreground`, `button.module.css:13`), não índigo. Pressão `scale .97/.985/.96` por largura (`button.tsx:20-25`). Gatilhos de camada não escalam (`button.module.css:5`, `button.tsx:95-96`) |
| ActionButton | `arc/action-button/action-button.tsx:11-18` | `label`, `pendingLabel`, `successLabel`, `onAction` (async), `resetAfterMs` | ação assíncrona com estado salvo/salvando/salvo, seta que sai, check desenhado | Em uso (5) | Defaults em inglês ("Saved"/"Saving", `:104`): sempre passar rótulos pt-BR |
| Badge | `arc/badge/badge.tsx:12-16`, CSS `badge.module.css:44-48` | `tone` neutral/success/info/warning/danger, `size` sm(22px)/md(26px), `icon` | status em pílula com tinta | Consolidado (23) | "info" usa o acento índigo |
| Avatar | `arc/avatar/avatar.tsx:8` | `name`, `src`, `size` sm28/md36/lg48/xl88, `status` online/offline | pessoa; iniciais; foto com fade de blur | Consolidado (16) | Com `.light-avatar` vira plano em acento suave (`venancor-scope.css:143`) |
| BottomSheet | `arc/bottom-sheet/bottom-sheet.tsx:16-32` | `trigger`, `open`/`onOpenChange`, `title`, `description`, `detents` (frações da viewport), `initialDetent`, `closeLabel`, `className` | menus, ações contextuais, formulários curtos no celular | Consolidado (23) | Portal Radix/Base: **exige `className="arc-venancor"`**. Largura máx 36rem (`bottom-sheet.module.css:16`), sempre ancorado embaixo: no desktop não substitui um Dialog centralizado |
| SegmentedControl | `arc/segmented-control/segmented-control.tsx:8-17` | `options` {value,label,accessory}, `value`, `onValueChange`, `label`, `onOptionIntent` | 2 a 5 visões ("Assistentes / Leads"), filtros de período | Consolidado (13) | Pílula branca desliza com `spring.morph` (`:68`); `LayoutGroup` por instância (`:66`); rola horizontalmente com fade nas bordas |
| EmptyState | `arc/empty-state/empty-state.tsx:9-17` | `title`, `description`, `action`, `icon` (padrão `Folder`), `label` | vazio de lista/tela | Consolidado (25) | Ícone em quadrado `--radius-panel` cinza; texto troca com morph de altura |
| Input | `arc/input/input.tsx:9-12` | `label` (obrigatório), `description`, `error` + atributos nativos | campo com rótulo acima | Em uso (11) | Pílula 44px, borda forte, foco só por borda |
| Textarea | `arc/textarea/textarea.tsx:7` | `label`, `description`, `error` | texto longo | Em uso (7) | Raio 1.125rem forçado (`venancor-scope.css:182`) |
| SearchField | `arc/search-field/search-field.tsx:8` | `label`, `value`, `onValueChange`, `clearLabel` | busca com limpar | Em uso (5) | `clearLabel` padrão em inglês |
| PasswordField | `arc/password-field/password-field.tsx:10-15` | `label`, `description`, `messages` | senha com olho | Em uso (3) | Mensagens padrão em inglês (`:9`) |
| Switch | `arc/switch/switch.tsx:11-13` | Radix Switch + `label` | ligar/desligar | Em uso (5) | 42x24, trilho índigo |
| RadioCards | `arc/radio-cards/radio-cards.tsx:10-41` | `options` {value,label,description,meta,icon,disabled,disabledReason}, `layout` grid/list, `minColumnWidth`, `name` | escolha única rica (plano, unidade, papel) | Em uso (6) | Anel que salta de cartão em cartão |
| ChipGroup | `arc/chip-group/chip-group.tsx:10-29` | `options`, `value: string[]`, `multiple`, `maxVisible` (+N) | filtros/etiquetas, seleção múltipla sem busca | Em uso (6) | É o mais perto de multi-select do Lite |
| Skeleton | `arc/skeleton/skeleton.tsx:8-17` | `lines`, `avatar`, `loading`, `children` | carregamento com crossfade | Em uso (5) | Pulso finito (11 ciclos) |
| Stepper | `arc/stepper/stepper.tsx:12-43` | `steps` {id,label,description,error}, `current`, `orientation`, `onStepSelect`, `details`, `compact` | progresso de fluxo em etapas | Pontual (2) | Indicador, não um formulário em etapas |
| Slider | `arc/slider/slider.tsx:11-42` | `label`, `value` número ou par, `marks`, `format`, `largeStep`, `start`/`end` | faixa numérica | Pontual (2) | Suporta intervalo |
| AnimatedCounter | `arc/animated-counter/animated-counter.tsx:8-14` | `value`, `label`, `prefix`/`suffix`, `decimals`, `animateOnView`, `locale` (padrão en-US) | número de KPI que rola | Pontual (2) | Passar `locale="pt-BR"` |
| MetricCard | `arc/metric-card/metric-card.tsx:8` | `label`, `value`, `suffix`, `context`, `change` (+/-) | KPI com variação | Pontual (1) | **Visual Arc puro**: borda + `--radius-surface` + padding 24 (`metric-card.module.css:1`). O padrão Lite real de número é o bloco cinza (3.4) |
| Calendar | `arc/calendar/calendar.tsx:14-26` | `value`, `onChange`, `month`, `minDate`/`maxDate`, `disabledDates`, `showToday` | data única inline | Pontual (1) | Sem intervalo; `use-today.ts:98` cita um `date-range-picker` que não existe no repo |
| DatePicker | `arc/date-picker/date-picker.tsx:12-25` | `label`, `value`, `onChange`, `format`, `locale` (padrão en-US), `placeholder` ("Select a date") | data única em campo | Pontual (1) | Popover **absoluto, sem portal** (`date-picker.module.css:20`, z-index 20): pode ser cortado por `overflow:hidden` de cartões e tabelas |
| ExpandableCard | `arc/expandable-card/expandable-card.tsx:11-20` | `title`, `description`, `defaultExpanded`, `width`, `expandedWidth` | acordeão de um item | Pontual (1) | Borda + raio surface (Arc puro) |
| FileDropzone | `arc/file-dropzone/file-dropzone.tsx:18-34` | `accept`, `multiple`, `maxFiles`, `onUpload` (progresso, abort), `maxSize`, `listPlacement`, `compactAt` | upload com lista e progresso | Pontual (1) | Textos padrão em inglês (`:202`) |
| ArcProvider | `arc/lib/arc-provider.tsx:66-79` | `link`, `image` | trocar `<a>`/`<img>` por `next/link`/`next/image` | Infra | |

### 3.2 Light (`components/light/*`)

| Componente | Arquivo | Props | Quando usar | Maturidade |
|---|---|---|---|---|
| LightChrome | `light/light-chrome.tsx:38-70` | `children`, `user`, flags (`showQuoteSimulator`, `journeyEnabled`, `teamManagementEnabled`...), `audience` broker/supervisor/manager, `initialChatRail` | moldura do app Lite: rail de conversas no desktop (`.lite-split`), header, sheet "Mais", tour, dicas | Consolidado (é a moldura) |
| LightAppHeader | `light/light-app-header.tsx:19-37` | `availability`, `onOpenMore`, `actions`, `hideAvailability` | barra do app: voltar + título (raiz `text-xl/500`, interna `text-base/500`) + pílula de disponibilidade + "Mais" 44px | Consolidado |
| LightBackButton | `light/light-back-button.tsx:14` | `fallbackHref`, `alwaysParent` | voltar sem loop (histórico do app, senão pai com replace) | Interno do header |
| LightMoreSheet | `light/light-more-sheet.tsx:22-52` | destinos por flags e `audience` | menu secundário em BottomSheet (lista agrupada em cartão cinza, `:77-90`) | Consolidado |
| LightAuthShell / LightAuthTitle | `light/light-auth-shell.tsx:13,33` | `children`, `footer` / `title`, `description` | login, primeiro acesso, 2FA | Em uso |
| LightPageSkeleton | `light/light-page-skeleton.tsx:13` | `variant` list/detail/dashboard, `label` | `loading.tsx` de rota (cartões brancos `rounded-3xl` com sombra) | Em uso (6) |
| LitePageEnter / LiteList / LiteListItem / LitePress | `light/light-motion.tsx:13,40,49,59` | `children`, `className`, `label` | entrada de página, lista em cascata, pressão | Em uso (2 a 3) |
| PeoplePage / PeopleStats / PeopleFilters / PeopleSection / PeopleRow / PeopleEmpty | `light/people-list/people-list.tsx:20,41,56,89,118,145` | ver `:98-116` (`name`, `href`, `seed`, `avatar`, `chip`, `preview`, `previewTone`, `meta`, `dot`, `action`, `faded`, `index`) | **o padrão de lista do Lite** ("agenda telefônica", 17/10) para leads, clientes, equipe, conversas da equipe | Consolidado (8 telas: `features/broker-workspace/components/light-clients-list.tsx`, `light-leads-list.tsx`, `light-conversations-view.tsx`, `features/manager-workspace/manager-lite-team.tsx`, `features/supervisor-workspace/my-team-page.tsx`, `supervisor-leads-radar.tsx`, `team-on-duty-list.tsx`, `features/team-conversations/team-conversations-list.tsx`) |
| LightSideRail | `light/light-side-rail.tsx:15` | `activeTab`, `queueBadgeCount`, `brand`, `userName` | trilho de ícones 72px (DEC-137) | **Sem uso** desde a remodelação de 2026-10-09 (`light-chrome.tsx:32-33`) |
| LightBottomNav | `light/light-bottom-nav.tsx:18` | idem | barra flutuante em pílula no celular | **Sem uso** |
| Rotas e navegação | `light/light-routes.ts`, `light-navigation.ts`, `use-light-route.ts`, `use-top-strip.ts` | | rotas permitidas, títulos, pais; faixa fixa no topo ajusta `--app-dvh` | Infra |

### 3.3 Chat (`components/chat/*`)

| Componente | Arquivo | Props principais | Quando usar | Maturidade |
|---|---|---|---|---|
| ChatScreen | `chat/chat-screen.tsx:46` | roteiro (`ChatScript`), identidade, `onAction` (`ChatActionRunner`, `:17-18`), modos embutido/fill | tela de conversa inteira (header, conversa, opções, composer) | Consolidado (Lite do corretor) |
| AssistantChat | `chat/assistant-chat.tsx:20` | `identity`, `script`, `instant`, `headerAction`, `topNotice`, `agentId`, `canWrite` | conversa de um assistente | Consolidado |
| ChatBlockView | `chat/chat-blocks.tsx:193` | `block` (date, system, assistant, user, whatsapp, facts, list, bars, steps, button, consent...) | blocos da conversa | Consolidado |
| ChoiceList | `chat/chat-blocks.tsx:50` | opções A..G | respostas sugeridas (alvo 44px) | Consolidado |
| TypingIndicator | `chat/chat-blocks.tsx:30` | `label` | "digitando" | Consolidado |
| MessageEnter | `chat/chat-blocks.tsx:369` | `delay` | envolver bloco que entra (y 8px, 180ms) | Consolidado |
| Composer | `chat/composer.tsx:62` | menções (`BROKER_MENTIONS`, `:24`), placeholder, `inputMode` | entrada de texto com `@` | Consolidado |
| ThreadRow / ThreadList | `chat/thread-row.tsx:37,75` | `thread`, `now`, `index`, `active`, `timeOnly` / `threads`, `groupByDay`, `activeId` | lista de conversas (rail) | Consolidado |
| ThreadListScreen | `chat/thread-list-screen.tsx:18` | título, busca, threads | lista em tela cheia | Em uso |
| ChatHome | `chat/chat-home.tsx:136-143` | `mode` page/rail, `assistants`, `leads`, `summary` | Início do corretor (celular e desktop) | Consolidado |
| AssistantAvatar | `chat/assistant-avatar.tsx:40-51` | `shape` (mochi, onigiri, cubo, favo, nuvem, salte, logo, jack; `types.ts:13`), `hue`, `size`, estado | mascote SVG | Consolidado |
| LiveBlockView | `chat/live-blocks.tsx:73` | `block`, `onLeadOpen` | dados trazidos por `@` (lista, tiles 2 colunas, meta, cartão do lead) | Em uso |
| OperatorAnswerCard | `chat/operator-answer-card.tsx:58` | `card`, `at` | tabela de preço de operadora em seções recolhíveis | Em uso |
| ConsentCard | `chat/consent-card.tsx:22` | `block`, `onDecide` | consentimento de IA (LGPD) | Em uso |
| PausedHero | `chat/paused-hero.tsx:21` | `block` | assistente pausado (aurora + mascote dormindo) | Em uso |
| PresenceCallout / PresenceCalloutList | `chat/presence-callout.tsx:47,232` | `ask`, `variant` home/chat | confirmar presença no plantão (câmera) | Em uso |
| CameraCapture | `chat/camera-capture.tsx:22` | `onShot`, `onClose`, `onFallback` | câmera dentro da página | Em uso |
| ChatAudioPlayer | `chat/chat-audio.tsx:20` | `url` | áudio de WhatsApp no balão | Em uso |
| DynamicNotice | `chat/dynamic-notice.tsx:35` | itens `DynamicNoticeItem` (`:10`) | aviso urgente estilo ilha do iPhone | Em uso |
| TipHost | `chat/tip-host.tsx:68` | (sem props) | dica flutuante a cada 20 min no máximo | Em uso (só corretor) |
| WeekRanking | `chat/week-ranking.tsx:38` | `data: HomeHighlights` | posição na semana + sheet | Em uso |
| LiteWelcome / PushNudge / WelcomeVideo | `chat/lite-welcome.tsx:66`, `push-nudge.tsx:21`, `welcome-video.tsx:24` | `variant` / `onClose` / `onDone` | primeiro acesso | Em uso |
| LiteTour / LiteMicroTour | `chat/tour/lite-tour.tsx:44,97+` | `pathname` | tour guiado com spotlight | Em uso |
| MarkSeenOnView, RefreshSoon | `chat/mark-seen-on-view.tsx:17`, `refresh-soon.tsx:7` | | utilitários sem UI | Infra |

### 3.4 Padrões dos CSS modules (não são componentes, mas são o vocabulário Lite fora do chat)

| Padrão | Definição | Onde |
|---|---|---|
| Página Lite | largura 860, padding 24/16/48 e 32/24/56 a partir de 720px, título `--text-xl`/500 + subtítulo `--text-sm` muted | `venancor-scope.css:186-189`; `people-list.module.css:9-13`; `my-team-page.module.css:1-5,69`; `team-settings.module.css:1-4,49` |
| Bloco cinza de número (stat) | `padding 14px 16px`, raio 1.25rem, `--surface-muted`, número `1.75rem`/500 tabular, rótulo `--text-sm` muted; alerta pinta o número de `--danger`; no celular `1.4rem` | `people-list.module.css:15-20`; variações: `.overview span` (`my-team-page.module.css:21`), `.situationItem`/`.performanceItems li` (`supervisor-broker-profile.module.css:76-81,99-101`), `.stat` desktop (`chat-home.module.css:15-19`), `.liveTile` (`chat.module.css:302-307`) |
| Linha de lista branca | grade `avatar | texto | meta`, padding `12px 14px`, raio 1.25rem, `--surface` + `--shadow-resting`, hover `--surface-muted`, `:active scale .99`, avatar 48px com matiz do nome | `people-list.module.css:37-62` |
| Linha esmaecida | `data-faded`: fundo muted sem sombra | `people-list.module.css:41-42` |
| Segmento de filtro em pílula | trilho `--surface-muted` raio 999 padding 4; botão ativo branco com `--shadow-resting`; contagem tabular ao lado | `people-list.module.css:23-29`; `.windowSwitch` (`supervisor-broker-profile.module.css:94-97`); FilterChip com `layoutId` (`conversations-workspace.tsx:886-910`) |
| Busca em pílula | 44px, sem borda, branco com `--shadow-resting` | `people-list.module.css:30-31` |
| Título de seção | `--text-base`/600 com contagem muted | `people-list.module.css:34-35`; `.sectionTitle` 500 em `my-team-page.module.css:26-28` |
| Cartão branco de seção | `border:0`, raio 1.5rem, `--surface`, `--shadow-resting`, entrada translateY 8px | `supervisor-broker-profile.module.css:19-31`; `light-page-skeleton.tsx:5` (`rounded-3xl ... shadow-(--shadow-resting)`); `light-settings` |
| Cartão cinza de seção | padding 16 a 20, `--radius-panel`, `--surface-muted`, sem sombra | `my-team-page.module.css:6`; `team-settings.module.css:23` |
| Lista agrupada em cartão (estilo ajustes iOS) | cartão `--surface-muted` raio panel, linhas `14px 16px` separadas por `--border-subtle` | `my-team-page.module.css:46-51`; `light-more-sheet.tsx:77-90` |
| Hero da equipe/unidade | cartão branco com foto 96px e números em blocos | `my-team-page.module.css:18-22,62-64` |
| Ação principal de formulário | pílula 48px, `--chat-action-strong`, branca | `handoff-form.module.css:17-18`; `.primaryAction` 44px com raio panel (`supervisor-broker-profile.module.css:47-63`) |
| Ação secundária | pílula muted ou branca com borda | `handoff-form.module.css:20`; `.secondaryAction` |
| Opção selecionável | cartão borda 1px raio panel; escolhida com borda e 8% de `--chat-action` | `handoff-form.module.css:6-9` |
| Zona de perigo | borda e fundo em `color-mix(danger)` | `my-team-page.module.css:54-56` |
| Barra/progresso | trilho 8px `--neutral-4` ou muted, preenchimento `--chat-action`, `transform-origin:left` (anima `scaleX`) | `week-ranking.module.css:26-27`; `supervisor-broker-profile.module.css:138-139`; `chat-home.module.css:20-21` |
| Barras semanais | colunas em pílula `--chat-action` sobre bloco muted | `supervisor-broker-profile.module.css:127-130`; `.bars` do chat `chat.module.css:175-177` |
| Pílula de ação "Agora" | 44px, `--accent` índigo, 600 | `chat-home.module.css:100-103` |
| Precedente diretor (`data-lite`) | painéis sem borda com sombra, filtros em pílula, linha raio 1.25rem, contagem em pílula | `app/(dashboard)/conversas/conversas-lite.module.css:7-84` |

### 3.5 Lacunas: o que o modo diretor precisa e o Lite ainda NÃO tem

| Necessidade do diretor | Existe no Lite? | Mais próximo hoje | Comentário |
|---|---|---|---|
| Tabela de dados densa (ordenação, colunas, seleção, sticky header) | Não | `PeopleRow` (lista em cartões), `.facts`/`.listRows` do chat | O doc manda "escape para o completo" para tabela grande (`LITE_CHAT_DESIGN_SYSTEM.md:28`). Precisa de um padrão "tabela Lite" novo (cabeçalho sem caps, linhas sem bordas verticais, hover muted, raio no contêiner) |
| Kanban | Não | nenhum | Criar do zero com colunas `--surface-muted` e cartões brancos `--shadow-resting` |
| Gráficos (linha, área, pizza, funil) | Parcial | barras CSS (`chat.module.css:175-177`), funil em barras (`supervisor-broker-profile.module.css:136-139`), `AnimatedCounter` | `--series-1..4` só existe no `foundation.css` não carregado; o CRM tem `--chart-1..5` (`globals.css`). Definir paleta de gráfico no escopo |
| Date range | Não | `Calendar`/`DatePicker` de data única | Arc upstream tem `date-range-picker` (citado em `arc/lib/use-today.ts:98`), não instalado |
| Combobox (busca + lista) | Não | `SearchField` + lista | |
| Multi-select | Parcial | `ChipGroup multiple` (`chip-group.tsx:24-27`) | Sem busca, sem portal, não serve para listas longas (corretores, unidades) |
| Select | Não | `<select>` nativo (16px no celular, `venancor-scope.css:195`) ou `SegmentedControl` | |
| Dropdown menu | Não | `BottomSheet` com lista (padrão "•••", `my-team-page.tsx:105`) | No desktop o sheet sobe do rodapé; falta menu ancorado |
| Tooltip | Não | nenhum | |
| Popover genérico | Não | só o popover interno do `DatePicker` (absoluto) | |
| Dialog de confirmação centralizado | Não | `.sheetDanger` dentro de sheet (`my-team-page.module.css:54-56`) | Ação destrutiva hoje é confirmada no próprio sheet |
| Toast | Não (por regra) | confirmação na conversa (`LITE_CHAT_DESIGN_SYSTEM.md:224`), `.pushToast` decorativo | O diretor usa `sonner` (`app/layout.tsx:115`) |
| Stepper de formulário (wizard) | Parcial | `Stepper` (indicador), fluxo guiado do chat (`progress` "x de y") | Falta casca de wizard com rodapé de navegação |
| Upload | Sim | `FileDropzone` | Pontual, textos em inglês |
| Paginação | Não | nenhum | Listas Lite carregam tudo |
| Breadcrumbs | Não | voltar + título (`light-app-header.tsx:49-57`) | O `DashboardHeader` do CRM tem `breadcrumb` (`conversas/page.tsx` mantém) |
| Sidebar desktop com navegação | Não (em produção) | `.lite-rail` é a lista de conversas; `LightSideRail` 72px existe mas sem uso | Diretor tem muitas seções: precisa de sidebar Lite própria |
| Command palette | Não | menu `@` do composer (`chat.module.css:215-219,259-277`) | |
| Checkbox | Não | tokens `--control-*` citam checkbox (`venancor-scope.css:36`), mas não há componente | |
| Tabs de página | Parcial | `SegmentedControl` | Sem variante sublinhada |
| Accordion múltiplo | Parcial | `ExpandableCard` (um por vez), seções do `OperatorAnswerCard` | |
| Barra de seleção em massa | Não | nenhum | CRM tem `selection-toolbar.tsx` |
| Filtros ativos (chips removíveis) | Não | `ChipGroup` | CRM tem `foundations/active-filter-chips` |
| KPI card no padrão Lite | Parcial | bloco cinza (3.4); `MetricCard` está no visual Arc puro | Unificar |
| Drawer lateral de detalhe (desktop) | Não | BottomSheet | CRM usa `foundations/detail-drawer` |
| Tema escuro | Não | só os azuis do chat trocam | |

---

## 4. Regras de linguagem visual extraídas do código

### 4.1 Espaçamento e grade
- Escala de 4px (`--space-*`). Na prática: 8px entre linhas e blocos de número, 12px entre painéis, 16px entre seções, 20px de calha no chat (citações em 2.9).
- Página de conteúdo em coluna única de 860px centralizada; listas e cartões ocupam a largura da coluna.
- Desktop (1024px+): conversa/lista à esquerda 360px e conteúdo ao centro (`venancor-scope.css:152-156`, `chat-home.module.css:46-64`).

### 4.2 Cantos e superfícies
- Controles, campos, botões, filtros e linhas de lista: pílula (`--radius-control: 9999px`). Exceção: textarea 1.125rem.
- Cartões: 24px (`--radius-panel`) ou 28px (`--radius-surface`); linhas e blocos de número: 20px; blocos pequenos: 16px.
- **Cartão = superfície + sombra, sem borda** (`venancor-scope.css:113`; `supervisor-broker-profile.module.css:19-24`; `conversas-lite.module.css:30-36` com `border: 0 !important`).
- Dois tipos de cartão convivem: branco com `--shadow-resting` sobre fundo branco/cinza, ou cinza `--surface-muted` sem sombra. Blocos dentro de cartão branco são cinza; cartões soltos na folha branca são brancos com sombra ou cinza.
- Toda tela Lite é "uma folha branca" (`venancor-scope.css:139-140`); o diretor no precedente usa a folha `#f7f7f9` com painéis brancos (`conversas-lite.module.css:11,16`).

### 4.3 Blocos cinza de número
- Número grande em peso 500 com `tabular-nums` e `--tracking-display`, rótulo pequeno muted embaixo, fundo `--surface-muted`, sem borda, sem sombra. Cor de alerta só no número (`people-list.module.css:16-20`).
- Grade em `repeat(var(--cols), 1fr)` (`people-list.module.css:15`) ou `auto-fit minmax(7rem..140px)` (`my-team-page.module.css:63`, `chat-home.module.css:15`).
- Pode ser link (`PeopleStats` com `href`, `people-list.tsx:45-48`).

### 4.4 Pílula de ação principal
Há três variantes vivas, o que é uma inconsistência a decidir antes de generalizar:
1. Azul de ação `--chat-action` (chat, CTA de dica, botão de link: `chat.module.css:52-58,212,430`) e `--chat-action-strong` (formulários de supervisor: `handoff-form.module.css:18`, `supervisor-broker-profile.module.css:63`). Alturas 44 a 50px.
2. Pílula flutuante com **gradiente** vertical `chat-action → chat-action-strong` e sombra azul (`chat.module.css:228-232`; `lite-welcome.module.css:31-34`; `welcome-video.module.css:19-21`).
3. Índigo `--accent` (`chat-home.module.css:100-103`, "Agora") e Arc `Button primary` **preto** (`button.module.css:13`).
Regra comum: uma ação primária por superfície (`LITE_CHAT_DESIGN_SYSTEM.md:24`), pílula, texto branco 500 (às vezes 600), `:active scale .97/.98`.

### 4.5 Texto
- Sentence case sempre; nenhum `text-transform: uppercase` nos módulos Lite (busca em `components/chat`, `components/light`, `features/supervisor-workspace`, `features/manager-workspace`: zero ocorrências). Sem rótulo/overline acima de título (`LITE_CHAT_DESIGN_SYSTEM.md:85`).
- Uma família (Plus Jakarta Sans). Títulos com tracking negativo `-.03em`; corpo `-.01em`.
- Pesos: predominante 400/500 (154 ocorrências de 500 contra 42 de 600/700 nos módulos Lite). O 600 aparece em código mais novo: nome na lista (`people-list.module.css:55`), título de seção (`:34`), "Agora" (`chat-home.module.css:92,97,100`), presença (`chat.module.css:373,385`), aba ativa da bottom nav (`light-bottom-nav.tsx:14`). DEC-137 fixa "pesos 400 a 700" (`docs/decision-log.md:1698`); o doc do chat diz "Nunca 600/700" (`LITE_CHAT_DESIGN_SYSTEM.md:80`).
- Números sempre `font-variant-numeric: tabular-nums`.
- Português, tom de colega, sem travessão, erro diz o que fazer (`LITE_CHAT_DESIGN_SYSTEM.md:214-224`).

### 4.6 Alvos de toque
- Mínimo 44px: `--control-height-sm: 2.75rem` (`venancor-scope.css:121`), opção do chat `min-height: 44px` (`chat.module.css:187`), botões redondos `size-11` (`light-app-header.tsx:13`, `light-back-button.tsx:28`), gatilho "•••" 44px (`my-team-page.module.css:36`), busca 44px (`people-list.module.css:30`).
- Botões menores estendem a área com pseudo-elemento (`venancor-scope.css:146-147`; `slider.module.css:22`).

### 4.7 Gradiente
- Regra declarada: "Sem gradiente, sem sombra empilhada" (`docs/decision-log.md:1698`; estudo `docs/design-system/lite/2026-10-21-estudo-visor-animacoes.md:4`).
- Exceções existentes no código (19 ocorrências): pílula flutuante (`chat.module.css:230`), botões de boas-vindas/vídeo/tour (`lite-welcome.module.css:31`, `welcome-video.module.css:19`, `lite-tour.module.css:22,81`), sino do push (`lite-welcome.module.css:38`), brilho do consentimento (`chat.module.css:332`), aurora do pausado e halo da presença (`chat.module.css:346-349,368`), cartão e hero do ranking (`week-ranking.module.css:2,15`), prévia do convite (`team-settings.module.css:8`), fade do composer (`chat.module.css:200`), shimmer (`chat.module.css:279`). Para o diretor, seguir a regra: nenhum gradiente em telas de trabalho.

### 4.8 Sombras
- Três níveis apenas: resting (cartões, linhas, botões de ícone), raised (composer), floating (camadas flutuantes). Ver 2.8.
- Hover de cartão no desktop pode subir 1px (`chat-home.module.css:55`) ou trocar o fundo para `--neutral-3`.

### 4.9 Ícones
- `lucide-react` em todo o Lite (14 imports em chat/light/arc/supervisor/manager); traço padrão, `size-4/5`, 18px no header; `strokeWidth` 2.4 ativo e 1.9 inativo na navegação (`light-bottom-nav.tsx:50`). Exemplos: `ChevronLeft`, `ChevronRight`, `Ellipsis`, `House`, `ListChecks`, `MessageSquareText`, `ArrowRight`, `Folder`, `ChevronDown`, `LogOut`.
- O modo diretor ainda mistura `@phosphor-icons/react` e `@hugeicons/react` (o precedente usa `MagnifyingGlass` do Phosphor dentro do escopo, `conversations-workspace.tsx:398`). Padronizar em lucide na conversão.

### 4.10 Mascotes e ilustrações
- Mascotes SVG por assistente com formas e matiz (`chat/assistant-avatar.tsx:8,40-51`; `types.ts:13`): cor `oklch(86% .1 h)` topo, `66% .17 h` base, `54% .18 h` fundo; matizes Leads 212, Plantão 28, Agenda 150, Cotação 268, Desempenho 330, Insights 200 (`LITE_CHAT_DESIGN_SYSTEM.md:74`). Estados idle/working (respira)/waiting (ponto azul).
- Avatares de pessoa: iniciais sobre matiz derivado do nome `hsl(hue 52% 91%)` / texto `hsl(hue 42% 30%)` (`people-list.module.css:51`, `people-list.tsx:16`).
- Ilustração 3D (voxel) existe no CRM (`components/illustrations/voxel-illustration.tsx`, `public/illustrations/voxel/*.png`) mas não é usada no Lite; o estudo propõe usá-la em estados vazios (`2026-10-21-estudo-visor-animacoes.md`, item 8). Banner de aviso aprovado: modal de 2 colunas com ilustração 3D (memória do Vinicios).
- Emojis como medalha no ranking (`week-ranking.module.css:7,18`).

### 4.11 Animações
| Padrão | Especificação | Onde |
|---|---|---|
| Entrada de página | fade + y 8px, 240ms, `ease.enter` | `light-motion.tsx:13-26`; `chat-home.tsx:292` |
| Entrada CSS sem hidratação | `rise` translateY 8px, 220ms, `cubic-bezier(.22,1,.36,1)`, atraso `--i × 30ms` (máx 12) | `people-list.module.css:3-6`, `people-list.tsx:18` |
| Cascata de lista | y 6px, 180ms, `[.16,1,.3,1]`, `min(index,8) × 35ms` | `thread-row.tsx:42-44`; `LiteList` `stagger.item` |
| Opções do chat | y 6px, atraso `50ms + i × 40ms` | `chat-blocks.tsx:88-91` |
| Mensagem nova | y 8px + fade 180ms | `chat-blocks.tsx:19,369-372` |
| Precedente diretor | linhas y 6px 240ms com `index × 20ms` até 14 itens; últimas 3 mensagens y 8 + scale .98 260ms; painel do cliente x 12px 280ms | `conversations-workspace.tsx:414-418,992-998,506-511` |
| Segmento/filtro | pílula com `layoutId` e mola (`spring.morph` ou bounce .15 / 0.45s) | `segmented-control.tsx:68`; `conversations-workspace.tsx:899-904` |
| Sheet | molas com detents, saída mais curta, overlay proporcional | `bottom-sheet.tsx:37-55` |
| Pressão | `scale .97` (botões), `.99` (linhas), `.985` (cartões) | `button.tsx:20-25`; `people-list.module.css:43`; `light-motion.tsx:62` |
| Morph de texto | letras/palavras sobem de blur 4px; largura acompanha em `spring.morph` | `button.tsx:28-36`, `badge.tsx:19-23`, `input.tsx:35` |
| Números | odômetro por dígito | `animated-counter.tsx:48-65`; contagem do bloco vivo `live-blocks.tsx:27` |
| Barras/meta | `scaleX`/`scaleY` de 0, 0.6s ou mola `smooth` com cascata 30ms | `chat-home.tsx:348`; `chat-blocks.tsx:344` |
| Pulsos infinitos | pílula de aceitar 1.8s, linha em atenção, presença 2.8s, skeleton finito | `chat.module.css:235-246,368-369`; `skeleton.module.css:3` |
| Proibido | bounce/elastic, animar width/height/top/left (`docs/design-system/MOTION.md:93,116`); o Arc anima largura com mola em controle de texto, aceito como exceção do componente |

### 4.12 Movimento reduzido
- Todo módulo tem `@media (prefers-reduced-motion: reduce)` e todo componente `motion` consulta `useReducedMotion` (ex.: `button.module.css:38`, `people-list.module.css:6`, `light-motion.tsx:14-15`, `conversations-workspace.tsx:247,415,509,997`).
- Preferência própria do app `html[data-reduce-motion="1"]` zera durações dentro do escopo (`venancor-scope.css:169-171`). Fora do escopo ela não vale.

---

## 5. Precedente `ed0af666` e riscos de generalizar

### 5.1 Técnica usada
1. **Import do CSS do escopo na página servidor**: `import "@/components/arc/venancor-scope.css"` (`app/(dashboard)/conversas/page.tsx:5`).
2. **Wrapper**: a raiz da página recebe `className={\`arc-venancor ${liteStyles.root} ...\`}` (`page.tsx:1071`). O `DashboardHeader` do CRM fica **dentro** do escopo (herda tokens Lite).
3. **CSS module dedicado** (`conversas-lite.module.css`, 84 linhas) com seletores de atributo sob `.root`: `[data-lite="frame"|"workspace"|"toolbar"|"panes"|"pane"|"row"|"chip-count"|"search"]` (`:14-70`). Comentário: "Elements opt in with data-lite=... so the shared components stay untouched" (`:5`).
4. **Marcação opt-in no JSX**: 8 atributos `data-lite` adicionados (`conversations-workspace.tsx:321,325,385,393,397,431,502,908,1612`; `page.tsx:1089`).
5. **Especificidade**: onde a classe Tailwind vencia, o módulo usa `!important` (`border: 0 !important` em `[data-lite="pane"]`, `conversas-lite.module.css:31`).
6. **Movimento** adicionado com `motion/react` e uma constante local `LITE_EASE = [0.16,1,0.3,1]` (`conversations-workspace.tsx:884`) em vez de importar `motionTokens`.

### 5.2 O que mudou e o que ficou
| Mudou | Ficou |
|---|---|
| Fundo da página `#f7f7f9`, painéis brancos sem borda com `--shadow-resting` e raio 24px, separação por gap de 12px | Estrutura de 3 colunas, componentes `Input`, `ScrollArea`, `Select`, `Sheet`, `DropdownMenu`, `FilterToolbar`, `DashboardHeader` do CRM |
| Toolbar transparente sem borda | Classes Tailwind originais (`border-r border-border`, `bg-card`, `bg-muted/15`) continuam no JSX e são anuladas pelo módulo |
| Filtros: pílula branca deslizante (`layoutId`) + contagem em pílula muted, índigo suave quando ativo | Ícone Phosphor na busca |
| Linhas raio 20px, hover muted, ativa `--accent-subtle`, pressão `.99` | Tipografia e pesos do CRM nos componentes internos (não houve troca para 400/500) |
| Busca com fundo muted sem borda | Select de unidade/tag, Sheet do perfil e menu "..." abrem em portal com o visual do CRM |
| Cascata das linhas, entrada das 3 últimas mensagens, painel do cliente deslizando | Comportamento, dados, acessibilidade (aria) intactos |

### 5.3 Riscos ao aplicar a técnica em todas as telas

**A. Componentes shadcn (`components/ui/*`) dentro do escopo**
1. `--accent` índigo: itens de menu, combobox, command, toggle, calendário e qualquer `hover:bg-accent` viram índigo sólido com texto branco (2.19). No precedente isso não apareceu porque o menu abre em portal, fora do escopo. **Se algum dia o portal for redirecionado para dentro do escopo (para ganhar o visual Lite), o problema aparece de imediato.**
2. Tipografia: `text-xl..5xl` crescem (22 a 72px). Dashboards e KPIs do diretor (`text-2xl/3xl`) mudam de tamanho sem ninguém ter pedido.
3. Durações: `--duration-fast` 250 → 160ms muda abas (`--tabs-dur`) e transições do CRM; `--ease-in-out` muda a curva.
4. Cores de status: `--success`/`--warning` mais escuros; selos e gráficos do CRM baseados em `bg-success/10`, `text-warning` mudam de tom.
5. Bordas translúcidas: tabelas e `Separator` com `border-border` ficam quase invisíveis sobre `--surface-muted`.
6. O botão shadcn (`button-variants.ts:4-22`) usa `rounded-full`, `text-xs`, `duration-[var(--duration-quick)]`; o Arc `Button` é preto, `text-sm`, 44px. Dentro do escopo coexistiriam dois botões primários diferentes (índigo shadcn e preto Arc).
7. `!important` como regra: cada tela precisará de um módulo com anulações; o custo de manutenção cresce e a ordem de carga do CSS passa a importar.
8. `data-lite` é opt-in manual: componentes compartilhados (por exemplo `ConversationRow`) ganham atributos que só fazem sentido numa tela.

**B. Portais que saem do escopo**
| Camada | Implementação | Portal | Resultado hoje |
|---|---|---|---|
| Dialog | `components/ui/dialog.tsx:16-17,44` (`@base-ui/react/dialog`) | `body` | visual do CRM |
| Sheet | `components/ui/sheet.tsx:22-23,50` | `body` | visual do CRM |
| Drawer | `components/ui/drawer.tsx:59-60,110` | `body` | visual do CRM |
| Popover | `components/ui/popover.tsx:29` | `body` | visual do CRM |
| DropdownMenu | `components/ui/dropdown-menu.tsx:13-14,34` | `body` | visual do CRM (e por isso o `bg-accent` fica cinza) |
| Tooltip | `components/ui/tooltip.tsx:55` | `body` | visual do CRM |
| Select | `components/motion/select.tsx:20,324,353` (`createPortal(..., document.body)`) | `body` | visual do CRM |
| Toast | `<Toaster />` em `app/layout.tsx:115` | raiz | visual do CRM |
| BottomSheet Arc | `arc/bottom-sheet/bottom-sheet.tsx:100,374` | `body` | só fica Lite porque recebe `className="arc-venancor"`; **sem a classe os tokens Arc ficam indefinidos** (fundo transparente) |

Opções para os portais: (1) passar a classe na camada de conteúdo de cada wrapper (`DialogContent`, `PopoverContent`, `SelectContent`... aceitando `className="arc-venancor"`), como já se faz no BottomSheet; (2) usar o `container` dos portais Base UI apontando para um nó dentro do escopo (atenção a `overflow:hidden` e z-index); (3) promover os tokens para um seletor de tema no `html` (`html[data-skin="lite"]`) quando a tela do diretor estiver ativa, o que cobre portais de graça, mas reintroduz o problema de colisão global que levou ao revert de 2026-10-09 (`338eb958`). Qualquer opção que leve portais para dentro do escopo exige resolver antes o `--accent` (A.1).

**C. Outros riscos**
- **Tema escuro**: o escopo força claro. Telas do diretor convertidas deixam de respeitar `.dark` e utilitários `dark:` brigam com tokens claros.
- **Import do CSS**: o arquivo só entra se algum módulo da árvore o importar. Uma tela convertida sem o import herda a classe sem tokens (nada muda) e o erro passa despercebido.
- **z-index**: overlay do BottomSheet (50) empata com o `z-50` do shadcn; o aviso dinâmico (100) e a câmera (1000) ficam acima de tudo.
- **`html[data-text-scale]`** do Lite muda o `font-size` da página inteira (`venancor-scope.css:167-168`), inclusive fora do escopo.
- **Componentes Arc com textos em inglês** (`ActionButton`, `DatePicker`, `SearchField`, `PasswordField`, `FileDropzone`, `AnimatedCounter` com `locale="en-US"`): ao trazer para o diretor, passar sempre pt-BR.
- **DatePicker sem portal** dentro de painéis com `overflow: hidden` (como `[data-lite="pane"]`, `conversas-lite.module.css:35`) será cortado.
- **Histórico**: a pele global foi revertida a pedido do dono e o doc oficial diz "fora do escopo" (`LITE_CHAT_DESIGN_SYSTEM.md:253-259`). A conversão precisa de decisão registrada nova (decision-log) e atualização do §10.

### 5.4 O que o precedente sugere como receita, com correções
1. Importar `venancor-scope.css` no layout do diretor (não página a página).
2. Criar um modificador de compatibilidade do CRM dentro do escopo (`.arc-venancor[data-shell="crm"]` ou similar) que restaure `--accent`, `--accent-foreground`, `--text-xl..5xl`, `--duration-fast`, `--ease-in-out` para os valores do CRM e exponha o índigo Arc por outro nome.
3. Em vez de `data-lite` + `!important` por tela, ajustar os wrappers de `components/ui/*` (card, table, button, input, select, dialog) uma vez, condicionados ao escopo, e dar `className="arc-venancor"` (ou `container`) aos conteúdos em portal.
4. Usar `motionTokens` em vez de constantes locais (`LITE_EASE`).
5. Escolher uma pílula de ação principal (4.4) antes de espalhar.

---

## 6. Divergências doc x código (para corrigir na conversão)

| Tema | Documento | Código |
|---|---|---|
| Canvas da tela | `--background #f7f7f9` é o fundo do canvas (`LITE_CHAT_DESIGN_SYSTEM.md:45`) | `.light-canvas` é branco desde 2026-10-10 (`venancor-scope.css:139-140`) |
| Pesos | "Nunca 600/700" (`LITE_CHAT_DESIGN_SYSTEM.md:80`) | DEC-137 permite 400 a 700 (`docs/decision-log.md:1698`); 42 usos de 600/700 nos módulos Lite |
| Gradiente | proibido (`docs/decision-log.md:1698`) | pílula flutuante descrita com gradiente no próprio doc (`LITE_CHAT_DESIGN_SYSTEM.md:180`) e 19 gradientes no código |
| Navegação | "Sem sidebar, sem barra de abas" (`LITE_CHAT_DESIGN_SYSTEM.md:26,129`) | `LightSideRail` e `LightBottomNav` continuam no repo sem uso (DEC-137 é anterior) |
| z-index do aviso | 90 (`LITE_CHAT_DESIGN_SYSTEM.md:95`) | 100 (`dynamic-notice.module.css:7`) |
| Fontes de token | doc cita `foundation.css` como camada de tokens (`LITE_CHAT_DESIGN_SYSTEM.md:10`) | `foundation.css` não é importado |
| Modo normal | fora do escopo (`LITE_CHAT_DESIGN_SYSTEM.md:253-255`) | `ed0af666` já aplica o Lite às Conversas do diretor |
| Venancor base | títulos 24-28px peso 600, micro em caps (`docs/design-system/venancor.md:42`), tabela com cabeçalho em caps (`:57`) | Lite: título 22px/500, sem caps |
| Movimento CRM | 150-200ms, `cubic-bezier(0.2,0,0,1)` (`venancor.md:63`); quart `(0.25,1,0.5,1)` (`MOTION.md:93`) | Lite: 120/160/240/480/580ms, `(.16,1,.3,1)` e `(.22,1,.36,1)` |
