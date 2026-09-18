# Contexto do Projeto

## Stack
- Framework: Next.js (App Router)
- Estilização: Tailwind v4
- Componentes compartilhados: `/components/ui`

## Design System — REGRA OBRIGATÓRIA
Todo trabalho visual DEVE seguir estritamente `docs/design-system.md`.
Nunca criar cor, radius, spacing ou tipografia fora dos tokens definidos ali.
Se algo não estiver coberto pelo design system, PARE e pergunte — não assuma.

### Regras não-negociáveis deste sistema específico:
- Bordas definem containers (1px #e5e5e5), NÃO usar sombras pesadas para elevação
- Radius: 9999px (tags/badges), 8px (botões), 12px (cards), 6px (inputs), 16px (cards grandes)
- Inputs usam borda PRETA 1px (#000000) — exceção proposital ao padrão #e5e5e5
- Azul #2563eb é destaque (links, ícones, métricas) — NUNCA fundo de superfície grande
- #1e40af (Deep Sapphire) é a ÚNICA cor de CTA primário, uma vez por tela
- Satoshi só em 36px+ (headlines). Abaixo disso, Inter sempre.
- Nunca mais de uma cor cromática (verde/laranja/violeta) no mesmo componente

## Fluxo de trabalho
1. Nunca commitar direto na main — sempre branch por rota/lote
2. Antes de codificar: apresentar plano de mudanças por componente
3. Depois de codificar: eu vou revisar visualmente antes do merge