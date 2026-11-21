# Recuperação de leads: plano

Data: 21/11/2026. Status: **só plano, sem código**. Branch: `docs/recuperacao-de-leads`.

Fontes e números de mercado: `docs/research/2026-11-21-dossie-recuperacao-leads.md`, chamado abaixo de "dossiê". As referências [D§n] apontam para a seção n do dossiê.

## 1. Objetivo e como medir

**Meta do usuário:** pelo menos **dobrar** o número de leads recuperados e de leads quentes, e com isso aumentar o faturamento da Âncora.

**Definições** (calculadas pela mesma consulta antes e depois):
- **Recuperado:** lead que passou por "sem resposta" ou "frio" e, em até 14 dias, ficou quente ou morno ou chegou a um corretor que conversou com ele.
- **Quente:** `qualification_status` em `hot` ou `qualified`.
- **Base de comparação:** só leads de anúncio Meta (`source_channel = meta_lead_ads`). Importação de planilha fica fora.

**Métrica principal:** recuperados por semana. Linha de base: cerca de **120 por semana**. Meta: **240 ou mais por semana**, sustentada por 4 semanas seguidas.

**Métricas secundárias:**
- quentes por semana (linha de base: cerca de 530);
- tempo de quente até o primeiro contato do corretor;
- quente → cotação → venda.

**Proteções**, que param a cadência se piorarem:
- opt-out por mensagem enviada (hoje 1,5% das conversas);
- taxa de erro 131049;
- qualidade do número na Meta;
- custo da Meta por recuperado.

**Prova de causa:** um grupo de controle (holdout) de **10% dos frios**, sorteado e fixo por lead, recebe só o que existe hoje. Sem isso, não dá para separar o efeito do plano da sazonalidade das campanhas [D§9].

## 2. Linha de base (banco de produção, 21/11, só contagens, transação somente leitura)

Base: leads de anúncio Meta de 19/10 a 21/11. A importação de 16/11 (8.813 leads `supervisor_import`) ficou fora.

| Semana (seg) | Leads | Responderam | Quentes | Mornos | Frios | Sem WhatsApp | Com corretor | Cotação ou mais | Segurados |
|---|---|---|---|---|---|---|---|---|---|
| 19/10 | 1.209 | 897 | 449 | 135 | 364 | 201 | 670 | 2 | 526 |
| 26/10 | 1.465 | 1.149 | 612 | 172 | 512 | 134 | 786 | 9 | 620 |
| 02/11 | 1.107 | 856 | 483 | 100 | 455 | 48 | 591 | 6 | 461 |
| 09/11 | 1.307 | 1.029 | 554 | 145 | 550 | 43 | 736 | 48 | 528 |
| 16/11 (parcial) | 1.251 | 987 | 541 | 145 | 497 | 43 | 703 | 268 | 469 |
| **Total** | **6.339** | **4.918 (78%)** | **2.639 (42%)** | **697 (11%)** | **2.378 (38%)** | 469 (7%) | 3.486 (55%) | 333 | 2.604 (41%) |

"Cotação ou mais" quer dizer status `quote_sent` ou além. O salto em 16/11 vem de os corretores terem começado a marcar a etapa, então essa coluna ainda não serve de comparação.

**O que os números mostram:**

1. **Frios que voltaram:** 3.123 leads ficaram segurados por tempo limite, e 588 deles (19%) estão hoje quentes ou mornos. Isso dá a linha de base de cerca de 120 recuperados por semana.
2. **A cadência longa praticamente não existe.**
   - T1 (20 min, template de utilidade): 1.378 envios, 32% de resposta.
   - T2, T3 e T4: 937, 795 e 713 toques **pulados**, contra 154, 79 e 11 enviados. Os templates de marketing não estão aprovados na WABA.
   - **É o ganho mais barato do plano.**
3. **O follow-up de silêncio funciona.** Desde 10/11: 664 envios, 44% de resposta em 24h e 126 (19%) leads quentes. É o modelo a estender.
4. **A reativação de frios quase nunca envia.** Foram 72.126 cancelamentos "não elegível", contra 907 retomadas iniciadas pelo próprio cliente.
5. **A resposta vem cedo.** De quem respondeu, 87% respondeu em até 20 min, 8% entre 20 min e 3h e 5% depois disso. A cadência precisa ser densa no 1º dia e rara depois [D§1, D§2].
6. **Muito lead parado.** 41% dos leads de anúncio estão em `manual_hold`, segurados sem ação. É a "fila de quem não respondeu" de hoje, sem cadência nem dono.
7. **Opt-out baixo** (85 opt-outs e 27 números errados em 5.661 conversas). Há margem para insistir com cuidado.

