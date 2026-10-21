# Qualificação turbo: mais leads respondendo, mais leads quentes na distribuição

Data: 21/10/2026 · Autor: Vigia (Claude) para Vinicios · Status: Fases 0 a 2 e parte da 3 implementadas na branch `feat/qualificacao-turbo` (ver seção 11)

Objetivo: fazer o maior número possível de leads responder à primeira mensagem,
qualificar rápido e chegar quente à distribuição, gastando o mínimo com a Meta.
O sistema passa a testar sozinho abordagens, mensagens e perguntas e a ficar com
o que converte mais.

---

## 1. Resumo em 8 pontos

1. **O template de primeiro contato está como MARKETING** (`scripts/setup-qualification-template.ts:100`).
   Isso custa R$ 0,3217 por envio e faz a Meta **não entregar** para quem já recebe
   muita propaganda (limite de marketing por pessoa, erro 131049). Uma versão
   UTILIDADE, escrita sem tom promocional, custa R$ 0,035 (9 vezes menos) e não entra nesse limite.
2. **Depois da primeira mensagem vem silêncio.** Em 15 a 30 min o lead vira frio e
   vai para espera manual. Só existe uma nova tentativa, 3h depois, com o mesmo template.
   O "Sem resposta à 1ª mensagem" aparece na tela mas o backend força desligado
   (`followup-service.ts:53`).
3. **A mensagem é genérica e cria um passo a mais.** "Iniciar Atendimento" obriga o
   lead a clicar antes da primeira pergunta, e "Não tenho interesse" convida a sair.
   Não usa nada do anúncio nem do formulário.
4. **A IA pergunta de novo o que o formulário já respondeu** (tipo de plano, vidas,
   CNPJ). As respostas do formulário (`sourceMetadata.formAnswers`) não entram na memória.
5. **Não existe medição nem teste.** Entrega e leitura já chegam no webhook, mas nenhum
   relatório mostra taxa de resposta por template, e não há A/B.
6. **A nova cobrança da Meta (1/10/2026) não é acompanhada.** O webhook manda o preço de
   cada mensagem e o sistema descarta. Não usamos a janela grátis de até 7 dias dos
   anúncios de clique para WhatsApp.
7. **O plano** cria: primeira mensagem que já é a primeira pergunta (com botões),
   cadência de 4 toques com custo controlado, abordagem por tipo de anúncio, conversa
   de 3 perguntas usando o que o formulário já trouxe, motor de experimentos que
   escolhe o vencedor sozinho, e custo Meta por lead visível.
8. **Ordem sugerida:** Fase 0 (corrigir e medir, 1 semana) → Fase 1 (primeira mensagem
   e cadência) → Fase 2 (experimentos) → Fase 3 (abordagem por anúncio e Meta otimizando
   por lead quente) → Fase 4 (sistema aprende sozinho).

---

## 2. A nova cobrança da Meta (oficial, em vigor desde 1/10/2026)

Fonte: tabela de tarifas BRL baixada de developers.facebook.com/docs/whatsapp/pricing
(arquivos em `.maestri/.../meta-precos-2026-10/`, "Cost per message in BRL ... effective October 1, 2026").

### 2.1 Preço por mensagem entregue, Brasil, em reais

| Categoria | R$ por mensagem | Quando se aplica |
|---|---|---|
| Marketing | **0,3217** | Template promocional, de reengajamento ou "continue de onde parou" |
| Utilidade | 0,035 | Template não promocional sobre algo que o cliente pediu |
| Autenticação | 0,035 | Códigos de verificação |
| Atendimento (texto livre na janela de 24h) | 0,035 | **Grátis até 1.000 por mês por número.** A partir da 1.001ª, cobrado |
| Meta Business Agent | US$ 2 por 1 milhão de tokens | Só se usarmos o agente da Meta (não usamos) |

Faixas de volume (só utilidade e autenticação, por portfólio, por mês): utilidade a
R$ 0,035 até 250 mil mensagens e com desconto acima disso. Não muda nada no nosso volume.

### 2.2 Regras que mudam a estratégia

