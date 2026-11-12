# Prompt: plano da área "Venda Automatizada" (piloto)

> Cole o bloco abaixo numa sessão nova do Claude Code, na raiz do repositório. Ele pede **primeiro o plano** e só depois a implementação, por fases, conforme o fluxo do CLAUDE.md.

---

## Papel e objetivo

Você vai planejar (e, depois da minha aprovação, construir) a área **Venda Automatizada** do CorreTop. É um vendedor de IA que pega **um lead quente por vez**, escolhido por um gestor, e conduz a venda pelo WhatsApp do começo ao fim.

**O objetivo é vender.** O agente não é um atendente que tira dúvidas e repassa: ele tenta fechar a venda com o próprio cliente, usando o roteiro dos corretores que fecham (seção "O que os dados reais mostram"). Cada decisão do plano deve aumentar a chance de o cliente dizer sim e mandar os documentos. Os passos são:

1. confirma os dados;
2. cota com o catálogo real do `/cotacao`;
3. envia 2 ou 3 opções;
4. recomenda uma e trata as objeções;
5. oferece uma alternativa mais em conta quando o cliente pede;
6. manda o **PDF de cotação personalizado** para o cliente;
7. pede o fechamento;
8. pede os documentos;
9. entrega a negociação à pessoa que o gestor escolher, para a assinatura.

Tudo isso é auditável, tem botão de pausar e "assumir", e funciona sem inventar preço, rede ou promoção.

**Nunca passa a um corretor sozinho.** O agente não distribui, não oferta e não transfere o lead para nenhum corretor por conta própria, nem ao dono atual do lead, nem pela fila ou pelo plantão. Quando precisa de uma pessoa, ele **chama o gestor** que escolheu a negociação. O gestor decide se assume, se devolve ao agente ou se entrega a um corretor que **ele escolhe** numa lista. Só essa escolha manual muda o responsável pelo lead.

**Transcrição de áudio liberada** para este processo: todo áudio do cliente numa negociação ativa é transcrito e o agente responde ao que foi dito (detalhes no item 8).

**Entrega desta etapa:** um plano escrito em `docs/implementations/active/2026-11-12-venda-automatizada.md`.

- Ele cobre as seções do item "Formato do plano" abaixo.
- Traz as decisões que precisam de mim, cada uma com uma opção recomendada.
- Não escreva código antes de eu aprovar o plano.

## Regras do projeto (obrigatórias)

- **Branch:** comece a partir de `origin/feat/diretor-visual-lite`, a branch que o Coolify publica, e crie a sua com o nome `feat/venda-automatizada`. Nunca commite na `main` e não dê push sem eu pedir.
- **Infraestrutura:** só Coolify; nada de Vercel. Todo job novo entra em `docs/runbooks/coolify-scheduled-tasks.md`, com lease (`src/shared/db/job-lease.ts`) e heartbeat (`src/features/live-status/heartbeat.ts` e `job-schedule.ts`).
- **Visual:** siga `docs/design-system.md` e o Lite do diretor (`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`). A lista de entidades é uma `DataTable` com `SectionCardHeader`, o detalhe abre num `Sheet`, ações secundárias ficam no menu `⋯`, e há um CTA primário por tela. No texto do Lite, nunca use travessão. Se algo visual não estiver coberto pelo design system, pare e pergunte.
- **Canal explícito:** todo item que envia mensagem mostra e permite escolher entre Meta oficial e WAHA. O fallback fica visível e a validação é por canal: Meta exige template aprovado fora da janela de 24h; WAHA exige número conectado e limites anti-ban.
- **Migration:**
  - use o maior número existente em qualquer branch `origin/*` mais 1 (hoje a próxima é 0228; confira de novo);
  - o journal precisa ter o `.sql` correspondente;
  - o deploy não roda migration;
  - o código precisa tolerar tabela ausente (erro 42P01).
- **Flags:** tudo nasce atrás de flag no catálogo `src/shared/feature-flags/catalog.ts`, por empresa, desligada por padrão e auditada no Super-admin.
- **Idioma e registro:** texto ao usuário em pt-BR. A decisão vai para o `docs/decision-log.md` (próximo DEC livre) e a entrada para o `docs/features-log.md`.

