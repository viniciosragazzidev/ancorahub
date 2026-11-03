# Extensão v2: E3 e servidor da E2

Data: 03/11/2026. Base: `3a0b0b6b`. Branch: `feat/ext-v2-e3`.
Status: servidor implementado, aguardando revisão do Vigia; interface de ofertas permanece fora desta entrega.
Plano: `2026-11-03-extensao-whatsapp-v2.md`, E2/E3, O1–O6, P1, L1/L2 e A1.
Mapas: `mapa-ext-e1-e3.md` e `mapa-ext-e2-e4.md`, fornecidos pelo Maestro.

## Contexto autorizado e allowlist

- `lead-context.ts` preserva o escopo individual de tenant, unidade e corretor; não resolve telefone de outro corretor. Joins de filial, fila, plantão e plano incluem tenant.
- O payload estrito mantém os campos legados consumidos pelo decoder da E2 e acrescenta os nomes do contrato `LeadAmpliado`: `etapa`, `unidade`, `corretor`, `proximoPasso`, `temperatura`, `plano`, `vidas`, `valorMensal`, `fila`, `plantao`, `chegouEm` e `historico`. Não houve mudança em `apps/browser-extension/src/shared/types.ts`.
- Temperatura apenas apresenta `qualificationStatus` persistido: hot/warm/cold para quente/morno/frio; demais valores ficam sem dados. Não recalcula a classificação.
- Chegada segue Minha fila: `offeredAt` da oferta vigente deste corretor, ou `assignedAt`; nunca data de captura pela corretora. Plantão prefere a oferta vigente e usa o plantão do lead como reserva.
- Vidas usam `livesCount`, com fallback do CRM via `greetingFactsFromLead`. JSONs são lidos apenas no servidor para esse fallback, nunca serializados. Valor mensal é o valor persistido convertido em número finito.
- Próximo passo contém título e prazo, sem descrição da tarefa. Histórico contém no máximo cinco entradas recentes, somente tipo e data; a consulta nem seleciona conteúdo ou metadata das interações. CPF, comissão, notas e motivos de remoção não são exportados.
- Teste de integração de tipos atribui o resultado real a `LeadAmpliado`; testes verificam campos permitidos e rejeição de campos extras aninhados.

## Rotas e contrato para a interface posterior

- `GET /api/extension/offers`: somente broker, gate `VIEW_LEAD`, ofertas próprias no tenant com status PENDING/SENT/DELIVERED/READ e `expiresAt > agora`, ordenadas pelo vencimento, como Minha fila.
- Resposta: `{offers:[{id,expiresAt,plantao,temperatura,primeiroNome,phoneMasked}]}`. Não retorna telefone completo, nome completo, mensagens, lead inteiro ou conteúdo de tarefa.
- `POST /api/extension/offers/[offerId]/accept` e `/decline`: somente broker com permissão de sessão **ACCEPT_LEAD**, gate/flags/membership E0a e limite de aceite de 10/minuto por rota normalizada e sessão. `offerId` é UUID. Corpo não decide ação, tenant, usuário ou telefone.
- Chama `handleLeadOfferWebhookResponse` com `offerId` exato, tenant/usuário confiáveis e `buttonText` fixo `aceitar` ou `recusar`. Acrescenta override apenas de auditoria, com ação `extension.offer.accepted`/`declined` e metadata E0a; auditoria canônica não se repete em respostas já processadas.
- Vencedor: `{success:true,offerId,leadId,action:"accepted",alreadyAccepted,phone,greeting,whatsappUrl,foraDoPlantao}`. Depois do serviço, exige a mesma oferta ACCEPTED e propriedade atual do lead no tenant antes de selecionar/devolver contato. Repetição `already_accepted` só libera contato se essa confirmação continua válida.
- Erros de aceite reaproveitam `resolveLeadAcceptOutcome`; oferta alheia/inexistente dá 404 uniforme. Falhas de disputa/prazo dão 409 sem telefone, saudação ou URL.
- Recusa: `{success:true,offerId,action:"declined",alreadyDeclined,foraDoPlantao,contaComoPulo:true,message}`; não libera contato. Retry da mesma oferta DECLINED é resposta idempotente sem novo pulo. ACCEPTED/EXPIRED/LOST não são reportados como recusa bem-sucedida.
- Saudação e URL reaproveitam `loadBrokerGreetingSafe` e `buildWhatsAppUrl`. A extensão não envia mensagens; os efeitos oficiais do aceite continuam exclusivamente no serviço do CRM.
- P1: `findBrokerRunningDutyScheduleId`, que usa `pickBrokerRunningDutyScheduleId`, serve só para `foraDoPlantao`. Não é condição de aceite. Falha dessa consulta consultiva não transforma aceite confirmado em erro nem produz aviso falso de fora do plantão.

