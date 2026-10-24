# Matriz de qualidade por rota (modo normal -> Lite)

Repo: `ancorahub-lite-listas` (somente leitura). Gerado em 2026-10-24 por script próprio (`scratchpad/matriz/analyze.js` + `report.js`), seguindo imports a partir de cada `page.tsx` (até 6 níveis, só `.tsx` e barrels `index.ts`; para em `components/ui`, `components/arc`, `shared`, `lib`).

## Como ler

- **Papéis**: D diretor, G gestor (manager), S supervisor, C corretor (broker). Fonte: checagens na página, layouts de `integrations/`, `marketing/`, `qualificacao/`, `leads/distribuicao/` (barram G), `custom-roles/routes.ts` (cargo personalizado pode ocultar) e `light-routes.ts` (o que cada público Lite pode abrir; fora disso o layout manda pra /dashboard).
- **Lite**: "sim, sempre" = a tela já é Lite (arc-venancor/light/chat); "ramo Lite + tela normal" = a página escolhe por experiência, a tela normal (alvo da conversão) segue no estilo antigo; "parcial" = tela normal que já usa algum componente arc/light; "não" = 100% estilo antigo.
- **Riscos e a11y** contam só os arquivos da tela NORMAL (o alvo). Em telas "sempre Lite" contam os arquivos Lite. O chrome comum (`DashboardHeader`) foi tirado das linhas e está numa seção própria.
- **loading/error**: todas as rotas herdam no mínimo `(dashboard)/loading.tsx` (RouteLoading: skeleton genérico de 3 cards, não Lite, `max-w-[1280px]`) e `(dashboard)/error.tsx` (RouteError genérico, não Lite). "nenhum" nunca acontece de fato.
- **Animação/reduced motion**: `globals.css:684` zera animation/transition para `*` em `prefers-reduced-motion`, e `InterfaceMotionProvider` (root layout) aplica `MotionConfig reducedMotion="user"`. Então CSS e motion/react declarativo respeitam. Só JS imperativo (requestAnimationFrame, `animate()`) precisa revisão manual.
- **Heurística**: regex sobre JSX. "campo s/ label" = Input/Select/Textarea/Switch sem `id`, `aria-label`, `aria-labelledby`, spread de props ou `<label>` envolvendo (muitos têm `<Label>` visual sem `htmlFor`). "ícone s/ aria-label" = Button `size="icon"` ou só com elemento filho, sem aria-label nem sr-only (os que têm só `title` aparecem marcados "tem so title": nome acessível fraco, sem tooltip no toque). Larguras: `min-w-[>=300px]`, `w-[>=360px]`, `grid-cols-N>=4` e `grid-cols-[...]` largo, todos sem prefixo de breakpoint. Há falsos positivos (ex.: largura dentro de popover) e falsos negativos (texto dinâmico em botão).

## Tabela