- **Cobra por mensagem entregue**, não mais por conversa. Mensagem que falha não é cobrada.
- **Janela de atendimento (24h):** abre quando o cliente escreve ou clica num botão.
  Dentro dela podemos mandar texto livre e mensagens interativas (botões, listas).
  Desde 1/10, utilidade dentro da janela também é cobrada; texto livre é mais barato
  que template dentro dela, e grátis até 1.000 por mês por número.
- **Janela grátis de anúncio (FEP):** quem chega por anúncio de clique para WhatsApp
  (Android/iOS) abre uma janela em que **todas** as mensagens são grátis por até 7 dias,
  desde que respondamos dentro das 24h. Para esses leads, a cadência inteira sai de graça.
- **Limite de marketing por pessoa:** a Meta limita quantos templates de marketing cada
  pessoa recebe de todas as empresas. Quem lê pouco recebe menos. Falha com erro 131049,
  e reenviar antes de 24h piora. Mensagens de marketing dentro de uma janela aberta não
  contam no limite.
- **Utilidade precisa ser não promocional** e ligada ao pedido do cliente. "Continue de
  onde parou" e reengajamento são marketing mesmo que o cliente tenha pedido. A Meta
  reclassifica sozinha um template de utilidade que pareça promoção (desde abril/2025
  pode ser instantâneo) e penaliza quem insiste: aviso, limite de utilidade, suspensão.
- **Qualidade do template** (verde, amarelo, vermelho) cai com bloqueios, denúncias e
  pouca leitura. Template vermelho pode ser pausado. Mensagem que o lead ignora derruba
  a qualidade de todos os envios.

### 2.3 Quanto custa hoje e quanto vai custar (estimativa por 1.000 leads de formulário)

| | Hoje | Proposto |
|---|---|---|
| 1º contato | 1.000 × marketing = R$ 321,70 (e parte nem é entregue) | 1.000 × utilidade = R$ 35,00 |
| 2º toque (20 min) | não existe | ~600 × utilidade = R$ 21,00 |
| 3º toque (3h, horário comercial) | ~600 × marketing (mesmo template) = R$ 193,00 | ~450 × marketing = R$ 144,80 |
| 4º toque (dia seguinte) | não existe | ~350 × marketing = R$ 112,60 |
| **Templates** | **~R$ 515** | **~R$ 313** |
| Conversa (texto livre) | 1.000 grátis/mês por número, depois R$ 0,035 | igual |

Mais toques, mais respostas e ~40% menos gasto em templates. Para leads de anúncio de
clique para WhatsApp, o custo vai a zero dentro da janela grátis.

---

## 3. Como estamos hoje (diagnóstico do código)

### 3.1 Entrada e primeira mensagem
- Lead Ads (`meta-lead-ads.ts:318`), site/n8n e CTWA (`meta-ctwa-intake.ts:88`) passam por
  `createLeadFromWebhookSync` e iniciam a qualificação (`conversation-state-machine.ts:476`).
- **Um template por empresa** para o evento FIRST_CONTACT (`message-policy-service.ts:429`).
  Não varia por origem, campanha ou anúncio.
- Texto atual: "Olá, *{{1}}*!😀 Recebemos sua solicitação de atendimento sobre planos de saúde
  pela {{2}}.⚓ Para encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas
  perguntas rápidas por aqui.⚡ Como deseja continuar?" Botões: Iniciar Atendimento, Falar com
  atendente, Não tenho interesse. **Categoria: MARKETING.**
- Variáveis fixas `[nome, nome_bot, "Âncora Saúde"]` (`conversation-state-machine.ts:686`):
  "Âncora Saúde" está escrito no código. Se o template aprovado usar `{{2}}` posicional sem
  mapeamento, `{{2}}` recebe o nome do bot e a mensagem sai "pela Ana" (conferir no WhatsApp Manager).
- Sai na hora, sem regra de horário. Se falhar, vai direto para espera manual, sem nova tentativa.

### 3.2 Depois da primeira mensagem
- Nenhum lembrete antes do tempo limite (15 a 30 min). Sem resposta: frio e espera manual.
- Uma única requalificação 3h depois, só em filas automáticas, com o mesmo template de marketing.