## O que já existe (reaproveitar; confira os caminhos)

- **Cotador real:** `src/features/global-catalog/pilot/`.
  - `engine.ts` traz o `simulate(plans, input, date, reviewed, hidden, release)`, uma função pura que filtra por modalidade, cidade, vidas, entidade, perfil PME, acomodação, coparticipação e `budgetCents`, ordena por preço e marca cada plano como `ready`, `pending` ou `incompatible`, com os motivos.
  - Em `contracts.ts` ficam o `QuoteInput` e o `canUsePilot`, que hoje libera um único corretor.
  - Em `server.ts` ficam o `loadPilotIndex`, o `loadPlanShard` (detalhes e rede) e o `requirePilot`, que **depende de sessão**.
  - `proposal-action.ts` gera o PDF, mas só para plano revisado (`reviewedPlanIds`). Hoje **0 de 4.922** estão revisados.
  - `guide/guide-flow.ts` tem os parsers `parseAges`, `parseBudget`, `matchCity`, `matchEntity` e `toQuoteInput`.
- **WhatsApp:**
  - Saída Meta com outbox: `src/features/communication-channels/outbound-service.ts`, com as funções `enqueueMetaTextMessage` e `enqueueMetaTemplateMessage` e a tabela `whatsapp_outbound_messages` (`deliveryRoute`, `idempotencyKey`, `holdReason`).
  - Política de janela e templates: `message-policy-service.ts` e `templates.ts`.
  - Mídia: `src/features/leads/actions/send-lead-media.ts` envia só na hora; **não há outbox de documento**.
  - Entrada: `ingestMetaCloudWebhook` (`communication-channels/service.ts`) e `ingestWahaWebhook` (`waha-cadence/inbound.ts`), gravando em `whatsapp_messages`.
  - WAHA de produção: fica no repositório corretop-infra.
- **IA:**
  - Gateway: `src/features/ai-gateway/` (`runGateway` com saída validada por zod, `sensitive`, perfis, orçamento `anthropic-budget.ts`, `maskPersonalData`).
  - Guardrails antigos: `src/features/ai-agent/guardrails.ts`. O `PricingGuard` **bloqueia todo preço**, então a venda precisa de um pipeline próprio.
  - Qualificação: `src/features/ai-qualification/`, com as respostas em `ai_qualification_sessions.collectedData` e em `ai_conversations`.
  - Turbo: `src/features/qualification-turbo/`.
  - Conversation intelligence, que move etapa e detecta venda: `src/features/conversation-intelligence/`.
  - RAG das operadoras com citação obrigatória: `src/features/operator-catalog/answer.ts` e `answer-guard.ts`.
  - Opt-out: `parseOptOut` em `src/features/ai-agent/quick-reply.ts`.
  - Bloqueio Meta 131049: `meta-delivery-failure.ts`.
  - Transcrição de áudio: já está na `feat/diretor-visual-lite` (commit `8c29cbb9`), em `src/features/ai-agent/audio-transcription/` (`service.ts`, `rules.ts`, `transcriber.ts` com Groq Whisper e reserva OpenAI, `flag.ts` com `feature_ai_audio_transcription_<tenantId>`), tabela `lead_audio_transcriptions` (migration 0225). Hoje vale só na qualificação e só para os 2 primeiros áudios de até 2 min. O texto fica na mensagem e aparece como "Transcrição".
- **Funil:**
  - Etapas do lead: new, distributed, in_contact, quote_sent, negotiation, documentation_pending, under_analysis, awaiting_reply, converted, lost. "Fechamento" corresponde a documentation_pending e under_analysis.
  - Histórico: `lead_stage_history` (com `actorType` "ai") e `lead_funnel_events`.
  - Venda: `sales` e `registerSaleAction`.
  - Documentos: `lead_documents` e `document_requirements`.
- **Horário:** `src/shared/time/business-hours.ts`.
- **Navegação:** `src/shared/navigation/nav-registry.ts` e `src/shared/navigation-access.ts`.