## 3. Inventário: o que existe, o que falta mostrar, o que falta construir

Legenda: **A** = existe e aparece na tela · **B** = existe no back, falta mostrar · **C** = não existe, ou só tem cadastro sem execução.

| Área | Situação | Onde |
|---|---|---|
| Qualificação por IA (motor, memória, timeout) | A/B | `src/features/ai-agent/conversation-state-machine.ts`, `memory.ts`, `qualification-timeout-sweep.ts`, `qualification-timeout-policy.ts:117`; tela `/qualificacao` |
| "Ponto" da qualificação por lead (campo atual, pergunta pendente, memória) | **B** | `ai_conversations.memory` (`memory.ts:37`), `leads.qualification_details.missingFields`, `ai_qualification_sessions.currentQuestionKey` |
| Classificação quente, morno, frio | A | `src/features/qualification-engine/service.ts:293` |
| Mensagem do cliente sem resposta da IA | B | `src/features/ai-agent/unanswered-recovery.ts` |
| Follow-up de silêncio (1 toque, metade do prazo) | A (só o interruptor) | `src/features/ai-agent/silence-follow-up*.ts`; interruptor em `/qualificacao/turbo` |
| Turbo: 1ª mensagem, A/B, T1–T4 | A | `src/features/qualification-turbo/` (`cadence.ts:19`, `experiments.ts`, `funnel.ts`); job `qualification-cadence` |
| Funil do turbo | A | `/dashboard?tab=funnel` (`funnel.ts:219,314`) |
| Requalificação de frio (1 vez, +3h) | A | `src/features/ai-qualification/cold-lead-requalification*.ts`; `/leads/distribuicao`, aba "Leads frios" |
| Reativação de frio (sweep antigo) | **C** | `cold-lead-reactivation-sweep.ts` não é chamado por nenhum job |
| Regras de follow-up em `/qualificacao` | **C** (só cadastro) | `src/features/ai-qualification/followup-service.ts:53`; `stats-service.ts` devolve follow-up = 0 fixo |
| Segurar frios e liberação por idade | A | `lead-distribution/control-service.ts:33`, `cold-age-release*.ts` |
| Distribuição, filas, plantão, prioridade por temperatura | A | `src/features/lead-distribution/` |
| Etapas depois do corretor (`leads.status`), histórico de etapa | A | `src/features/leads/lead-status-constants.ts`, `stage-history.ts`, `stale-stage-sweep.ts` |
| Nível da negociação | A | `src/features/negotiations/negotiation-model.ts:8`; `/negociacoes` |
| Linha do tempo do lead | A, parcial (só `leadInteractions`) | `/leads/[id]`, aba history (`getLeadTimeline`) |
| Linha do tempo da **qualificação** (toques, memória, requalificações, auditoria) | **B** | `lead_funnel_events` (`src/features/leads/funnel-events.ts`) é gravado e nenhuma tela lê; os toques ficam em `qualification_details.turbo` |
| Venda Automatizada | A (piloto, flag desligada) | `src/features/auto-sale/`; `/vendas/automatizada`; follow-ups 45 min, 20 h, D+2, D+5 |
| Automações e fluxos WhatsApp | **C** (enfileira, ninguém processa) | `src/features/automations` (`runAutomationProcessor` sem job), `workflow-automation` sem tela |
| Call Âncora (base de frios por ligação) | A (atrás de flag) | `src/features/call-ancora/` (`cold-base.ts`: 3 tentativas, 4 h de pausa); `/call-ancora` |
| Sasá | A (piloto) | `src/features/sasa/` (16 ferramentas); falta ferramenta de recuperação (**C**) |
| Cadência WAHA | **C** | `src/features/waha-cadence/service.ts:29` tem `enabled: false` fixo |
| Envio Meta: janela de 24 h, templates, outbox, 131049 | A/B | `communication-channels/outbound-service.ts`, `message-policy-service.ts:339`, `meta-delivery-failure.ts:61` |
| Opt-out | B (gravado, sem lista na tela) | `ai_conversations.optOutAt` |
| Pontuação (score) | B (`qualificationScore` = % de campos, não aparece na tela) | `qualification-engine/service.ts:293` |
| Métrica "recuperados" | **C** | — |
| A/B além da 1ª mensagem | **C** | só `t0` em `experiments.ts` |
| `/dev/laboratorio` para qualificação e recuperação | **C** | o laboratório (`src/lib/dev-lab.tsx`) ainda não simula esses fluxos |

