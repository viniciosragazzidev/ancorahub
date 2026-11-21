# Dossiê: recuperação de leads (cadência, estados, scoring, regras)

Pesquisa feita em 21/11/2026 para embasar o plano `docs/implementations/active/2026-11-21-recuperacao-de-leads.md`.

**Legenda das fontes:**
- **[P]**: a fonte primária ou a página oficial foi lida nesta pesquisa.
- **[S]**: o número ou a afirmação vem de fonte secundária, ou a primária não pôde ser conferida.
- **fornecedor**: material de quem vende a ferramenta. Serve como direção, não como prova.

Nenhum número aparece aqui sem fonte. Onde a fonte é fraca, isso está escrito ao lado.

## 0. Resumo: o que a pesquisa sustenta e o que não sustenta

| Afirmação | Força | Uso no plano |
|---|---|---|
| Responder em minutos, e não em horas, multiplica o contato e a qualificação | Média (estudo de fornecedor com acadêmico, 2007; HBR 2011) | A IA já responde na hora. O gargalo é o **tempo até o corretor** depois de quente, que vira SLA medido. |
| Quase todo ganho de tentativas acaba por volta da 6ª tentativa | Média (Velocify, fornecedor, base de cerca de 3,5 milhões de leads) | Cadência de recuperação com **no máximo 6 toques** antes de virar nutrição. |
| Cadências curtas e concentradas no início (1–2 dias entre toques na 1ª semana) contatam mais | Fraca a média (MarketingProfs, Outreach, Apollo) | Toques concentrados nos primeiros 7 dias. |
| "80% das vendas exigem 5 ou mais follow-ups" | **Mito, sem estudo de origem** | Não usar. |
| Mensagem livre só dentro da janela de 24h; fora dela, só template; reengajamento é template de **marketing** | Forte (Meta, oficial) | Retomadas livres dentro da janela; depois, templates de marketing aprovados. |
| Limite de marketing por usuário (131049): esperar 24h ou mais, nunca insistir | Forte (Meta, oficial) | A regra já existe na cadência turbo e vira regra geral. |
| WhatsApp não oficial (WAHA) para envio automático em massa viola as diretrizes | Média (diretrizes do WhatsApp lidas por trechos) | **Frios em escala só pela API oficial.** WAHA fica para conversa 1:1 do corretor. |
| Condição de saúde é dado sensível e não pode servir para selecionar risco | Forte (LGPD art. 11; ANS SN 27/2015), com conferência pendente do texto oficial | O score **nunca** usa condição de saúde. Idade pode ser usada. |
| Fit × engajamento com decaimento é o modelo usual de scoring | Média (HubSpot, RD Station) | Score em matriz A1–D4 com decaimento semanal do engajamento. |
| Benchmark de recuperação em corretora de plano de saúde | **Não encontrado** | O ponto de partida é a linha de base do nosso próprio banco. |

## 1. Tempo de resposta ao lead

- **Ligar em 5 minutos, e não em 30, aumenta em cerca de 100 vezes a chance de contato e em cerca de 21 vezes a chance de qualificar.**
  - Fonte: *Lead Response Management Study*, InsideSales.com com James Oldroyd (MIT), 2007. Slides: https://pt.slideshare.net/slideshow/insidesales-mit/1809952 e PDF: https://www.mortech.com/hs-fs/hub/25649/file-13535879-pdf/docs/mit_study.pdf **[S]**
  - Limites: não é artigo revisado por pares (são dados de plataforma de fornecedor analisados por um acadêmico). A base citada é de cerca de 6 empresas, mais de 15 mil leads e mais de 100 mil ligações. O estudo não mediu fechamento de venda.
- **A própria InsideSales reconhece os limites do estudo.**
  - Fonte: "Rethinking our LRM study", Ken Krogue, 2009, https://www.insidesales.com/rethinking-our-lrm-study-about-lead-response-management/ **[P]**
  - O texto admite que não se sabe se ligar na hora para lead de baixa intenção aumenta vendas. Também separa quem mostra sinal de compra de quem é só curioso.
