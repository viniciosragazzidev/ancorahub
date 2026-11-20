---
name: interface-enxuta
description: Regras para desenhar ou refinar telas do AncoraHub no padrão enxuto (só o essencial fixo, detalhe sob demanda via hover card, drawer ou menu), tiradas da análise do Jubayer/Ingot UI e compatíveis com docs/design-system.md, FEEDBACK.md e a regra de densidade do CLAUDE.md. Use ao criar ou mexer em tabela, lista, painel, popover, hover card, drawer, filtro, modal ou tela de configurações no modo normal (desktop).
---

# Interface enxuta

Base: `docs/design-system/referencias/jubayer6910.md` (o porquê de cada regra e o post de origem).
Hierarquia em conflito: `docs/design-system.md` > `docs/design-system/FEEDBACK.md` > esta skill. No Lite, vale `docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`.

## Antes de codar

0. **Pergunta obrigatória:** "o que eu adiciono para facilitar o dia de quem usa esta tela o tempo todo?" Liste as 1 a 3 tarefas mais frequentes da tela e corte passos delas: atalho de teclado ("/" para buscar), copiar telefone num clique, filtros lembrados, "próximo item" num toque, ação frequente na própria linha, contagem que diz o que fazer. Só com dado já carregado; ação frequente é nível 0 do `FEEDBACK.md` (sem som). Diga no relatório o que entrou.

1. Leia a tela inteira e liste o que está fixo nela. Para cada item, pergunte: "o usuário precisa disso para agir agora?" Se não precisa, o item sai da tela fixa.
2. Apresente o plano por componente (exigência do `CLAUDE.md`). Siga a opção recomendada sem esperar resposta, a menos que exija **token novo**: aí pare e pergunte.
3. Nunca invente cor, raio, espaçamento, sombra ou tamanho de fonte. Se o padrão pedir algo fora dos tokens, anote em "Decisões pendentes" no relatório de referência e pergunte.

## Onde cada informação mora

| Camada | Para quê | Componente |
|---|---|---|
| Fixo na tela | o que decide a próxima ação: nome, status, um número, um verbo | `SectionCardHeader`, `DataTable`, `DsStatusBadge` |
| Hover card (desktop) | conferir sem sair da lista: 5 a 7 dados + atalhos frequentes | `HoverPreview` (`src/components/ui/hover-preview.tsx`) |
| Drawer (`Sheet`) | ler tudo e editar: histórico, configurações, sub-listas | `Sheet`, `SheetSection` |
| Menu `⋯` / "Configurações ▾" | ação rara ou auxiliar | `DropdownMenu` |
| Modal | só tarefa focada ou confirmação irreversível | `Dialog` |

Regra de bolso: **olhar = hover card, mexer = drawer, raro = menu**.

## Hover card (prévia ao passar o mouse)

- Só em dispositivo com mouse: `(hover: hover) and (pointer: fine)`. No toque, o gatilho mantém o comportamento antigo (abre o drawer ou navega).
- Gatilho é o **nome da entidade**, não a linha inteira. O clique no nome continua fazendo o que fazia.
- Abre com 350ms de atraso e fecha com 150ms, para não piscar ao atravessar a tabela. Abre também no **foco do teclado**; `Esc` fecha e devolve o foco.
- Abre **ao lado do nome** (`side="right"`, alinhado ao topo), cobrindo as colunas vizinhas, não a linha de baixo.
- Conteúdo, de cima para baixo (modelo aprovado pelo Vinicios em 20/11, referência `LeadHoverCardContent`):
  1. Cabeçalho: avatar 36px, nome (Inter 600, 16px), contexto em caption Fog, status em pílula à direita.
  2. Chips de contexto (pílula com borda Ash, ícone 12px): plano, vidas, unidade.
  3. Progresso: `SegmentBar` + "Etapa 5 de 8" em caption.
  4. Número principal num bloco Paper Mist com raio 12: rótulo em caixa alta, valor em 24px semibold, legenda em caption.
  5. Grade de 3 dados: rótulo caption Fog, valor body 500. Pessoa sempre com `PersonChip`, telefone em mono.
  6. Seção "Próximo passo" (rótulo em caixa alta) só quando a lista sabe.
  7. Rodapé: atalhos ghost (WhatsApp, Ligar) à esquerda; "Abrir ficha" secundário à direita, com `Kbd ↵` quando Enter no nome abre. **Nenhum CTA primário (Deep Sapphire ou preenchido) no hover card.**
- Superfície: `bg-popover`, 1px Ash, raio 12px, `--shadow-md`, largura 384px, padding 16px.
- O nome que dispara sublinha no hover (`underline-offset-4 hover:underline`).
- Movimento: fade + 4px de translação em 120 a 160ms. Com `prefers-reduced-motion`, só fade de até 120ms.
- Feedback: abrir é nível 0 (sem som, sem vibração). Atalho que muda dado segue o nível dele no `FEEDBACK.md`.
- Dados ausentes viram "—", nunca "undefined" ou linha vazia. Não busque dados novos no servidor só para o hover: use o que a linha já tem.

## Capricho em abas, botões e cartões (ref P17, pedido do Vinicios em 20/11)