### 3.3 A conversa
- 6 perguntas obrigatórias: nome, tipo de plano, vidas, idade, cidade, e-mail.
- Não usa o formulário: pergunta de novo tipo de plano, vidas e CNPJ.
- Todo lead que responde tudo vira "quente" (pontuação por preenchimento chega a 100),
  então "quente" hoje não diferencia ninguém.

### 3.4 Medição, custo e regras da Meta
- Entrega e leitura são gravadas (`whatsapp_outbound_messages.deliveredAt/readAt`), mas
  nenhum relatório usa. Sem funil enviado → entregue → lido → respondeu.
- `stats-service.ts:80-83` usa status que não existem e limiares diferentes do motor (75/40 contra 80/50).
- O preço que vem no webhook (`pricing.category`, `billable`, `type`) é descartado.
- A janela de 24h não filtra por provedor: mensagem recebida no WAHA conta como janela aberta na Meta.
- Sem controle de categoria: não percebemos se a Meta reclassificar um template.
- A API de Conversões manda Qualificado/Quente só para Lead Ads; o `ctwa_clid` dos anúncios de
  clique para WhatsApp é guardado e nunca usado.

---

## 4. Por que os leads não respondem (hipóteses, da mais forte para a mais fraca)

1. **Não receberam.** Template de marketing cai no limite por pessoa (131049) e em quem lê pouco.
   Medir já na Fase 0: % de 131049 e % entregue sem leitura.
2. **A mensagem pede um clique sem valor.** "Iniciar Atendimento" é um passo burocrático. A
   primeira mensagem deve ser a primeira pergunta, com botões que já qualificam.
3. **"Não tenho interesse" como opção fácil**, ao lado de outras duas que parecem iguais.
4. **Nenhum lembrete.** Muita gente vê a mensagem e esquece; o 2º e o 3º toque costumam
   trazer uma parte grande das respostas.
5. **Mensagem genérica.** Não fala do que a pessoa pediu no anúncio (plano empresarial, Amil,
   família), então parece spam.
6. **Hora errada.** Lead da madrugada recebe, não responde e vira frio antes de acordar.
7. **Conversa longa.** 6 perguntas, incluindo e-mail, e repetindo o formulário.

---

## 5. O que muda (pilares)

### Pilar A. Primeira mensagem que já é a primeira pergunta
- Template de **UTILIDADE**, não promocional, que confirma o pedido e faz a pergunta que mais
  qualifica, com **botões de resposta**. Clicar no botão já abre a janela de 24h e já responde
  a pergunta 1.
- Botão de saída suave: "Agora não" em vez de "Não tenho interesse".
- Variáveis certas: nome, empresa (do cadastro da empresa, não do código), produto pedido.
- Escolha do template por **abordagem** (pilar E), não um único por empresa.

### Pilar B. Cadência de toques com custo controlado
| Toque | Quando | Categoria | Objetivo |
|---|---|---|---|
| T0 | imediato (24h por dia) | Utilidade | Confirmar pedido + pergunta 1 com botões |
| T1 | +20 min sem resposta | Utilidade | Lembrete neutro do pedido, mesma pergunta, botão "Prefiro ligação" |
| T2 | +3h, só entre 8h e 20h | Marketing | Outro ângulo (benefício concreto, prazo da cotação) |
| T3 | dia seguinte, 10h | Marketing | Oferecer ligação com horário em botões |
| T4 | +3 dias, 10h | Marketing | "Posso encerrar?" (mensagem de despedida, costuma ter alta resposta) |

Regras:
- Para no primeiro sinal: resposta, clique, "Agora não", opt-out, 131049 (espera 24h) ou bloqueio.
- No máximo 4 templates de marketing por lead em 7 dias.
- Lead de anúncio de clique para WhatsApp: tudo em texto livre ou interativo dentro da janela
  grátis, sem template.
- **Ligação em paralelo (decisão sua, seção 10):** sem resposta em 30 min no horário comercial,
  o lead vai para a distribuição marcado "Ligar", enquanto a cadência continua.

