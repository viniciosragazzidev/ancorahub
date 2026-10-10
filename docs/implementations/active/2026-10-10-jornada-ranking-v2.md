# Jornada, missões e ranking v2 (corretor, supervisor e diretor)

> Pedido do Vinicios (2026-10-10): "planeje e veja todas as funcionalidades legais para o modo corretor e supervisor, com interações com o modo diretor; melhore missões, animações e interações; sistema melhor de ranking de equipe e entre corretores; missões ligadas ao atendimento; tudo dinâmico, com animação e feedback visual; no mínimo 20 implementações, usando todos os agentes."
>
> Base: `2026-10-10-central-relacionamento-corretor.md` (R0 e R1 no ar: extrato `engagement_point_events`, coletor, Central de recados). Este plano é a R2 + R4 ampliadas. **As regras obrigatórias do Vigia (§8 daquele plano) continuam valendo**: ponto só com evidência, idempotência, período em America/Sao_Paulo, sem prêmio material até o parecer jurídico, opt-out do placar, oferta de lead sempre na frente de celebração, nada de pontos no WhatsApp.

## 0. Princípios

1. **Atrás de flag, sempre.** `feature_broker_engagement_enabled` (já existe: coleta pontos) + flags novas, todas com padrão desligado:
   - `feature_broker_journey_enabled`: o corretor vê Jornada, missões, conquistas e celebrações;
   - `feature_team_ranking_enabled`: placar entre equipes e placar interno da equipe;
   - `feature_engagement_campaigns_enabled`: campanhas e regras do diretor.
2. **Degrada sem quebrar.** Toda leitura das tabelas novas tem `.catch` e some da tela se a migração 0193 não estiver aplicada (lição do /equipe).
3. **Ranking justo.** Placar semanal (zera na segunda, SP), nível é carreira. Entre corretores: dentro da unidade, top 3 + a própria posição + "faltam X pts para o próximo". Entre equipes: pontos por corretor ativo (média), para equipe grande não ganhar só por tamanho. Opt-out: quem sai do placar some do top 3 dos outros e continua vendo a própria posição.
4. **Feedback na hora, sem atrapalhar.** Celebração entra numa fila: oferta de lead > alerta de SLA > celebração. Celebração grande (missão, nível, conquista) uma vez só (`engagement_celebrations.seen_at`). `prefers-reduced-motion` troca animação por troca simples.
5. **Design do Lite com Arc.** Toda tela nova usa os componentes de `src/components/arc` (metric-card, animated-counter, segmented-control, bottom-sheet com `className="arc-venancor"`, empty-state, badge, avatar, radio-cards). Checar que todo `.module.css` tem as classes usadas.
6. **Datas.** Nunca `Date` cru dentro de `sql`: operador drizzle ou `toISOString()::timestamptz`.

## 1. As 23 implementações

### Onda A: fundação (dados e motores) · Cinzel