- **Aba**: rótulo + contagem numa pílula pequena dentro da própria aba; a ativa ganha fundo da superfície e sombra de repouso; as outras ficam em texto secundário.
- **Botão**: ícone de 16px + verbo ("Exportar CSV", "Conectar", "Abrir"); o primário é um só; o destrutivo vai por último no menu.
- **Status**: pílula com o estado real e curto ("Recebendo leads", "Sem leads há 3 dias", "Conectado"), nunca um rótulo fixo que não diz nada ("Disponível").
- **Cartão de catálogo**: ícone + nome + categoria em cima, uma frase, e um rodapé separado por hairline com o dado que importa ("Último lead há 2 h · 34 nas últimas 24 h") e a ação à direita.
- **Modal de conexão**: lista "o que vai poder fazer", uma escolha, um interruptor, rodapé com a garantia à esquerda ("Seguro via OAuth") e as ações à direita.

## Detalhes mínimos (componentes prontos, use em toda tela)

| Detalhe | Componente | Como |
|---|---|---|
| Ícone em cada cabeçalho de coluna | `DataTableColumnHeader` | `icon={<Flag />}` (14px, Fog) |
| Contagem e resumo ao lado do título do card | `SectionCardHeader` | `count="6 novos"`, `summary="12 leads · por entrada"` |
| Pessoa (corretor, responsável, autor) | `PersonChip` / `PersonInitials` | iniciais Powder Blue + "Nome S."; nome completo no `title` |
| Progresso em passos (etapa, checklist) | `SegmentBar` | `value`, `total` e `label` acessível |
| Tecla que funciona | `Kbd` | "↵", "Esc", "⌘K", só onde a tecla age de verdade |
| Prévia no hover | `HoverPreview` | gatilho focável; nada muda no toque |
| Status | `DsStatusBadge` | pílula lavada com ponto; nunca texto solto |
| Número | `tabular-nums` | valores, contagens e horários alinham |

## Tabela

- Uma tabela por lista (`DataTable` + `SectionCardHeader` dentro do `Card variant="overview"`). Nunca grade de cards.
- Linha de ~40px, padding horizontal 12px, hover em Paper Mist, sem sombra.
- Primeira coluna: nome em peso 500 + subtítulo em caption Fog. O nome é o gatilho do hover card.
- Acima da tabela: abas de filtro **com contagem** ("Todos 240 · Sem resposta 12"). Ao lado: busca curta e filtros em chips "Rótulo: Valor ▾".
- Com busca ativa, embaixo: "3 de 12 leads contêm 'silva' · Limpar busca".
- Rodapé: "10 de 1.240 leads" em caption Fog.
- Última coluna: `⋯` com as ações raras. No menu: o nome da entidade no cabeçalho (caption Fog), grupos separados por hairline, atalho à direita quando existir e o destrutivo sempre por último, em Rose Ink.
- Filtros num popover, com a contagem de cada opção e o resumo "3 filtros · 221 leads · Aplicar" no rodapé.
- Seleção em massa: barra flutuante no rodapé (`DsSelectionBar`), linha selecionada em Powder Blue, "Selecionar todos os 284".
- Alerta da linha é uma segunda linha em Rose Ink, só quando há problema ("há 3 dias sem resposta"). Nunca um banner fixo por linha.
- Problema agregado vai para o rodapé da tabela, com a ação que resolve ao lado ("4 leads sem resposta · Ver").

## Tipografia, cor e forma (resumo dos tokens)

- Inter em toda UI abaixo de 36px. Satoshi só 36px+.
- Rótulo de grupo: caption 11px, Fog, `uppercase tracking-wide`. Use no lugar de cartão aninhado.
- Número de KPI: Inter 600 em 24 ou 30px; delta em caption com Forest Ink ou Rose Ink.
- Dado técnico (protocolo, horário de log, ID): Geist Mono.
- Status: pílula com fundo lavado + texto escuro (Soft Mint/Forest Ink, Amber Wash/Ink, Rose Wash/Ink, Powder Blue/Electric Blue). Uma cor cromática por componente.
- Bordas 1px Ash. Raios 12 (cartão), 8 (botão), 6 (input), 9999 (pílula), 16 (modal e drawer). Sombra só no que flutua.
- Destrutivo: Rose Wash + Rose Ink. Não existe vermelho sólido.
- Sem gradiente em UI.

## Modais e confirmações

- Rodapé: contexto ou ação secundária à esquerda; "Cancelar" e o primário à direita.
- Confirmação forte (lista "Isso vai:", digitar o nome) só para ação irreversível. O resto segue os níveis 0 e 1 do `FEEDBACK.md`.
- Aviso de consequência em `DsCallout` de erro, dizendo o efeito e não culpando ninguém.
- Até 4 opções curtas: `DsSegmentedControl`, não select.

## Checklist de entrega

- [ ] Só o essencial ficou fixo; o resto foi para hover card, drawer ou menu
- [ ] Um único CTA Deep Sapphire na tela
- [ ] Nenhum token novo (ou pedido feito ao usuário e registrado)
- [ ] Hover card: só mouse fino, abre no foco, `Esc` fecha, atraso de abertura, `prefers-reduced-motion` respeitado
- [ ] Toque e mobile com o comportamento anterior
- [ ] Fluxo testável em `/dev/laboratorio`
- [ ] Typecheck (`NODE_OPTIONS=--max-old-space-size=8192`) e Vitest (`--maxWorkers=1`) passando
- [ ] Verificado no navegador com print
