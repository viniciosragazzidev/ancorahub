> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Movimento no CRM (Design System Venancor)

Diretriz de animação do CRM, adaptada da skill "animate" escolhida pelo dono do produto.
Base técnica que já existe e deve ser reutilizada: `src/lib/motion/*` (tokens, presets, transições),
`src/utils/animation`, provider de motion da interface e o hook de reduced motion.

## Contexto (define o quanto animar)
- **Público:** corretores e gestores, uso intensivo o dia todo, desktop e celular. Usuários avançados: **velocidade acima de tudo**.
- **Personalidade:** sério, calmo, confiável (saúde). Nada brincalhão, nada de bounce/elastic, nada de confete.
- **Desempenho:** telas pesadas (leads, conversas, plantão) e celular: só `transform` e `opacity`, nada de animar layout.

## Estratégia
- **Momento de destaque (um só):** confirmação de ação importante do corretor (aceitar lead, reatribuir, registrar venda): check em círculo com escala suave + fade (300-400ms).
- **Camada de feedback:** todo clique e envio tem resposta visual (pressão do botão, estado de carregando, toast).
- **Camada de transição:** abrir/fechar dialogs, sheets, popovers, dropdowns, abas e acordeões sem cortes secos.
- **Delícia contida:** contadores de KPI que sobem ao carregar o dashboard; estados vazios com ícone que aparece suave. Só isso.

## Tempos e curvas
| Uso | Duração |
|---|---|
| Feedback imediato (pressão, toggle) | 100-150ms |
| Mudança de estado (hover, abrir menu) | 150-250ms |
| Layout (dialog, sheet, acordeão) | 250-350ms |
| Entrada de página/lista | 300-500ms, stagger 30-50ms, no máximo 6-8 itens |
- Saída = ~75% da entrada.
- Curvas: `cubic-bezier(0.25, 1, 0.5, 1)` (quart, padrão) e `cubic-bezier(0.16, 1, 0.3, 1)` (expo, entradas). **Proibido** bounce e elastic.

## Aplicação por componente
- **Botão:** hover = troca de cor (sem escala no CRM denso); pressão = `scale(0.97)` em 100ms; carregando = spinner no lugar do ícone, largura fixa.
- **Campos:** foco = transição de borda e anel da primária em 150ms; erro = shake curto (2 ciclos, 4px, 250ms) + cor; sucesso = check suave.
- **Switch/checkbox:** deslize/traço em 150-200ms.
- **Abas e segmentos:** indicador desliza entre itens (layout animation do motion), conteúdo com fade 150ms.
- **Dialog/Sheet:** backdrop fade; dialog fade + `scale(0.98→1)` 250ms; sheet desliza da borda 300ms; foco preso e devolvido ao fechar.
- **Popover/dropdown/tooltip:** fade + 4px de deslocamento a partir da origem, 150ms; tooltip com delay de 300ms.
- **Toast:** entra deslizando + fade, sai mais rápido; ícone de status com pequeno pulso.
- **Listas e tabelas:** primeira carga com stagger curto (máx. 8 linhas); novas linhas (lead novo chegando) com destaque de fundo que esmaece em 1,5s; remoção com fade + colapso via `opacity/transform`.
- **Skeleton:** shimmer suave e troca para o conteúdo com crossfade.
- **Dashboard:** KPIs contam até o valor (count-up 600ms, `tabular-nums`); gráficos desenham na entrada uma vez.
- **Sidebar/menu:** indicador do item ativo desliza; grupos recolhem com rotação do chevron.
- **Navegação entre rotas:** crossfade leve do conteúdo principal (150ms), header e sidebar fixos.
- **Copiar:** confirmação "Copiado" com troca de ícone por check por 1,5s.

## Acessibilidade (obrigatório)
- Respeitar `prefers-reduced-motion`: sem deslocamento/escala, só troca instantânea ou fade mínimo.
- Nada bloqueia interação durante animação.
- Nenhuma animação de feedback acima de 500ms.

## Nunca
Bounce/elastic, animar width/height/top/left, animar tudo, animação sem propósito, ignorar reduced motion.