| Rota | Só redirect | Papéis | Lite | loading.tsx | Estado vazio | error.tsx | Padrões | Riscos 390px | Riscos a11y | Animação / reduced motion |
|---|---|---|---|---|---|---|---|---|---|---|
| /agenda | não | C (só Lite) | sim, sempre (rota só Lite) | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | lista | 0 | 0 | nenhuma |
| /assinatura | não | D/G/S/C (sem checagem na página) | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards, lista | 0 | 2: 2 cor como única info | tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user) |
| /assistente | não | D/G/S/C | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | simples | 2: 2 overflow-x | 12: 3 ícone s/ aria-label, 1 campo s/ label, 8 cor como única info | motion/react + tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user) |
| /atendimento/fluxo | não | D/G (edição só D) | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | abas, cards, lista | 0 | 0 | nenhuma |
| /atendimento/mensagens | não | D/G | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | abas, cards, dropdown, tabela, sheet, dialog, lista | 1: 1 overflow-x; tabela sem versão mobile | 18: 18 campo s/ label | tailwind animate-*; reduced: verificar: 1 JS imperativo (rAF/animate) |
| /atendimento | sim (p/ /atendimento/situacoes) | D/G | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /atendimento/situacoes | não | D/G | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | abas, cards, dropdown, tabela, lista, sheet | 1: 1 overflow-x; tabela sem versão mobile | 9: 9 campo s/ label | JS; reduced: verificar: 2 JS imperativo (rAF/animate) |
| /clientes/[clientId] | não | D/G/S/C; Lite C/S/G | parcial (usa arc/light) | próprio (Lite) | sim: texto "Nenhum..." | herdado de / (raiz) | cards, abas, lista, formulario | 1: 1 overflow-x | 1: 1 campo s/ label | tailwind animate-* + motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /clientes | não | D/G/S/C; ramo Lite C | ramo Lite + tela normal | próprio (Lite) | sim: texto "Nenhum..." | herdado de / (raiz) | dropdown, cards, tabela, grafico | 0 | 0 | nenhuma |
| /configuracoes/comissoes | não | D/G | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | formulario, cards | 0 | 1: 1 campo s/ label | motion/react; reduced: sim (global: CSS * e MotionConfig user) |
| /conversas/broker | não | C (só Lite) | sim, sempre (rota só Lite) | próprio (reusa pai) | sim: texto "Nenhum..." | herdado de /conversas | formulario, lista, sheet | 0 | 3: 1 campo s/ label, 2 clique s/ teclado | motion/react; reduced: verificar: 4 JS imperativo (rAF/animate); trata explicitamente |
| /conversas/dashboard | não | D/G/S/C (acessar_conversas) | não | herdado de /conversas (skeleton próprio) | não | herdado de /conversas | cards | 0 | 0 | nenhuma |
| /conversas | não | D/G/S/C normal (C Lite vai p/ /conversas/broker) | ramo Lite + tela normal | próprio (skeleton próprio) | sim: EmptyState + texto | próprio | dropdown, sheet, dialog, formulario, popover, lista | 1: 1 overflow-x | 10: 2 ícone s/ aria-label, 8 campo s/ label | motion/react + tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /cotacao | não | C (normal e Lite) | ramo Lite + tela normal | herdado de / (raiz) (genérico RouteLoading) | sim: EmptyState + texto | herdado de / (raiz) | abas, formulario, tabela, lista | 0; tabela sem versão mobile | 5: 5 campo s/ label | motion/react; reduced: verificar: 2 JS imperativo (rAF/animate); trata explicitamente |
| /dashboard/c/[assistant] | não | C e S (só Lite) | sim, sempre (rota só Lite) | herdado de /dashboard (skeleton próprio) | não | herdado de / (raiz) | dialog, lista, sheet, formulario | 0 | 3: 1 campo s/ label, 2 clique s/ teclado | motion/react + tailwind animate-*; reduced: verificar: 4 JS imperativo (rAF/animate); trata explicitamente |
| /dashboard/drill/[drillId] (alias de /relatorios/drill/[drillId]) | não | D/G/S/C (sem checagem na página) | não | herdado de /dashboard (skeleton próprio) | não | herdado de / (raiz) | tabela | 0; tabela sem versão mobile | 0 | nenhuma |
| /dashboard | não | D/G/S/C normal; ramos Lite C/S/G | ramo Lite + tela normal | próprio (skeleton próprio) | sim: Empty, DsEmptyState + texto | herdado de / (raiz) | formulario, cards, lista, tabela, grafico, dropdown, popover, dialog | 3: 1 largura/grid fixa (min-w-[760px]); 2 overflow-x | 0 | motion/react + tailwind animate-*; reduced: verificar: 2 JS imperativo (rAF/animate); trata explicitamente |
| /desempenho | não | C (só Lite) | sim, sempre (rota só Lite) | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | simples | 0 | 0 | nenhuma |
| /distribuicao/dashboard | não | D/G (rota custom: lead_queues_view) | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards | 0 | 0 | nenhuma |
| /distribuicao (alias de /leads/distribuicao) | não | D (G barrado pelo layout de /leads/distribuicao) | não | herdado de / (raiz) (genérico RouteLoading) | sim: DsEmptyState + texto | herdado de / (raiz) | lista, formulario, cards, dialog, tabela, dropdown, abas, sheet, grafico | 7: 3 largura/grid fixa (min-w-[640px], grid-cols-5, grid-cols-4); 4 overflow-x; tabela sem versão mobile | 19: 7 ícone s/ aria-label, 12 campo s/ label | tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /documentos | não | D/G/S/C | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | tabela, cards, formulario | 0; tabela sem versão mobile | 3: 3 ícone s/ aria-label | nenhuma |
| /empresas | não | D/G/S/C com flag; Lite G | sim, sempre | herdado de / (raiz) (genérico RouteLoading) | sim: EmptyState + texto | herdado de / (raiz) | cards | 0 | 0 | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /equipe/[id] | não | D/G, S com escopo; Lite G/S | parcial (usa arc/light) | herdado de /equipe (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de /equipe | cards, popover, lista, tabela | 1: 1 largura/grid fixa (grid-cols-7); tabela sem versão mobile | 0 | nenhuma |
| /equipe/cargos | não | D | não | herdado de /equipe (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de /equipe | dropdown, dialog, formulario, abas, cards | 0 | 5: 1 ícone s/ aria-label, 3 campo s/ label, 1 clique s/ teclado | nenhuma |
| /equipe/convidar | não | D/G/S | não | herdado de /equipe (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de /equipe | cards, dialog, formulario, dropdown | 0 | 4: 4 campo s/ label | nenhuma |
| /equipe/dashboard | não | D/G/S (rota custom: convidar_corretor) | não | herdado de /equipe (genérico RouteLoading) | não | herdado de /equipe | cards | 0 | 0 | nenhuma |
| /equipe/desempenho | não | S (só Lite, flag) | sim, sempre (rota só Lite) | herdado de /equipe (genérico RouteLoading) | sim: EmptyState | herdado de /equipe | abas, formulario, lista | 0 | 0 | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /equipe/minha/configurar | não | S (só Lite) | sim, sempre (rota só Lite) | herdado de /equipe/minha (Lite) | sim: EmptyState + texto | herdado de /equipe | formulario, abas, sheet, lista | 0 | 1: 1 campo s/ label | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /equipe/minha | não | S (só Lite) | sim, sempre (rota só Lite) | próprio (Lite) | sim: EmptyState + texto | herdado de /equipe | formulario, abas, sheet, lista | 0 | 0 | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /equipe | não | D, G com unidade; ramo Lite G (S Lite redireciona) | parcial (usa arc/light) | próprio (genérico RouteLoading) | sim: EmptyState + texto | próprio | cards, dialog, formulario, dropdown, tabela, abas, lista, grafico, sheet | 0; tabela sem versão mobile | 10: 10 campo s/ label | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /equipe/plantao | não | S (só Lite) | sim, sempre (rota só Lite) | herdado de /equipe (genérico RouteLoading) | sim: EmptyState | herdado de /equipe | formulario, lista | 0 | 0 | nenhuma |
| /equipe/recuperacoes | não | D | não | herdado de /equipe (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de /equipe | cards, formulario, tabela, dialog, grafico | 0; tabela sem versão mobile | 0 | tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /equipe/repassar | não | S com escopo | sim, sempre | herdado de /equipe (genérico RouteLoading) | não | herdado de /equipe | formulario | 0 | 1: 1 campo s/ label | nenhuma |
| /equipe/transferencia | não | S (só Lite, com escopo) | sim, sempre (rota só Lite) | herdado de /equipe (genérico RouteLoading) | não | herdado de /equipe | formulario | 0 | 0 | nenhuma |
| /ferramentas/materiais-operadoras | não | D | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | sheet, lista, cards, dropdown, tabela | 3: 3 overflow-x; tabela sem versão mobile | 1: 1 campo s/ label | nenhuma |
| /ferramentas | não | D/G | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards | 0 | 0 | nenhuma |
| /ferramentas/validador-comprovante | não | D/G | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards, lista | 0 | 0 | nenhuma |
| /filiais | sim (p/ /equipe?visao=unidades) | D/G/S | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /fluxos-whatsapp | não | D/G | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards, dialog | 0 | 6: 6 campo s/ label | nenhuma |
| /gestao/equipes/[supervisorId] | não | G e S (só Lite, flag) | sim, sempre (rota só Lite) | herdado de / (raiz) (genérico RouteLoading) | sim: EmptyState + texto | herdado de / (raiz) | lista, cards, dropdown, sheet, abas | 0 | 0 | nenhuma |
| /gestao | não | G e S (só Lite, flag) | sim, sempre (rota só Lite) | herdado de / (raiz) (genérico RouteLoading) | sim: EmptyState + texto | herdado de / (raiz) | lista, tabela, cards, dropdown, sheet, abas | 0 | 0 | nenhuma |
| /guia | não | D/G/S/C | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards, lista | 1: 1 overflow-x | 0 | nenhuma |
| /guia/webhook | não | D/G/S/C | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards, formulario, lista | 1: 1 overflow-x | 4: 1 ícone s/ aria-label, 3 campo s/ label | nenhuma |
| /integrations/meta | não | D (+cargo marketing); G barrado pelo layout | não | herdado de /integrations (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | cards, dropdown, dialog, lista | 0 | 0 | tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user) |
| /integrations | não | D (+marketing); G barrado pelo layout | não | próprio (genérico RouteLoading) | não | herdado de / (raiz) | cards | 0 | 0 | nenhuma |
| /integrations/whats_alt | sim (p/ /integrations/whatsapp?visao=diretoria) | D | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /integrations/whatsapp | não | D | não | herdado de /integrations (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | abas, cards, dialog, dropdown, lista, sheet, formulario, tabela | 0; tabela sem versão mobile | 3: 3 campo s/ label | motion/react + tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /integridade | não | D/G/S | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards | 0 | 0 | nenhuma |
| /internal/design-system/motion | não | qualquer logado (interna) | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards, lista | 0 | 0 | motion/react + tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user) |
| /internal/design-system | não | qualquer logado (interna) | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | abas, cards | 0 | 1: 1 ícone s/ aria-label | nenhuma |
| /jornada | não | C (Lite, flag) | sim, sempre | próprio (Lite) | sim: EmptyState + texto | herdado de / (raiz) | formulario, lista, sheet | 0 | 0 | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /leads/[id]/feedback | não | D/G/S/C | sim, sempre | herdado de /leads/[id] (Lite) | sim: EmptyState | herdado de /leads/[id] | formulario | 0 | 0 | nenhuma |
| /leads/[id] | não | D/G/S/C normal; ramos Lite C/S/G | ramo Lite + tela normal | próprio (Lite) | sim: texto "Nenhum..." | próprio | cards, formulario, abas, dropdown, dialog, lista | 1: 1 overflow-x | 12: 10 campo s/ label, 2 cor como única info | tailwind animate-* + motion/react; reduced: verificar: 2 JS imperativo (rAF/animate); trata explicitamente |
| /leads/arquivados | não | D | não | herdado de /leads (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de /leads | cards, formulario, tabela | 1: 1 overflow-x; tabela sem versão mobile | 1: 1 campo s/ label | nenhuma |
| /leads/dashboard | não | D/G/S/C | não | herdado de /leads (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de /leads | cards | 0 | 0 | nenhuma |
| /leads/distribuicao | não | D (G barrado pelo layout) | não | herdado de /leads (genérico RouteLoading) | sim: DsEmptyState + texto | herdado de /leads | lista, formulario, cards, dialog, tabela, dropdown, abas, sheet, grafico | 7: 3 largura/grid fixa (min-w-[640px], grid-cols-5, grid-cols-4); 4 overflow-x; tabela sem versão mobile | 19: 7 ícone s/ aria-label, 12 campo s/ label | tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /leads/distribuicao/plantao/[scheduleId] | não | D (G barrado pelo layout) | não | herdado de /leads (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de /leads | cards, formulario, tabela, popover, lista, grafico, abas, sheet, dropdown, dialog | 3: 1 largura/grid fixa (grid-cols-4); 2 overflow-x; tabela sem versão mobile | 3: 3 campo s/ label | tailwind animate-* + motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /leads/distribuicao/plantao | sim (p/ /distribuicao?view=plantao) | D | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /leads | não | D/G/S/C normal; ramos Lite C/S/G | ramo Lite + tela normal | próprio (genérico RouteLoading) | sim: EmptyState + texto | próprio | sheet, dialog, formulario, dropdown, kanban, abas, cards, lista, tabela | 4: 2 largura/grid fixa (grid-cols-4); 2 overflow-x; tabela sem versão mobile | 19: 1 ícone s/ aria-label, 11 campo s/ label, 6 clique s/ teclado, 1 cor como única info | motion/react + tailwind animate-* + tw-animate; reduced: verificar: 2 JS imperativo (rAF/animate); trata explicitamente |
| /marketing/campanhas/[id] | não | D (+marketing); G barrado pelo layout | não | herdado de / (raiz) (genérico RouteLoading) | não | próprio | cards, tabela, lista | 0; tabela sem versão mobile | 0 | nenhuma |
| /marketing/campanhas | não | D (+marketing); G barrado pelo layout | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | cards, tabela | 1: 1 largura/grid fixa (min-w-[900px]); tabela sem versão mobile | 2: 1 campo s/ label, 1 clique s/ teclado | nenhuma |
| /marketing/importacoes | não | D (+marketing); G barrado pelo layout | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | drawer, dropdown, cards | 0 | 2: 2 campo s/ label | nenhuma |
| /marketing/meta | sim (p/ /marketing/campanhas) | D | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /marketing | sim (p/ /marketing/campanhas) | D | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /mensagens/[leadId] | não | G e S (só Lite) | sim, sempre (rota só Lite) | herdado de /mensagens (Lite) | sim: texto "Nenhum..." | herdado de / (raiz) | simples | 0 | 0 | nenhuma |
| /mensagens | não | G e S (só Lite) | sim, sempre (rota só Lite) | próprio (Lite) | sim: texto "Nenhum..." | herdado de / (raiz) | lista, formulario | 0 | 0 | nenhuma |
| /minha-fila | não | D/G/S/C (uso principal C); ramo Lite | ramo Lite + tela normal | próprio (Shimmer) | sim: texto "Nenhum..." | herdado de / (raiz) | lista, cards, tabela | 0; tabela sem versão mobile | 3: 2 campo s/ label, 1 cor como única info | tailwind animate-* + motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /noc | não | D/G/S | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | dropdown, grafico, cards, tabela | 0; tabela sem versão mobile | 8: 8 cor como única info | motion/react + tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /notificacoes | não | D/G/S/C; ramo Lite | ramo Lite + tela normal | herdado de / (raiz) (genérico RouteLoading) | sim: EmptyState + texto | herdado de / (raiz) | lista | 0 | 0 | motion/react + tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /plantoes/agora | não | C | sim, sempre | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | lista | 0 | 1: 1 campo s/ label | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /plantoes/corretor/[brokerId] | não | D/G/S | sim, sempre | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | lista | 0 | 0 | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /plantoes | não | C (só Lite, flag) | sim, sempre (rota só Lite) | herdado de / (raiz) (genérico RouteLoading) | sim: EmptyState | herdado de / (raiz) | lista, sheet | 0 | 0 | nenhuma |
| /propostas | não | D/G/S/C (sem checagem) | não | herdado de / (raiz) (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | cards, abas, sheet, formulario, tabela, dialog | 0; tabela sem versão mobile | 1: 1 ícone s/ aria-label | nenhuma |
| /qualificacao | não | D/S (G barrado pelo layout) | não | próprio (genérico RouteLoading) | não | próprio | abas, cards, dropdown, tabela, formulario, dialog, grafico | 1: 1 overflow-x; tabela sem versão mobile | 32: 4 ícone s/ aria-label, 28 campo s/ label | tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /qualificacao/turbo | não | D/S (G barrado pelo layout) | não | herdado de /qualificacao (genérico RouteLoading) | não | herdado de /qualificacao | sheet, cards, tabela | 1: 1 overflow-x; tabela sem versão mobile | 0 | nenhuma |
| /relacionamento | não | D/G enviam; S Lite e C Lite leem | sim, sempre | herdado de / (raiz) (genérico RouteLoading) | sim: EmptyState, DsEmptyState + texto | herdado de / (raiz) | formulario, lista, sheet, abas, cards, grafico, dialog | 0 | 0 | motion/react; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /relatorios/drill/[drillId] | não | D/G/S/C (sem checagem na página) | não | herdado de /relatorios (genérico RouteLoading) | não | herdado de / (raiz) | tabela | 0; tabela sem versão mobile | 0 | nenhuma |
| /relatorios | sim (p/ /dashboard?${suffix}) | D/G/S | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /roadmap | sim (p/ /dashboard) | ninguém (redirect incondicional p/ /dashboard) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /settings/extension | não | D/G/S/C (edição D) | não | herdado de /settings (genérico RouteLoading) | não | herdado de / (raiz) | lista, cards, formulario | 0 | 0 | nenhuma |
| /settings/feedback-templates | não | D/G/S (C cai em erro) | não | herdado de /settings (genérico RouteLoading) | sim: texto "Nenhum..." | herdado de / (raiz) | cards, formulario | 0 | 3: 2 campo s/ label, 1 cor como única info | nenhuma |
| /settings/integrations | sim (p/ /integrations) | D/G/S/C | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /settings/meta | sim (p/ /integrations/meta) | D/G/S/C | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /settings | não | D/G/S/C; ramos Lite C/S/G | ramo Lite + tela normal | próprio (genérico RouteLoading) | sim: EmptyState + texto | herdado de / (raiz) | cards, formulario, abas, dialog, dropdown, lista | 6: 6 overflow-x | 26: 1 ícone s/ aria-label, 24 campo s/ label, 1 cor como única info | tailwind animate-* + motion/react; reduced: verificar: 2 JS imperativo (rAF/animate); trata explicitamente |
| /settings/waha-diagnostic | não | D/G/S/C (sem checagem) | não | herdado de /settings (genérico RouteLoading) | não | herdado de / (raiz) | lista | 0 | 0 | nenhuma |
| /settings/whatsapp | sim (p/ /integrations/whatsapp) | D/G/S/C | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| /tarefas/dashboard | não | D/G/S/C | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | cards | 0 | 0 | nenhuma |
| /unidades/[branchId] | não | D; G (Lite) | ramo Lite + tela normal | próprio (Lite) | sim: texto "Nenhum..." | herdado de / (raiz) | cards, dropdown, formulario, tabela, lista, dialog, grafico | 0; tabela sem versão mobile | 0 | motion/react + tailwind animate-*; reduced: sim (global: CSS * e MotionConfig user); trata explicitamente |
| /vendas/[id] | não | D/G/S/C | não | herdado de /vendas (PageSkeleton) | sim: texto "Nenhum..." | herdado de / (raiz) | abas, cards, formulario, tabela, grafico | 0 | 2: 2 cor como única info | nenhuma |
| /vendas/dashboard | não | D/G/S/C | não | herdado de /vendas (PageSkeleton) | não | herdado de / (raiz) | cards | 0 | 0 | nenhuma |
| /vendas | não | D/G/S/C | não | próprio (PageSkeleton) | sim: texto "Nenhum..." | herdado de / (raiz) | dropdown, formulario, tabela, cards, grafico | 1: 1 overflow-x | 0 | nenhuma |
| /welcome | não | D/G/S/C (só desktop) | não | herdado de / (raiz) (genérico RouteLoading) | não | herdado de / (raiz) | simples | 0 | 1: 1 cor como única info | motion/react; reduced: sim (global: CSS * e MotionConfig user) |

## Chrome comum (DashboardHeader, aparece em quase toda tela normal)

- `src/components/dashboard-header.tsx`: overflow-x (rolagem horizontal interna) (44)
- `src/components/notification-popover.tsx`: sem achados; animação motion/react, tailwind animate-*
- `src/components/experience-mode-toggle.tsx`: ponto de cor (status) sem texto/aria (168); animação tailwind animate-*
- `src/components/huge-icons.tsx`: sem achados; animação motion/react
- `src/components/empty-state.tsx`: sem achados; animação motion/react
- `src/features/notifications/components/push-notification-manager.tsx`: campo Input sem label associado (297); animação motion/react, tailwind animate-*
- `src/components/theme-toggle.tsx` entra pelo header: tela normal ainda oferece tema escuro (regra Lite: sem tema escuro).

## Totais

- Rotas (page.tsx): 92. Só redirect: 11 (inclui /roadmap, redirect incondicional com código morto). Telas reais: 81 (2 são alias: /distribuicao e /dashboard/drill/[drillId]).
- Lite: 21 já sempre Lite; 10 com ramo Lite + tela normal; 3 parciais; 47 sem nada Lite.
- Sem loading próprio: 64 de 81 telas (56 caem no RouteLoading genérico, não Lite). Loading próprio: 17.
- Sem estado vazio detectado (na tela normal): 30.
- Sem error.tsx próprio (só o genérico da raiz ou de um pai): 75 de 81. Error próprio: 6.
- Com risco em 390px: 25 (largura/grid fixa sem breakpoint: 7; tabela sem versão mobile detectada: 24).
- Com algum problema de a11y: 38.
- Com animação JS imperativa a revisar para reduced motion: 9.

## 20 piores rotas (pontuação: tabela sem mobile 4, ícone s/ label 3, largura fixa 3, campo/clique 2, sem vazio 4, sem loading próprio 2, sem error próprio 1, overflow-x 1)

### 1. /qualificacao (pontos 77; não)
- tabela sem versão mobile (só rolagem lateral); sem estado vazio
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:548` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:965` botao so com icone sem aria-label
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:1069` botao so com icone sem aria-label
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:604` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:622` campo Input sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:645` campo Input sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:654` campo Textarea sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:688` campo Textarea sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:701` campo Textarea sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:868` campo Input sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:877` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:890` campo Input sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:905` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:917` campo Input sem label associado
- `src/app/(dashboard)/qualificacao/_components/qualification-hub-client.tsx:1064` campo Input sem label associado
- `src/features/ai-qualification/components/bulk-qualification-dialog.tsx:115` campo SelectTrigger sem label associado
- `src/features/communication-channels/components/whatsapp-test-message-card.tsx:74` campo Input sem label associado
- `src/features/communication-channels/components/whatsapp-test-message-card.tsx:89` campo SelectTrigger sem label associado
- `src/features/communication-channels/components/whatsapp-test-message-card.tsx:103` campo Textarea sem label associado
- `src/app/(dashboard)/settings/_components/agent-training-tab.tsx:88` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/agent-training-tab.tsx:124` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/agent-training-tab.tsx:136` campo Textarea sem label associado
- `src/app/(dashboard)/settings/_components/agent-training-tab.tsx:166` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/agent-training-tab.tsx:167` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/agent-training-tab.tsx:169` campo Input sem label associado
- `src/app/(dashboard)/qualificacao/_components/agent-triggers-panel.tsx:233` botao so com icone sem aria-label
- `src/app/(dashboard)/qualificacao/_components/agent-triggers-panel.tsx:296` botao so com icone sem aria-label
- `src/app/(dashboard)/qualificacao/_components/agent-triggers-panel.tsx:209` campo Switch sem label associado
- `src/app/(dashboard)/qualificacao/_components/agent-triggers-panel.tsx:269` campo Switch sem label associado
- `src/app/(dashboard)/qualificacao/_components/agent-triggers-panel.tsx:322` campo Input sem label associado
- (+3 achados)

### 2. /leads/distribuicao (pontos 65; não)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx:745` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/distribuicao/_components/distribution-tabs-container.tsx:76` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-month-calendar.tsx:77` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-month-calendar.tsx:78` min-w-[640px]
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-month-calendar.tsx:78` grid-cols-5 sem breakpoint
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:590` grid-cols-4 sem breakpoint
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:664` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:742` campo input sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:888` campo Checkbox sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:1058` campo Input sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:1075` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/distribution-policy-panel.tsx:83` campo Input sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:387` botao so com icone sem aria-label (tem so title)
- `src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:396` botao so com icone sem aria-label (tem so title)
- `src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:405` botao so com icone sem aria-label (tem so title)
- `src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:413` botao so com icone sem aria-label (tem so title)
- `src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:423` botao so com icone sem aria-label (tem so title)
- `src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:534` campo SelectTrigger sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:549` campo SelectTrigger sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:312` campo Input sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:321` campo Input sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:338` campo Input sem label associado
- `src/app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:350` campo SelectTrigger sem label associado
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1486` botao so com icone sem aria-label
- `src/app/(dashboard)/leads/distribuicao/_components/broker-acceptance-sla-panel.tsx:116` campo Input sem label associado
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:645` botao so com icone sem aria-label

### 3. /settings (pontos 63; ramo Lite + tela normal)
- error genérico herdado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:284` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:300` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:315` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:327` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:364` overflow-x (rolagem horizontal interna)
- `src/features/user-profile/components/perfil-tabs.tsx:66` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/settings/_components/empresa-tab.tsx:42` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/empresa-tab.tsx:46` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/empresa-tab.tsx:50` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:150` campo input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:151` campo input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:152` campo input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:153` campo select sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:158` campo input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:214` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:218` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:222` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:256` campo SelectTrigger sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:286` campo input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:287` campo input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:288` campo input sem label associado
- `src/app/(dashboard)/settings/_components/integrations-tab.tsx:328` campo input sem label associado
- `src/app/(dashboard)/settings/_components/feedback-tab.tsx:65` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/feedback-tab.tsx:79` campo Input sem label associado
- `src/app/(dashboard)/settings/_components/feedback-tab.tsx:156` campo Input sem label associado
- `src/features/conversation-intelligence/components/ai-stage-mode-card.tsx:71` campo input sem label associado
- `src/app/(dashboard)/settings/_components/color-picker.tsx:39` campo input sem label associado
- `src/app/(dashboard)/settings/_components/logo-upload.tsx:65` botao so com icone sem aria-label
- `src/app/(dashboard)/settings/_components/logo-upload.tsx:54` campo input sem label associado
- `src/app/(dashboard)/settings/_components/passkey-section.tsx:261` campo Input sem label associado
- (+4 achados)

### 4. /leads (pontos 54; ramo Lite + tela normal)
- tabela sem versão mobile (só rolagem lateral)
- `src/app/(dashboard)/leads/_components/leads-filters.tsx:471` grid-cols-4 sem breakpoint
- `src/app/(dashboard)/leads/_components/leads-filters.tsx:522` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/_components/leads-header-actions.tsx:110` grid-cols-4 sem breakpoint
- `src/components/data-table/data-table.tsx:57` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx:134` campo SelectTrigger sem label associado
- `src/app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx:155` campo SelectTrigger sem label associado
- `src/app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx:178` campo SelectTrigger sem label associado
- `src/app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx:188` campo Input sem label associado
- `src/app/(dashboard)/leads/_components/leads-filters.tsx:278` ponto de cor (status) sem texto/aria
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:369` botao so com icone sem aria-label (tem so title)
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:271` campo Input sem label associado
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:281` campo SelectTrigger sem label associado
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:295` campo SelectTrigger sem label associado
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:189` onClick em <Card> sem role/teclado
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:208` onClick em <Card> sem role/teclado
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:227` onClick em <Card> sem role/teclado
- `src/features/conversation-intelligence/components/negotiations-radar-tab.tsx:246` onClick em <Card> sem role/teclado
- `src/app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:204` campo SelectTrigger sem label associado
- `src/features/leads/components/lead-quick-note.tsx:57` campo Textarea sem label associado
- `src/app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:196` campo textarea sem label associado
- `src/components/data-table/data-table.tsx:87` onClick em <TableRow> sem role/teclado
- `src/components/data-table/data-table.tsx:98` <TableCell role> com onClick sem onKeyDown
- `src/components/data-table/data-table-pagination.tsx:48` campo SelectTrigger sem label associado
- `src/components/chat/live-blocks.tsx:38` animação JS imperativa
- `src/components/chat/live-blocks.tsx:40` animação JS imperativa

### 5. /atendimento/mensagens (pontos 46; não)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/atendimento/mensagens/_components/messages-workspace.tsx:182` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/qualificacao/_components/message-policies-panel.tsx:364` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/message-policies-panel.tsx:377` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/message-policies-panel.tsx:382` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/message-policies-panel.tsx:391` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/message-policies-panel.tsx:400` campo SelectTrigger sem label associado
- `src/app/(dashboard)/qualificacao/_components/message-policies-panel.tsx:405` campo SelectTrigger sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:169` campo SelectTrigger sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:183` campo SelectTrigger sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:203` campo SelectTrigger sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:216` campo Input sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:231` campo Textarea sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:244` campo Input sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:254` campo SelectTrigger sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:267` campo Input sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:273` campo Input sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:296` campo Input sem label associado
- `src/app/(dashboard)/integrations/whatsapp/_components/template-builder-wizard.tsx:303` campo Input sem label associado
- `src/app/(dashboard)/atendimento/mensagens/_components/message-drawer.tsx:261` campo Input sem label associado
- `src/app/(dashboard)/atendimento/mensagens/_components/message-drawer.tsx:116` animação JS imperativa

### 6. /atendimento/situacoes (pontos 30; não)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/atendimento/situacoes/_components/situations-workspace.tsx:240` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/atendimento/situacoes/_components/situations-workspace.tsx:111` campo Input sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx:54` campo Input sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx:186` campo Input sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx:233` campo Input sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx:234` campo Textarea sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx:235` campo Input sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx:237` campo Textarea sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/suggestion-drawer.tsx:74` campo Input sem label associado
- `src/app/(dashboard)/atendimento/mensagens/_components/message-drawer.tsx:261` campo Input sem label associado
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx:80` animação JS imperativa
- `src/app/(dashboard)/atendimento/mensagens/_components/message-drawer.tsx:116` animação JS imperativa

### 7. /assistente (pontos 28; não)
- sem estado vazio; loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:552` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:658` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:433` botao so com icone sem aria-label
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:543` botao so com icone sem aria-label
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:688` botao so com icone sem aria-label
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:675` campo Input sem label associado
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:410` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:603` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:604` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:605` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:740` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:748` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:756` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/assistente/_components/assistente-chat-client.tsx:764` ponto de cor (status) sem texto/aria

### 8. /leads/[id] (pontos 27; ramo Lite + tela normal)
- `src/app/(dashboard)/leads/[id]/page.tsx:622` overflow-x (rolagem horizontal interna)
- `src/features/leads/components/lead-status-selector.tsx:182` campo SelectTrigger sem label associado
- `src/features/leads/components/lead-status-selector.tsx:231` campo textarea sem label associado
- `src/features/leads/components/lead-status-selector.tsx:246` campo select sem label associado
- `src/features/leads/components/lead-timeline.tsx:30` campo Textarea sem label associado
- `src/app/(dashboard)/leads/[id]/supervision-panel.tsx:213` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:204` campo SelectTrigger sem label associado
- `src/features/leads/components/lead-feedback-dialog.tsx:69` campo Input sem label associado
- `src/features/leads/components/lead-progress-stepper.tsx:68` ponto de cor (status) sem texto/aria
- `src/features/leads/components/lead-quick-note.tsx:57` campo Textarea sem label associado
- `src/app/(dashboard)/leads/[id]/inline-feedback-form.tsx:246` campo Input sem label associado
- `src/app/(dashboard)/leads/[id]/inline-feedback-form.tsx:255` campo select sem label associado
- `src/app/(dashboard)/leads/[id]/inline-feedback-form.tsx:312` campo SelectTrigger sem label associado
- `src/components/chat/live-blocks.tsx:38` animação JS imperativa
- `src/components/chat/live-blocks.tsx:40` animação JS imperativa

### 9. /equipe (pontos 24; parcial (usa arc/light))
- tabela sem versão mobile (só rolagem lateral)
- `src/app/(dashboard)/equipe/team-invite-section.tsx:194` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/team-invite-section.tsx:210` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/team-invite-section.tsx:230` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/team-invite-section.tsx:242` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/member-actions.tsx:195` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/member-actions.tsx:216` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/member-actions.tsx:238` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/member-actions.tsx:254` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/member-actions.tsx:754` campo textarea sem label associado
- `src/app/(dashboard)/equipe/member-actions.tsx:828` campo SelectTrigger sem label associado

### 10. /conversas (pontos 23; ramo Lite + tela normal)
- `src/app/(dashboard)/conversas/conversations-workspace.tsx:373` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/conversas/conversations-workspace.tsx:1123` botao so com icone sem aria-label
- `src/app/(dashboard)/conversas/conversations-workspace.tsx:1110` campo Input sem label associado
- `src/app/(dashboard)/conversas/conversations-workspace.tsx:2037` campo textarea sem label associado
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx:616` campo Input sem label associado
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx:675` campo SelectTrigger sem label associado
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx:741` campo SelectTrigger sem label associado
- `src/features/ai-qualification/components/bulk-qualification-dialog.tsx:115` campo SelectTrigger sem label associado
- `src/app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:196` campo textarea sem label associado
- `src/features/conversations/components/quick-responses-popover.tsx:61` botao so com icone sem aria-label (tem so title)
- `src/features/conversations/components/media-attach-button.tsx:113` campo input sem label associado

### 11. /cotacao (pontos 21; ramo Lite + tela normal)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/features/broker-workspace/components/light-quote-simulator/profile-step.tsx:44` campo Input sem label associado
- `src/features/broker-workspace/components/light-quote-simulator/profile-step.tsx:56` campo Input sem label associado
- `src/features/broker-workspace/components/light-quote-simulator/profile-step.tsx:63` campo Input sem label associado
- `src/features/broker-workspace/components/light-quote-simulator/profile-step.tsx:91` campo Input sem label associado
- `src/features/broker-workspace/components/light-quote-simulator/summary-step.tsx:85` campo Input sem label associado
- `src/components/chat/live-blocks.tsx:38` animação JS imperativa
- `src/components/chat/live-blocks.tsx:40` animação JS imperativa

### 12. /dashboard/c/[assistant] (pontos 21; sim, sempre (rota só Lite))
- sem estado vazio; loading herdado (skeleton próprio); error genérico herdado
- `src/features/assist/components/assist-search.tsx:87` <li role> com onClick sem onKeyDown
- `src/components/chat/presence-callout.tsx:212` campo input sem label associado
- `src/components/chat/dynamic-notice.tsx:94` <motion.div role> com onClick sem onKeyDown
- `src/components/chat/tour/lite-tour.tsx:219` animação JS imperativa
- `src/components/chat/tour/lite-tour.tsx:221` animação JS imperativa
- `src/components/chat/live-blocks.tsx:38` animação JS imperativa
- `src/components/chat/live-blocks.tsx:40` animação JS imperativa

### 13. /fluxos-whatsapp (pontos 19; não)
- sem estado vazio; loading herdado (genérico RouteLoading); error genérico herdado
- `src/features/automations/components/whatsapp-flows-client.tsx:218` campo Input sem label associado
- `src/features/automations/components/whatsapp-flows-client.tsx:228` campo Input sem label associado
- `src/features/automations/components/whatsapp-flows-client.tsx:236` campo Input sem label associado
- `src/features/automations/components/whatsapp-flows-client.tsx:249` campo Input sem label associado
- `src/features/automations/components/whatsapp-flows-client.tsx:262` campo Input sem label associado
- `src/features/automations/components/whatsapp-flows-client.tsx:275` campo Input sem label associado

### 14. /leads/distribuicao/plantao/[scheduleId] (pontos 18; não)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:410` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:428` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/broker-day-history-trigger.tsx:62` grid-cols-4 sem breakpoint
- `src/app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:204` campo SelectTrigger sem label associado
- `src/features/leads/components/lead-quick-note.tsx:57` campo Textarea sem label associado
- `src/app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:196` campo textarea sem label associado

### 15. /guia/webhook (pontos 17; não)
- sem estado vazio; loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/guia/webhook/webhook-tutorial.tsx:124` overflow-x (rolagem horizontal interna)
- `src/app/(dashboard)/guia/webhook/webhook-tutorial.tsx:116` botao so com icone sem aria-label (tem so title)
- `src/app/(dashboard)/guia/webhook/webhook-tutorial.tsx:162` campo input sem label associado
- `src/app/(dashboard)/guia/webhook/webhook-tutorial.tsx:163` campo input sem label associado
- `src/app/(dashboard)/guia/webhook/webhook-tutorial.tsx:164` campo input sem label associado

### 16. /documentos (pontos 16; não)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/features/documents/components/documents-workspace.tsx:302` botao so com icone sem aria-label (tem so title)
- `src/features/documents/components/documents-workspace.tsx:311` botao so com icone sem aria-label (tem so title)
- `src/features/documents/components/documents-workspace.tsx:518` botao so com icone sem aria-label

### 17. /conversas/broker (pontos 15; sim, sempre (rota só Lite))
- error genérico herdado
- `src/features/assist/components/assist-search.tsx:87` <li role> com onClick sem onKeyDown
- `src/components/chat/presence-callout.tsx:212` campo input sem label associado
- `src/components/chat/dynamic-notice.tsx:94` <motion.div role> com onClick sem onKeyDown
- `src/components/chat/tour/lite-tour.tsx:219` animação JS imperativa
- `src/components/chat/tour/lite-tour.tsx:221` animação JS imperativa
- `src/components/chat/live-blocks.tsx:38` animação JS imperativa
- `src/components/chat/live-blocks.tsx:40` animação JS imperativa

### 18. /noc (pontos 15; não)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/noc/noc-client.tsx:181` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/noc/noc-client.tsx:351` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/noc/noc-client.tsx:355` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/noc/noc-client.tsx:359` ponto de cor (status) sem texto/aria
- `src/app/(dashboard)/noc/noc-client.tsx:698` ponto de cor (status) sem texto/aria
- `src/features/noc/components/noc-heatmap.tsx:38` ponto de cor (status) sem texto/aria
- `src/features/noc/components/noc-heatmap.tsx:42` ponto de cor (status) sem texto/aria
- `src/features/noc/components/noc-heatmap.tsx:47` ponto de cor (status) sem texto/aria

### 19. /equipe/cargos (pontos 14; não)
- loading herdado (genérico RouteLoading); error genérico herdado
- `src/app/(dashboard)/equipe/cargos/workspace.tsx:70` botao so com icone sem aria-label
- `src/app/(dashboard)/equipe/cargos/workspace.tsx:315` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/cargos/workspace.tsx:658` campo Input sem label associado
- `src/app/(dashboard)/equipe/cargos/workspace.tsx:667` campo SelectTrigger sem label associado
- `src/app/(dashboard)/equipe/cargos/workspace.tsx:704` onClick em <Card> sem role/teclado

### 20. /marketing/campanhas (pontos 14; não)
- tabela sem versão mobile (só rolagem lateral); loading herdado (genérico RouteLoading); error genérico herdado
- `src/features/meta-ads/components/campaigns-dashboard-view.tsx:141` min-w-[900px]
- `src/features/meta-ads/components/campaigns-dashboard-view.tsx:111` campo Input sem label associado
- `src/features/meta-ads/components/campaigns-dashboard-view.tsx:174` onClick em <TableRow> sem role/teclado