**Resumo do inventário:**
- O motor já existe.
- Os maiores buracos:
  - não há uma cadência única e longa: o T2–T4 é pulado e as regras de follow-up não executam;
  - não há visão do ponto em que cada lead está;
  - não há métrica de recuperado.
- A maior parte do trabalho é **juntar e mostrar**, não inventar.

## 4. Mapa de estados único

A "Etapa" é **derivada** dos campos que já existem: `qualification_status`, `qualification_state`, `ai_conversations.status`, `leads.status`, `corretor_id`, `optOutAt` e o estado da cadência. Não entra coluna nova de etapa.

Isso segue a ideia da Salesforce de separar o estado da máquina do rótulo da tela [D§4] e evita uma terceira fonte da verdade. Uma função pura (`deriveLeadJourney`) devolve `{ fase, etapa, passo, total, motivo, proximoPasso }`. A tela, o hover card, o funil e a Sasá leem a mesma função.

### 4.1 Antes do corretor: Qualificação

| # | Etapa (rótulo na tela) | Regra de entrada | Sai para |
|---|---|---|---|
| Q1 | **Chegou** | lead criado, 1ª mensagem ainda não saiu | Q2; "Sem WhatsApp" se não tem WhatsApp |
| Q2 | **Contatado** | 1ª mensagem enviada, sem resposta | Q3 se responde; R1 se o prazo estoura |
| Q3 | **Em conversa** + subpasso ("Tipo de plano", "Vidas", "Idades", "Cidade") | respondeu; o subpasso é o 1º campo de `missingFields` | Q4 se fica quente; R2 se para de responder |
| Q4 | **Quente** | `hot`/`qualified` | Q5 |
| Q5 | **Aguardando corretor** | quente, na fila ou oferecido | N1 quando um corretor aceita |

### 4.2 Recuperação: quem saiu do caminho

| # | Etapa | Regra de entrada | Sai para |
|---|---|---|---|
| R1 | **Nunca respondeu** | Q2 e nenhuma mensagem do cliente | volta a Q3 se responder; R4 ao fim da cadência |
| R2 | **Parou no meio** | respondeu ao menos 1 vez e ficou em silêncio | volta a Q3; R4 ao fim da cadência |
| R3 | **Morno** | deu dado válido, mas não chegou a quente | distribuído como hoje (morno vai para a fila) |
| R4 | **Sem resposta: fila de ligação** | cadência terminada sem resposta | Call Âncora; volta a Q3 se responder |
| R5 | **Momento ruim** | o cliente disse "agora não" ou "mais pra frente" | volta à nutrição na data combinada (padrão: 30 dias) |
| R6 | **Nutrição** | fim da fila de ligação sem contato | toques mensais com gatilho; volta a Q3 se responder |
| X1 | **Não contatar** | opt-out ou número errado | terminal; nunca mais recebe mensagem automática |
| X2 | **Descartado** | desqualificado (sem perfil) ou lead duplicado | terminal |

### 4.3 Depois do corretor: Negociação

As etapas usam o enum `lead_status`, que já existe. Só os rótulos ficam mais claros.

| # | Etapa | `leads.status` | Observação |
|---|---|---|---|
| N1 | **Primeiro contato** | `distributed`, `in_contact` | SLA: tempo até a 1ª mensagem ou ligação do corretor |
| N2 | **Cotação enviada** | `quote_sent` | |
| N3 | **Negociação** | `negotiation` | |
| N4 | **Documentos** | `documentation_pending` | |
| N5 | **Em análise na operadora** | `under_analysis` | |
| N6 | **Ganho** | `converted` | |
| N7 | **Perdido** | `lost` (com motivo) | vira R6 depois de 60 dias, se o motivo for preço ou momento |
| — | **Aguardando retorno** | `awaiting_reply` | qualificador que aparece sobre a etapa atual, não é uma etapa |

