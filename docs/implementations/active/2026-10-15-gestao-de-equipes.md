# Gestão de Equipes no Lite (gestor e supervisor)

> Pedido do Vinicios em 2026-10-15. Prioridade 3 da semana (Lite do gestor/supervisor).
> Regra central: **gestão por exceção**. O gestor ouve "2 equipes precisam de atenção"; o supervisor ouve "3 corretores precisam de você". Ninguém abre 20 perfis por dia.
> Hierarquia: Unidade → Supervisor (= equipe) → Corretor. Gestor gerencia supervisores e a saúde das equipes; supervisor gerencia comportamento e evolução dos corretores.

## 1. Viabilidade: o que já existe

O CRM já tem a maior parte da matéria-prima. O trabalho é sobretudo **uma camada de métricas por janela** e **telas novas no Lite**, com poucas migrations.

| Necessidade | Já existe | Falta |
|---|---|---|
| Equipe como entidade | `supervisor_teams` (nome, descrição, imagem, 1 por supervisor) + `tenant_memberships.supervisor_id` | cor e ícone (2 colunas) |
| Aceite, tempo de aceite, início | `lead_offers` + `getTeamOfferStats` (`src/features/engagement/broker-stats.ts`) | janela anterior para tendência |
| Redistribuição | `lead_offers` com status EXPIRED / DECLINED / REPLACED | contagem por corretor e equipe |
| SLA de primeiro contato | `leads.assigned_at` x `first_contact_at` (já usado no pulso do corretor) | agregação por equipe |
| Cotações, vendas, perdas, conversão | `quotes`, `sales`, `leads.status` (`converted`/`lost`), `motivo_perda` | agregação por janela |
| Retornos vencidos, sem próxima ação | `lead_tasks` (`due_at`, `completed_at`) | regra "lead ativo sem tarefa aberta" |
| Situação atual do corretor | `availability_status`, plantão do dia com presença (`getSupervisorWorkspaceData().duty`) | nada |
| Pulso do corretor | `getSupervisorLiteMemberPulse` (gestor e supervisor) | 30 dias e comparação com janela anterior |
| Metas | tabelas `goals` (escopo broker/team/branch/tenant) e `goal_progress` + `src/features/goals/` (serviço e componentes prontos, sem tela montada) | tela Lite; tipos SLA/tempo de resposta/cotações |
| Feedback do supervisor | `supervisor_notes` (orientação/elogio/alerta) no perfil `/equipe/[id]` | tipos "ponto de melhoria" e "acompanhamento" + data "revisar em" |
| Reconhecimento | `recognizeBrokerAction` (pontos + motivo) e broadcast `recognition` | exibir no perfil |
| Ranking e destaques | jornada/engajamento: `leaderboard-queries.ts`, `ranking.ts`, `TeamStandings`, missões, conquistas, temporadas | "Destaques da semana" por categoria e "maior evolução" |
| Mural e avisos | Central de relacionamento (`relationship_broadcasts`, público por equipe ou unidade) | liberar `/relacionamento` no Lite do gestor (hoje fora da lista de rotas) |
| Histórico mensal | nada (só o ledger de pontos é diário) | tabela de snapshot diário (fase G6) |

Conclusão: o **MVP inteiro sai sem tabela nova de métricas**, calculando sobre eventos crus com cache curto. Só a evolução mês a mês (item 7 do pedido) pede snapshot diário.

## 2. Definições (vocabulário único das telas)

Janela padrão de **7 dias**, alternável para **30 dias**. Tendência = janela atual x a janela anterior de mesmo tamanho (↑ melhorou, → estável dentro de ±5%, ↓ piorou).

- **Recebidos:** ofertas ao corretor na janela (`lead_offers.offered_at`), sem CANCELLED/LOST.
- **Taxa de aceite:** aceitas / recebidas.
- **Tempo de aceite:** mediana de `accepted_at - offered_at`.
- **Redistribuições:** ofertas que expiraram, foram recusadas ou substituídas (EXPIRED, DECLINED, REPLACED).
- **SLA:** % dos leads atribuídos na janela com primeiro contato dentro do prazo do tenant.
- **Conversão:** vendas / leads atribuídos na janela.
- **Retornos vencidos:** tarefas abertas com `due_at` passado.
- **Sem próxima ação:** lead em atendimento sem nenhuma tarefa aberta.
- **Sem atividade:** corretor ativo sem aceite nem mudança de etapa há 2 dias úteis.

## 3. Saúde da equipe (0 a 100)

Função pura `teamHealthScore(metrics)` com pesos fixos (calibrar depois com dados reais):

| Componente | Peso |
|---|---|
| SLA | 25 |
| Taxa de aceite | 20 |
| Pendências (retornos vencidos + sem próxima ação, por corretor) | 20 |
| Conversão (relativa à média da unidade) | 15 |
| Redistribuições | 10 |
| Atividade e equilíbrio de carga | 10 |

Faixas: **Excelente** 85+, **Saudável** 70 a 84, **Atenção** 50 a 69, **Crítico** abaixo de 50. A tela nunca mostra a fórmula, só "Pontos fortes" e "Pontos de atenção" (os 2 melhores e os 2 piores componentes, em frase).

## 4. Rotas

O `/equipe` já é a gestão de pessoas (convites, transferências, membros) e continua assim. A gestão de desempenho ganha casa própria:

- `/gestao`: gestor vê a unidade; supervisor vê a própria equipe (mesma rota, escopo pela sessão).
- `/gestao/equipes/[supervisorId]`: perfil da equipe (gestor; o supervisor cai direto na sua).
- `/equipe/[id]`: perfil do corretor, que já existe e ganha as seções novas (não duplicar rota).
- Flag nova `feature_team_management_enabled` (super admin) até validar.