## O que os dados reais mostram (estudo de 12/11, só leitura)

> A amostra é pequena: na prática, 12 fechamentos reais com corretor e 1 convertido marcado. Trate como evidência qualitativa forte.

- **Velocidade vende.**
  - Nos fechamentos, a mediana até a 1ª mensagem do corretor foi de **17 min**, a cotação saiu **10 min** depois e os documentos foram pedidos **0,9 h** depois.
  - Nos perdidos, a mediana até a 1ª mensagem foi de **46 min**.
  - Em 7 de 10 fechamentos, o cliente escolheu e recebeu a lista de documentos **na primeira sessão**, de 30 a 90 min.
- **Ritmo de chat.** O cliente responde em cerca de 1 min. O corretor manda textos curtos (cerca de 24 caracteres), quebrados em várias mensagens, com perguntas. Um quinto das mensagens do corretor é **áudio**, que hoje não é transcrito.
- **Quem ganhou:** o plano mais barato com rede perto de casa e sem coparticipação, ou com coparticipação parcial. Apareceram Klini 200, Amil Bronze, Leve Top 400 e Assim. O cliente que pediu "o mais completo" fechou o básico.
- **Alavancas que funcionaram:**
  - promoção de entrada (desconto nas primeiras parcelas, dental grátis);
  - MEI ou CNPJ para baratear (exige 6 meses ou mais);
  - compra de carência ou portabilidade;
  - adesão por entidade.
- **Sequência dos ganhadores:**
  1. **Abertura:** apresenta-se (nome e corretora) e **confirma** o que o bot já coletou, sem repetir perguntas.
  2. **Perguntas, no máximo 4:** bairro ou região, hospital ou laboratório de preferência, CNPJ ou MEI e há quanto tempo, plano atual e quanto paga, com ou sem coparticipação, **orçamento**.
  3. **Cotação:** 2 a 4 opções, com o preço de cada uma e a rede da região. Logo depois, **uma pergunta de afunilamento** ("200, 400 ou 600?").
  4. **Recomendação explícita:** "eu indicaria X porque tem o hospital Y e não tem coparticipação".
  5. **Fechamento:** depois do "gostei", vem "vamos seguir?" e, **no mesmo minuto**, a lista de documentos, mais a escolha do vencimento (1, 5, 10 ou 20) como fechamento por alternativa.
  6. **Urgência verdadeira:** prazo da promoção ou início de uso.
  7. **Pós-sim:** ajuda com token e assinatura, avisa sobre a entrevista médica e o prazo de análise, e orienta a cancelar o plano antigo só depois do 1º pagamento.
- **Documentos padrão:**
  - RG ou CNH frente e verso, CPF, comprovante de residência, e-mail, telefone, selfie com documento;
  - criança: certidão de nascimento;
  - MEI ou CNPJ: o certificado;
  - portabilidade: 3 boletos e a carteirinha;
  - adesão: comprovante de vínculo.
- **Objeções mais comuns e respostas que funcionaram:**
  1. "caro": trocar por uma operadora mais barata com rede local, oferecer MEI, mostrar o valor com o desconto de entrada; nunca um "consigo reduzir" sem número;
  2. "pago X hoje": perguntar o valor e a coparticipação atuais e encerrar com cordialidade se não houver como bater;
  3. "tem o hospital X?": responder pelo guia, com o tipo de atendimento;
  4. coparticipação: explicar parcial contra total;
  5. carência: urgência, consultas, 180 dias para cirurgia eletiva, 300 dias para parto, compra de carência;
  6. "vou falar com o esposo": combinar retorno hoje, deixar a lista de documentos adiantada, follow-up no dia seguinte;
  7. "o anúncio dizia outro valor": explicar que é a tabela MEI ou CNPJ (já causou perda com acusação de propaganda falsa);
  8. idade e criança sozinha: regra por operadora;
  9. "é golpe?": nome, corretora, unidades físicas, convite para ir à unidade;
  10. "vou pensar": follow-up em menos de 24h com a decisão pronta ("ficou com o A20 ou o A40?").
