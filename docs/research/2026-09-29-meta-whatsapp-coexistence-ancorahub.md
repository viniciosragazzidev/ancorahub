# Pesquisa — coexistência oficial do WhatsApp no AncoraHub

**Data:** 2026-09-29  
**Escopo:** entender o onboarding de coexistência oficial Meta e comparar com a integração WhatsApp Cloud API existente. Pesquisa; nenhuma implementação foi feita.

## Resumo

A coexistência permite que o mesmo número continue no aplicativo WhatsApp Business e também use a Cloud API. É tecnicamente compatível com a direção atual do AncoraHub, mas **a integração existente ainda não oferece coexistência**: o cadastro atual é o fluxo padrão da Cloud API.

Há bastante infraestrutura reaproveitável — canal por tenant, token cifrado, envio Cloud API, validação de assinatura do webhook e resolução do tenant por `phone_number_id`. O trabalho específico é maior que ativar uma opção: precisa oferecer o ramo correto do Embedded Signup, pular o registro padrão do telefone, acompanhar a sincronização e processar os novos eventos sem confundi-los com mensagens de clientes.

## Como o fluxo oficial funciona

1. Um Diretor inicia no AncoraHub o Embedded Signup configurado pela Meta para usuários existentes do WhatsApp Business App. A opção deve ser apresentada separadamente do cadastro de um número novo, para deixar claro que o número continuará no aplicativo.
2. No fluxo Meta, a empresa seleciona/autoriza seus ativos e associa o número que já usa no WhatsApp Business App; confirma essa associação no próprio aplicativo e pode autorizar a sincronização do histórico.
3. A janela devolve um código de autorização e IDs de ativos. O navegador envia somente esses dados; o servidor troca o código, valida WABA e telefone na Graph API, deriva o tenant da sessão autenticada, cifra o token e inscreve o app na WABA.
4. O backend confirma que o telefone está em coexistência (a documentação descreve `is_on_biz_app = true` e `platform_type = CLOUD_API`). **Não deve chamar `/{phone_number_id}/register`**: o telefone já está registrado; a própria documentação Meta manda pular essa etapa.
5. O sistema inicia/acompanha a sincronização de contatos e, quando autorizada pela empresa, mensagens anteriores. A documentação consultada estabelece uma janela de 24 horas para iniciar a sincronização após o onboarding; perdê-la exige desfazer o onboarding e repetir o fluxo.
6. Depois, mensagens de clientes seguem pelo webhook padrão `messages`; mensagens enviadas por uma pessoa no aplicativo chegam separadamente em `smb_message_echoes` e precisam aparecer como mensagens da empresa no histórico do CRM. Eventos `history` e `smb_app_state_sync` abastecem o histórico e contatos sincronizados.

Fluxo resumido:

```text
Diretor inicia Coexistência
  → Meta autoriza o número já usado no WhatsApp Business App
  → servidor troca o código, valida ativos e salva o canal com segurança
  → servidor NÃO registra o telefone novamente
  → sincronização de contatos/histórico + novos webhooks
  → CRM e aplicativo continuam atendendo o mesmo número
```

## Requisitos e ressalvas indicados pela Meta

- A documentação de coexistência exige que a solução já seja Tech Provider ou Solution Partner, use Embedded Signup com registro de sessão e consiga receber/processar os webhooks.
- A página consultada aponta WhatsApp Business App versão 2.24.17 ou superior e país compatível. Como esses critérios podem mudar, devem ser conferidos novamente no App Dashboard e na documentação antes da homologação.
- Para liberar Embedded Signup, a coleção oficial da Meta indica App Review e Advanced Access para `business_management` e `whatsapp_business_management`. O envio pela Cloud API também depende da autorização de mensagens correspondente (`whatsapp_business_messaging`) no token/integração.
- Coexistência não equivale a espelhar todas as funções do aplicativo: a documentação lista conversas em grupo como não sincronizadas/não suportadas pela API, mudanças em alguns recursos do aplicativo e limite fixo de 20 mensagens por segundo para números em coexistência.
- Mensagens enviadas manualmente pelo aplicativo não abrem, não estendem e não alteram a janela de atendimento da Cloud API. Portanto, uma resposta enviada pelo corretor no telefone não deve ser tratada como se renovasse a janela de 24 horas para mensagens livres enviadas pelo CRM.
- O cliente pode desconectar a plataforma pelo próprio WhatsApp Business App; a Meta informa que isso gera `account_update` com `PARTNER_REMOVED`. O AncoraHub precisaria refletir a desconexão e interromper o envio do canal sem apagar o histórico.