**Regras gerais:**
- Etapa automática **só avança**, como no HubSpot [D§4]. Voltar exige ação humana registrada; as exceções são uma resposta do cliente (R → Q3) e o fim da nutrição.
- Cada transição grava um evento em `lead_funnel_events`, que já existe: `{ de, para, motivo, origem }`. É dali que saem a linha do tempo e o funil, sem recalcular.

## 5. A cadência única de recuperação

Hoje há quatro mecanismos separados: turbo T1–T4, follow-up de silêncio, requalificação +3h e reativação. A proposta junta tudo num **motor de cadência**: tabela de passos por segmento, um job, um registro de toques.

O motor reaproveita peças que já existem e funcionam:
- `decideNextTouch` (`qualification-turbo/cadence.ts`), com as regras de horário, 131049 e intervalo mínimo;
- o envio de template (`enqueueMetaTemplateMessage`);
- o envio livre do follow-up de silêncio.

### 5.1 Segmentos e passos (opção recomendada)

Horário: 8h às 20h, seg. a sáb.; domingo só para quem escreveu no domingo. Intervalo mínimo entre toques: 90 min.

**Segmento R1, nunca respondeu.** Fora da janela; tudo por template.

| Passo | Quando | Canal | Conteúdo | Já existe? |
|---|---|---|---|---|
| T1 | +20 min | Meta, template utility | lembrete curto com o nome da empresa | sim (`anc_t1_lembrete`) |
| T2 | +3 h (no mesmo dia, se der) | Meta, template marketing | benefício + pergunta fechada ("é pra você, família ou empresa?") | template **não aprovado** |
| T3 | dia seguinte, 10h | Meta, template marketing | oferta de ligação ("prefere que um corretor te ligue?", botões Sim/Não) | **não aprovado** |
| T4 | D+3, 10h | Meta, template marketing | despedida com porta aberta | **não aprovado** |
| → | depois do T4 | — | vai para **R4, fila de ligação** | novo |

**Segmento R2, parou no meio.** A janela de 24 h está aberta; até 7 dias se veio de anúncio CTWA [D§6].

| Passo | Quando | Canal | Conteúdo |
|---|---|---|---|
| S1 | metade do prazo (7 min no Âncora Saúde) | canal da conversa, texto livre | retoma a última pergunta (já existe: follow-up de silêncio) |
| S2 | +3 h | canal da conversa, texto livre | pergunta de resposta simples, com botões quando for Meta |
| S3 | +20 h, antes de a janela fechar | canal da conversa, texto livre | "posso te mandar já uma simulação com o que você me passou?" |
| S4 | D+2 | Meta, template marketing | lembrete da cotação |
| S5 | D+4 | Meta, template marketing | oferta de ligação |
| S6 | D+7 | Meta, template marketing | despedida |
| → | depois do S6 | — | R4 (fila de ligação) |

**Segmento R3, morno.** Vai para o corretor como hoje. Se o corretor não fizer contato em 2 h úteis, entram S2 e S3 como ponte da IA, avisando que o corretor vai chamar.

**Segmento R5/R6, nutrição.** No máximo 1 toque por mês (D+30, D+60, D+90), cada um com um gatilho concreto: reajuste anual, mudança de faixa etária, carência. Só template de marketing. Para no 3º toque sem leitura.

**Regra dos 6 toques:** nenhum lead recebe mais de 6 mensagens automáticas sem responder antes de ir para a fila de ligação. É onde o ganho por tentativa praticamente acaba [D§2].

**Saída da cadência, em qualquer passo:**
- respondeu (volta a Q3, e a IA continua);
- opt-out ou número errado (X1);
- recebeu corretor;
- perdido ou ganho;
- 2 erros 131049 (para; espera 24 h a cada erro) [D§6];
- qualidade do número caiu (pausa geral).

**Cada mensagem tem saída visível**: "Se não quiser mais receber, responda SAIR." Pede a LGPD (art. 18) e a Meta [D§6, D§7].

### 5.2 Canal: escolha explícita, com validação e fallback

Cada passo da cadência mostra o canal na configuração: **Meta**, **WAHA** ou **mesmo canal da conversa**.