- **Follow-up:**
  - taxa de resposta: 22% entre 12 e 24h, 17% entre 1 e 2 dias, 10% entre 2 e 4 dias; o 2º follow-up rende metade do 1º;
  - cadência:
    - na mesma sessão, de 30 a 60 min depois da cotação;
    - antes de 24h, retomada com o plano e o preço;
    - D+2, nova condição real ou o prazo;
    - D+5, opção mais barata ou encerramento;
    - depois disso, a regra de "Aguardando retorno" assume;
  - horário: evitar sexta à tarde e o fim de semana, e responder até as 21h, porque o cliente manda documentos à noite.
- **Falhas a evitar:**
  - despejar opções sem perguntar (até 16 imagens seguidas);
  - ignorar o teto de orçamento;
  - repetir perguntas;
  - follow-up genérico ou agressivo ("desistiu??");
  - errar idade ou número de vidas;
  - preço divergente do anúncio;
  - fricção depois do sim.

## O que o plano precisa resolver

1. **Escopo do piloto e acesso.**
   - Flag por empresa.
   - Quem escolhe o lead: diretor e gestor.
   - **Só 1 negociação ativa por empresa**, garantido no banco por índice parcial único.
   - Critério de lead elegível: quente, ativo, com telefone, com consentimento LGPD, sem opt-out, sem bloqueio Meta e fora de pós-venda.
   - Ao entrar no piloto, o lead sai da distribuição automática (fila, plantão, redistribuição e ofertas) enquanto a negociação estiver ativa. Defina o que acontece se um corretor já tinha o lead (sugestão: só entra lead que ninguém aceitou ainda, ou o gestor confirma a retirada).
   - O agente se apresenta como **assistente virtual da corretora**, em nome da corretora, não de um corretor.
2. **Modelo de dados.**
   - Proponha as tabelas, por exemplo:
     - `auto_sale_deals`: lead, estado, modo, canal, quem escolheu (o gestor), a quem o gestor entregou (vazio até a entrega), limites;
     - `auto_sale_turns`: cada mensagem recebida ou enviada, intenção, fatos extraídos, decisão, custo de IA;
     - `auto_sale_offers`: snapshot da cotação (input, planos, preços, release do catálogo, chave do PDF no R2).
   - Inclua índices, a migration e a tolerância a tabela ausente.
3. **Máquina de estados do funil.**
   - Etapas sugeridas: escolhido, confirmar dados, preferências, cotação enviada, recomendação, objeções, pedido de fechamento, documentos, chamada ao gestor, entregue a quem o gestor escolheu, ganho ou perdido.
   - Para cada etapa: o que dispara a entrada e a saída, qual etapa do lead ela atualiza (com `actorType` "ai") e qual o tempo máximo.
4. **Serviço de cotação sem sessão.**
   - Extraia do `requirePilot` uma camada de serviço que o job e o agente chamem com o contexto da negociação.
   - Mapeie as respostas da qualificação para o `QuoteInput`.
   - Estratégia de escolha:
     - no máximo 3 opções dentro do orçamento, ordenadas por preço;
     - priorizar a rede perto do bairro e sem coparticipação;
     - uma recomendada, com o motivo;
     - a "opção mais em conta" é o `simulate` rodado de novo, relaxando um filtro por vez, com explicação do que mudou.
