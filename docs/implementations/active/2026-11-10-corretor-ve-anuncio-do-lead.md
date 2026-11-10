# Corretor vê o anúncio que trouxe o lead

Status: plano para revisão (10/11/2026). Nada foi implementado.

Pedido do Vinicios em 10/11/2026: "Adicione um plano para que o corretor receba informações do anuncio que o lead dele foi gerado".

## Resumo

O corretor passa a ver **o que o cliente viu**: a imagem, o título e o texto do anúncio, e se o cliente entrou pelo formulário ou pelo WhatsApp. Com isso ele puxa a conversa pelo que o cliente clicou ("Vi que você se interessou pelo plano a partir de R$ 99 para o Rio").

Ele **não** passa a ver o nome da campanha, do conjunto ou do anúncio, IDs, verba, gasto, data de captura nem a página. Esses dados continuam como hoje, só para gestão.

Isso muda uma decisão de produto: em 16/10/2026 ficou decidido que "a origem do lead continua oculta ao corretor" (citada na DEC-150, `docs/decision-log.md`, e implementada em `src/features/leads/broker-visibility.ts`). O plano propõe uma exceção estreita, e não a revogação: a origem interna continua oculta, e só o conteúdo público do anúncio aparece. Ver a pergunta 1.

## Mapa do que existe hoje

### Como o lead chega da Meta

| Entrada | Onde | O que se guarda do anúncio |
| --- | --- | --- |
| Formulário (Lead Ads) | `src/app/api/webhooks/meta/lead-ads/route.ts` → `src/features/communication-channels/meta-lead-ads.ts` | `ad_id`, `adset_id`, `campaign_id`, `form_id`, `campaign_name` (`fetchMetaLead`, :213-228). **Não pede** `ad_name`, `adset_name` nem nada do criativo. |
| WhatsApp do anúncio (CTWA) | `communication-channels/service.ts:346` → `meta-ctwa-referral.ts` → `meta-ctwa-intake.ts` | Do `referral` da Meta guarda só `source_id` (ad), `headline` (160), `source_url` e `ctwa_clid`. **Descarta** `body` e `media_type`. O tipo (`types.ts:13-21`) nem declara `image_url`, `video_url` ou `thumbnail_url`. O `referral` bruto não é salvo. |
| WhatsApp do anúncio sem `referral` | `meta-ctwa-intake.ts` (`ingestChannelLead`, :164-200) | Nada do anúncio: `withoutReferral: true`. |
| WAHA | `src/features/waha-cadence/*` | Nada. O WAHA não recebe o `referral` da Meta. |
| Importação CSV de marketing | `src/features/marketing-import/service.ts:327-352` | Só **nomes** do arquivo (campanha, conjunto, anúncio, formulário). Sem IDs da Meta. |
| Webhook genérico (site, landing) | `create-lead-from-webhook.ts:33-48` | Só `source`. O `metadata` (UTMs) é descartado. Não existe coluna de UTM. |

### Onde fica gravado no lead (`src/shared/db/schema.ts:375-467`)

- Colunas: `sourceChannel`, `sourceCampaign`, `sourceAd`, `sourceForm` (IDs no Lead Ads e no CTWA, nomes no CSV), `metaCampaignId`, `metaAdSetId`, `metaAdId`, `metaFormId`, `metaPageId`, `capturedAt`.
- `sourceMetadata` (jsonb):
  - Lead Ads: `campaignName`, `campaignResolution`, `tipoPlano`, `tipoCnpj`, `operadora`, `formAnswers` ("Pergunta: resposta", até 40), `unmappedFormFields`, `pageId`.
  - CTWA: `entry: "whatsapp"`, `adsLabel`, `campaignName`, `adHeadline`, `adUrl`, `ctwaClid`.
- Cidade e número de vidas do formulário não têm coluna. Ficam como texto em `formAnswers` (a IA e o `client-info.ts` leem por regex).
- Lead repetido do mesmo telefone: só preenche o que estava vazio (`create-lead-from-webhook-sync.ts:160-198`).

### Cache da Meta (tabelas do sync, `meta-sync-service.ts`)

- `meta_campaigns`: nome, status, **`dailyBudget` e `lifetimeBudget`**. Nunca podem chegar ao corretor.
- `meta_ad_sets`: nome, status.
- `meta_ads`: `adId`, nome, status, `leadGenFormId`. **Nenhum dado de criativo** (imagem, texto, título). O sync já pede `creative{object_story_spec}`, mas usa só para achar o formulário.
- `meta_lead_forms`: nome.
- Não existe tabela de gasto ou de insights. O cliente da Graph (`meta-graph-client.ts`) não tem chamada de criativo nem cache de resposta.
- O OAuth de marketing já pede `ads_read` (`meta-marketing-oauth-url.ts:18`), que basta para ler o criativo do anúncio.