| Canal | Validação antes de enviar | Fallback |
|---|---|---|
| Meta (oficial) | texto livre só com a janela de 24 h aberta (ou CTWA até 7 dias); fora dela, só template aprovado da categoria certa; sem 131049 nas últimas 24 h; canal registrado | se o template não está aprovado: pula o passo e registra "template não aprovado" (como hoje) |
| WAHA | número WAHA conectado e o lead com conversa iniciada nele | Meta, se a validação da Meta passar |
| Mesmo canal | o canal da última mensagem da IA | o outro canal |

**Recomendação:**
- **Toda cadência automática sai pela Meta oficial.**
- **WAHA só no "mesmo canal da conversa"** (conversa que já nasceu no WAHA) e nunca para frio em escala. Automação em número não oficial arrisca o banimento do número [D§6].

### 5.3 Conteúdo

- Mensagens curtas, uma pergunta por vez, de resposta simples (botões nos templates). CTA simples responde mais que pergunta aberta [D§8, fonte fraca]; isso vira teste A/B.
- **Nunca** perguntar condição de saúde, doença ou cirurgia. Idade, vidas e cidade bastam [D§7].
- Os templates novos (`anc_t2_beneficio`, `anc_t3_ligacao`, `anc_t4_despedida`, `anc_s4_cotacao`, `anc_s5_ligacao`, `anc_s6_despedida`, `anc_n_reajuste`) entram no `templates-pack.ts` e são enviados à Meta pelo botão que já existe em `/qualificacao/turbo`.

## 6. Fila de quem não respondeu (R4)

- **Fila própria "Sem resposta"** em cada unidade (`leadQueues`, sem distribuição automática). Substitui o `manual_hold` genérico, que hoje acumula 41% dos leads sem dono nem prazo.
- **Entra:** quem termina a cadência sem responder. Não entra quem está em X1.
- **Trabalhada pelo Call Âncora:** `cold-base.ts` já faz 3 tentativas com 4 h de pausa. A base passa a ler esta fila primeiro, ordenada pela pontuação (seção 7).
- **Sai:**
  - interessado: vira lead do corretor;
  - não atendeu 3 vezes: vai para R6, nutrição;
  - sem interesse: vai para R6, com motivo;
  - número errado: vai para X1.
- **Na tela:** contagem e idade média na central de filas (`/leads/distribuicao`), e um botão de ação por lote ("Mandar para o Call Âncora") no menu `⋯`.

## 7. Pontuação do lead

Matriz no estilo RD Station: **Perfil A–D × Interesse 1–4**, com decaimento semanal do interesse [D§4, D§5].

**Perfil**, vindo da qualificação:

| Dado | Pontos |
|---|---|
| Tipo de plano empresarial/PME com CNPJ | +30 |
| Plano familiar | +20 |
| Plano individual | +10 |
| 2 ou mais vidas | +15 |
| Idades informadas | +15 |
| Cidade atendida por uma fila ativa | +15 |
| Operadora pedida no anúncio | +10 |
| Fora da área ou sem perfil | vai direto para D |

**Interesse**, vindo do comportamento:

| Dado | Pontos |
|---|---|
| Respondeu em até 20 min | +25 |
| Respondeu, em qualquer tempo | +15 |
| Leu a última mensagem | +10 |
| Pediu ligação ou clicou "Sim" | +30 |
| Abriu a cotação | +20 |
| Cada semana sem interação | −25% |

**Como é usada:**
- ordenar a fila de ligação e o Call Âncora;
- escolher o segmento da nutrição;
- o perfil A com interesse 3–4 vai direto ao corretor, mesmo sem completar a qualificação.

Os pesos acima são o **ponto de partida**. Depois de 8 semanas, são recalibrados contra a taxa real de venda por célula da matriz.

**Proibido:** usar condição de saúde, que é dado sensível (LGPD art. 11) e seleção de risco vedada pela ANS [D§7].

A matriz substitui o `qualificationScore` atual (% de campos preenchidos) nas telas. O campo antigo continua para a distribuição até a fase 4.

## 8. Telas (Lite, padrão `interface-enxuta`)

Todas seguem `docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`, `FEEDBACK.md` e os filtros-padrão de intervalo + fila, com entradas por turno.

