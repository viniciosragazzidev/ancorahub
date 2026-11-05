# Etapas bem definidas e funil profissional (plano, 05/11/2026)

**Pedido do Vinicios (05/11):**
1. Chats em "fechamento" que já morreram (sem atividade, cliente sumiu) ficam misturados com os fechamentos de
   verdade. Eles devem ir para **perdido** ou para **aguardando retorno**, e as etapas precisam ficar bem definidas.
2. Funil de nível de CRM profissional: cada etapa de cada cliente monitorada e registrada; onde o cliente sai,
   onde para na qualificação, onde é perdido, quantos passam pela qualificação, padrões por origem. Tudo para
   melhorar a qualidade do lead junto com marketing e geração de leads. Por baixo, completo; na tela, leve
   para quem opera; o máximo automático, com informação clara.

Status: **plano, aguardando aprovação.** Nenhum código mudou.

---

## Diagnóstico (levantamento de 05/11)

### Por que os chats mortos ficam em fechamento
- "Fechamento" = `documentation_pending` + `under_analysis`.
- A IA de conversa (`conversation-intelligence/analyzer.ts` + `policy-executor.ts`, job a cada minuto) **só avança**
  etapa sozinha. Voltar e perder são sempre só sugestões, e o próprio prompt diz que "silêncio não basta para perder".
- O job só reanalisa chats com mensagem nos **últimos 3 dias**. Chat que morreu não recebe mensagem e **nunca mais é
  olhado**.
- **Nada tira um lead do fechamento** automaticamente. Não existe etapa "aguardando" nem marca de "parado"; o
  "Esfriando" do radar de Negociações é só visual (calculado na tela, não salvo).
- Se o corretor desfaz um avanço da IA, a IA pode avançar de novo (o desfazer não é respeitado na análise seguinte).

### O que já existe para o funil
- **Origem por lead:** canal, campanha, conjunto, anúncio, formulário e página da Meta, mais a hora da captura
  (`leads.source*`, `leads.meta*`). Não há UTM em coluna própria.
- **Qualificação da IA:** perguntas Q1–Q6 (nome, tipo de plano, vidas, idades, cidade, e-mail). Só existe o
  **estado atual** (`ai_conversations.memory`: campos coletados e última pergunta). **Não há histórico por pergunta.**
- **Funil pronto (parcial):** `qualification-turbo/funnel.ts` (Chegaram → 1ª mensagem → Entregue → Lida → Respondeu →
  Qualificado → Com corretor → Venda), em `/dashboard?tab=funnel`. Não separa por origem nem por pergunta.
- **Qualidade por origem:** `reports/metrics/lead-quality-service.ts` (quente/morno/frio, atribuídos, convertidos por
  campanha, anúncio, formulário…), com CSV.
- **Histórico de etapas:** não há tabela própria. Cada mudança vira uma linha de texto em `lead_interactions` e um
  `audit_logs`. O tempo em cada etapa só sai lendo texto. A mudança em lote talvez nem registre.
- **Perda:** motivo obrigatório na mudança individual (10 códigos em `MOTIVOS_PERDA`), opcional no lote.
- Nenhum job junta métricas de funil; a única tabela de resumo é por corretor (`broker_metric_daily`).

---

## Parte A — Etapas bem definidas (higiene automática)

### A1. Etapa nova: "Aguardando retorno"
- Entre as etapas ativas e "Perdido". Quer dizer: **o cliente parou de responder**; o lead ainda pode voltar.
- Sai da lista de fechamentos e negociações, então fechamento passa a ser só fechamento de verdade.
- Precisa de migração (novo valor no enum de etapa). Número da migração: o maior entre todas as branches da origem.

### A2. Regra diária de "chat parado" (automática)
Um job no Coolify (entra no runbook `coolify-scheduled-tasks.md`) olha, uma vez por dia, os leads em Cotação enviada,
Negociação e Fechamento:

| Situação | O que acontece |
|---|---|
| **5 dias úteis** sem mensagem do cliente (mesmo com o corretor tentando) | vai para **Aguardando retorno**, com motivo "Cliente sem resposta há 5 dias úteis"; o corretor recebe um aviso no app |
| **Cliente responde** enquanto está em Aguardando retorno | **volta sozinho** para a etapa em que estava |
| **+10 dias úteis** em Aguardando retorno sem resposta | vai para **Perdido**, motivo `sem_contato`; 2 dias antes o corretor é avisado ("amanhã este lead será perdido") |

- **O corretor manda:** um toque em "Manter na etapa" segura o lead por mais 7 dias. Se o corretor mexeu na etapa
  nos últimos 3 dias, a regra não mexe.
- **Venda em potencial** (a IA marcou alta intenção): nunca vai para Perdido sozinho; fica em Aguardando retorno e o
  gestor é avisado.