### Pilar C. Conversa curta
- Semear a memória com o formulário e o anúncio (tipo de plano, vidas, CNPJ, operadora, cidade)
  e pular o que já se sabe.
- 3 perguntas essenciais: para quem (botões), idades de todos (uma mensagem), cidade (lista).
  E-mail vira opcional, perguntado pelo corretor.
- Respostas por **botões e listas interativas** dentro da janela (gratuitos até 1.000/mês,
  depois R$ 0,035), em vez de texto livre.
- "Quente" passa a medir intenção real (prazo, já tem plano, urgência, pediu ligação,
  clicou rápido), não só preenchimento.

### Pilar D. Motor de experimentos (teste de abordagem, mensagem e pergunta)
- **Pontos testáveis:** template do T0, cadência (tempos e textos), ordem e forma das perguntas,
  abordagem por tipo de anúncio, texto do fechamento antes da distribuição.
- **Sorteio estável por lead** (hash do lead + experimento) com pesos por variante.
- **Métrica principal:** respondeu em 24h. Secundárias: qualificou, chegou quente, foi
  distribuído, virou venda, custo Meta por qualificado.
- **Vencedor automático (Fase 4):** depois de no mínimo ~330 leads por variante (detecta
  25% → 35% de resposta com 95% de confiança), o sistema passa a mandar mais tráfego para o
  vencedor (Thompson sampling) e mantém 10% explorando.
- **Proteções:** pausa a variante se a taxa de "Agora não"/bloqueio passar do limite, se a
  qualidade do template cair para amarelo, ou se a Meta reclassificar a categoria.
- **Tela:** `/qualificacao` › aba "Experimentos" no padrão de tabela (`DataTable`), clique abre
  a gaveta com o funil de cada variante e o botão "Tornar padrão".

### Pilar E. Abordagem por tipo de anúncio
Uma **abordagem** = template do T0 + cadência + perguntas + tom. Escolhida por regra:
origem (Lead Ads, clique para WhatsApp, site), nome da campanha, formulário, tipo de lead
(PF/PME), operadora pedida.

| Tipo de anúncio | Abordagem | Primeira pergunta |
|---|---|---|
| Plano individual/família | Familiar | Para quem é o plano? |
| Empresarial/CNPJ/MEI | PME | Quantas pessoas entram no plano? |
| Por profissão (adesão) | Adesão | Qual sua profissão? |
| Operadora específica (ex. Amil) | Operadora | Confirma que quer cotar {{operadora}}? |
| Preço/economia | Economia | Você já tem plano hoje? |
| Clique para WhatsApp | Conversa (grátis) | Botões de boas-vindas do anúncio |
| Site/Google | Direta | Para quem é o plano? |
| Reativação (lead antigo) | Retorno | Ainda está procurando plano? |

Convenção sugerida para o nome das campanhas: `[PF]`, `[PME]`, `[ADESAO]`, `[AMIL]`... no
começo do nome. A regra lê isso sem precisar configurar campanha por campanha.

### Pilar F. Custo e regras da Meta sob controle
- Gravar o `pricing` de cada status (categoria, cobrável, tipo) por mensagem.
- Painel: custo Meta por lead, por campanha, por abordagem e por lead qualificado.
- Detectar janela grátis de anúncio (FEP) e janela de 24h por provedor (corrigir o bug).
- Alertar quando a Meta reclassificar um template ou a qualidade cair; tratar 131049 com espera de 24h.

### Pilar G. Meta otimizando os anúncios para lead que responde
- API de Conversões: incluir anúncios de clique para WhatsApp (`ctwa_clid`,
  `action_source: business_messaging`) e um evento "Respondeu" além de Qualificado/Quente.
  Assim a Meta passa a entregar anúncio para quem tem perfil de responder, o que reduz a raiz
  do problema.
- Sequências de boas-vindas dos anúncios de clique para WhatsApp com botões de abertura
  ("Plano para mim", "Para minha família", "Para minha empresa").

---

## 6. Banco de templates novos (para enviar à Meta)

