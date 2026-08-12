# Pesquisa — integração nativa Meta: WhatsApp Tech Provider e Lead Ads

**Data:** 2026-08-12  
**Escopo:** requisitos para substituir a configuração manual por conexões diretas, multi-tenant e auditáveis no CRM.  
**Fontes:** somente documentação e coleções oficiais publicadas pela Meta. Os documentos `developers.facebook.com` limitaram a leitura automatizada (HTTP 429); os links abaixo são os endereços canônicos que devem ser conferidos no painel Meta antes de ir a produção.

## Decisão de arquitetura recomendada

Há **dois fluxos de autorização**, com objetivos e credenciais distintas. Eles podem aparecer em uma única experiência de “Conectar Meta”, mas **não devem ser tratados como um único token nem como o mesmo tipo de cadastro**:

1. **WhatsApp Cloud API:** Embedded Signup para Tech Provider, usando a configuração de Login for Business (`config_id`) aprovada. O resultado vincula uma WABA e um ou mais `phone_number_id` ao tenant.
2. **Marketing / Lead Ads:** Facebook Login for Business/OAuth com escopos de marketing e páginas. O resultado autoriza descoberta e seleção explícita de Business, conta de anúncios, página, formulário, pixel/dataset e a inscrição de `leadgen` na página escolhida.

Essa separação evita que um token de WhatsApp seja usado para consultar ativos de Ads, reduz permissões e permite revogar cada produto independentemente. A identidade do tenant continua sendo obtida da sessão no servidor; IDs retornados pelo navegador são apenas candidatos a validar novamente na Graph API.

## 1. WhatsApp nativo — Embedded Signup de Tech Provider

### O que o Tech Provider habilita