| # | Implementação | Detalhe |
|---|---|---|
| A1 | **Migração 0193 + script `apply-0193-engagement-journey.mjs`** | Tabelas: `engagement_missions` (catálogo da empresa: id, tenant, kind `daily\|weekly\|team\|campaign`, rule/metric, target, bonus_points, period, audience jsonb, starts_at, ends_at, status, created_by), `engagement_mission_progress` (mission, broker ou supervisor, period_key, progress, target, completed_at; unique mission+subject+period_key), `engagement_achievements` (tenant, broker, badge_key, earned_at, evidence jsonb; unique tenant+broker+badge), `engagement_celebrations` (tenant, user, kind, payload jsonb, priority, created_at, seen_at; índice user+seen_at). Coluna `tenant_memberships.ranking_opt_out boolean default false`. Índices do placar: `engagement_point_events (tenant_id, period_day, broker_id)`. Script simula por padrão, `--apply` grava, mostra o host. |
| A2 | **Motor de missões** `src/features/engagement/missions.ts` (puro + testes) | Missões do dia escolhidas pelo dia do corretor (tem plantão ou não): "Todo primeiro contato em até 5 min" (contatos com evidência / leads recebidos), "Zerar retornos vencidos", "Registrar cada atendimento" (notas válidas / atendimentos), "Aceitar toda oferta em até 1 min". Da semana: "5 dias com contato no prazo", "20 primeiros contatos com evidência". `periodKey` SP. Bônus ao concluir vira evento `mission.completed` com idempotência `mission:<id>:<broker>:<period>`. |
| A3 | **Motor de conquistas** `achievements.ts` (puro + testes) | Os 8 selos do plano anterior (§3.4), cada um com `progress(current, target)` para a grade mostrar "7/10". Os de venda ficam desligados enquanto `sale.approved` estiver off. |
| A4 | **Níveis e sequência** `levels.ts` (puro + testes) | Níveis: Iniciante 0, Consultor 500, Especialista 2.000, Referência 6.000, Mestre 15.000. `levelOf(total)` com % para o próximo. Sequência: dias seguidos (com plantão) sem SLA estourado; dia sem plantão não quebra. |
| A5 | **Coletor estendido** | Depois de gravar pontos, avalia missões, conquistas e nível só dos corretores tocados no lote; grava progresso (upsert), bônus e celebrações em lote (uma inserção por lote). Idempotente. |
| A6 | **Consultas do placar** `leaderboard.ts` | Semana SP. `brokerWeek(tenant, broker)`, `unitLeaderboard(tenant, branch)` (top 3 sem opt-out + posição própria + gap), `teamLeaderboard(tenant, branch?)` (equipes por pontos/corretor ativo, com nome e foto da `supervisor_teams`), `teamInternal(tenant, supervisor)` (corretores da equipe), variação vs semana anterior. Cache curto (`unstable_cache` 60 s por tenant). |

### Onda B: corretor (Lite) · Maestro (UI) + Cinzel (ligações)

| # | Implementação | Detalhe |
|---|---|---|
| B1 | **Tela Minha jornada** `/jornada` | Topo: anel de nível animado + nome do nível + pontos da semana com `AnimatedCounter` + chama de sequência. Missões de hoje (cards com barra spring e "faltam 2"). Placar da unidade (pódio top 3 + "você está em 7º, faltam 40 pts"). Conquistas (grade 4x2, cinza com dica, brilho quando ganha). Extrato (de onde veio cada ponto, agrupado por dia). |
| B2 | **Conversa "Jornada"** no chat do corretor | Assistente novo com resumo: nível, missões em andamento, posição. Escolhas: "Ver minha jornada", "Ver extrato". |
| B3 | **Toast de pontos na hora** | `+15 · Primeiro contato em 2 min` com contador subindo e partícula; usa a fila de prioridade (nunca na frente de oferta). Busca celebrações não vistas a cada 30 s e no foco da janela. |
| B4 | **Celebração grande** | Missão concluída, nível novo, conquista: card central com selo animado + confete (o mesmo do tour), botão "Continuar", marca `seen_at`. Uma por vez, em fila. |
| B5 | **Resumo do fim do dia** na conversa Jornada | "Hoje: 6 leads, 5 contatos no prazo, +85 pts, subiu para 4º". Gerado pelo coletor depois das 19h SP, uma vez por dia. |
| B6 | **Opt-out do placar** em Configurações | Switch "Aparecer no placar da unidade" + texto de finalidade (LGPD). Grava `ranking_opt_out`. |
| B7 | **Missão de etapa integrada** | A missão de etapa que já existe passa a usar o motor (progresso real, barra animada, bônus). |
| B8 | **Microinterações** | `AnimatedCounter` em todos os números de pontos, barra de progresso com spring, `navigator.vibrate(12)` opcional ao concluir (só se suportado e sem reduced motion). |

### Onda C: supervisor · Cinzel (dados) + Maestro (UI)

| # | Implementação | Detalhe |
|---|---|---|
| C1 | **Placar entre equipes** | Na conversa "Desempenho da equipe" e em `/equipe/minha`: "Sua equipe está em 2º de 5 na unidade", pódio das equipes com foto e nome da equipe, variação vs semana passada. |
| C2 | **Placar interno animado** | Desempenho da equipe vira tela `/equipe/desempenho`: pódio top 3, lista com barras que crescem, setas de subida/descida, filtro semana/mês. |
| C3 | **Missão da equipe (coletiva)** | Ex.: "Equipe sem SLA estourado hoje", "Equipe com 30 contatos no prazo na semana". Barra coletiva; o corretor vê a própria contribuição na Jornada; bônus para todos ao concluir. |
| C4 | **Reconhecimento com pontos** | No perfil do membro e em Recados: "Reconhecer com +N pts" (N de 5 a 50, motivo obrigatório, limite de 100 pts por semana por supervisor, auditoria). Vira evento `recognition.bonus` e celebração para o corretor. |
| C5 | **Alerta "quase lá"** | Supervisor recebe na conversa Equipe: "Ana está a 1 contato de completar a missão do dia". No máximo 1 por corretor por dia. |