- **Leads online "envelhecem" em horas.**
  - Fonte: Oldroyd, McElheran e Elkington, "The Short Life of Online Sales Leads", *Harvard Business Review* 89(3), 2011, registro em https://scholarsarchive.byu.edu/facpub/9711 **[S]**
  - O artigo não foi lido. Fontes secundárias atribuem a ele uma auditoria de 2.241 empresas dos EUA, tempo médio de resposta de cerca de 42 horas e chance de qualificar cerca de 7 vezes maior quando o contato sai em até 1 hora. Os números variam entre as fontes; use "~7x em 1h" só com essa ressalva.
- **Só 7% de 433 empresas responderam em até 5 minutos, e 55% não responderam em 5 dias úteis.**
  - Fonte: Drift, *Lead Response Survey*, 2017/2018 (cliente oculto), reproduzido em https://salesloft.com/resources/blog/lead-response-survey **[S]**
- **Clientes da Chili Piper convertem cerca de 70% dos inbound qualificados em reunião**, contra 30–40% sem a ferramenta.
  - Fonte: Chili Piper, 2024, https://www.chilipiper.com/post/form-conversion-rate-benchmark-report **[S, fornecedor]**

**Leitura para a Âncora:** a IA já responde em segundos: 87% de quem respondeu fez isso nos primeiros 20 minutos, segundo a linha de base do plano. O tempo que falta medir é **quente → primeiro contato do corretor**.

## 2. Número de tentativas e intervalos

- **93% dos leads convertidos foram alcançados até a 6ª tentativa.** Leads que exigem mais de 7 tentativas convertem 45% menos.
  - Fonte: Velocify, *The Ultimate Contact Strategy*, cerca de 3,5 milhões de leads de mais de 400 empresas. Slides: https://www.slideshare.net/Velocify/the-ultimate-contact-strategy e resumo: https://natlawreview.com/article/study-reveals-best-contact-strategies-optimal-lead-conversion **[S, fornecedor]**
  - Um relatório posterior da Velocify diz que tentar 7–8 vezes, e não 6, rende ganho mínimo.
- **"80% das vendas exigem 5 ou mais follow-ups" não tem estudo identificável.**
  - A origem rastreável é uma coluna de Robert Clay na Marketing Donut, por volta de 2009, sem fonte: https://marketingdonut.co.uk/blog/13/10/five-ways-to-reach-new-markets
  - Análise da origem: https://ainora.lt/blog/sales-follow-up-80-percent-5-contacts-study-2026 **[S]**
  - Ver também a VentureBeat: https://venturebeat.com/marketing/these-incredible-sales-stats-everyone-cites-are-actually-completely-false
  - **Não usar.**
- **A taxa de contato cai 63% depois de 7 tentativas.** Cadências de 6–8 dias, com 1–2 dias entre tentativas, tiveram o maior contato.
  - Fonte: MarketingProfs, 2019, https://www.marketingprofs.com/charts/2019/40610/the-optimal-sales-cadence-frequency-and-duration-benchmarks **[S]** (página bloqueada; autor e amostra não confirmados).
- **Não existe ótimo validado para o número de toques.** Fornecedores sugerem 6–15 toques em 2–4 semanas, concentrados no início.
  - Fontes: Outreach, https://outreach.io/resources/blog/email-cadence, e Apollo, https://www.apollo.io/insights/what-is-the-ideal-number-of-touches-in-an-outbound-sales-sequence **[S, fornecedores, B2B outbound]**
- ***Fanatical Prospecting*, Jeb Blount (Wiley, 2015), "Regra dos 30 dias":** a prospecção feita num mês sustenta o pipeline dos 90 dias seguintes.
  - Fontes: https://www.oreilly.com/library/view/-/9781119144755/ e resumo em https://readingraphics.com/library/fanatical-prospecting/ **[S]**
- ***Predictable Revenue*, Aaron Ross e Marylou Tyler (2011):** cada papel separado (quem prospecta, quem fecha, quem cuida da conta).
  - Fonte: https://forentrepreneurs.com/predictable-revenue **[S]**
  - No nosso caso, o princípio vira: a IA qualifica, o corretor fecha, e a recuperação é um papel próprio, automatizado.

## 3. Frameworks de qualificação: o que serve para plano de saúde

- **BANT** (Budget, Authority, Need, Timeline), atribuído à IBM.
  - Fonte: https://builtin.com/articles/bant **[S]**
  - Serve: faixa de mensalidade, quem decide (titular, RH, sócio no PME) e prazo (fim do plano atual, carência).