Regras para todos:
- Utilidade: sem preço, sem "promoção", sem "melhor", sem urgência comercial; sempre
  referindo o pedido feito pela pessoa.
- Marketing: pode ter benefício e convite, sempre com botão de saída ("Agora não").
- Variáveis nomeadas: `{{nome}}`, `{{empresa}}`, `{{produto}}`, `{{operadora}}`, `{{corretor}}`.
- Texto curto (até ~300 caracteres), um emoji no máximo, sem travessão.

### 6.1 Primeiro contato (T0), UTILIDADE

**T0-A Direta (padrão)**
> Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde na {{empresa}}. Para montar as opções certas, me conta: para quem é o plano?

Botões: `Só para mim` · `Para minha família` · `Para minha empresa`

**T0-B Pedido + tempo**
> Olá, {{nome}}. Seu pedido de cotação de plano de saúde chegou para a {{empresa}}. São 3 perguntas rápidas para eu preparar as opções. Para quem é o plano?

Botões: `Só para mim` · `Família` · `Empresa (CNPJ)`

**T0-C Corretor nomeado**
> Olá, {{nome}}, aqui é {{corretor}}, da {{empresa}}. Vi seu pedido de cotação de plano de saúde e vou cuidar dele. Para quem é o plano?

Botões: `Só para mim` · `Família` · `Empresa`

**T0-D Escolha do canal**
> Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde na {{empresa}}. Como prefere seguir?

Botões: `Por aqui no WhatsApp` · `Prefiro ligação` · `Agora não`

**T0-E Formulário (quando já sabemos o tipo)**
> Olá, {{nome}}. Recebemos seu pedido de cotação de {{produto}} na {{empresa}}. Para calcular, preciso das idades de quem vai entrar no plano. Quantas pessoas são?

Botões: `1 pessoa` · `2 a 3 pessoas` · `4 ou mais`

**T0-F PME**
> Olá, {{nome}}. Recebemos o pedido de cotação de plano de saúde empresarial na {{empresa}}. Para montar a proposta, quantas pessoas vão entrar no plano?

Botões: `2 a 5` · `6 a 29` · `30 ou mais`

**T0-G Adesão (por profissão)**
> Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde por adesão na {{empresa}}. Os planos por adesão dependem da profissão. Qual é a sua área?

Botões: `Saúde` · `Direito ou contabilidade` · `Outra`

**T0-H Operadora pedida**
> Olá, {{nome}}. Recebemos seu pedido de cotação do plano {{operadora}} na {{empresa}}. Para calcular, me conta: para quem é o plano?

Botões: `Só para mim` · `Família` · `Empresa`

**T0-I Já tem plano**
> Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde na {{empresa}}. Para comparar do jeito certo: você já tem plano hoje?

Botões: `Sim, quero trocar` · `Não tenho` · `Tenho pela empresa`

**T0-J Pedido de madrugada** (22h às 7h; pode ser só uma variação do horário)
> Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde na {{empresa}}. Quando puder, me conta para quem é o plano e eu já deixo as opções prontas.

Botões: `Só para mim` · `Família` · `Empresa`

### 6.2 Lembrete (T1, +20 min), UTILIDADE
**T1-A**
> {{nome}}, seu pedido de cotação de plano de saúde continua aberto aqui na {{empresa}}. Falta só saber para quem é o plano.

Botões: `Só para mim` · `Família` · `Prefiro ligação`

**T1-B**
> {{nome}}, para concluir seu pedido de cotação na {{empresa}} preciso de uma resposta rápida: o plano é para quantas pessoas?

Botões: `1` · `2 a 3` · `4 ou mais`

### 6.3 Reengajamento (T2, T3, T4), MARKETING
**T2-A Benefício concreto**
> {{nome}}, consigo comparar as principais operadoras para você e mostrar as opções que cabem no seu bolso, com a rede de hospitais de cada uma. Quer que eu prepare?

Botões: `Quero ver` · `Prefiro ligação` · `Agora não`

**T2-B Prova social local**
> {{nome}}, aqui na {{empresa}} ajudamos famílias e empresas do Rio a escolher o plano certo, sem custo pela consultoria. Posso montar sua cotação?