### O que o corretor vê hoje sobre a origem

| Tela | Hoje |
| --- | --- |
| Conversa do lead no Lite (`/leads/[id]`, `LightLeadDetail variant="panel"`) | Nada. `page.tsx:431-432` e `:480-482` zeram `origem` e `sourceCampaign`; `:318-336` nem busca nomes de campanha para o corretor Lite. O bloco "fulano chegou da campanha X" existe em `lead-script.ts:85-89,356`, mas está desligado no modo painel. |
| Ficha (`?ficha=1`) e drawer | Nada de origem. Aparecem as **respostas do formulário**, `tipoPlano`, `tipoCnpj` e `operadora` no cartão "Informações do cliente" (`client-info.ts:109-163`). |
| Lista e fila | `stripLeadOriginForBroker` (`broker-visibility.ts`) zera origem, IDs e data de captura antes de mandar ao navegador. |
| Aviso de lead novo (in-app e push) | Só o nome: "Você recebeu o lead {nome} para atender." (`send-push-helper.ts:325-344`, `lead-assigned-notification.ts:113-125`, `realtime-sync-provider.tsx:225-243`). |
| Oferta pelo WhatsApp (Meta) | Template aprovado `new_lead_broker`, com 4 parâmetros fixos: `cargo`, `corretor_nome`, `lead_nome`, `produto_interesse` (`templates.ts:71-73`). `produto_interesse` é o resumo de uma linha (até 240) de plano, vidas, idades, cidade e CNPJ (`buildLeadOfferSummary`, `client-info.ts:170-194`). |
| Oferta pelo WhatsApp (WAHA, número da empresa) | Texto livre das variantes (`team-notices/variants.ts:55-72`), com `broker`, `lead`, `product` e `link`. |

### Permissões hoje

- O corretor só abre o lead dele (`buildLeadScopeWhere`, `lead-authorization.ts:108-112`) ou um lead com oferta pendente para ele (`page.tsx:99-145`).
- O contato só aparece depois do aceite (`lead-contact-privacy.ts`).

## O que vale mostrar ao corretor

Pensando no corretor leigo, que só quer saber como começar a conversa:

| Dado | Mostrar? | Por quê |
| --- | --- | --- |
| Imagem (ou capa do vídeo) do anúncio | Sim | É o que o cliente viu. Ajuda a lembrar "ah, é o da família". |
| Título do anúncio | Sim | Costuma ser a promessa ("Plano PME a partir de R$ 89"). |
| Texto do anúncio | Sim, cortado em 2 linhas, inteiro ao tocar | Traz a oferta e a região. |
| Como entrou: formulário ou WhatsApp | Sim, em uma palavra | Muda a abordagem: no formulário o cliente ainda não falou com ninguém. |
| Respostas do formulário, produto, operadora, cidade | Já aparecem em "Informações do cliente" | Não repetir no cartão novo. |
| Nome de campanha, conjunto, anúncio e formulário | Não | São nomes internos ("PME RJ CBO teste 3"), não ajudam na conversa e entregam a estratégia da corretora. |
| IDs, página, conta, público, verba, gasto, data e hora de captura | Não | Ficam como hoje, só na gestão. |

"Oferta prometida" não existe como dado estruturado na Meta. Ela está no título e no texto do anúncio. Ver a pergunta 4 para um campo opcional escrito pela gestão.

## Proposta por tela

Tudo no estilo Lite (`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`): escopo `.arc-venancor`, Plus Jakarta Sans só 400/500, título 14/500, apoio 12 em `--text-muted`, superfície `--surface`, `--radius-panel` e `--shadow-resting`, sem cor nova, sem travessão no texto, sem CTA azul (o cartão é informativo; o CTA da tela continua o atual).

### 1. Conversa do lead (Lite): cartão "De onde veio"

- **Onde:** novo filho do slot `details` de `LightLeadDetail` (`src/features/broker-workspace/components/light-lead-detail/index.tsx:107-113`), logo acima de "Informações do cliente". No desktop fica na coluna lateral; no celular entra no "Ver dados" (BottomSheet), como os outros cartões. Nada fica fixo a mais na tela da conversa.
- **Conteúdo (fechado):**
  - Título "De onde veio" e, ao lado, um texto de apoio de uma palavra: "Formulário do anúncio" ou "WhatsApp do anúncio".
  - Miniatura 56×56 (raio de controle do Lite), título do anúncio em 14/500 e texto em 2 linhas.