## 5. Fases

Cada fase passa pelo portão de design Lite (prints claro/escuro, celular 390 e desktop 1440, animação em CSS) e entra na `feat/diretor-visual-lite`.

### G0. Camada de métricas (base de tudo)
- `src/features/team-management/metrics.ts`: uma consulta agregada por corretor para a unidade inteira (CTEs sobre `lead_offers`, `leads`, `lead_tasks`, `quotes`, `sales`), janela atual e anterior juntas, cache de 60 s. Agrega em equipe e unidade em memória.
- `health.ts` (score e frases), `alerts.ts` (regras da seção G4), tudo função pura com teste.
- Escopo travado no servidor: gestor só a própria unidade, supervisor só o próprio time (`inSupervisorTeam`).
- Pronto quando: testes das funções puras + consulta conferida contra o pulso existente em 3 corretores reais (SQL entregue ao Vinicios).

### G1. Visão do gestor (`/gestao`)
- Topo enxuto: corretores ativos, equipes, leads da unidade, SLA, aceite, conversão (6 números, com seta de tendência).
- Frase de exceção: "2 equipes precisam de atenção".
- **Saúde das equipes:** um card por equipe (identidade, supervisor, score, 2 frases), ordenado Crítico → Atenção → Saudável. Corretores sem supervisor aparecem como grupo "Sem equipe".
- **Comparar supervisores:** tabela compacta (equipe, SLA, aceite, conversão, saúde, tendência). Sem pódio.

### G2. Equipe e supervisor (`/gestao/equipes/[id]`, e a home do supervisor)
- Para o supervisor, `/gestao` abre aqui.
- **Precisam de você:** um card por corretor com os motivos em frase ("3 retornos vencidos", "nenhum aceite nas últimas 2h", "conversão caiu 30% em 7 dias"), com atalho para o lead ou para cobrar.
- **Carga da equipe:** barras de leads ativos por corretor, com aviso quando alguém passa de 50% acima da média.
- Meta da equipe (se houver) e score.
- Para o gestor, a mesma página mostra a **qualidade de gestão** do supervisor: corretores abaixo da média, evoluindo, sem atividade, pendências críticas.

### G3. Perfil do corretor (evolução de `/equipe/[id]`)
- Situação atual: disponibilidade, plantão de hoje, ativos, novos, pendências.
- Desempenho 7/30 dias com tendência (aceite, tempo de aceite, primeira resposta, redistribuições, cotações, vendas, conversão, perdas).
- **Feedback:** reaproveitar `supervisor_notes`, com 2 tipos novos (ponto de melhoria, acompanhamento) e "revisar em" opcional, que vira lembrete ao supervisor.
- Reconhecimentos recebidos (ledger de pontos e broadcasts de reconhecimento).
- Metas individuais (G5).

### G4. Alertas automáticos e insights
Regras puras sobre a camada G0, cada uma com frase pronta:
- corretor sem aceitar (2h no plantão); redistribuições subindo (+40% em 3 dias); muitos leads sem próxima ação; conversão caindo (-30% em 7 dias); sobrecarga (+50% da média); poucos leads em relação à equipe; SLA da equipe piorando; supervisor com pendências críticas acumuladas.
- Aparecem em G1/G2 como frases e, opcionalmente, no Início do Lite (card "Precisa de você").
- Insights do tipo "Maria reduziu o tempo de aceite em 32%" saem da comparação de janelas.

### G5. Metas
- Tela Lite sobre `src/features/goals/` (já pronto): supervisor define metas da equipe e de cada corretor; gestor vê as metas de todas as equipes.
- Migration: novos `target_type` (`quotes_count`, `sla_rate`, `response_minutes`).
- Visual: "6 de 8 · 75%" com barra.

### G6. Destaques, resumo semanal e evolução
- **Destaques da semana** por categoria (maior conversão, melhor SLA, maior evolução, menos redistribuições), reaproveitando o ranking da jornada; o corretor com `ranking_opt_out` fica de fora.
- **Destaque manual** do supervisor com motivo (vira reconhecimento).
- **Resumo semanal:** card "Esta semana" para gestor e supervisor; notificação na segunda de manhã.
- **Evolução mês a mês:** tabela `broker_metric_daily` (snapshot noturno + backfill dos últimos 90 dias a partir dos eventos) e linha do tempo no perfil.

### Depois do MVP (backlog, sem data)
Personalização da equipe (cor e ícone: 2 colunas em `supervisor_teams`), mural no Lite do gestor (liberar `/relacionamento`), heatmap por dia e hora, matriz de desempenho, sequências de consistência, check-in semanal, plano de desenvolvimento.

## 6. Ordem e divisão sugerida
1. G0 (base, 1 executor, bloqueia o resto).
2. G1 e G3 em paralelo (telas diferentes).
3. G2 e G4 juntas (dividem as regras de alerta).
4. G5, depois G6.

Migrations do MVP: só `supervisor_notes` (tipos + `follow_up_at`) em G3 e `goal_target_type` em G5. O snapshot diário fica para G6.

## 7. Decisões do Vinicios (2026-10-15)
1. Rota: **`/gestao`**.
2. Score: pesos e faixas da seção 3, como propostos.
3. Conversão: **vendas / leads atribuídos na janela**.
4. Destaques e "maior evolução": **só gestor e supervisor no MVP** (o corretor vê depois).
