
# Design System Venancor (padrão do Vinicios)

> Painel do design system padrão de todos os produtos do Vinicios a partir de 2026-10-04.
> Origem: marca da Venancor (MedLink, repo `venancor`, `DESIGN-SYSTEM.md`) + padrões de layout das referências do MedLink.
> (migração em 2026-10-04, branch `design/venancor-ds`).
> Spec técnica versionada no CRM: `docs/design-system/venancor.md`.

## Princípios
1. **Claro por padrão.** Tema escuro só se pedido (lição de 2026-10-03).
2. **Superfície > sombra.** Fundo cinza-quente bem claro, cards brancos de raio grande, quase sem sombra.
3. **Pílulas.** Campos, botões, segmentos e badges totalmente arredondados.
4. **Hierarquia por tamanho e cor**, não por negrito. Títulos grandes de peso médio.
5. **Uma cor de ação.** O azul-violeta `#3b2dff` marca o que é clicável/selecionado. Sucesso só em verde.
6. **Respiro.** Densidade confortável: padding de card 20-24px, gap entre campos 16-20px.

## Cores (light)
| Token | Valor | Uso |
|---|---|---|
| `--background` | `#ffffff` (página `#faf9f7`) | fundo |
| `--foreground` | `#09090b` | texto principal |
| `--card` | `#ffffff` | cards, dialogs |
| `--primary` | **`#3b2dff`** | ação, foco, seleção |
| `--primary-foreground` | `#ffffff` | texto sobre primária |
| `--secondary` / `--muted` / `--accent` | `#f4f3f0` | superfícies neutras quentes |
| `--muted-foreground` | `#71717a` | texto secundário, rótulos |
| `--border` / `--input` | `#e4e4e7` | bordas finas |
| `--ring` | `#3b2dff` | anel de foco |
| `--success` | `#10b981` | pago, concluído |
| `--warning` | `#f59e0b` | atenção, proposta |
| `--info` | `#3b82f6` | em atendimento, informativo |
| `--destructive` | `#ef4444` | erro, excluir |
| seleção suave | primária a ~8% | fundo de item selecionado |

**Dark (só quando pedido):** fundo `#09090b`, primária `#1F6FE5`, superfícies/bordas `#27272a`.

**Status (badges):** Aguardando slate · Em atendimento blue · Proposta amber · Venda/Pago emerald · Erro red, sempre `bg-*-50 text-*-700 border-*-200`.
**Gráficos:** primária `#3b2dff`, info `#3b82f6`, warning `#f59e0b`, success `#10b981`, neutro `#94a3b8`.

## Tipografia
- **Plus Jakarta Sans** em tudo (`--font-sans`). **Amil Typeface** só no logo (`--font-logo`).
- Título de página 24-28px peso 600, tracking levemente negativo. Seção 16-18px/600. Corpo 14px/400. Rótulo 13px/500 em `muted-foreground`. Micro (caps) 11px/600 tracking largo.
- Números (KPIs, valores) com `tabular-nums`.

## Forma e espaço
- Raio base **16px** (`--radius: 1rem`): card 16-20px, dialog 24px, campos e botões **pílula** (`rounded-full`).
- Altura de controle: 40px (compacto), **44-48px padrão**, 52px CTA em mobile.
- Espaçamento: escala de 4px; card `p-5/p-6`; seção `gap-6`; formulário `gap-4/5`.
- Sombra: só em elementos flutuantes (popover, dialog, toast): sombra suave e difusa.

## Componentes
- **Botão:** primário preenchido `#3b2dff` pílula; secundário branco com borda; ghost para ações de linha; destrutivo vermelho só em confirmação.
- **Campo:** pílula, borda fina, rótulo acima, ajuda/erro abaixo em 13px.
- **Segmento/abas:** pílulas lado a lado, selecionado com fundo da primária a 8% + borda e texto da primária.
- **Card:** branco, borda 1px `--border`, raio 16-20px, sem sombra.
- **Dialog/Sheet:** largo (até `max-w-3xl/4xl`), até 90vh, header e rodapé fixos, corpo com rolagem nativa **sem ScrollArea**; tela cheia no celular.
- **Tabela:** cabeçalho em caps micro `muted-foreground`, linhas com hover `#f4f3f0`, ações à direita.
- **Badge de status:** pílula pequena com as cores de status.
- **Tela de sucesso:** check verde grande em círculo, título, subtítulo, 2 botões (secundário em cima, primário embaixo).
- **Ícones:** traço fino (lucide/hugeicons stroke 1.5), nunca preenchidos.

## Movimento
Curto e funcional: 150-200ms, `cubic-bezier(0.2, 0, 0, 1)`, respeitar `prefers-reduced-motion`.

## Onde está aplicado
- MedLink: nativo (Next 16 + shadcn base-nova + Tailwind 4).
- CRM Âncora (este repo): migração do design system antigo (Inter, cinzas) para este, em 2026-10-04.
