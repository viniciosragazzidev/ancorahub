# Organização das rotas: cada assunto numa área, com abas

Data: 2026-11-04. Status: Fase 0 feita; Fases 1 a 8 pendentes.

## Objetivo

Cada funcionalidade fica em um único lugar previsível. O menu tem poucas áreas, e cada área tem abas.
Configuração não fica no meio de tela de operação. A interface mostra só o essencial; o resto vai para drawer ou menu.

## Áreas (modo normal / diretor)

| Área | Abas | O que absorve |
|---|---|---|
| Início `/dashboard` | Visão geral · Qualidade · Funil · Ao vivo | relatórios, drill, `/noc` (aba Ao vivo) |
| Conversas `/conversas` | Leads · Corretores · Coex | a aba "distribuídos" vai para Distribuição |
| Leads `/leads` | Lista/Kanban · Radar · Perdidos · Arquivados · Visão geral | `/leads/arquivados`, `/leads/dashboard` |
| Distribuição `/distribuicao` | Hoje · Operar · Plantões · Regras | Operar: sem atribuição, repassar. Regras: roteamento, filas, SLA, política, limite de leads ativos (hoje em Ajustes). Plantões: as 4 telas de plantão, detalhe em drawer |
| Comercial `/vendas` | Negociações · Propostas · Vendas · Clientes · Documentos | `/negociacoes`, `/propostas`, `/clientes`, `/documentos`, validador de comprovante, comissões (atalho) |
| Equipe `/equipe` | Pessoas · Unidades · Desempenho · Relacionamento | `/gestao`, `/unidades/[id]`, `/filiais`, `/relacionamento` (recados e Jornada) |
| Atendimento IA `/atendimento` | Comportamento · Perguntas · Situações · Mensagens · Follow-up · Turbo · Base de conhecimento · Simulador | `/qualificacao` (+turbo), `/fluxos-whatsapp`, bloco de IA de Ajustes › Atendimento, materiais das operadoras |
| Marketing `/marketing` | Campanhas · Importações | Meta Ads e importação |
| Configurações (rodapé) | Conta · Empresa · Unidade · Acesso e segurança · Canais · Assinatura | cargos e recuperações (saem de Equipe), WhatsApp, diagnóstico WAHA, Meta, integrações, extensão, `/assinatura` |

O modo Light (corretor, supervisor e gerente) mantém a estrutura atual; só os links do "Mais" mudam.

## Decisões (recomendadas, aprovadas em 2026-11-04)

- Negociações entra em Comercial.
- `/noc` vira a aba "Ao vivo" de Início. `/integridade` fica só no super-dev. `/assistente` sai, porque repete o chat de Início e a Cotação. Guia vai para o menu do usuário como "Ajuda".
- O nome da área é "Atendimento IA".

## Regras para manter

1. Um assunto, uma área. Configuração vai para Regras ou Configurações.
2. Aba = sub-rota com `layout.tsx` (ex.: `/vendas/propostas`). Hoje convivem `?tab`, `?view`, `?visao` e `?aba`.
3. Um cadastro único de navegação (`nav-registry`) alimenta o menu lateral, `director-routes.ts`, `feature-search-index.ts`, atalhos e `custom-roles/routes.ts`.
4. Um teste falha se uma página do painel não pertencer a uma área nem estiver marcada como interna.
5. Endereço antigo nunca quebra: toda mudança deixa um redirecionamento.

## Fases (uma branch por fase)

- **Fase 0, correções sem mudança visual: feita.**
  - `/propostas` e `/configuracoes/comissoes` voltaram a abrir. Os redirects em `next.config.ts` impediam as páginas de abrir.
  - Vendas ganhou o atalho "Propostas". "Comissões" aparece só para diretor e gerente.
  - Links corrigidos:
    - `/settings?tab=comissoes` passou para `/configuracoes/comissoes`
    - `?tab=integrations` passou para `?tab=integracoes`
    - `?tab=security` passou para `?tab=seguranca`
    - `/leads?tab=distribuicao` passou para `/distribuicao?view=roteamento`
    - `/leads?tab=plantao` passou para `/distribuicao?view=plantao`
    - `/dashboard?tab=commercial` passou para `/dashboard`
  - Removido o link "Materiais de divulgação" de Campanhas: não existe tela de materiais para a corretora.
- **Fase 1, base:** cadastro único de navegação, componente de abas da área e menu lateral com 8 áreas.
- **Fases 2 a 8, uma área por vez:** Atendimento IA, Distribuição, Comercial, Equipe, Configurações, Leads e Conversas.
- **Limpeza final:** apagar as telas mortas `/minha-fila/page.tsx`, os 6 `*/dashboard` de domínio, `/tarefas/dashboard` e `/settings/extension`. Antes, verificar se `/minha-fila` tem algo que a fila Light não tem, como a aba "Aguardando aceite".

## Riscos

- `custom-roles/routes.ts` dá permissão por caminho. Mudar a rota exige migrar as permissões salvas por empresa.
- Endereços antigos estão em WhatsApp, extensão e favoritos dos usuários; os redirects precisam ficar.
- Se o componente de abas não estiver em `docs/design-system.md`, perguntar antes de criar.