## Correção canônica da recusa aprovada pelo Maestro

Decisão explícita em `respostas-cinzel-e3.md`, recebida nesta sessão:

1. Permitir `offerId` opcional no serviço, com seleção exata por tenant+broker e sem fallback. Sem ele, mantém a seleção atual de WhatsApp/WAHA/Lite.
2. Recusa depois de `expiresAt` retorna `expired`, sem alterar oferta, pular plantão ou disparar efeitos por esse caminho. O executor normal `expireOutdatedLeadOffers` continua responsável pela expiração e seus efeitos normais.
3. Oferta terminal ou UPDATE sem linha retorna `already_resolved`, sem efeitos. O UPDATE também exige prazo vigente, protegendo o caso concorrente.

**Comportamento anterior confirmado no código:** oferta ainda ativa mas vencida podia virar DECLINED e chamar `applyDutySkipPolicy`, contando pulo indevido pela recusa. UPDATE sem linha já retornava antes desse helper e não contava pulo, porém informava sucesso falso. A correção vale no serviço canônico para todos os consumidores; não cria regra paralela na extensão.

## Validação e limites

- `npx tsc --noEmit`: passou.
- Vitest focado: 208 casos distintos em 11 arquivos passaram, sem banco (rodada principal de 190; rodada adicional de 29, com 11 casos repetidos). Inclui as rotas E0a com os três novos endpoints, allowlist E2/listagem, disputa/prazo/ownership, fora do plantão, duplicação, recusa canônica, auditoria, sessão e caminho WhatsApp sem offerId; também os contratos existentes de domínio/resultado.
- ESLint dos helpers/rotas/testes da extensão e regressão nova: passou. `git diff --check`: passou.
- Build padrão tentou compilar e encontrou a limitação conhecida do Turbopack com node_modules por junction; prebuild da extensão passou. Webpack compilou com sucesso (aviso preexistente de `unpdf`); resultado completo ainda em validação. Ver evidência de verificação.
- Sem `.env`, `.env.local`, `.env.production` ou DATABASE_URL/POSTGRES_URL no processo; não houve acesso ao banco nem migração. Nenhuma alteração nos arquivos da interface reservados ao Vigia.

## Integração, revisão e rollback

- Novas sessões emitidas recebem `ACCEPT_LEAD`. **Sessões antigas precisam reconectar** para receber a capacidade; rotação de token não promove permissões já concedidas. Não há SQL novo.
- Prioridade da revisão: alterações em `lead-distribution/offers.ts`, contagem do pulo e seleção exata por offerId. Regras de nivelamento, agenda, tolerância do aceite e distribuição O6 não foram alteradas.
- Testes/prints de abrir conversa com e sem contato salvo pertencem à interface posterior; não foram simulados como entrega deste servidor.
- Reverter os commits remove as três rotas e os novos campos; a E2 tolera campos ausentes. Sessões com capacidade adicional não a exercem sem as rotas. Não restaurar tokens nem reverter regras de produção automaticamente.