### 8.1 Etapa visual em todo lugar
- **Componente `LeadJourney`**: uma `SegmentBar` com as fases Qualificação → Corretor → Negociação, a etapa atual escrita ("Em conversa · Idades") e o próximo passo ("IA retoma às 14h30", "Corretor: 1º contato atrasado 12 min").
- Aparece no hover card do lead (bloco "Progresso", que já existe), no topo da ficha `/leads/[id]`, no painel lateral de `/conversas` e numa coluna da lista de leads.
- **Atalho do dia a dia:** na lista, filtro de um clique por etapa ("Parou no meio · 34") e a tecla `J` para ir ao próximo lead da mesma etapa.

### 8.2 Rota de análise da qualificação: `/qualificacao/leads`
- **Tabela** (`DataTable` + `SectionCardHeader`) com estas colunas:
  - lead;
  - etapa (`LeadJourney` compacto);
  - campo atual;
  - toques recebidos (por exemplo, "3 de 6");
  - última resposta;
  - perfil × interesse ("A3");
  - fila.
- **Clique na linha abre o drawer** com a **linha do tempo da qualificação**: cada mensagem da IA e do cliente, os campos coletados (com a mensagem que deu o dado), cada toque da cadência com canal e resultado, cada transição de etapa com o motivo, opt-out e erros da Meta.
  - Fonte: `whatsapp_messages`, `ai_conversations.memory`, `qualification_details.turbo`, `lead_funnel_events` e `audit_logs`.
  - Nada novo é gravado só para essa tela.
- **Menu `⋯` da linha:** reabrir qualificação, mandar para a fila de ligação, marcar "Momento ruim" (com data), marcar "Não contatar".

### 8.3 Funil de recuperação: `/qualificacao/recuperacao`
Uma tela, quatro blocos, sem troca de visualização:
1. **Números do período**, com intervalo e fila:
   - entraram;
   - em qualificação;
   - quentes;
   - parou no meio;
   - nunca respondeu;
   - em requalificação/follow-up;
   - na fila de ligação;
   - em nutrição;
   - **recuperados**;
   - não contatar.
2. **Por forma de follow-up:** uma linha por passo (T1…T4, S1…S6, ligação, nutrição), com enviados, pulados (e por quê), respostas, recuperados e custo Meta.
3. **Meta:** recuperados por semana × linha de base (120) × meta (240), com o grupo de controle ao lado.
4. **Saúde:** opt-out por envio, 131049, qualidade do número e templates não aprovados (com o botão que já existe para enviá-los).

### 8.4 Configuração para o diretor
Fica em `/qualificacao/turbo`, renomeada para **"Recuperação"**: um card só, com "Configurações ▾".
- **Interruptor geral** e interruptor por segmento (Nunca respondeu, Parou no meio, Morno, Nutrição).
- Por passo: ligado/desligado, quando sai, **canal** (Meta / WAHA / mesmo da conversa) e template, com o status de aprovação ao lado.
- Horário de envio; tamanho do grupo de controle (padrão 10%).
- **Sem editor de texto livre para template:** o texto do template é o aprovado pela Meta. O texto livre (S1–S3) tem prévia.

## 9. A/B e prova de que dobrou

- **Grupo de controle de 10%**, sorteado por hash do lead (o mesmo mecanismo de `experiments.ts`), fixo. Recebe só o que existe hoje.
- **Métrica principal do teste (OEC):** recuperado em até 14 dias. Checar o equilíbrio do sorteio (SRM) toda semana [D§9].
- **Tamanho:** com cerca de 500 frios por semana e controle de 10%, a diferença de 10% → 20% fica detectável em cerca de 6–8 semanas. Diferenças menores não são testadas [D§9].
- **Testes por passo**, um de cada vez, depois que o controle mostrar efeito:
  1. pergunta fechada × aberta no S2;
  2. S3 a +20 h × D+2;
  3. oferta de ligação no T3 × no T4.
- **Reaproveitar o Thompson sampling** que já existe para a 1ª mensagem, estendendo o `experiments.ts` para os passos.
- **Sem olhar o resultado antes do tamanho fixado.**

## 10. Riscos e cuidados

