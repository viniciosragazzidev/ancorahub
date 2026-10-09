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
O ÚNICO design system do CRM é o do modo Lite: `docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md` (decisão do Vinicios em 2026-10-09).
Qualquer outro documento de design (`docs/design-system.md`, `docs/design-system/*` fora de `lite/`, `docs/ux/UX_REDESIGN_*`, `NEWDesign.md`, `nexus-analytics-dashboard-DESIGN.md`, referências Dub/Satoshi) está DESCONTINUADO e deve ser ignorado.
- Valores visuais vêm dos tokens do Lite (§2 do documento): fundo `#f7f7f9`, cards brancos sem borda com sombra leve e raio 24px, controles em pílula, Plus Jakarta Sans só 400/500, azul de ação e índigo dos controles, sombras resting/raised/floating, movimento do §3.
- No modo normal (diretor/gestor) aplica-se só a camada visual do Lite: a estrutura (sidebar, tabelas, drawers, fluxos) continua; não transformar telas em chat.
- Nunca criar cor, raio, sombra, peso ou fonte fora desses tokens. Se algo não estiver coberto, PARE e pergunte.

## Densidade de interface — REGRA OBRIGATÓRIA
Só o essencial fica fixo na tela; o resto vai para drawer ou menu suspenso.
A densidade é regra estrutural (vale com o visual do Lite).
- Lista de entidades = uma tabela no padrão de `/equipe` (`DataTable` + `SectionCardHeader`), nunca grade de cards grandes
- Clique na linha abre drawer lateral (`Sheet`) com detalhes e configurações da entidade
- Ações secundárias e configurações auxiliares em dropdown (`⋯` na linha, "Configurações ▾" no card)
- Adicionar itens relacionados = busca + botão "+" (`SearchAddList`), com "Só ativos" por padrão
- Um único CTA primário por tela; reutilizar os componentes compartilhados, nunca recriar por página

## Fluxo de trabalho
1. Nunca commitar direto na main — sempre branch por rota/lote
2. Antes de codificar: apresentar plano de mudanças por componente
3. Depois de codificar: eu vou revisar visualmente antes do merge