- **Ao tocar:** abre o BottomSheet (celular) ou `Sheet` (desktop) já usados no Lite, com a imagem grande, o título e o texto completo. Sem link para a Meta (o corretor não tem acesso à conta).
- **Componente:** `AdOriginCard`, em `src/features/broker-workspace/components/light-lead-detail/`, seguindo o padrão do `ClientInfoCard` (`identity-zone.tsx:72-90`). A ficha (`?ficha=1`) usa o mesmo componente.
- **Vídeo:** mostra a capa com um ícone de play decorativo (`aria-hidden`). Não toca.
- **Carrossel e criativo dinâmico:** mostra o primeiro card e o primeiro título/texto.
- **Acessibilidade:** `aria-labelledby` no título; a miniatura tem `alt` com o título do anúncio.

O bloco "chegou da campanha X" do roteiro da conversa (`lead-script.ts:356`) continua desligado: duas fontes da mesma informação ferem a densidade.

### 2. Aviso de lead novo (in-app e push)

- Acrescenta uma linha curta à mensagem, só quando há título de anúncio:
  - Hoje: "Você recebeu o lead Maria para atender."
  - Proposto: "Você recebeu o lead Maria para atender. Veio do anúncio "Plano PME a partir de R$ 89"."
- Título do anúncio cortado em 60 caracteres, com reticências.
- Sem imagem no aviso: o `DynamicNotice` e o push não têm espaço para ela, e a imagem já está no cartão.
- Onde: `notifyNewLead` (`send-push-helper.ts:325-344`, incluindo as variantes de redistribuição :308-324) e o plugin de atribuição manual (`lead-assigned-notification.ts:113-125`).

### 3. Oferta pelo WhatsApp

Segue a regra de canal explícito: o envio da oferta já mostra e deixa escolher Meta ou WAHA em Avisos da equipe; o anúncio entra nos dois, cada um com a sua validação.

- **WAHA (número da empresa, texto livre):** nova variável `ad` em `NoticeFields` (`outbound-service.ts:858-868`), com uma linha "Anúncio: <título>" nas variantes de `team-notices/variants.ts:55-72`, só quando há título. Não precisa de aprovação da Meta.
- **Meta (template oficial):** o `new_lead_broker` tem 4 parâmetros fixos, e a política bloqueia outros templates (`message-policy-service.ts:241-244`).
  - Recomendado: submeter um template novo, `new_lead_broker_anuncio`, com o quinto parâmetro `anuncio`.
  - Enquanto ele não for aprovado, a oferta pela Meta segue com o template atual, sem o anúncio.
  - Depois de aprovado, entra no mapa de `templates.ts:18,24` e na lista permitida da política, com a mesma checagem de parâmetros (`template-parameters.ts:83-101`).
  - Quando o lead não tem anúncio, o parâmetro vai como "Não informado"; a Meta não aceita parâmetro vazio.
  - Não usar o `produto_interesse` para isso: ele já tem um significado e o limite de 240 caracteres.
- **Valor do parâmetro:** só o título, uma linha, até 60 caracteres, sem quebra nem tabulação. Nunca respostas do formulário (podem ter dado de saúde, regra de `meta-lead-ads.ts:140-145`).
- A mensagem de confirmação depois do aceite (`lead_assignment_confirmed`) não muda.

## De onde vem cada dado

| Dado | Formulário (Lead Ads) | WhatsApp do anúncio (CTWA) |
| --- | --- | --- |
| Tipo de entrada | `sourceChannel` + `sourceMetadata.entry` (já gravado) | `sourceMetadata.entry = "whatsapp"` (já gravado) |
| Título | API da Meta pelo `metaAdId`, com cache | `adHeadline` (já gravado); completa pela API se vazio |
| Texto | API da Meta, com cache | `referral.body`, hoje **descartado**: passa a ser gravado |
| Imagem ou capa | API da Meta (`thumbnail_url` / `image_url` do criativo), copiada para o nosso armazenamento | `referral.image_url` / `thumbnail_url`, hoje **não lido**: passa a ser lido; se faltar, API da Meta |

### Cache do criativo

- **Tabela nova `meta_ad_creatives`** por empresa e `ad_id`:
  - `title`, `body`, `media_type`, `image_storage_path`, `source` (`graph` ou `referral`), `fetched_at`, `fetch_error`.
  - Sem nome de campanha, sem verba.
  - A migração recebe o maior número de drizzle de qualquer branch `origin` no dia de implementar, com o `.sql` correspondente no journal.