### Onda D: diretor (modo normal) · Cinzel

| # | Implementação | Detalhe |
|---|---|---|
| D1 | **Painel de engajamento** em `/relacionamento` (aba Jornada da equipe) | Placar por unidade e por equipe, pontos por regra (pizza/barras), adesão (corretores que pontuaram), top missões concluídas. |
| D2 | **Campanhas** | Diretor cria: título, métrica do catálogo, meta, bônus, período, público (unidade, equipe, plantão, pessoas). Vira missão `campaign` para o público; aparece na Jornada com faixa da campanha; progresso ao vivo. Gestor e supervisor criam só no próprio escopo. |
| D3 | **Aba Regras** | Liga/desliga regra, ajusta pontos e limite diário (`engagement_settings`), restaurar padrão. Mudança não recalcula pontos antigos. |
| D4 | **Temporada (sem prêmio material)** | Usa `performance_seasons`: nome da temporada, datas, destaques por reconhecimento. Prêmio em dinheiro/bem continua fora até o parecer. |
| D5 | **Relatório anti-exploração** | Pontos por regra por corretor, outliers (z-score), notas repetidas, contatos fora do padrão; botão "estornar evento" com motivo (auditado). |

**Total: 6 + 8 + 5 + 5 = 24 implementações.**

## 2. Execução e agentes

- **Lince (batedor e QA):** antes da Onda A, mapa das fontes de dados das missões (mensagens enviadas com evidência, ofertas, tarefas, notas, plantão do dia) e dos pontos de encaixe na UI (chat threads, DynamicNotice, week-ranking, step mission). Depois de cada onda: QA (rotas, estados vazio/erro, 390px, reduced motion, classes CSS existentes, gavetas com `arc-venancor`).
- **Cinzel (executor):** Onda A, ligações de dados da B, dados da C, Onda D.
- **Maestro (Claude):** contratos (tipos) antes da Onda A, UI da Onda B e C, integração, commits.
- **Vigia (revisor):** revisão de cada onda antes do commit (foco: anti-exploração, LGPD/opt-out, escopo por tenant/unidade/equipe, idempotência, performance).

Ordem: A → (B e C em paralelo, arquivos separados) → D → QA final. Commit por onda aprovada. Nada de deploy nem migração aplicada sem o Vinicios.

## 3. Como subir (quando o Vinicios voltar)

1. `node scripts/apply-0193-engagement-journey.mjs` (simula) e `--apply`.
2. Deploy.
3. Super admin: ligar `feature_broker_journey_enabled` para um piloto, depois `feature_team_ranking_enabled`, depois `feature_engagement_campaigns_enabled`.
4. Parecer jurídico antes de prêmio material (continua fora).

## 4. Portão de qualidade da interface (pedido do Vinicios: "interface incrível, sem falhas, cuidado detalhista")

Nenhuma tela desta frente é dada como pronta sem passar por tudo abaixo:

1. **Vitrine de desenvolvimento** `/dev-preview/<tela>` (só existe com `NODE_ENV !== "production"`, responde 404 em produção, fora do login): cada tela e estado com dados de exemplo (vazio, carregando, cheio, texto longo, erro, opt-out, nível máximo, missão concluída).
2. **Print com Playwright** em 390x844 e 1280x800 de cada estado, conferido a olho pelo Maestro antes da revisão. Sem sobreposição, sem texto cortado, sem rolagem horizontal, sem elemento sem fundo, alinhamentos e espaçamentos consistentes (múltiplos de 4).
3. **Interação:** toda ação tem estado pendente, sucesso e erro no próprio controle; foco visível só no teclado; alvos de toque com 44px; animações com `transform`/`opacity`, duração dos `motionTokens`, `prefers-reduced-motion` respeitado; nada pisca no primeiro render (sem `Date.now()`/`window` no render inicial).
4. **Estrutura:** todo `styles.x` existe no `.module.css` (script de comparação); toda gaveta Arc com `className="arc-venancor"`; nenhum travessão, eyebrow ou caixa alta; textos curtos em pt-BR.
5. **Testes:** unitários dos motores (missões, conquistas, níveis, placar) com casos de borda (virada de semana em SP, opt-out, empate, equipe sem corretor ativo); testes de componente dos estados.