- **GPCTBA/C&I** (HubSpot).
  - Fonte: https://blog.hubspot.com/sales/gpct-sales-qualification **[S]**
  - Serve: **consequências negativas** (ficar sem cobertura, reajuste do plano atual) e **implicações positivas** (rede desejada). São gatilhos de reengajamento.
- **MEDDIC** (PTC, cerca de 1996).
  - Fonte: https://meddicc.com/resources/who-created-meddic **[S, fornecedor de treinamento]**
  - Serve só para **PME/empresarial** (comprador econômico, critério e processo de decisão).
- **SPIN Selling** (Neil Rackham, 1988).
  - Fonte: https://www.routledge.com/SPIN-Selling-1st-Edition/Rackham/p/book/9780566076893 **[S]**
  - Serve: perguntas de implicação no roteiro do corretor, não no bot.
- **Gap Selling** (Keenan, 2018).
  - Fonte: https://builtin.com/articles/gap-selling **[S]**
  - Serve: registrar o plano atual (ou a falta dele) e o resultado desejado.
- **CHAMP:** origem não verificada. Citar só como variante do BANT que começa pelo problema.
- **Cuidado legal (seção 7):** nenhum framework justifica perguntar condição de saúde na qualificação.

## 4. Como os CRMs modelam estados

- **HubSpot, lifecycle stages:** Subscriber, Lead, MQL, SQL, Opportunity, Customer, Evangelist, Other.
  - As atualizações automáticas **só avançam** o estágio.
  - Fonte: https://knowledge.hubspot.com/records/use-lifecycle-stages **[P]**
- **HubSpot, Lead Status padrão:** New, Open, In Progress, Open Deal, Unqualified, Attempted to Contact, Connected, Bad Timing. Mesma fonte **[P]**.
  - "Tentativa de contato", "Conectado" e "Momento ruim" são os estados de recuperação de que precisamos.
- **Salesforce:** os rótulos de status são personalizáveis. O que define "convertido" é a flag `IsConverted`, não o rótulo.
  - Fonte: https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_leadstatus.htm **[S]**
  - Leitura para nós: separar o **estado** (máquina) do **rótulo** (tela).
- **RD Station:** scoring em dois eixos, **Perfil** (A a D) × **Interesse** (1 a 4). A1 é o melhor, D4 o pior.
  - Fontes: https://www.rdstation.com/blog/marketing/o-que-e-lead-scoring/ e https://reportei.com/lead-scoring-e-nota-de-interesse/ **[S]**
- **Kommo:** etapas configuráveis. O Salesbot dispara quando o lead entra numa etapa e uma condição é atendida (por exemplo: WhatsApp → lead → bot pergunta → tarefa para o vendedor).
  - Fontes: https://support.kommo.com/docs/set-up-digital-pipeline-triggers e https://support.kommo.com/docs/pipelines-overview **[S]**
- **Pipedrive:** não verificado.

## 5. Lead scoring

- **HubSpot:** a nota de **fit** vem de propriedades (perfil), a de **engajamento** vem de ações e interações. Tem **decaimento** (perde X% depois de um período) e teto de pontos.
  - Fonte: https://knowledge.hubspot.com/scoring/build-lead-scores **[S]**
- **RD Station:** perfil bom com interesse baixo vai para **nutrição**; perfil fraco com interesse alto pode ser oportunidade.
  - Fonte: https://www.rdstation.com/blog/vendas/processo-comercial/qualificacao-de-leads/ **[S]**
- **Salesforce Einstein:** não verificado. Fica de fora.
- **Aplicação para a Âncora (inferência nossa, não de fonte):**
  - **Fit** = tipo de plano, vidas, faixa etária, cidade atendida, PME com CNPJ.
  - **Engajamento** = respondeu, em quanto tempo, pediu ligação, abriu cotação, com decaimento semanal.
  - **Nunca** usar condição de saúde.

## 6. WhatsApp Business Platform: regras da Meta

- **Cobrança por mensagem entregue desde 01/07/2025.** Categorias: Marketing, Utility, Authentication. Mensagem livre (*service*) só dentro da **janela de 24h**, que abre ou reinicia a cada mensagem do cliente.
  - Fonte: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing **[P]**