- **Busca na Graph:** método novo em `meta-graph-client.ts`, `fetchAdCreative(adId)`, com `fields=creative{title,body,thumbnail_url,image_url,object_story_spec,asset_feed_spec}`.
  - Usa o token da conexão de marketing (`meta_connections`, mesmo de `meta-ctwa-intake.ts:31-41`, com `ads_read`).
  - Usa o mesmo controle de ritmo do cliente (200 ms e parada em 75% do uso).
- **Quando busca:**
  1. Na entrada do lead, em segundo plano, sem atrasar a criação nem a distribuição. Se o criativo do `ad_id` já está no cache e tem menos de 7 dias, não busca.
  2. Na abertura do cartão, se ainda não há cache: mostra o que já estiver gravado (o título do CTWA, por exemplo) e não espera a Meta.
  3. Opcional: o sync de anúncios (`meta-sync-service.ts`) passa a gravar título e texto do `object_story_spec` que ele já recebe, sem chamada extra.
- **Imagem:** as URLs da Meta (`scontent…`) expiram. A imagem é baixada uma vez, reduzida para a miniatura e uma versão média, e guardada no armazenamento já usado pelas mídias das conversas (`waha-cadence/message-media.ts`). O corretor recebe uma URL assinada de curta duração, nunca a URL da Meta.
- **Falhas:** anúncio apagado, token sem `ads_read` ou limite da Meta → grava `fetch_error`, tenta de novo em 24 h no máximo 3 vezes e mostra o cartão só com o que houver.

### Leads antigos

O cartão vale para leads novos e para os já existentes com `metaAdId` ou `adHeadline`. Os antigos buscam o criativo na primeira abertura (item 2 acima), sem carga em massa.

## Privacidade e permissões

1. **Projeção própria e fechada.** O corretor recebe um objeto `adContext` com só `entry`, `title`, `body`, `mediaType` e `imageUrl` assinada, montado por `buildBrokerAdContext` em `src/features/leads/broker-ad-context.ts`.
   - `stripLeadOriginForBroker` continua igual: origem, campanha, IDs e data de captura seguem zerados no que vai para o navegador.
   - Um teste falha se o `adContext` tiver qualquer chave fora dessa lista (por exemplo `campaignName`, `dailyBudget`, `metaAdId`).
2. **Só o lead dele.** A projeção é carregada na mesma consulta autorizada da página do lead (`buildLeadScopeWhere` + a checagem de oferta pendente de `page.tsx:99-145`).
   - A rota que assina a URL da imagem refaz essa checagem pelo `leadId`, e não pelo `adId`, para o corretor não conseguir listar criativos de outros leads.
3. **Antes do aceite.** O conteúdo do anúncio não identifica o cliente e pode aparecer na oferta pendente. O contato continua escondido até o aceite, como hoje. Ver a pergunta 3.
4. **Nada de custo.** `meta_campaigns.dailyBudget`/`lifetimeBudget` e qualquer gasto ficam fora da projeção, do aviso e da mensagem. Não se cria tabela de gasto neste plano.
5. **Saúde (LGPD).** Respostas do formulário não vão para aviso, push nem WhatsApp. No cartão novo também não: elas seguem só em "Informações do cliente", onde já estão hoje.
6. **Auditoria.** A primeira visualização do anúncio pelo corretor em cada lead grava `lead.ad_context.viewed` em `audit_logs`, seguindo o padrão do `broker_performance.viewed`.
7. **Registro da decisão.** Entra no `docs/decision-log.md` uma DEC nova revendo a regra de 16/10/2026 só para o conteúdo público do anúncio. Uma linha nova no `docs/business-rules.md` diz o que o corretor vê e o que não vê.

## Quando o lead não veio de anúncio

- **Sem cartão, sem aviso e sem linha na mensagem.** Não aparece "Sem anúncio" nem um cartão vazio: menos coisa na tela.
- Casos: lead manual, importação CSV (só há nomes internos, que não são mostrados), webhook do site ou landing page, WhatsApp de anúncio sem `referral`, número WAHA e indicação.
- **Anúncio sem nenhum dado** (criativo apagado e sem título gravado): o cartão também não aparece.
- **Tem título, mas não tem imagem:** o cartão aparece só com o texto, sem área cinza no lugar da imagem.
- No template da Meta, o parâmetro vai como "Não informado" (a Meta não aceita parâmetro vazio).

