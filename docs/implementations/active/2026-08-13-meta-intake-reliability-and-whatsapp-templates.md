# Confiabilidade do intake Meta e plano de templates WhatsApp

## Objetivo

Garantir que uma falha da Graph API nunca materialize um lead fictício, que um lead real da Meta acione somente o seu próprio trabalho operacional sem esperar o cron diário e que a qualificação legada encontre o canal oficial efetivamente persistido. Preparar a próxima etapa: catálogo e criação de templates oficiais por conta WhatsApp Business (WABA) do tenant.

## Escopo e arquivos

- `src/features/communication-channels/meta-lead-ads.ts`: leitura de lead da Meta falha de forma explícita; após um intake confirmado, processa somente os efeitos e a distribuição daquele lead e daquele tenant.
- `src/features/leads/webhooks/services/lead-effect-outbox.ts`: o worker aceita escopo opcional de tenant/lead para o caminho imediato, sem ampliar o lote para outras corretoras; a notificação direta e a outbox usam a mesma chave de idempotência.
- `src/features/lead-distribution/jobs.ts`: o processador aceita o mesmo escopo estreito para recuperação, seed e claim do job.
- `src/features/ai-qualification/service.ts`: usa a constante canônica `META_CLOUD_PROVIDER` (`meta_cloud`) em vez do identificador legado que não existe em canais conectados.
- `src/features/communication-channels/meta-lead-ads.test.ts`: regressão para Graph 404/código 100, que agora bloqueia a criação sintética.

## Decisões

- DEC-058 permanece válida: o lead, a entrega e os efeitos persistem primeiro; falha posterior não recria o lead. O processamento imediato é uma drenagem limitada do trabalho já persistido, e o cron diário continua como recuperação.
- DEC-053 permanece válida: nenhum template novo habilita disparo automático para lead de landing page sem consentimento aplicável e modelo Meta aprovado.
- Nenhuma migração de template foi aplicada nesta correção. O catálogo atual `message_templates` é genérico e não tem WABA, idioma, componentes, estado Meta, qualidade ou motivo de reprovação; usá-lo como fonte de verdade da Meta quebraria a rastreabilidade.

## Plano de templates WhatsApp por tenant

1. Criar uma tabela provedora separada, por exemplo `whatsapp_message_templates`, vinculada a `tenant_id`, `channel_id`, `waba_id` e `meta_template_id`. Persistir nome, idioma, categoria, componentes normalizados, status, qualidade, motivo de reprovação, último sync e snapshot mínimo. A unicidade é `(tenant_id, waba_id, name, language)`.
2. Criar um cliente server-only da Graph API para listar `/{WABA_ID}/message_templates`, seguir paginação e validar que a WABA vem do canal oficial do tenant — nunca de input do navegador. A primeira entrega é somente leitura, acionada por Diretor e auditada; sem canal ativo, a tela explica a dependência em vez de exibir um catálogo vazio como conectado.
3. Criar a área `/integrations/whatsapp/templates`: última sincronização, busca por nome/idioma/categoria/status, preview dos componentes e estados claros `APPROVED`, `PENDING`, `REJECTED`, `PAUSED` ou `DISABLED` recebidos da Meta. Diretor cria e sincroniza; Gestor apenas consulta se possuir a capacidade correspondente; Corretor não vê nem edita o catálogo.
4. Criar o fluxo de rascunho e submissão via `POST /{WABA_ID}/message_templates`: schema por categoria, idioma explícito, componentes/variáveis validados, auditoria sem corpo sensível e retorno local como `PENDING`. A aprovação é exclusivamente da Meta; o CRM faz sync explícito/polling e nunca marca como aprovado por suposição.
5. Introduzir um resolvedor de envio por propósito operacional. Os fluxos atuais de convite e serviço continuam com os nomes legados até o Diretor selecionar um template Meta `APPROVED` do seu tenant. O worker envia somente `id/nome + idioma + contrato de variáveis` do modelo sincronizado; template ausente, rejeitado ou incompatível bloqueia o envio e cria exceção auditada.
6. Cobrir com testes: isolamento entre tenants/WABAs, paginação, token sem escopo, sincronização idempotente, status/reprovação, validação de variáveis, criação pendente e bloqueio de envio fora da janela/regra de consentimento. Homologar por último com uma WABA ativa e um template de utilidade não sensível.

