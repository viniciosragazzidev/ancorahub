# Movimento no CRM (Design System Venancor)

Diretriz de animação do CRM, adaptada da skill "animate" escolhida pelo dono do produto.
Fonte única de valores (desde 18/11/2026): `src/components/arc/motion-tokens.ts`. As variáveis CSS de
`globals.css` (`--duration-instant|fast|exit|standard|draw|considered`, `--duration-stagger`, `--ease-enter|standard|exit`)
e os conjuntos antigos (`src/lib/motion`, `src/shared/animations`) só repetem ou apontam para ele; o teste
`src/lib/motion/motion-tokens-sync.test.ts` impede que se separem. Para saber se pode animar, use
`useMotionAllowed()` (`src/components/motion/use-motion-allowed.ts`): junta o sistema, "Menos animação" e o kill switch.
Plano de refinamento em curso: `docs/implementations/active/2026-11-18-refinamento-movimento-areas.md`.

> **Padrão geral de feedback (14/11/2026):** níveis de resposta, som, vibração, mascote e estados do botão de ação estão em [FEEDBACK.md](./FEEDBACK.md), que prevalece em conflito. No modo normal valem os níveis 0 a 2: o bounce e o confete continuam proibidos aqui. O confete e a mola `celebrate` existem só no nível 3 do Lite.

## Contexto (define o quanto animar)
- **Público:** corretores e gestores, uso intensivo o dia todo, desktop e celular. Usuários avançados: **velocidade acima de tudo**.
- **Personalidade:** sério, calmo, confiável (saúde). Nada brincalhão, nada de bounce/elastic, nada de confete.
- **Desempenho:** telas pesadas (leads, conversas, plantão) e celular: só `transform` e `opacity`, nada de animar layout.

## Estratégia
- **Momento de destaque (um só):** confirmação de ação importante do corretor (aceitar lead, reatribuir, registrar venda): check em círculo com escala suave + fade (300-400ms).
- **Camada de feedback:** todo clique e envio tem resposta visual (pressão do botão, estado de carregando, toast).
- **Camada de transição:** abrir/fechar dialogs, sheets, popovers, dropdowns, abas e acordeões sem cortes secos.
- **Delícia contida:** estados vazios com ícone que aparece suave; número que muda com a tela aberta rola por dígito (nível 2 do FEEDBACK). Só isso.

## Tempos e curvas
| Uso | Duração |
|---|---|
| Feedback imediato (pressão, toggle) | `instant` 120ms |
| Mudança de estado (hover, abrir menu, troca de aba) | `fast` 160ms |
| Saída | `exit` 180ms |
| Layout (dialog, sheet, acordeão) e entrada de bloco | `standard` 240ms |
| Entrada de página/lista | `standard` 240ms por bloco, cascata `stagger.item` 35ms, no máximo 6 blocos (8 itens de lista) |
| Raro (traço, check) | `draw` 320ms; teto `considered` 480ms |
- Curvas: `ease.enter` `cubic-bezier(0.16, 1, 0.3, 1)` para entradas, `ease.standard` `cubic-bezier(0.22, 1, 0.36, 1)` para troca de estado, `ease.exit` `cubic-bezier(0.7, 0, 0.84, 0)` para saídas. **Proibido** bounce e elastic.

## Aplicação por componente
- **Botão:** hover = troca de cor (sem escala no CRM denso); pressão = `scale(0.97)` em 100ms; carregando = spinner no lugar do ícone, largura fixa.
- **Campos:** foco = transição de borda e anel da primária em 150ms; erro = shake curto (2 ciclos, 4px, 250ms) + cor; sucesso = check suave.
- **Switch/checkbox:** deslize/traço em 150-200ms.
- **Abas e segmentos:** indicador desliza entre itens (layout animation do motion), conteúdo com fade 150ms.
- **Dialog/Sheet:** backdrop fade; dialog fade + `scale(0.98→1)` 250ms; sheet desliza da borda 300ms; foco preso e devolvido ao fechar.
- **Popover/dropdown/tooltip:** fade + 4px de deslocamento a partir da origem, 150ms; tooltip com delay de 300ms.
- **Toast:** entra deslizando + fade, sai mais rápido; ícone de status com pequeno pulso.
- **Listas e tabelas:** primeira carga da rota com stagger curto (máx. 8 linhas), nunca em filtro, ordenação ou paginação; novas linhas (lead novo chegando) com destaque de fundo que esmaece em 1,5s; remoção com fade + colapso via `opacity/transform`.
- **Skeleton:** shimmer suave e troca para o conteúdo com crossfade.
- **Dashboard:** números aparecem prontos ao abrir a tela (nível 0, sem contar do zero), sempre com `tabular-nums`; com a tela aberta, valor que muda em tempo real rola por dígito (nível 2). Gráficos desenham na entrada uma vez.
- **Sidebar/menu:** indicador do item ativo desliza; grupos recolhem com rotação do chevron.
- **Navegação entre rotas:** hoje sem transição (a View Transition do React prendia o loading do RSC; ver DEC-034). A entrada por CSS em `template.tsx` é a etapa 2 do plano de 18/11/2026; header e sidebar ficam fixos.
- **Copiar:** confirmação "Copiado" com troca de ícone por check por 1,5s.

## Acessibilidade (obrigatório)
- Respeitar `prefers-reduced-motion`: sem deslocamento/escala, só troca instantânea ou fade mínimo.
- Nada bloqueia interação durante animação.
- Nenhuma animação de feedback acima de 500ms.

## Nunca
Bounce/elastic, animar width/height/top/left, animar tudo, animação sem propósito, ignorar reduced motion.