Botões: `Pode montar` · `Tenho dúvidas` · `Agora não`

Confirmar antes de enviar à Meta: a consultoria é mesmo sem custo para o cliente.

**T3-A Ligação**
> {{nome}}, se for mais fácil, um especialista da {{empresa}} pode te ligar e explicar as opções em 5 minutos. Qual o melhor horário?

Botões: `Manhã` · `Tarde` · `Noite`

**T4-A Despedida**
> {{nome}}, não quero te incomodar. Posso encerrar seu pedido de cotação de plano de saúde ou ainda quer receber as opções?

Botões: `Quero receber` · `Pode encerrar`

### 6.4 Reativação de lead frio (7 a 30 dias), MARKETING
**R-A**
> {{nome}}, há alguns dias você pediu uma cotação de plano de saúde na {{empresa}}. Ainda está procurando? Posso te mandar as opções atualizadas.

Botões: `Ainda procuro` · `Já resolvi` · `Agora não`

**R-B Mudança de cenário**
> {{nome}}, as operadoras atualizaram tabelas e condições este mês. Quer que eu refaça sua cotação de plano de saúde?

Botões: `Quero` · `Agora não`

Usar só quando houver reajuste ou mudança real de tabela no mês (a Meta e o cliente penalizam promessa falsa).

### 6.5 Anúncio de clique para WhatsApp (grátis, sem template)
Sequência de boas-vindas no anúncio:
- Texto: "Olá! Sou da {{empresa}}. Vou te ajudar a encontrar o plano de saúde certo. Para quem é o plano?"
- Botões de abertura: `Plano para mim` · `Para minha família` · `Para minha empresa`
- Mensagem pré-preenchida: "Quero uma cotação de plano de saúde"

### 6.6 O que fazer com o template atual
- Manter `lead_qualification_start` só como reserva até os novos serem aprovados.
- Não usar mais no reenvio de reativação (reativação usa R-A/R-B, que são marketing de fato).

---

## 7. Experimentos iniciais (o que testar primeiro)

| # | Teste | Variantes | Hipótese | Métrica |
|---|---|---|---|---|
| E1 | Primeiro contato | Atual (marketing) × T0-A × T0-D | Pergunta com botões e utilidade dobra a resposta | Respondeu em 24h |
| E2 | Lembrete | Sem T1 × T1-A em 20 min × T1-A em 60 min | O lembrete curto traz +30% de resposta | Respondeu em 24h |
| E3 | Abertura | T0-A (para quem) × T0-I (já tem plano) | Falar da situação atual gera mais conversa | Qualificou |
| E4 | Perguntas | Idades uma por uma × todas numa mensagem | Uma mensagem só reduz abandono | Qualificou / tempo |
| E5 | E-mail | Obrigatório × opcional | Tirar o e-mail aumenta qualificados sem perder venda | Qualificou e venda |
| E6 | Ligação | Sem ligação × "Prefiro ligação" no T1 | Parte dos leads quer ligação e hoje se perde | Distribuído e venda |
| E7 | Corretor nomeado | T0-A × T0-C | Nome de pessoa passa confiança | Respondeu |

Cada teste roda até ~330 leads por variante. Com o volume atual, 1 a 3 semanas por teste;
dá para rodar 2 em paralelo em pontos diferentes (ex.: E1 no primeiro contato e E4 nas perguntas).

---

## 8. Implementação por fases e componentes

> Cada fase em branch própria a partir da última feature branch. Migrations: próximo número
> livre acima do maior de todas as branches (hoje 0210). Migrations e deploy são do Vinicios.