## Validações

- `npm test -- --run src/features/communication-channels/meta-lead-ads.test.ts src/features/communication-channels/meta-cloud-client.test.ts src/features/leads/webhooks/tests/webhook-intake-sync.test.ts src/features/leads/webhooks/tests/webhook-idempotency.test.ts src/features/ai-agent/qualification-e2e.test.ts src/features/lead-distribution/jobs.test.ts` — 6 arquivos, 26 testes aprovados.
- `npm run type-check` — aprovado.
- `npm run agent:verify -- --level fast` — 88 arquivos e 348 testes aprovados.
- `npm run build` — aprovado; uma tentativa de geração de `/super-admin/whatsapp-review` excedeu 60 segundos e foi repetida pelo Next com sucesso.
- A consulta às páginas oficiais da Meta foi tentada; o servidor da Meta respondeu HTTP 429 durante esta execução. O desenho usa os endpoints e permissões já fornecidos pelo solicitante e deve ser reconferido contra a versão Graph ativa antes da implementação da fase de CRUD.

## Retomada de qualificação pendente via WhatsApp

- Uma mensagem inbound de um lead com `qualification_status = pending` inicia ou retoma o fluxo de IA. Estados finais (`qualified`, `hot`, `warm`, `cold`, `lost`) não reabrem uma qualificação já concluída.
- O identificador do tenant e o canal continuam sendo resolvidos pelo webhook autenticado; nenhum estado de qualificação é aceito do navegador. Números reconhecidos como internos da corretora seguem protegidos e não recebem resposta automática.
- Os campos principais são atualizados no lead e o conjunto completo, com score e status, é persistido em `qualification_details`. Ao concluir, o mesmo resolvedor de distribuição entrega a um corretor elegível ou deixa o lead na fila operacional sem perda de histórico.
- A resposta e o handoff são reavaliados depois que a IA devolve campos estruturados. Assim, o último dado informado pelo cliente não gera uma pergunta extra antes da transferência.

## Riscos e rollback

## Registro do número na Cloud API

- A migration `0119_whatsapp_cloud_registration_state` distingue o controle operacional do tenant do estado confirmado pela Meta: `pending`, `registering`, `registered`, `failed` e `legacy_unverified`.
- O Embedded Signup continua sendo a única superfície que confirma a posse do telefone. Após `FINISH`, o servidor cria um PIN de 2FA aleatório, cifra-o com a chave já usada para tokens e chama `/{phone-number-id}/register`; PIN, token e dados de mensagem não são retornados ao cliente nem escritos na auditoria.
- Só a resposta bem-sucedida marca o canal `active`. Uma falha deixa envio bloqueado, registra o resultado sem segredo e permite ao Diretor repetir somente a ativação técnica de uma conexão anterior, sem reconectar nem repetir OTP.

Reverter o registro do número preserva histórico, WABA e telefone, mas o canal permanece bloqueado até que uma ativação válida volte a ser confirmada pela Meta. A migration não expõe credenciais e o rollback não remove dados de conversa.

## Recriação de templates após troca de portfólio Meta

- O Embedded Signup persiste o `businessId`, `wabaId`, `phoneNumberId` e o token retornados pela Meta no canal oficial ativo do tenant. A recriação consulta exclusivamente esse canal; não aceita WABA, número ou token do navegador.
- O formulário de recriação valida o payload no servidor, preserva botões de resposta rápida, URL e telefone do template armazenado e converte variáveis nomeadas para a numeração exigida pela Graph API. Variáveis repetidas preservam a mesma posição, e variáveis numéricas não sequenciais ou misturadas são bloqueadas antes do POST.
- URLs legadas de convite em `ancorahub.com.br` são atualizadas para `https://crm.ancorasaude.cloud` sem codificar placeholders dinâmicos como `{{1}}`. URLs externas não são modificadas.
- A interface não informa sincronização concluída se a leitura posterior da Meta falhar. A submissão bem-sucedida é registrada como `PENDING`, cuja aprovação continua sendo decisão exclusiva da Meta.