5. **PDF de cotação personalizado para o cliente** (peça central da venda).
   - Gerado a partir de um snapshot de `auto_sale_offers`; nenhum número é digitado à mão nem gerado pela IA.
   - Conteúdo, nesta ordem:
     - capa com o nome do cliente, a data e a validade da cotação;
     - o perfil cotado: vidas e idades, cidade e bairro, modalidade (PF, adesão com a entidade, PME ou MEI);
     - as 2 ou 3 opções lado a lado: operadora, plano, acomodação, coparticipação, valor por vida e total por mês;
     - a **opção recomendada em destaque**, com o motivo em uma frase ("tem o hospital X perto de você e não tem coparticipação");
     - os hospitais e laboratórios da rede perto do bairro do cliente, com o tipo de atendimento;
     - carências em linguagem simples e a compra de carência, quando ele já tem plano;
     - a promoção vigente, só da tabela cadastrada pelo diretor, com a data de fim;
     - a lista de documentos para contratar e o próximo passo ("responda SIM e escolha o vencimento: 1, 5, 10 ou 20");
     - o contato da corretora e as unidades físicas (responde à dúvida "é golpe?");
     - o aviso legal: valores da tabela da operadora na data, sujeitos à análise da operadora.
   - Também uma **imagem por plano** (PNG) com o preço, para quem não abre PDF. A legenda da mensagem traz o valor e a pergunta de afunilamento.
   - Uma versão nova a cada oferta nova: a "opção mais em conta" gera um PDF novo, comparando com o anterior.
   - Persistido no R2 com hash e ligado ao lead e à negociação. O gestor vê e baixa no `Sheet`. O envio usa um **outbox de documento** novo (hoje mídia só sai na hora, pela tela).
   - Visual: siga o design system nas cores, fontes e espaçamentos. Hoje o PDF do cotador usa Helvetica e Latin-1 (`proposal-action.ts`); avalie fonte embutida com acento. O que o design system não cobrir para PDF, pergunte antes.
   - Bloqueio da revisão comercial: hoje nenhum plano está revisado e o PDF do cotador sai bloqueado para todos. Proponha:
     - quais operadoras e planos revisar antes do piloto (as que mais vendem: Klini, Amil Bronze, Leve, Assim);
     - o que o agente pode mandar para um plano ainda pendente.
6. **O agente de venda.**
   - Modelo pelo `ai-gateway` com `sensitive`.
   - Saída estruturada com intenção, fatos novos, objeção detectada, próxima ação e mensagens curtas (várias, em ritmo de chat).
   - Ferramentas determinísticas: `simulate`, detalhes do plano, rede, RAG das operadoras com citação e tabela de promoções vigentes (cadastrada pelo diretor, com validade).
   - O playbook e as objeções acima viram o prompt do sistema e um catálogo versionado.
7. **Guardrails de venda** (substituem o `PricingGuard` só aqui):
   - todo número de preço precisa bater com um snapshot de `auto_sale_offers`;
   - rede e hospital só com fonte;
   - promoção só da tabela vigente;
   - nada de prometer carência, cobertura ou aprovação fora do catálogo;
   - nada de diagnóstico ou conselho médico;
   - anti prompt-injection;
   - limite de mensagens por hora e por dia;
   - horário de envio (dias úteis das 8h às 21h, sábado de manhã a decidir);
   - parada imediata em opt-out, 131049, "quero falar com uma pessoa", irritação, menção a advogado ou Procon, ou duas mensagens sem entender.
8. **Entrada e convivência com o que já roda.**
   - Gancho na entrada da Meta e do WAHA: com negociação ativa, o lead sai da qualificação, do turbo, da conversa inteligente, dos lembretes e da distribuição.
   - Agrupar a rajada do cliente: esperar de 60 a 90 s sem mensagem nova.
   - **Transcrição de áudio liberada (decidido).** Todo áudio do cliente numa negociação ativa é transcrito com o serviço existente.
     - Na negociação não vale o limite da qualificação (2 primeiros áudios). Proponha um limite por negociação e por dia, e a duração máxima (sugestão: até 5 min).
     - Liga junto com a flag da Venda Automatizada, sem depender de `feature_ai_audio_transcription_<tenantId>`.
     - O custo entra no custo da negociação.
     - Se o áudio falhar ou passar do limite, o agente pede com gentileza que o cliente escreva e avisa o gestor.
   - Idempotência por mensagem.
   - Avaliar se o agente responde em áudio (sugestão: não no piloto).
9. **Canal.**
   - Escolha explícita por negociação: Meta oficial como padrão ou um número WAHA escolhido pelo gestor, com o fallback visível.
   - Fora da janela de 24h da Meta, o follow-up só usa template aprovado. Liste os templates novos necessários.