## O que existe hoje no AncoraHub

Verificação do código e dos documentos locais:

- O cadastro é iniciado em `src/features/communication-channels/components/meta-embedded-signup-card.tsx`. Ele usa Embedded Signup v4, mas lança o fluxo padrão (`feature: "whatsapp_embedded_signup"`) e só reconhece `FINISH`, `CANCEL` e `ERROR`; não reconhece `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`.
- `completeMetaEmbeddedSignupAction` em `src/features/communication-channels/actions.ts` troca o código no servidor, valida os ativos, persiste token cifrado e associa o número ao tenant. Isso fornece uma base reutilizável.
- A finalização atual sempre tenta registrar o número com `registerMetaPhoneNumber` e cria um PIN. Esse comportamento é próprio do caminho padrão e não deve ser executado no ramo de coexistência.
- A tabela `communication_channels` já guarda `tenantId`, `wabaId`, `phoneNumberId`, estado, token cifrado e dados de registro. Não há estado explícito para modo de coexistência nem para sincronização.
- `src/app/api/webhooks/meta/whatsapp/route.ts` já valida a assinatura HMAC e tem endpoint Meta. Em `ingestMetaCloudWebhook`, porém, mudanças diferentes de `field: "messages"` são ignoradas; não há tratamento de `history`, `smb_app_state_sync` ou `smb_message_echoes`.
- O processamento atual de `messages` assume mensagens recebidas do cliente e pode iniciar qualificação por IA ou intake CTWA. Um echo do aplicativo precisa de caminho próprio e idempotente; reaproveitá-lo como mensagem inbound poderia fazer a IA responder ao próprio corretor ou criar um lead incorretamente.
- O segredo permanece no servidor e o webhook identifica canal/tenant pelo número Meta. Esses controles existentes devem ser preservados; não se deve confiar em `tenant_id` ou IDs recebidos do navegador como autoridade.

## Avaliação de esforço

É uma evolução de porte **médio**, não uma conexão simples por configuração. A parte de autorização e envio já existe; o custo principal está na nova máquina de estados de onboarding e na ingestão confiável dos eventos de sincronização.

Uma implementação segura poderia ser dividida assim:

1. **Pré-requisitos Meta:** confirmar status de Tech Provider, modo Live, App Review/Advanced Access, configuração de Embedded Signup com coexistência, session logging, domínios e assinatura dos campos adicionais no webhook.
2. **Onboarding separado:** adicionar ação “Conectar número já usado no WhatsApp Business”; aceitar e validar o evento específico de conclusão; persistir modo `coexistence`; descobrir/validar `phone_number_id`; não chamar registro/PIN de telefone.
3. **Sincronização e webhooks:** iniciar dentro da janela Meta; criar estados visíveis de sincronização/sucesso/falha; processar com deduplicação os três campos extras. Echos devem ser gravados como mensagens da empresa, sem passar por intake de lead ou automação inbound.
4. **Homologação controlada:** um número de teste autorizado, cobrindo envio Cloud API, recebimento de cliente, resposta no app, reconexão/desconexão, duplicatas e falhas/reentrega de webhook. Só então habilitar o fluxo para tenants via controle do Super-admin.

## Pontos de decisão antes de implementar