### Fase 0. Corrigir e medir (base de tudo)
| Componente | O que fazer | Arquivos |
|---|---|---|
| Preço por mensagem | Gravar `pricing` do status (categoria, cobrável, tipo) em `whatsapp_outbound_messages` | `communication-channels/service.ts:496`, `types.ts:46`, migration |
| Funil de qualificação | Relatório enviado → entregue → lido → respondeu (15 min / 24h) → qualificou → quente → distribuído → venda, por template, origem e campanha, com custo Meta | nova tela em `/qualificacao` (tabela + gaveta) |
| Janela de 24h | Filtrar pelo provedor; texto livre de IA e automações checa janela antes | `message-policy-service.ts:323`, `ai-qualification/service.ts:371,452`, `automations/engine.ts:337` |
| Template e variáveis | Conferir no WhatsApp Manager a categoria e o `{{2}}` do template atual; empresa vinda do cadastro, não do código | `conversation-state-machine.ts:686` |
| Falha da 1ª mensagem | Nova tentativa em erro temporário; 131049 espera 24h e avisa | `conversation-state-machine.ts:90`, `meta-delivery-failure.ts` |
| Relatório de IA | Corrigir status e limiares de `stats-service.ts:80` | `ai-qualification/stats-service.ts` |
| Categoria e qualidade | Webhook de mudança de categoria e qualidade do template: guardar e alertar o diretor | `template-sync-service.ts`, webhook Meta |

### Fase 1. Primeira mensagem e cadência
| Componente | O que fazer |
|---|---|
| Templates novos | Submeter T0-A, T0-D, T0-F, T0-G, T1-A, T2-A, T3-A, T4-A, R-A (seção 6) |
| Botões como resposta | Clique no botão grava a resposta da pergunta 1 e segue para a pergunta 2 (`ai-agent/quick-reply.ts`) |
| Cadência | Sequência T0 a T4 com horários, paradas e limite de marketing; liga o "Sem resposta à 1ª mensagem" (`followup-service.ts:53`) |
| Formulário na memória | Semear memória com `sourceMetadata` (tipo, vidas, CNPJ, operadora, cidade) e pular perguntas |
| Conversa de 3 perguntas | Botões e listas interativas; e-mail opcional |
| Ligação em paralelo | Se aprovado: lead sem resposta em 30 min vai à distribuição marcado "Ligar" |

### Fase 2. Experimentos
| Componente | O que fazer |
|---|---|
| Tabelas | `qualification_experiments`, `qualification_experiment_variants`, `lead_experiment_assignments` (migration) |
| Sorteio | Hash estável por lead, pesos por variante, segmento por origem/campanha |
| Pontos plugados | T0, cadência, ordem/forma das perguntas, fechamento |
| Tela | `/qualificacao` › Experimentos: tabela, gaveta com funil por variante, "Tornar padrão" |
| Proteções | Pausa automática por opt-out, bloqueio, qualidade ou reclassificação |

### Fase 3. Abordagem por anúncio e Meta otimizando
| Componente | O que fazer |
|---|---|
| Abordagens | Cadastro de abordagem (T0 + cadência + perguntas + tom) e regras por origem, campanha (`[PME]`...), formulário, operadora |
| Anúncio de clique para WhatsApp | Janela grátis: cadência só com texto livre/interativo; sequências de boas-vindas por anúncio |
| API de Conversões | Incluir clique para WhatsApp (`ctwa_clid`) e evento "Respondeu" |
| "Quente" real | Pontuação por intenção (prazo, já tem plano, pediu ligação, rapidez) |

### Fase 4. Sistema que aprende
- Vencedor automático por Thompson sampling com 10% explorando.
- Horário de envio aprendido por origem (quando cada tipo de lead mais responde).
- IA sugere novas variantes a partir das conversas que viraram venda (situações aprendidas
  já existem em `/atendimento/situacoes`), sempre com aprovação do diretor antes de enviar à Meta.

---

## 9. Metas e como acompanhar

| Indicador | Hoje | Meta 30 dias | Meta 90 dias |
|---|---|---|---|
| Entregue na 1ª mensagem | medir (Fase 0) | > 95% | > 97% |
| Respondeu em 24h | medir | +40% sobre hoje | +80% sobre hoje |
| Tempo até a 1ª resposta | medir | < 15 min mediana | < 10 min |
| Lead qualificado | medir | +30% | +60% |
| Custo Meta por lead qualificado | medir | -40% | -50% |
| Venda por lead | medir | acompanhar | +20% |

---

## 10. Decisões que preciso de você