10. **Follow-up.** A cadência derivada dos dados acima, com as condições de parada, os templates e o job no runbook.
11. **Chamar o gestor e entregar a quem ele escolher.**
    - O agente nunca escolhe nem avisa um corretor.
    - Gatilhos para **chamar o gestor**: documentos recebidos, cliente pediu uma pessoa, objeção fora do roteiro, valor fora do catálogo, dúvida de saúde, desconfiança de golpe, irritação.
    - Enquanto o gestor não responde, o agente segura a conversa com uma frase combinada ("vou confirmar isso e já te retorno") e não insiste.
    - O gestor recebe um resumo: quem é o cliente, o que quer, as ofertas e PDFs enviados, as objeções, o motivo da chamada e o próximo passo.
    - Avisos no app e no WhatsApp vão **só para o gestor** que escolheu a negociação.
    - No `Sheet`, o gestor escolhe entre devolver ao agente, assumir ele mesmo ou **entregar a um corretor que ele escolhe** numa busca. Só essa ação muda o dono do lead, com auditoria.
    - "Assumir" encerra o agente na hora.
12. **Modos de operação.**
    - **Simulação:** o agente escreve e nada sai. Use para testar com as conversas reais anonimizadas.
    - **Copiloto:** cada mensagem espera aprovação do gestor no app, com editar e enviar.
    - **Autopiloto:** envia sozinho, com limites.
    - O piloto começa em Copiloto e o gestor libera o Autopiloto por negociação.
13. **Tela da área.**
    - Rota e lugar na navegação (sugestão: área comercial, "Venda Automatizada").
    - Tabela das negociações (ativa e histórico).
    - CTA "Escolher lead quente": busca e lista de elegíveis, com "Só quentes" por padrão.
    - `Sheet` da negociação: etapa, conversa, ofertas enviadas, decisões da IA com o motivo, mensagens aguardando aprovação, botões Pausar e Assumir, custo.
    - Siga o design system; o que não estiver coberto, pergunte.
14. **Métricas do piloto.**
    - Tempo até a 1ª cotação, taxa de resposta, opções e PDFs enviados, chegada a "documentos pedidos" e a "proposta assinada", chamadas ao gestor e o motivo, custo de IA e de transcrição por negociação.
    - Compare com a base atual (17 min, 10 min e 0,9 h). Use "documentos pedidos" como sucesso principal, porque `converted` quase não é marcado hoje.
15. **Testes e avaliação.**
    - Unitários dos guardrails, da máquina de estados e da escolha de ofertas.
    - Uma suíte de replay com as 12 conversas de fechamento e as perdidas, anonimizadas: o agente precisa chegar ao pedido de documentos nas que fecharam e não pode inventar número.
    - Teste de cada objeção da lista.
    - Teste de parada, por opt-out e por "falar com pessoa".
    - Teste de que nenhum caminho do agente muda o dono do lead ou cria oferta para corretor.
    - Teste do PDF: todo número bate com o snapshot e o arquivo abre com acento.
    - Replay com áudio transcrito.
16. **Riscos, LGPD e conformidade.**
    - Consentimento.
    - Mínimo de dados de saúde.
    - Retenção.
    - Regras da ANS sobre carência e cobertura.
    - Transparência de ser assistente virtual.
    - Kill switch global.
17. **Fases de entrega**, cada uma com flag, critério de pronto e o que eu reviso visualmente:
    - **F0:** decisões e revisão comercial dos planos;
    - **F1:** dados, gate e a tela de escolha, sem envio;
    - **F2:** serviço de cotação, ofertas, PDF personalizado, transcrição na negociação e Simulação;
    - **F3:** Copiloto com 1 lead;
    - **F4:** Autopiloto com limites;
    - **F5:** avaliação e próximos passos.

## Formato do plano

Para cada seção:

- o que muda;
- os arquivos;
- as tabelas e os jobs;
- as flags;
- os testes;
- os riscos.

No fim, inclua:

- a lista **"Decisões para o Vinicios"**, cada uma com a opção recomendada primeiro;
- a estimativa por fase;
- o que **não** entra no piloto.

Seja específico com caminhos e nomes reais. Antes de afirmar que algo existe, confirme no código.
