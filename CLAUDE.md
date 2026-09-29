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

## Densidade de interface — REGRA OBRIGATÓRIA
Só o essencial fica fixo na tela; o resto vai para drawer ou menu suspenso.
Detalhes em `docs/design-system.md` § "Product Density".
- Lista de entidades = uma tabela no padrão de `/equipe` (`DataTable` + `SectionCardHeader`), nunca grade de cards grandes
- Clique na linha abre drawer lateral (`Sheet`) com detalhes e configurações da entidade
- Ações secundárias e configurações auxiliares em dropdown (`⋯` na linha, "Configurações ▾" no card)
- Adicionar itens relacionados = busca + botão "+" (`SearchAddList`), com "Só ativos" por padrão
- Um único CTA primário por tela; reutilizar os componentes compartilhados, nunca recriar por página

## Fluxo de trabalho
1. Nunca commitar direto na main — sempre branch por rota/lote
2. Antes de codificar: apresentar plano de mudanças por componente
3. Depois de codificar: eu vou revisar visualmente antes do merge