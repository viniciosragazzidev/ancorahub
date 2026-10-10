# Central de relacionamento com o corretor (mensagens + jornada gamificada)

> Pedido do Vinicios em 2026-10-10. Status: plano aprovado pelo Vigia (T30) com as correções da §8, nada implementado.
> Uma rota só, `/relacionamento`, que mostra a **Central** para diretor, gestor e supervisor e a **Minha jornada** para o corretor (Lite e normal).

## 1. O problema

- **Direção:** hoje não existe um jeito de falar direto com os corretores pelo sistema. O que existe são avisos automáticos (oferta, SLA, plantão) e a mensagem individual por WhatsApp (`sendBrokerDirectMessageAction`). Ninguém consegue avisar uma unidade inteira, parabenizar quem vendeu ou saber quem leu.
- **Corretor:** o app mostra o trabalho, mas não devolve nada quando ele faz bem feito. Atender rápido, fazer o retorno no dia e confirmar o plantão não geram reconhecimento.
- **Objetivo:** o corretor quer abrir o app no plantão porque vê o progresso dele, e a direção tem um canal oficial, medido, com os corretores.

## 2. Princípios

1. **Pontos só por fato do sistema, nunca por autodeclaração.** Os pontos saem de timestamps que o servidor grava: `assignedAt`, `firstContactAt`, `acceptedAt`, venda e tarefa concluída. Assim não dá para "farmar".
2. **Recompensar o que gera venda e cuidado com o cliente,** não volume vazio. No contexto de plano de saúde, isso é responder rápido, voltar no prazo, registrar o atendimento, estar no plantão e fechar.
3. **Sem punição e sem vergonha pública.** Não existem pontos negativos. Estourar o prazo só deixa de pontuar e quebra a sequência. O placar mostra o top 3 e a posição do próprio corretor, nunca a lista inteira com os últimos.
4. **Pouca coisa, bem feita:** 1 número (pontos da semana), 1 nível, até 3 missões do dia, 8 conquistas e 1 mural de mensagens.
5. **Configuração central.** As regras de pontos, missões e conquistas ficam num catálogo em código (`src/features/engagement/catalog.ts`), com ajuste por empresa numa tabela. É o mesmo padrão do `ai-gateway/agents.ts`.
6. **Reusar o que existe:**
   - `notifications` + `publishNotification` (push + realtime);
   - o `DynamicNotice` (card na tela);
   - a thread Âncora (o aviso aparece lá sozinho);
   - `enqueueMetaTextMessage` (WhatsApp interno respeitando as regras de avisos da equipe, DEC-125);
   - `performance_seasons` / `performance_awards` (prêmios);
   - o confete do tour.

## 3. Lado do corretor: "Minha jornada"

Ordem da tela, de cima para baixo (Lite: rota no menu "Mais" e uma thread nova "Jornada" na lista do chat; no desktop abre no centro do split):

1. **Topo:** nível + pontos da semana + sequência (dias de plantão com todo primeiro contato no prazo). Exemplo: "Especialista · 340 pts esta semana · 🔥 4 dias".
2. **Missões de hoje:** até 3 cards com barra de progresso. Exemplo: "Primeiro contato em até 5 min em todos os leads do plantão (2/3)".
3. **Campanha da semana:** quando a direção cria uma. Exemplo: "Semana PME: 3 cotações PME, +100 pts".
4. **Mural:** mensagens da direção, com botão "Ciente" quando o envio pede confirmação.
5. **Placar da unidade:** top 3 + "você está em 7º, faltam 40 pts para o 6º".
6. **Conquistas:** grade de 8 selos, os não conquistados em cinza com a dica de como ganhar.

**Na hora do fato (o que dá vontade de usar):**
- Primeiro contato rápido mostra o `DynamicNotice`: "+15 · Primeiro contato em 2 min ⚡".
- Missão concluída, nível novo ou conquista: card maior + confete (o mesmo do tour), uma vez só.
- Um resumo no fim do plantão vira mensagem na thread Jornada: "Plantão de hoje: 6 leads, 5 contatos no prazo, +85 pts, você subiu para 4º na unidade".

### 3.1 Regras de pontos (versão 1, ajustáveis por empresa)