| Risco | Cuidado |
|---|---|
| Opt-out e LGPD | "SAIR" em toda mensagem, honrado na hora (X1); registro do legítimo interesse (teste de balanceamento, guia da ANPD) feito com o jurídico; retorno só sobre a cotação pedida [D§7] |
| Dado sensível | nunca perguntar nem pontuar condição de saúde [D§7] |
| Limite da Meta (131049) e qualidade do número | espera de 24 h por erro; para no 2º erro; pausa geral se a qualidade cair para "baixa"; limite diário por portfólio respeitado [D§6] |
| Banimento do WAHA | cadência automática só pela Meta; WAHA só em conversa que já nasceu nele [D§6] |
| Custo da Meta | template de marketing é cobrado por entrega; o painel mostra custo por recuperado; T2–T4 só depois de medir o T1 |
| Leis estaduais de telemarketing (SP, RJ) | conferir com o jurídico antes da fase 3 (fila de ligação e nutrição) [D§7] |
| Corretor perde o lead para a IA | a cadência para quando há corretor; o morno sem contato do corretor tem ponte (R3) e aviso ao gestor |
| Números confusos (importações) | métrica só com leads de anúncio; importação em painel separado |

## 11. Fases de entrega

Cada fase tem flag por empresa, passa pelo `/dev/laboratorio`, recebe teste dos casos de "não enviar" e vai para a `preview/3005` para revisão visual antes do merge.

| Fase | Entrega | Migration | Job | Laboratório | Critério de pronto |
|---|---|---|---|---|---|
| **0. Ganho rápido** (1–2 dias) | Aprovar na Meta `anc_t2_beneficio`, `anc_t3_ligacao` e `anc_t4_despedida` (ação do diretor no botão que já existe). Corrigir `stats-service.ts` (follow-up = 0). | não | — | — | T2–T4 saindo; números aparecem na Visão |
| **1. Ver** | `deriveLeadJourney` + `LeadJourney` no hover card, na ficha e em conversas; `/qualificacao/leads` com o drawer da linha do tempo | não | — | fluxo "Etapa do lead" com lead simulado em cada etapa | todo lead mostra etapa e próximo passo |
| **2. Medir** | `/qualificacao/recuperacao` (funil, por forma de follow-up, meta); métrica "recuperado"; grupo de controle sorteado | **0234** (`lead_recovery_touches`: um registro por toque com passo, canal, status, resposta e custo) | — | fluxo "Funil de recuperação" com dados simulados | linha de base de 120/semana reproduzida na tela |
| **3. Cadência única** | motor de cadência com segmentos R1/R2/R3, passos S2–S6, escolha de canal por passo, "SAIR", tela de configuração | usa a 0234 | dentro do `qualification-cadence` (sem tarefa nova); runbook atualizado | fluxo "Cadência" com simulação de resposta, 131049 e opt-out | casos de não enviar com teste; controle de 10% ativo |
| **4. Fila e pontuação** | fila "Sem resposta" por unidade; base do Call Âncora lendo a fila; matriz perfil × interesse; ordenação | **0235** se precisar (fila padrão por unidade) | Call Âncora já existe | fluxo "Fila de ligação" | fila no lugar do `manual_hold` genérico |
| **5. Nutrição e A/B por passo** | R5/R6 com gatilhos (reajuste, faixa etária); Thompson por passo; ferramenta da Sasá "quem recuperar hoje" | não | mensal, dentro do mesmo job | fluxo "Nutrição" | 8 semanas de controle → decisão de meta |

Os números de migration são **conferidos de novo na hora** (maior número entre as branches da origin; hoje a maior é 0233).

## 12. Decisões (opção recomendada em cada uma)

1. **Etapa derivada × coluna nova de etapa.** Recomendado: **derivada** por uma função pura, com cada transição gravada em `lead_funnel_events`.
2. **Uma cadência única × manter os quatro mecanismos.** Recomendado: **cadência única** por segmento (Nunca respondeu, Parou no meio, Morno, Nutrição), com no máximo 6 toques antes da fila de ligação.
3. **Canal da cadência automática.** Recomendado: **Meta oficial** em tudo; WAHA só quando a conversa já nasceu no WAHA. O canal aparece e é escolhido por passo, com validação e fallback.
4. **Fila de quem não respondeu.** Recomendado: **fila "Sem resposta" por unidade, trabalhada pelo Call Âncora**, no lugar do `manual_hold` sem dono.
5. **Como provar que dobrou.** Recomendado: métrica **recuperados por semana**, só leads de anúncio (linha de base 120, meta 240), com **10% de controle** e 6–8 semanas antes de concluir.

**Pendência só do usuário:** aprovar na Meta os templates de marketing (T2–T4), o que destrava a fase 0. A conferência jurídica (LGPD e telemarketing estadual) precisa acontecer antes da fase 3.