- O AncoraHub quer importar o histórico antigo ou somente os contatos e mensagens novos? A Meta deixa o compartilhamento do histórico sob escolha do cliente e a integração precisa comunicar claramente o que será armazenado.
- O status do canal deve ficar bloqueado para envio até a sincronização terminar, ou a sincronização pode ocorrer em paralelo com o canal operacional? Isso define os estados e mensagens de erro da interface.
- A coexistência será disponibilizada a todos os Diretores ou primeiro como piloto autorizado pelo Super-admin?
- Confirmar no painel Meta se o app do AncoraHub já possui elegibilidade/aprovação para Tech Provider e para o ramo de coexistência. O Embedded Signup v4 existente, sozinho, não prova essa aprovação.

## Faturamento: Meta versus AncoraHub

- A tarifa da Meta é por mensagem da **API entregue**, variando pelo país do destinatário e pela categoria (marketing, utilidade, autenticação ou serviço). A janela de 72 horas originada por anúncio Click-to-WhatsApp ou botão elegível da Página continua sendo uma exceção gratuita conforme as regras Meta.
- Atenção à data desta pesquisa (29/09/2026): a página pública de preços ainda exibia o regime vigente até 30/09. A documentação de preços da Meta publica uma mudança para **01/10/2026**: 1.000 mensagens de serviço gratuitas por mês para cada número comercial; as mensagens de serviço entregues acima da cota passam a ser cobradas. Além disso, templates de utilidade enviados dentro da janela de atendimento de 24 horas passam a ser cobrados por entrega e não usam essa cota. A janela de entrada gratuita de 72 horas permanece. Confirmar o rate card efetivo diretamente no painel/documentação Meta na virada, pois as páginas de preço podem atualizar em momentos diferentes.
- No modo coexistente, mensagens que o corretor envia pelo aplicativo WhatsApp Business continuam gratuitas; mensagens enviadas pelo CRM/API seguem a tarifa da Cloud API. A resposta manual pelo aplicativo também não cria nem prolonga a janela de atendimento da API.
- Quem recebe a fatura depende do arranjo de cobrança: com pagamento configurado diretamente na WABA da corretora, a empresa paga a Meta; se o Tech Provider compartilhar sua linha de crédito Meta com a WABA do cliente, a Meta consolida a cobrança no provedor, que então cobra o cliente conforme o contrato.
- No código/documentação atual do AncoraHub não encontrei medição de consumo da Meta, gestão de linha de crédito ou repasse automático por tenant. A decisão comercial de billing ainda consta pendente (DEC-011). Portanto, conectar coexistência não define sozinho quem pagará: essa forma precisa ser escolhida no onboarding e no modelo comercial.

## Referências

- [Meta — onboarding de usuários do WhatsApp Business App (Coexistência)](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [Meta — coleção oficial Embedded Signup no Postman](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup) — inclui requisitos para App Review/Advanced Access e endpoints pós-cadastro.
- [Meta — coleção oficial WhatsApp Cloud API no Postman](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) — registro, permissões e operações de envio.
- [Meta — preços da WhatsApp Business Platform](https://whatsappbusiness.com/products/platform-pricing/) — cobrança por mensagem entregue, categorias, mercados, janelas gratuitas e consulta às tarifas.
- [Meta — tabela de preços e atualizações da Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) — rate cards por mercado/categoria e vigências; a consulta automatizada retornou HTTP 429 em 29/09/2026.
- [Meta — linha de crédito no Embedded Signup](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup) — opção de compartilhar crédito com a WABA do cliente e cobrança agregada do provedor.
- [Cópia consultada do conteúdo da documentação Meta de coexistência](https://support.chatarchitect.com/books/meta-whatsapp/page/onboarding-whatsapp-business-app-users-aka-coexistence-developer-documentation) — usada porque a página canônica `developers.facebook.com` limitou a consulta automatizada (HTTP 429); conteúdo apresentado como documentação Meta e atualizado em 20/03/2026. Confirmar os critérios operacionais na fonte Meta antes do lançamento.