O Embedded Signup é o fluxo hospedado pela Meta para o cliente criar ou escolher o Business Portfolio, a WhatsApp Business Account (WABA) e o número que será usado pela Cloud API. Para Tech Provider, o CRM inicia o fluxo em sua própria tela e recebe o resultado para finalizar a associação no servidor. A coleção oficial separa Embedded Signup, Cloud API e Webhooks, confirmando que são superfícies distintas da mesma plataforma. [Coleção oficial WhatsApp Business Platform no Postman](https://www.postman.com/meta/whatsapp-business-platform/collection/du6gzjv/embedded-signup)

Os links fornecidos no dashboard (`business.facebook.com/messaging/whatsapp/onboard/?app_id=...&config_id=...`) são o **Hosted Embedded Signup**: uma forma válida de iniciar o fluxo hospedado, porém com experiência pouco controlável. Para uma experiência realmente nativa no CRM, usar a configuração de **Facebook Login for Business + Embedded Signup** pelo SDK JavaScript da Meta e manter o Hosted ES somente como fallback para navegador, popup ou suporte.

### Contrato do frontend

1. Carregar o SDK oficial da Meta em uma tela autenticada do CRM.
2. Iniciar `FB.login` a partir de gesto explícito do Diretor autorizado, com a `config_id` de Embedded Signup e resposta de **código**; nunca pedir ou manipular `app_secret` no navegador.
3. Escutar a mensagem de sessão do popup somente durante a tentativa ativa. Validar `event.origin` contra `https://www.facebook.com` e `https://web.facebook.com`, além de validar o formato/evento `WA_EMBEDDED_SIGNUP` e os estados `FINISH`, `CANCEL` e `ERROR` antes de mudar a interface.
4. Tratar a mensagem de conclusão como confirmação de UX, não como autorização final. O servidor troca o código e consulta a Graph API para confirmar WABA, telefone e escopos antes de persistir a conexão.
5. Usar `sessionInfoVersion: "3"` e `version: "v4"` apenas porque a configuração fornecida no App Dashboard foi criada para essa variante. Esses valores, `app_id` e `config_id` devem ser configuração pública versionada, não constantes espalhadas pela UI.

**Importante:** `postMessage(..., "*")`, aceitar mensagens de qualquer origem ou confiar nos IDs enviados pelo popup abre caminho para associação de ativo incorreto. A origem precisa ser allowlisted e o servidor deve cruzar os identificadores com a conta autorizada na Meta.

### Finalização exclusivamente no servidor

Após receber o código/resposta do fluxo:

1. Registrar tentativa de conexão, ator, tenant e estado `pending` em auditoria, sem token ou PII no log.
2. Trocar o código pela credencial usando App ID e App Secret apenas no servidor, conforme o fluxo de token da Meta. [Facebook Login — acesso a tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/)
3. Validar a credencial e recuperar os identificadores retornados/permitidos pela Graph API.
4. Cifrar token em repouso, armazenar expiração/escopos e vincular WABA e `phone_number_id` de modo único ao tenant. Nunca devolver a credencial ao browser.
5. Inscrever a WABA/canal nos eventos implementados e concluir em `active` somente após a validação do webhook e um teste sintético de envio/recebimento.

### Configuração de App e webhooks

No App Dashboard, a configuração de Embedded Signup precisa estar ligada ao app em produção e ao domínio de produção do CRM. A Meta também exige um endpoint de webhook verificável, público e HTTPS; o endpoint deve responder ao desafio de verificação e validar a assinatura de cada POST. [Cloud API — Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)

Assinar inicialmente apenas eventos que já tenham processamento e tela operacional: `messages` e status de mensagem. A associação da WABA ao app é uma chamada server-side a `POST /{waba-id}/subscribed_apps`. Eventos de qualidade, conta e templates só devem ser habilitados quando houver persistência, visibilidade e procedimento de resposta. Para a operação Tech Provider, considerar `account_update` quando a configuração da Meta o exigir; validar esse requisito na configuração aprovada do parceiro antes do go-live. [Embedded Signup — documentação oficial](https://developers.facebook.com/docs/whatsapp/embedded-signup/)

Para esse produto, solicitar e aprovar separadamente `whatsapp_business_management` e `whatsapp_business_messaging`. Não acrescentar escopos de Marketing à configuração de WhatsApp apenas por conveniência.

## 2. Lead Ads nativo — OAuth de Marketing separado

### O fluxo correto

Lead Ads não deve ser iniciado pelo URL de onboarding de WhatsApp. O CRM usa Facebook Login for Business/OAuth para obter uma autorização de marketing, com `state` de uso único, TTL curto e vínculo prévio à tentativa/tenant do servidor. O callback recebe apenas `code` e `state`; troca de token, descoberta de ativos, seleção e persistência ocorrem no servidor.

A tela do Diretor deve listar somente ativos que a Graph API confirmou para a autorização atual: Business Portfolio, páginas, contas de anúncios, campanhas, conjuntos, anúncios, formulários, pixels e datasets. A escolha grava referências por tenant, nunca uma coleção global de ativos. A leitura do lead ocorre pelo `leadgen_id` recebido no webhook. [Lead Ads — retrieving leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)

### Permissões e revisão

Os escopos mínimos variam com o que for habilitado. O desenho deve solicitar em ondas e mostrar a justificativa ao usuário:

| Capacidade | Escopos/autorizações a validar no App Review |
|---|---|
| Listar e selecionar Páginas | `pages_show_list`, `pages_read_engagement` |
| Inscrever app em `leadgen` da Página | `pages_manage_metadata` |
| Ler dados do lead | `leads_retrieval` |
| Ler contas/campanhas/anúncios | `ads_read`; `ads_management` somente se o produto for criar/editar campanhas |
| Selecionar/gerenciar ativos de Business | `business_management`, somente se realmente necessário |

Permissões com dados de leads ou gestão de ativos normalmente demandam o nível de acesso e a revisão aplicável no App Dashboard. A implementação não deve anunciar que um ativo está “conectado” só porque aparece no popup: a Graph API precisa confirmar acesso e cada seleção deve ser auditada. [Referência de permissões da Meta](https://developers.facebook.com/docs/permissions/reference/) · [Webhooks da Graph API](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)

### Recebimento e recuperação

1. Configurar um único callback público de Lead Ads com verificação e assinatura válidas.
2. Para cada página selecionada, chamar a inscrição da página no campo `leadgen`; não presumir que a assinatura do app é global.
3. No evento, resolver o tenant por `page_id` já associado no banco; nunca por valor do payload ou do cliente.
4. Buscar `leadgen_id` no servidor, persistir ledger idempotente e encaminhar ao intake transacional de leads.
5. Permitir pausar/desconectar Página, campanha ou fonte sem apagar histórico; remover assinatura quando cabível e registrar a ação.

## 3. Segurança, privacidade e operação

- Aplicar `state` criptograficamente aleatório, uso único, expiração curta e vínculo ao usuário/tenant para qualquer callback OAuth.
- Não usar fallback de chave de cifra em produção, não manter App Secret em `NEXT_PUBLIC_*`, e não aceitar token colado pelo cliente como rota padrão.
- Cifrar tokens em repouso com rotação/versionamento; mascarar IDs e nunca registrar tokens, `code`, assinatura, payload bruto de lead ou conteúdo de conversa.
- Validar assinatura antes de interpretar ou persistir eventos; usar deduplicação do ID externo e fila/outbox para evitar reentrega duplicada.
- Manter kill switches do Super-admin separados para WhatsApp e Lead Ads, com estado reversível e auditoria de ativar, alterar, desconectar e reprocessar.
- Publicar política de privacidade, URL de exclusão de dados e cumprir Data Use Checkup/obrigações de revisão aplicáveis ao app. [Data Use Checkup](https://developers.facebook.com/docs/development/release/data-use-checkup/) · [Data Deletion Callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/)

## 4. Lacunas observadas no código atual

Esta é uma leitura do repositório, não uma exigência da Meta:

1. A tela de Meta Ads abre o URL de onboarding de WhatsApp para conectar Ads e WhatsApp juntos. Isso deve ser dividido em dois conectores e dois estados de conexão.
2. O callback de Lead Ads envia `postMessage` com `targetOrigin: "*"`, e a tela receptora não valida `event.origin`. Corrigir antes de usar o fluxo em produção.
3. A troca de OAuth e a descoberta de ativos ocorrem no callback antes de o servidor amarrar explicitamente `state` a usuário e tenant. Criar uma tentativa persistida, com TTL e consumo único.
4. A UI ainda oferece colagem de access token. Manter somente em ferramenta administrativa de diagnóstico, protegida, auditada e desabilitada por padrão; não como conexão principal de Diretor.
5. Os defaults públicos de App/Config ID devem migrar para configuração central validada por ambiente; App Secret, token técnico, verify token e chave de cifra continuam exclusivamente no servidor.

## 5. Plano de implementação sugerido

1. **Decisão e configuração:** registrar a substituição da conexão manual, mapear permissões aprovadas na Meta e cadastrar domínios/callbacks de produção.
2. **Núcleo de autorização:** criar entidade `meta_connection_attempt` com produto (`whatsapp` ou `marketing`), estado, nonce/state, ator, tenant, expiração e auditoria.
3. **WhatsApp:** implementar SDK/Embedded Signup, endpoint server-side de conclusão, validação Graph, cifra e associação WABA/número; manter Hosted ES como fallback explícito.
4. **Lead Ads:** implementar Facebook Login for Business com `state`, callback seguro, descoberta server-side e seleção dos ativos confirmados; nenhuma dependência de WhatsApp.
5. **Webhooks:** consolidar validação de desafio/HMAC, deduplicação e ledger; inscrever `messages` por WABA e `leadgen` por página somente após confirmação local.
6. **Governança:** kill switch por produto, configuração editável pelo Super-admin, logs de auditoria sem segredos e telas de status/erro/reconexão.
7. **Testes:** unitários para state/origin/assinatura/isolamento; integração com payloads sintéticos; homologação Meta com uma WABA, página e formulário de teste; teste observado de reconexão e revogação.

## Referências oficiais

- [Meta — Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/)
- [Meta — implementação do Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation)
- [Meta — Onboarding customers as a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider)
- [Meta — App Review para Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/app-review)
- [Meta — WhatsApp Cloud API Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Meta — Facebook Login access tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/)
- [Meta — Facebook Login: manual flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)
- [Meta — Marketing API Lead Ads: retrieving leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)
- [Meta — Graph API Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
- [Meta — permissions reference](https://developers.facebook.com/docs/permissions/reference/)
- [Meta — Data Use Checkup](https://developers.facebook.com/docs/development/release/data-use-checkup/)
- [Meta — Data deletion callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/)
- [Meta — WhatsApp Business Platform official Postman collection](https://www.postman.com/meta/whatsapp-business-platform/collection/du6gzjv/embedded-signup)