- **O que a página oficial mostrava em 21/11/2026** **[P; reconferir antes de orçar]**:
  - Utility dentro da janela de 24h passou a ser cobrada em 01/10/2026.
  - Mensagens de serviço: franquia de 1.000 por mês por número.
  - A **janela gratuita de quem chega por anúncio Click-to-WhatsApp pode durar até 7 dias**.
  - Cobrança em BRL no Brasil desde 01/07/2026.
- **Classificação de template:** conteúdo misto ou vago vira **Marketing**, e a Meta pode reclassificar. **Reengajamento de lead é marketing.**
  - Fonte: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization **[S]**
- **Limite de marketing por usuário (131049):** o limite se adapta à taxa de leitura recente da pessoa.
  - Depois do erro, esperar pelo menos 24h. Insistir antes pode bloquear novas tentativas por até 24h.
  - Se o cliente responder, abre a janela, e o marketing dentro dela não conta no limite.
  - Fonte: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits/ **[P]**
- **Limites de envio:** usuários únicos fora da janela, em 24h móveis, **por portfólio**. Níveis: 250, 2.000, 10.000, 100.000 e ilimitado. O nível sobe com qualidade boa e uso de pelo menos metade do limite.
  - Fonte: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits **[P]**
- **Opt-in obrigatório**, com o nome da empresa. Bloqueios e denúncias derrubam a qualidade e limitam o envio.
  - Fonte: https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in **[P]**
- **WhatsApp não oficial (WAHA, WhatsApp Web automatizado):** as diretrizes citam cliente não oficial, mensagem em massa e automação como violações, e o WhatsApp anunciou ação judicial contra envio em massa.
  - Fontes: https://www.whatsapp.com/legal/messaging-guidelines **[S]** e https://www.securityweek.com/whatsapp-will-take-legal-action-against-automated-or-bulk-messaging **[S]**
  - Não há taxa de banimento confiável publicada; o "68%" que circula não tem fonte.
  - **Risco real: perder o número e as conversas, sem recurso.**

## 7. Brasil: LGPD, saúde, ANS, CDC, "Não Me Perturbe"

- **Dado de saúde é sensível** (LGPD art. 5º, II; hipóteses do art. 11). O **art. 11, §5º** proíbe operadoras de tratar dado de saúde para selecionar risco.
  - Fonte: Lei 13.709/2018, https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm **[S; conferir a numeração no texto oficial]**
  - **Idade não é dado sensível. Doença preexistente é.**
- **Seleção de risco também é vedada pela ANS:** Súmula Normativa 27/2015; RN 557/2022; venda eletrônica pela RN 413/2016.
  - Fonte: https://www.gov.br/ans/pt-br/assuntos/contratante/legislacao-regulacao-em-saude-complementar **[S; confirmar com o jurídico]**
- **Legítimo interesse (art. 7º, IX):** a ANPD publicou guia em fev/2024, com teste de balanceamento documentado.
  - Fontes: https://www.gov.br/anpd/pt-br/assuntos/deliberacoes-do-conselho-diretor-1/circuitos-deliberativos-2024/cd-03-2024-votos.pdf e https://www.mattosfilho.com.br/unico/anpd-legitimo-interesse-lgpd/ **[S]**
  - Leitura segura: quem pediu cotação dá base para o retorno sobre aquela cotação. O reengajamento depois disso precisa de **opt-out funcional em toda mensagem**, honrado na hora (direito de oposição, art. 18, §2º).
- **"Não Me Perturbe" não cobre planos de saúde** hoje; cobre telecom e consignado.
  - Fontes: https://teletime.com.br/05/09/2025/nao-me-perturbe-atinge-13-milhoes-de-cadastros-recurso-agora-e-obrigatorio/ e https://teletime.com.br/29/06/2021/baigorri-defende-que-mais-setores-entrem-na-iniciativa-nao-me-pertube/ **[S]**
- **Bloqueio de telemarketing em SP:**
  - A Lei 17.334/2021 estendeu o bloqueio a mensagens por aplicativo, e a ALESP indica que foi revogada pela Lei 17.832/2023.
  - Fontes: https://www.al.sp.gov.br/repositorio/legislacao/lei/2008/lei-13226-07.10.2008.html e https://tiinside.com.br/15/03/2021/procon-sp-proibe-telemarketing-com-uso-de-whatsapp-bots-e-sms/ **[S]**
  - **Verificar o regime vigente em SP e no RJ antes de mandar mensagem ativa a frios.**