| Fato (fonte) | Pontos | Trava |
|---|---|---|
| Aceitou a oferta em até 1 min (`lead_offers.acceptedAt - offeredAt`) | +3 | por lead |
| Primeiro contato em até 5 min, **com evidência** (1ª mensagem enviada em `whatsapp_messages` ou ligação registrada; o toque "Registrar contato" sozinho não pontua) | +15 | por lead |
| Primeiro contato com evidência em até 15 min | +10 | por lead |
| Primeiro contato com evidência dentro do SLA | +5 | por lead |
| Retorno feito até o horário, só tarefa criada pelo sistema ou com `dueAt` 2h ou mais depois da criação | +5 | 10 por dia |
| Registrou como foi o atendimento (nota com tamanho mínimo e não repetida) | +3 | 10 por dia |
| Presença confirmada no plantão (`duty_presence_confirmations`) | +10 | por plantão |
| Venda **aprovada pela gestão** (não o registro do próprio corretor) | +50 (PME +80) | estorna se cancelar em 30 dias |
| Missão concluída | bônus da missão | uma vez por período |

- O lead transferido antes do primeiro contato não pontua para ninguém.
- A transferência depois disso mantém os pontos de quem fez.

### 3.2 Níveis (acumulado, não zera)

Iniciante (0) → Consultor (500) → Especialista (2.000) → Referência (6.000) → Mestre da corretagem (15.000).

O placar é **semanal** (zera na segunda); o nível é a carreira. Assim quem entrou agora pode ganhar a semana.

### 3.3 Missões

- **Do dia (automáticas, escolhidas pelo plantão do corretor):**
  - "Todo primeiro contato em até 5 min";
  - "Zerar os retornos vencidos";
  - "Registrar como foi cada atendimento";
  - "Confirmar presença no plantão".
- **Da semana:** "5 dias seguidos com contato no prazo"; "2 vendas".
- **Campanha:** a direção cria com título, regra (do catálogo), meta, bônus, período e público (unidade, plantão, pessoas).

### 3.4 Conquistas (8)

| Selo | Como ganha |
|---|---|
| Raio | 10 primeiros contatos em até 5 min |
| Plantão firme | 5 presenças confirmadas seguidas |
| Primeira venda | 1ª venda no sistema |
| Família protegida | 1ª venda de plano familiar |
| Empresa cuidada | 1ª venda PME |
| Retorno em dia | 20 retornos no prazo |
| Ninguém esperando | uma semana inteira sem SLA estourado |
| Virada | venda de um lead que estava frio |

## 4. Lado da direção: "Central de relacionamento"

Três abas, na mesma rota:

### 4.1 Mensagens (a principal)

**Compositor em 4 passos numa tela só:**
1. **Para quem:**
   - pessoas (busca com várias);
   - unidade;
   - plantão de hoje ou tipo de plantão (`duty_schedule_types`);
   - equipe do supervisor (`supervisorId`);
   - todos.
   - Mostra "vai para 23 corretores" com a lista para conferir.
   - Gestor e supervisor só enxergam a própria unidade ou equipe (mesma regra do planejador de plantões).
2. **Tipo:**
   - Aviso;
   - Reconhecimento (parabéns, com opção de dar pontos bônus com motivo);
   - Pedido de confirmação (com botão "Ciente").
3. **Canal:**
   - **Só no sistema:** notificação + push + mural + thread Âncora.
   - **Sistema + WhatsApp:** usa o número da empresa ou a Meta, como o `BROKER_CHAT` de hoje, respeitando o espaçamento e os limites dos avisos da equipe.
4. **Quando:** agora ou agendado.

**Histórico:** cada envio com o total de entregues, lidos e cientes. Clicar mostra quem ainda não viu, com o botão "Reenviar só para quem não leu".

**Mensagens prontas:** usa a biblioteca de mensagens (`message_templates`) com variáveis `{primeiro_nome}` e `{unidade}`.

### 4.2 Jornada da equipe

- Placar da semana por unidade e da empresa, com os pontos abertos por regra (de onde veio cada ponto).
- Campanhas: criar, pausar, ver o progresso.
- Prêmios: o diretor cadastra o prêmio da temporada (reconhecimento, folga, bônus, brinde) usando `performance_seasons` / `performance_awards`, que já existem e não estão montados em nenhuma rota.