## Flag para desligar

- `feature_broker_ad_context`, escopo tenant, padrão `false`, no catálogo `src/shared/feature-flags/catalog.ts`.
  - A chave real é `feature_broker_ad_context_<tenantId>`.
  - Helper em `src/features/leads/broker-ad-context-flag.ts`, no modelo de `src/features/live-status/flag.ts`.
- O Super-admin liga e desliga por empresa em `super-admin/tenants/[tenantId]`, com action no modelo de `updateLiveStatusPilotAction` e auditoria em `platform_audit_logs`.
- **Desligada:**
  - Some o cartão, a linha do aviso e a variável da mensagem WAHA.
  - A oferta pela Meta volta ao `new_lead_broker`.
  - A busca e o cache do criativo continuam rodando, para que ligar de novo não dependa da Meta.

## Fases

| Fase | O que entra | Pronto quando |
| --- | --- | --- |
| F0. Diagnóstico (só leitura, banco de produção só com autorização) | Nos últimos 30 dias: quantos leads têm `metaAdId`, quantos CTWA têm `adHeadline`, quantos anúncios distintos. Teste da busca do criativo em 3 anúncios reais com o token da conexão. | Sabemos a cobertura real e se o token lê o criativo. |
| F1. Captura | CTWA passa a guardar `body`, `media_type` e as URLs de mídia do `referral`. Tabela `meta_ad_creatives`, `fetchAdCreative`, cópia da imagem e busca em segundo plano na entrada. | Lead novo de anúncio tem criativo no cache em até 1 min. |
| F2. Projeção e cartão | `buildBrokerAdContext`, URL assinada, flag, `AdOriginCard` no painel e na ficha. Testes de privacidade e de lead sem anúncio. | Com a flag ligada, o corretor vê o cartão; desligada, nada muda. |
| F3. Aviso de lead novo | Linha do anúncio no in-app e no push. | Aviso com título cortado em 60 caracteres. |
| F4. Oferta pelo WhatsApp | Variável `ad` no WAHA. Submissão do `new_lead_broker_anuncio`; troca automática quando aprovado. | WAHA com a linha; Meta com o template novo depois da aprovação. |
| F5. Registro | DEC no decision-log, regra no business-rules e runbook se a nova tentativa de busca virar Scheduled Task do Coolify. | Documentos atualizados. |

Não há job novo obrigatório: a nova tentativa pode ir no job de sync da Meta que já existe. Se virar job próprio, entra em `docs/runbooks/coolify-scheduled-tasks.md`.

## Perguntas em aberto

1. **Rever a regra "a origem do lead fica oculta ao corretor" (16/10/2026)?**
   - Recomendado: exceção só para o conteúdo público do anúncio (imagem, título, texto e tipo de entrada). Nome de campanha, IDs, data de captura e custos seguem ocultos.
   - Alternativa: mostrar também o nome da campanha.
2. **Mostrar o nome do anúncio quando não há criativo?**
   - Recomendado: não. Nome interno não ajuda na conversa; sem criativo, não aparece cartão.
3. **O anúncio aparece antes do aceite da oferta?**
   - Recomendado: sim. Ajuda o corretor a decidir rápido e não expõe o cliente (o contato segue escondido).
4. **A gestão pode escrever a "promessa do anúncio" por campanha** (ex.: "Primeira mensalidade grátis até 30/11"), mostrada no cartão?
   - Recomendado: não agora. Primeiro usar o título e o texto do anúncio e medir se faltou algo; o campo manual fica para uma segunda etapa.
5. **Template novo da Meta para a oferta?**
   - Recomendado: sim, `new_lead_broker_anuncio` com um quinto parâmetro. Enquanto não é aprovado, a Meta segue sem o anúncio e o WAHA já mostra.
6. **Imagem no armazenamento próprio ou URL da Meta?**
   - Recomendado: armazenamento próprio com URL assinada. As URLs da Meta expiram e mostrariam imagem quebrada em leads de dias atrás.
7. **Mostrar uma frase pronta para puxar a conversa** ("Vi que você se interessou por…")?
   - Recomendado: não neste plano. O design do Lite pede dado direto, sem texto explicativo; o corretor já tem os assistentes de IA da conversa para sugerir a abertura.
8. **Guardar UTMs do webhook genérico** (site e landing) para um cartão parecido no futuro?
   - Recomendado: fora deste plano. Hoje o `metadata` é descartado e não há o que mostrar; vira um plano próprio se o site passar a gerar volume.
