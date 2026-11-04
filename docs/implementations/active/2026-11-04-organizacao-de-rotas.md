# Organização das rotas: cada assunto numa área, com abas

Data: 2026-11-04. Status: Fases 0 a 4 feitas; Fases 5 a 8 pendentes.

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
- **Fase 1, base: feita** (branch `feat/organizacao-rotas-f1`). Cadastro em `src/shared/navigation/nav-registry.ts`, `AreaTabs` abaixo do cabeçalho, menu lateral com as áreas.
- **Fase 2, Atendimento IA: feita** (branch `feat/organizacao-rotas-f2`). Uma fileira de abas: Comportamento, Perguntas, Situações, Mensagens, Follow-up, Simulador, Turbo, Permissões, Conectividade, Fluxos de WhatsApp (diretor) e Base de conhecimento (diretor).
  - O cadastro aceita aba por query (`/qualificacao?tab=...`, com valores antigos como `alerts` e `mcp_governance`); trocar entre visões da mesma página só muda a URL, sem recarregar nem perder o que foi digitado.
  - Saíram as abas internas da Qualificação e de Atendimento e o botão "Qualificação turbo".
  - Pendente para a fase de Configurações: Conectividade vai para Configurações > WhatsApp; o cartão de modo da IA ainda está em Ajustes > Atendimento.
  - O contador de alertas que aparecia em "Simulador (1)" saiu junto com a aba interna.
- **Fase 3, Distribuição: feita** (branch `feat/organizacao-rotas-f3`). Uma fileira de abas: Hoje, Operação, Plantões, Regras, Filas (diretor) e Saúde, só para diretor e gestor.
  - `/leads/distribuicao` vale como a mesma página; o detalhe de um plantão marca a aba Plantões.
  - Saíram as abas internas (versão normal e Lite do diretor). A versão normal lê a aba pela URL.
  - As abas da Distribuição recarregam a página no servidor (a versão do diretor monta cada visão no servidor); só as abas marcadas `inPlace` trocam sem recarregar.
  - Pendente: "sem atribuição" (Leads), "distribuídos" (Conversas), "repassar" (Equipe) e o limite de leads ativos (Ajustes) ainda não foram trazidos para cá; entram nas fases de Leads, Conversas e Configurações.
- **Ajuste depois da Fase 3 (pedido do Vinicios):** mudar o mínimo e manter a estrutura que já existe. As abas e os títulos voltaram aos nomes originais (Resumo, Entradas e regras, Prompt e comportamento, Fluxo de atendimento, Qualificação turbo, Materiais das operadoras) e a ordem original; o nome da área no menu é o único nome novo.
- **Fase 4, Comercial: feita** (branch `feat/organizacao-rotas-f4`). Comercial abre em Vendas, como o item antigo do menu; abas Vendas, Propostas, Negociações, Clientes, Documentos, Comissões e Ferramentas. Saiu de Vendas o cartão "Navegação comercial relacionada", que repetia as abas.
- **Fases 5 a 8, uma área por vez, mudando o mínimo:** Equipe, Configurações, Leads e Conversas.
- **Limpeza final:** apagar as telas mortas `/minha-fila/page.tsx`, os 6 `*/dashboard` de domínio, `/tarefas/dashboard` e `/settings/extension`. Antes, verificar se `/minha-fila` tem algo que a fila Light não tem, como a aba "Aguardando aceite".

## Riscos

- `custom-roles/routes.ts` dá permissão por caminho. Mudar a rota exige migrar as permissões salvas por empresa.
- Endereços antigos estão em WhatsApp, extensão e favoritos dos usuários; os redirects precisam ficar.
- Se o componente de abas não estiver em `docs/design-system.md`, perguntar antes de criar.