1. **Ligação em paralelo:** lead sem resposta em 30 min (horário comercial) vai para o corretor
   ligar enquanto a cadência continua? (recomendo sim)
2. **E-mail obrigatório na qualificação?** (recomendo tirar e testar no E5)
3. **Limite de toques:** até 4 templates de marketing em 7 dias por lead está bom?
4. **Corretor nomeado na primeira mensagem (T0-C):** usar o nome de quem vai atender ou um nome fixo?
5. **Convenção de nome de campanha** (`[PF]`, `[PME]`, `[ADESAO]`, `[AMIL]`): o time de marketing topa?
6. **Quem aprova templates e experimentos:** só o diretor?

---

## Fontes

- Tabela de tarifas BRL e níveis de volume, efetiva em 1/10/2026, developers.facebook.com/docs/whatsapp/pricing
- Preço de mensagens sem template (atendimento) a partir de 1/10/2026, developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- Limite de marketing por pessoa (131049), developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits
- Categorias de template (utilidade × marketing), developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- Qualidade de template, developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality
- Sequências de boas-vindas de clique para WhatsApp, developers.facebook.com/documentation/business-messaging/whatsapp/ctwa/welcome-message-sequences


---

## 11. O que foi implementado (21/10/2026, branch `feat/qualificacao-turbo`)

| Pilar | Implementado | Onde |
|---|---|---|
| A. Primeira mensagem | Escolha por abordagem (direta, PME, operadora, clique para WhatsApp), template de madrugada, envio por template nomeado com volta automática ao template configurado se falhar | `qualification-turbo/approaches.ts`, `service.ts`, `ai-agent/conversation-state-machine.ts` (início) |
| A. Templates | Pacote de 11 templates (utilidade e marketing) criado pelo CRM na Meta com parâmetros nomeados; tela com status, categoria, qualidade e aviso de reclassificação | `templates-pack.ts`, `actions.ts`, `/qualificacao/turbo` |
| B. Cadência | Lembretes T1 a T4 com horários, intervalo mínimo, parada na resposta, "Agora não", corretor, limite 131049 (espera 24h, desiste na 2ª); substitui a requalificação de +3h quando o T2 está aprovado | `cadence.ts`, `cadence-job.ts`, `/api/internal/jobs/qualification-cadence` (runbook) |
| C. Conversa curta | Formulário do anúncio entra na memória (tipo de plano, vidas, cidade, CNPJ); se já respondeu "para quem", a 1ª mensagem pergunta só como seguir | `form-seed.ts` |
| C. Objeções | Recusa suave ("já tenho", "agora não", "tá caro"...) é lida pela IA no contexto: ela pergunta o motivo e oferece um caminho; a 2ª recusa encerra com educação; o cliente que volta com interesse reabre a conversa. Só comando explícito ("sair", "não me mande") encerra na hora | `ai-agent/quick-reply.ts`, `qualification-interpreter.ts`, `conversation-state-machine.ts` |
| C. Entendimento | "Pra minha filha / pro meu pai" = plano individual para outra pessoa; "eu e minha filha" = familiar | `ai-agent/memory.ts` |
| C. Botões | "Prefiro ligação" passa o lead para um corretor; botões de continuar seguem a qualificação | `quick-reply.ts` |
| D. Experimentos | Sorteio estável por lead, Thompson sampling depois de 50 envios por variante, 10% explorando; liga/desliga "Aprender sozinho" | `experiments.ts` |
| F. Custo | Preço por mensagem do webhook gravado (migration 0211, opcional); funil mostra custo real ou estimado | `communication-channels/service.ts`, `drizzle/0211_whatsapp_outbound_pricing.sql` |
| Painel | Aba "Funil de qualificação" no `/dashboard` | ver `2026-10-21-painel-diretor.md` |

Ainda não feito: cadência para quem respondeu e parou no meio (abandono), cadência dos leads de
clique para WhatsApp, evento "Respondeu" na API de Conversões com `ctwa_clid`, sequências de
boas-vindas nos anúncios e correção do filtro de provedor da janela de 24h.