### 4.3 Regras

- Liga/desliga cada regra e ajusta pontos, missões do dia e conquistas da empresa.
- Valores padrão do catálogo, com "restaurar padrão".

## 5. Arquitetura

**Feature nova:** `src/features/engagement/`
- `catalog.ts`: regras de pontos, missões, conquistas e níveis (código = padrão).
- `scoring.ts`: funções puras: fato → eventos de pontos, missões e conquistas (testáveis sem banco).
- `collector.ts`: lê os fatos novos desde a última marca d'água (leads com `firstContactAt`, ofertas aceitas, tarefas concluídas, presenças, vendas e cancelamentos) e grava no extrato de forma idempotente.
- `celebrate.ts`: depois de gravar, chama `publishNotification` (tipo `engagement.*`) e o realtime, que vira o `DynamicNotice` / confete no app.
- `queries.ts`: o que a tela "Minha jornada" e o placar leem (somas do extrato).

**Feature nova:** `src/features/relationship/`
- `audience.ts`: resolve o público (pessoas, unidade, plantão, equipe, todos) para uma lista de `broker_id`, respeitando o escopo de quem envia.
- `send.ts`: cria o envio, um `notifications` por pessoa, e enfileira o WhatsApp quando o canal pede.
- `actions.ts`: server actions (enviar, agendar, reenviar, marcar ciente).

**Quando calcular:**
- Cron novo `/api/internal/jobs/engagement` a cada 2 min (Coolify), para não mexer no caminho quente da distribuição.
- Para a sensação de "na hora", o `lead.registerContact` do chat chama o coletor só daquele lead, sem esperar (fire-and-forget).
- O mesmo cron dispara os envios agendados.

**Tabelas (migração 0188, SQL novo aplicado à mão, nunca `db:migrate` do Windows):**

| Tabela | Para quê |
|---|---|
| `engagement_point_events` | Extrato: corretor, regra, pontos, lead, `idempotency_key` única, `reversed_at`. A fonte da verdade, e tudo é soma dele |
| `engagement_settings` | Ajuste por empresa (JSON validado com zod sobre o catálogo) |
| `engagement_missions` | Campanhas e missões criadas pela direção (regra, meta, bônus, período, público) |
| `engagement_mission_progress` | Progresso por corretor e período (`period_key` = dia ou semana) |
| `engagement_badges` | Conquistas ganhas (corretor, selo, data) |
| `engagement_watermarks` | Marca d'água do coletor por empresa |
| `relationship_broadcasts` | Envio: remetente, tipo, texto, público (JSON), canal, pede ciente, agendado para, enviado em |
| `relationship_broadcast_recipients` | Por corretor: notificação, WhatsApp enfileirado, lido em, ciente em |

**Flags (desligadas por padrão):** `feature_broker_engagement_enabled` (jornada e pontos) e `feature_relationship_center_enabled` (central de mensagens). Dá para ligar só as mensagens primeiro.

**Auditoria:** todo envio, bônus manual e mudança de regra gravam em `audit_logs`.

## 6. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| R0 | Migração 0188, catálogo, `scoring.ts` com testes, coletor + cron (flags off) | O extrato enche certo em produção sem ninguém ver nada |
| R1 | Central: aba Mensagens, só no sistema (público, envio, mural, thread Âncora, lidos) | O diretor manda para uma unidade e vê quem leu |
| R2 | Minha jornada (topo, missões do dia, placar top 3, conquistas) + celebrações na tela | O corretor atende rápido e o card "+15" aparece |
| R3 | Canal WhatsApp, agendamento, "Ciente" e reenviar para quem não leu | Aviso com confirmação chega no WhatsApp e volta o ciente |
| R4 | Campanhas, prêmios da temporada, aba Regras | O diretor cria a "Semana PME" sem precisar de código |
| R5 | Ajuste fino com dados reais: relatório de "pontos por regra", corte de regra que estiver sendo explorada | 2 semanas de piloto numa unidade |