- **CDC (Lei 8.078/1990):** práticas abusivas (art. 39) e oferta e publicidade (arts. 30–37). Não verificado nesta pesquisa; confirmar com o jurídico.

## 8. Reengajamento por WhatsApp no Brasil (fontes fracas)

- **81,3% de taxa média de resposta no WhatsApp** (Ollow, 2025), https://www.abcdacomunicacao.com.br/estudo-revela-que-whatsapp-atinge-81-de-taxa-de-resposta-e-acelera-substituicao-de-crms-tradicionais-por-ia/ **[S, fornecedor]**
  - O número mistura conversas em andamento. **Não serve de benchmark para lead frio.**
- **O WhatsApp concentrou 97% das mensagens conversacionais em 2025** (Panorama RD Station 2026), https://www.rdstation.com/pesquisas/panoramas-rd-station/edicao-2026/conversas/cenario-2025/ **[S]**
- **Taxas de resposta por tipo de mensagem:** 10–20% em transmissão promocional e 30–50% em mensagem de serviço. CTA simples passa de 60%; tarefa complexa fica em um dígito.
  - Fonte: agregada pela Respond.io, https://respond.io/pt/blog/whatsapp-marketing-roi **[S; a fonte primária da Blip não foi verificada]**
- **Não há benchmark confiável de recuperação em corretora de plano de saúde.** A comparação é com a nossa linha de base.

## 9. Testes A/B

- **Não parar o teste quando "deu significativo".** Fixar o tamanho da amostra antes.
  - Fonte: Evan Miller, "How Not To Run an A/B Test", 2010, https://www.evanmiller.org/how-not-to-run-an-ab-test.html **[P parcial]**. Calculadora: https://www.evanmiller.org/ab-testing/
- **Kohavi, Tang e Xu, *Trustworthy Online Controlled Experiments* (Cambridge, 2020):**
  - Uma métrica principal (**OEC**) alinhada ao objetivo de longo prazo.
  - Checar o **Sample Ratio Mismatch** (divisão real × esperada, teste qui-quadrado) em todo experimento.
  - Fonte: https://assets.cambridge.org/97811087/24265/excerpt/9781108724265_excerpt.pdf **[S]**
- **Ordem de grandeza** (cálculo nosso, fórmula padrão de duas proporções, α = 0,05 bicaudal, poder de 80%):
  - De 10% para 15%: **cerca de 690 leads por braço**.
  - De 10% para 12%: vários milhares por braço.
  - Com cerca de 500 frios por semana, **testar só diferenças grandes e uma variável por vez**.

## 10. Implicações para a cadência (síntese)

1. **T+0:** a IA responde e qualifica. Ver seção 1.
2. **Quente:** corretor em até 15 min no horário comercial, com SLA medido. Ver seção 1.
3. **Dentro da janela aberta** (24h, ou até 7 dias se veio de anúncio CTWA): até 3 retomadas livres, antes de a janela fechar. Ver seção 6.
4. **Depois da janela:** templates de marketing em D+2, D+4 e D+7, uma pergunta de resposta simples por mensagem. Ver seções 2 e 8.
5. **Depois do 6º toque sem resposta:** nutrição mensal com gatilho concreto (reajuste, fim de carência, mudança de faixa etária). Ver seções 2 e 3.
6. **Em qualquer passo:** erro 131049 → esperar 24h ou mais; opt-out em toda mensagem; pausar se a qualidade do número cair. Ver seções 6 e 7.
7. **Frios em escala só pela API oficial**, nunca por WAHA. Ver seção 6.

## Pendências de verificação

- Ler o artigo da HBR de 2011.
- Ler o texto oficial da LGPD (art. 11, §5º, e art. 18).
- Ler a lei paulista 17.832/2023, a RN 557/2022 e as normas de venda online da ANS.
- Reconferir a página de preços da Meta (utility e service cobrados desde 01/10/2026; janela CTWA de 7 dias) antes de orçar.
- Verificar Pipedrive, Einstein e a origem do CHAMP, se forem ser citados.
