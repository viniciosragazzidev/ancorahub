# Contexto do Projeto

## Stack
- Framework: Next.js (App Router)
- Estilização: Tailwind v4
- Componentes compartilhados: `/components/ui`

## Infraestrutura — REGRA OBRIGATÓRIA
Produção roda no **Coolify** (VPS), em `https://crm.ancorasaude.cloud`. **Não usamos mais Vercel.**
- Nunca criar `vercel.json`, crons da Vercel, scripts `vercel`, arquivos `.vercel*` ou referências a `*.vercel.app`
- Jobs agendados são Scheduled Tasks do Coolify, documentados em `docs/runbooks/coolify-scheduled-tasks.md`; job novo entra nesse runbook
- Variáveis de ambiente ficam no Coolify, não em arquivos locais versionados
- A biblioteca `ai` (Vercel AI SDK) é dependência de código do agente, não hospedagem: pode continuar

## Design System — REGRA OBRIGATÓRIA
Desde 20/11/2026 o Lite é a única versão da interface, inclusive para o Diretor (`[data-skin="diretor"]`). Todo trabalho visual DEVE seguir estritamente `docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md` (design system "Conversa").
- O código é a fonte da verdade dos tokens: `src/components/arc/venancor-scope.css`, `src/components/arc/foundation.css`, `src/components/arc/motion-tokens.ts` e `src/components/chat/*`
- Brief de produto, voz, referências e decisões: `DESIGN.md` na raiz
- `docs/design-system.md` continua valendo para densidade e padrões de página que o Lite não cobre
- Não trabalhar no modo normal; implementar e verificar só nos caminhos Lite (`*Lite`, `isDirectorLitePageOnServer`, `useDirectorLitePage`)

Nunca criar cor, radius, spacing, sombra ou tipografia fora dos tokens do Lite.
Se algo não estiver coberto pelo design system, PARE e pergunte — não assuma.

### Regras não-negociáveis deste sistema específico:
- Tokens só abaixo de `.arc-venancor`, nunca no `:root`; camadas abertas fora da moldura (bottom sheet) recebem `className="arc-venancor"`
- Superfícies neutras frias: canvas `--background` (#f7f7f9), cartões `--surface` (#ffffff), hover `--surface-muted`; borda translúcida `--border` (`rgb(16 16 40 / .08)`)
- Elevação discreta: só `--shadow-resting`, `--shadow-raised` e `--shadow-floating`; nada de sombra pesada
- Radius: `--radius-control` 9999px (botões, inputs, linhas, chips), `--radius-panel` 1.5rem (cartões, composer, menus), `--radius-surface` 1.75rem; balões 16px
- Azul de ação `--chat-action` (`oklch(62% .2 255)`) marca a ação primária, uma por superfície; o resto é neutro
- Índigo `--accent` (#3b2dff) só para seleção em controles Arc (switch, segmented, radio, checkbox, foco)
- Status (`--success`, `--warning`, `--danger`) só significa status, sempre com texto; verde do WhatsApp só no que é WhatsApp
- Nunca mais de uma cor cromática no mesmo componente
- Tipografia: Inter (`--font-inter`) em tudo, pesos 400 e 500 apenas (nunca 600/700), escala 12/14/16/18/22/28/36, números com `tabular-nums`
- Sem caixa alta e sem rótulo/overline acima de título
- Alvo de toque mínimo 44px; campos com 16px no celular
- Textos em pt-BR, frases curtas, nunca travessão (—)

## Artifact aprovado vira código 1:1 — REGRA OBRIGATÓRIA E INDISCUTÍVEL
Desde 27/11/2026, toda tela desenhada num artifact e aprovada é implementada exatamente igual: cada borda, cor, raio, espaçamento, tamanho de fonte, ícone, ordem e área.
- Copiar a marcação e o CSS do artifact para um CSS module novo e marcação nova no caminho Lite, ligados aos dados e ações reais. Nunca restilizar o componente antigo com CSS por cima (as regras antigas vencem e o resultado fica "parecido")
- Antes do push, abrir a tela real e o artifact lado a lado em 1440x900 e 375x812 e conferir área por área (bordas, cantos, cores, ícones, rótulos, ordem, gavetas e popovers)
- O que não puder ficar igual (dado que não existe, regra do projeto) é dito ao usuário antes do push, nunca trocado em silêncio

## Densidade de interface — REGRA OBRIGATÓRIA
Só o essencial fica fixo na tela; o resto vai para drawer ou menu suspenso.
Detalhes em `docs/design-system.md` § "Product Density".
- Lista de entidades = uma tabela no padrão de `/equipe` (`DataTable` + `SectionCardHeader`), nunca grade de cards grandes
- Clique na linha abre drawer lateral (`Sheet`) com detalhes e configurações da entidade
- Ações secundárias e configurações auxiliares em dropdown (`⋯` na linha, "Configurações ▾" no card)
- Adicionar itens relacionados = busca + botão "+" (`SearchAddList`), com "Só ativos" por padrão
- Um único CTA primário por tela; reutilizar os componentes compartilhados, nunca recriar por página

## Feedback e movimento: REGRA OBRIGATÓRIA
Toda resposta a ação ou evento segue `docs/design-system/FEEDBACK.md` (padrão geral desde 14/11/2026, começando pelo modo Lite).
- Cada ação tem um nível: 0 silencioso, 1 confirmação, 2 marco no contexto, 3 celebração. Ação frequente nunca tem som nem celebração
- Camadas em ritmo fixo: visual na hora, texto +80ms, número +160ms; som e vibração só a partir do nível que pede
- Sucesso só depois da confirmação do servidor; erro mostra causa, o que continua valendo e "Tentar de novo"
- Botão de ação com estados repouso, pressionado, enviando, confirmado e falhou, largura fixa (`LiteActionButton` no Lite)
- Som e vibração só via `useFeedback`; nunca `playSound` ou `navigator.vibrate` direto
- Respeitar `prefers-reduced-motion`, o kill-switch e os interruptores do usuário (som, vibração, animações, celebrações)
- Sem culpa, sem confete no modo normal, sem celebrar volume. Plano por rota: `docs/implementations/active/2026-11-14-feedback-padrao.md`

## Fluxo de trabalho
1. Nunca commitar direto na main — sempre branch por rota/lote
2. Antes de codificar: apresentar plano de mudanças por componente
3. Depois de codificar: eu vou revisar visualmente antes do merge