Sugestão: R0 + R1 primeiro (mensagens resolvem uma dor já hoje), depois R2. Piloto da jornada em 1 unidade.

## 7. Decisões em aberto

1. **Prêmio de verdade: fora até o parecer jurídico** (§8.2). Começa só com reconhecimento + placar.
2. Placar com top 3 + a própria posição (recomendado) ou ranking completo.
3. Valores dos pontos da §3.1: padrão sugerido, ajustável depois na aba Regras.

## 8. Revisão do Vigia (T30, 2026-10-10): regras obrigatórias

1. **Anti-exploração (Goodhart).** O `firstContactAt` hoje é autodeclarado (toque em "Registrar contato"), então ponto de contato só com evidência (mensagem enviada ou ligação registrada); a métrica de SLA não pode virar alvo de toque. Retorno só de tarefa do sistema ou com `dueAt` >= 2h após a criação. Nota com tamanho mínimo e sem repetir. Venda só aprovada pela gestão.
2. **Trabalhista e LGPD.** Corretor costuma ser autônomo: meta, ranking, pontos por presença e prêmio podem reforçar prova de vínculo (prêmio tem regra própria, CLT art. 457 §4). **Parecer jurídico antes de R2 e R4**; prêmio fora até lá. LGPD: tela explica a finalidade, o extrato fica visível ao corretor e ele pode tirar o nome do placar (opt-out do top 3).
3. **Escopo do público.** Plantões são globais (DEC-110): para gestor e supervisor, "plantão de hoje" e "tipo de plantão" cruzam com a unidade/equipe dele; "todos" só para diretor. O público é resolvido **no servidor no momento do envio** (também no agendado, revalidando papel e escopo do remetente), nunca a lista vinda do navegador.
4. **Idempotência.** Chave única (tenant, regra, entidade, corretor); marca d'água com sobreposição de 5 min (o unique absorve repetição); estorno com chave própria; unique em conquistas (corretor, selo) e progresso (missão, corretor, `period_key`); `period_key` em America/Sao_Paulo; ponto gravado não é recalculado quando a regra muda.
5. **Performance.** Índices para o coletor (leads tenant + first_contact_at, lead_offers tenant + accepted_at, tarefas completed_at, vendas updated_at) e para o placar (eventos tenant + corretor + created_at), ou total semanal materializado. Celebrações em lote, sem um publish por evento.
6. **Avisos (DEC-125).** Pontos e celebrações nunca vão para o WhatsApp. Envio pela Meta fora da janela de 24h exige template aprovado. Respeitar horário silencioso e limite por pessoa; "reenviar para quem não leu" conta no limite. O card "+15" **nunca** passa na frente de uma oferta de lead (fila com prioridade: oferta > celebração).
7. **Processo.** O cron novo entra em `docs/runbooks/coolify-scheduled-tasks.md`. Migração 0188 confirmada livre em 2026-10-10.

## 9. Como subir R0+R1 (ordem obrigatória)

1. **Antes do deploy**, na máquina do Vinicios: `node scripts/apply-0188-engagement-relationship.mjs` (simula) e depois `--apply`. Ele cria os 5 índices nas tabelas existentes com CONCURRENTLY e depois as tabelas novas. Se o migrate do deploy rodar antes, os índices são criados sem CONCURRENTLY e travam escrita em `lead_offers`, `lead_tasks`, `lead_interactions` e `duty_presence_confirmations` durante o build (Vigia T31).
2. Deploy.
3. Coolify: tarefa `*/2 * * * *` em `/api/internal/jobs/engagement` (runbook).
4. Ligar `feature_relationship_center_enabled` (Central) quando quiser. `feature_broker_engagement_enabled` só grava pontos no extrato, ninguém vê ainda.

Estatísticas e ranking (pedido de 2026-10-10, revisado no T32): posição só do próprio corretor, janela de 7 dias, tudo atrás de `feature_broker_engagement_enabled`. Ideias do Vigia para depois: rankear dentro da unidade (volumes diferentes entre unidades) e contar só ofertas dentro do horário de plantão na mediana de aceite.

Pendências não bloqueantes do T31: envio de até 1.000 avisos dentro da ação pode demorar (mover para fila na R3); limite de envios por remetente (anti-spam).
