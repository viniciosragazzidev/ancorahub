# Refinamento de rotas densas — 21/07/2026

## Entrega

O detalhe de lead (`/leads/[id]`) foi reorganizado em uma navegação única por abas:

- **Atendimento**: próxima ação do corretor e supervisão da gestão.
- **Cotações**: criação/leitura de propostas e estado vazio contextual.
- **Documentos**: checklist persistente por beneficiário e aprovação.
- **Linha do tempo**: histórico de interações.
- **Tarefas**: execução e pendências do atendimento.

Os contadores de cotações, documentos e tarefas aparecem na própria aba. Isso reduz a rolagem inicial e evita que cards de contextos diferentes disputem atenção.

## Regras preservadas

- A autorização continua sendo resolvida no servidor e com escopo de tenant.
- Supervisão só aparece para gestão; o hub de ação só aparece para o atendimento permitido.
- Cotações continuam respeitando `shouldShowQuotes`.
- Documentos continuam usando a checklist persistente por beneficiário.

## Próximo lote

Relatórios, fila geral e superfícies de super-admin continuam candidatas a uma segunda rodada. Antes de mover esses blocos, é necessário mapear filtros, permissões e links profundos específicos de cada rota para não quebrar operações existentes.