## 5. Onda E: assistência ao corretor e acessibilidade (pedido do Vinicios, 2026-10-10)

> "Tudo para que o corretor não se sinta perdido e saiba onde está tudo, acessibilidade ao máximo."

### Assistência (achar tudo, saber o que fazer)

| # | Implementação | Detalhe |
|---|---|---|
| E1 | **"Onde fica?" (busca de tudo)** | Botão de busca do Lite vira uma busca única: telas, ações ("registrar contato", "pausar plantão", "trocar foto") e leads, com sinônimos do jeito que o corretor fala ("sumir da fila" → pausar plantão). Resultado leva direto para o lugar. Teclado: `/` ou Ctrl+K no computador. |
| E2 | **Ajuda da tela ("?")** | Cada tela do Lite tem um "?" no topo: gaveta com "o que é esta tela" em 3 passos curtos + "Me mostra" (micro-tour daquela tela). Conteúdo num catálogo único (`help-catalog.ts`) por rota. |
| E3 | **Micro-tours por tela** | Primeira visita a cada tela (Jornada, Fila, Lead, Plantão, Configurações): 2 a 4 passos apontando os controles, reaproveitando o `LiteTour`. Pode pular e rever pelo "?". |
| E4 | **Âncora responde "onde fica"** | Na conversa da Âncora, perguntas como "onde vejo meus pontos?" ou "como pauso o plantão?" respondem com o caminho e um botão que leva lá (intenções mapeadas, sem IA paga). |
| E5 | **Próxima ação no Início** | Um cartão fixo "A próxima coisa é: ..." (ex.: "Responder Carla, esperando há 6 min"), escolhido por prioridade: oferta > SLA > retorno vencido > missão perto de concluir. |
| E6 | **Vazios que ensinam** | Todo estado vazio diz por que está vazio e o que fazer, com 1 botão. Revisão de todas as telas do Lite. |
| E7 | **Glossário na hora** | Termos (prazo de 1º contato, plantão, oferta, etapa, missão) com toque para explicar numa gaveta curta. |
| E8 | **Primeiros passos** | Para corretor novo: lista de 5 passos com progresso (foto, WhatsApp conectado, disponibilidade, tour, primeiro atendimento), some quando completa. |
| E9 | **Erros que orientam** | Toda mensagem de erro diz o que aconteceu e o que fazer agora, com botão de tentar de novo; nada de texto técnico. |

### Acessibilidade (WCAG 2.2 AA no mínimo)

| # | Implementação | Detalhe |
|---|---|---|
| E10 | **Auditoria automática** | Playwright + axe-core em todas as rotas do Lite e nas vitrines `/dev/*` (celular e computador). Zero violação séria ou crítica para dar a onda como pronta. |
| E11 | **Preferências de acessibilidade** em Configurações | Texto maior (100/115/130%), reduzir animações (independente do sistema), alto contraste, vibração liga/desliga. Guardadas no perfil e aplicadas por atributos no `<html>` do Lite. |
| E12 | **Leitor de tela** | Oferta de lead nova anunciada em `aria-live="assertive"`; celebrações em `polite`; todo ícone com nome; ordem de foco lógica; gavetas prendem e devolvem o foco; títulos de página únicos. |
| E13 | **Teclado e toque** | Tudo acessível por teclado (Tab, Enter, Esc), atalhos documentados no "?"; alvos de toque com 44px; nada depende só de cor (ícone ou texto junto); contraste de texto 4.5:1. |
| E14 | **Zoom e texto longo** | Layout aguenta zoom de 200% e nomes longos sem cortar ação nem gerar rolagem horizontal. |

**Total geral do plano: 24 + 14 = 38 implementações.** A Onda E entra depois da B e em paralelo com a C/D (arquivos separados).