- Toda mudança automática fica registrada com "quem mudou: regra de chat parado" e o motivo (ver B1).

### A3. Ajustes na IA de conversa
- Respeitar o desfazer: depois que o corretor desfaz um avanço, a IA só sugere, não move, naquele lead por 7 dias.
- O silêncio continua fora da IA: quem trata silêncio é a regra A2 (determinística, previsível e explicável).

### A4. Limpeza inicial com simulação
- Antes de ligar, a regra roda em **modo simulação** e mostra ao diretor a lista "estes 37 leads iriam para
  Aguardando retorno, estes 12 para Perdido". Com o ok, liga de verdade e limpa o que está acumulado hoje.

---

## Parte B — Funil profissional

### B1. Histórico de etapas de verdade (`lead_stage_history`)
Uma linha por mudança de etapa: lead, etapa de origem, etapa de destino, quando, **quem mudou** (corretor, gestor,
IA, regra, sistema) e o id, motivo, código de perda, **tempo na etapa anterior** e a origem do lead (campanha,
anúncio, formulário) copiada no momento.
- Escrita pelo ponto único `changeLeadStatus` (e o lote passa a usar o mesmo caminho).
- **Retroativo:** preenchida com o passado a partir de `lead_interactions` e `audit_logs`, para o funil já nascer
  com histórico.

### B2. Eventos do funil (`lead_funnel_events`)
Um registro por marco, com hora e origem do lead:
chegou → 1ª mensagem enviada → entregue → lida → respondeu → **cada pergunta da qualificação feita e respondida**
(com a chave da pergunta) → qualificado / desqualificado (motivo) → enviado ao corretor → 1º contato do corretor →
cada etapa → perdido (motivo) / vendido.
- Emitidos onde as coisas já acontecem hoje (entrada do lead, máquina de estados da IA, sweep de timeout,
  distribuição, `changeLeadStatus`). **Nada muda para quem opera.**
- Resolve o maior buraco: saber **em qual pergunta** o cliente parou.

### B3. Resumo diário automático (`funnel_daily`)
Job noturno no Coolify que junta, por dia × origem (canal, campanha, anúncio, formulário) × fila/unidade:
quantos passaram por cada etapa, conversão entre etapas e tempo mediano em cada uma. As telas leem o resumo
(rápido e barato).

### B4. Telas (poucas e claras)
- **Quem opera (corretor):** nada novo além da etapa "Aguardando retorno" e do botão "Manter na etapa".
- **Diretor e marketing:** evoluir a aba Funil que já existe em `/dashboard?tab=funnel`, sem criar tela nova:
  1. **Funil em uma linha**, com a % de passagem entre etapas e a **maior perda destacada** em uma frase
     ("Maior perda: 38% param na pergunta das idades").
  2. **Onde param na qualificação:** uma barra por pergunta.
  3. **Onde perdemos:** motivos de perda por etapa.
  4. **Qualidade por campanha:** tabela (padrão `DataTable`) com leads, % qualificados, % vendas e custo por venda
     quando há custo da Meta. Clique na linha abre um drawer com o funil daquela campanha.
  - Filtros mínimos: período e origem. **Exportar CSV** para o marketing.
- **Resumo automático semanal** (regras, sem IA): segunda-feira, uma notificação para diretor e marketing com 3
  frases ("Campanha X: 60% param na pergunta das idades"; "Anúncio Y trouxe 3× mais vendas por lead").

### B5. O que não entra agora
UTM em coluna própria, testes A/B novos, e mudanças no roteiro da IA. O funil vai mostrar onde mexer primeiro.

---

## Ordem de entrega
1. **A1 + A2 + A4** (etapa nova, regra de chat parado em simulação e depois limpeza): resolve a bagunça de hoje.
2. **B1** (histórico de etapas, com retroativo) e **A3** (IA respeita o desfazer).
3. **B2** (eventos, incluindo as perguntas da qualificação).
4. **B3 + B4** (resumo diário, aba Funil e resumo semanal).

## Decisões em aberto
1. Nome da etapa nova: **"Aguardando retorno"** (recomendado) ou "Sem resposta".
2. Prazos: **5 dias úteis** sem resposta → Aguardando retorno; **+10 dias úteis** → Perdido (recomendado), ou outros.
3. Ir para Perdido sozinho depois do prazo (recomendado, com aviso 2 dias antes) ou só sugerir ao corretor.
4. Quem recebe o resumo semanal: diretor e um perfil de marketing (qual pessoa ou cargo?).

## Critério de pronto
- Fechamento só tem fechamento de verdade; chat parado sai sozinho e volta sozinho se o cliente responder.
- Cada mudança de etapa e cada marco do funil ficam registrados com quem, quando, por quê e de onde veio o lead.
- Diretor e marketing veem, numa aba, onde os clientes param e quais campanhas trazem leads melhores.
