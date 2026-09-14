# Auditoria funcional de produção — Lead Ads → fila → corretor

**Data:** 14/09/2026  
**Escopo:** entrada Meta Lead Ads, resolução de fila/unidade, plantão, elegibilidade, distribuição, oferta WhatsApp, aceite, SLA, recuperação, métricas e trilha de auditoria.  
**Método:** inspeção estática do código real, leitura das regras/decisões do projeto e testes automatizados focados. Não houve acesso nem alteração de dados de produção.

## 1. Veredito executivo

**NÃO — ainda não considero o fluxo totalmente pronto para produção sem ressalvas.**

O caminho principal está implementado e testado em nível unitário: webhook autenticado → criação idempotente → efeito durável → `processQueuedLead` → oferta única → aceite atômico. Porém, existem riscos P1 que devem ser corrigidos antes de declarar garantia operacional total, sobretudo o aceite sem `providerMessageId`, a regra de roteamento legada sem consumidor e a divergência entre a regra BR-023 e a decisão DEC-097.

## 2. Fluxo observado

```text
Meta webhook assinado
  → fetch do lead na Graph API
  → resolveMetaCampaignIntake (campanha/anúncio/formulário)
  → createLeadFromWebhookSync (tenant, unidade, fila, idempotência, auditoria)
  → outbox + job durável
  → runLeadDistributionProcessor
  → processQueuedLead (unidade/fila/política/plantão/elegibilidade/ranking)
  → createLeadOffersForBrokers (uma oferta, titularidade provisória)
  → outbox Meta/WAHA
  → aceite/recusa/expiração
  → rotação e recuperação pelo mesmo job
```

## 3. Matriz de cobertura

| Etapa | Implementado | Testado | Pronto para produção | Evidência | Risco |
|---|---:|---:|---:|---|---|
| Webhook Meta GET/POST | Sim | Sim | Sim, condicionado a configuração | `src/app/api/webhooks/meta/lead-ads/route.ts`; assinatura e JSON | P2 |
| Token/credencial e tenant | Sim | Parcial | Sim | `meta-lead-ads.ts`; fonte ativa por `pageId` e tenant | P2 |
| Fetch e normalização Meta | Sim | Sim | Sim | `fetchMetaLead`, `normalizeMetaLead` | P2 |
| Campanha/anúncio/formulário → fila | Sim | Sim | Parcial | `resolveMetaCampaignIntake`; precedência não está centralizada em catálogo declarativo | P1 |
| Idempotência do intake | Sim | Sim | Sim | `createLeadFromWebhookSync`, `webhookDeliveries`, índices externos | P2 |
| Criação de lead ativo | Sim | Sim | Sim | valida nome/telefone; soft-delete respeitado | P2 |
| Outbox de efeitos | Sim | Sim | Sim | `enqueueLeadEffectTx`, processamento de efeitos | P2 |
| Job de distribuição durável | Sim | Sim | Sim | `jobs.ts`, lease, retry, seed e recuperação | P2 |
| Claim concorrente | Sim | Sim | Parcial | compare-and-set em `claimNextJob`; falta teste de concorrência real com banco | P1 |
| Resolução da unidade | Sim | Sim | Parcial | `selectDistributionBranch`, `processQueuedLead`; fallback depende de flags | P1 |
| Resolução da fila | Sim | Sim | Parcial | `leadQueues` + `leadDistributionPolicies`; filas manuais são pausa explícita | P2 |
| Plantão/roster | Sim | Sim | Sim | `getRosterBrokerIds`, `duty-actions.ts` | P2 |
| Elegibilidade do corretor | Sim | Sim | Sim | tenant, vínculo ativo, usuário ativo, disponibilidade e telefone | P2 |
| Capacidade/ranking | Sim | Sim | Parcial | `resolveDistributionCandidate`; capacidade é preferência, conforme DEC-097 | P2 |
| Oferta única | Sim | Sim | Parcial | lock da linha do lead e busca de oferta ativa | P1 |
| Titularidade provisória | Sim | Sim | **Não sem alinhar documentação** | `createLeadOffersForBrokers` grava `corretorId` antes do aceite | P1 |
| Envio oficial | Sim | Parcial | Parcial | outbox Meta/WAHA; entrega real não foi observada | P1 |
| Aceite atômico | Sim | Sim | Parcial | `handleLeadOfferWebhookResponse` usa lock de lead/oferta | P1 |
| Recusa | Sim | Sim | Sim | marca `DECLINED` e reenfileira | P2 |
| Expiração | Sim | Sim | Parcial | marca `EXPIRED`; reprocessamento depende do scheduler/seed | P1 |
| SLA sem primeiro contato | Sim | Sim | Parcial | `sla.ts` chama o mesmo motor; E2E não executado | P1 |
| Recuperação de lease/assignment | Sim | Sim | Sim | `recoverExpiredJobLeases`, `recoverStuckLeadAssignments` | P2 |
| Leads inválidos/sintéticos | Sim | Sim | Sim | soft-delete, status terminal e `Lead WhatsApp (%)` filtrados | P2 |
| Auditoria | Sim | Sim | Parcial | eventos e `auditLogs`; faltam testes de completude | P1 |
| Visibilidade por papel/tenant | Sim | Sim | Sim | ações e consultas escopadas; métricas fora deste caminho devem consumir catálogo | P2 |
| Métricas | Parcial | Parcial | Não | `broker-summary` e relatórios têm migração gradual para catálogo DEC-090 | P1 |
| Regra de roteamento legada | Existe | Não no fluxo | Não | `routing-engine.ts` não é chamado pelo executor automático | P1 |
| E2E Meta real | Não executado | Não | Não comprovado | requer credenciais/dados de produção | P0 de evidência, não necessariamente defeito |

## 4. Autoridade canônica recomendada

| Responsabilidade | Fonte única recomendada |
|---|---|
| Seleção automática de unidade, fila e corretor | `src/features/lead-distribution/service.ts::processQueuedLead` |
| Persistência/leases/retry/recuperação | `src/features/lead-distribution/jobs.ts` |
| Ranking e desempate | `src/features/lead-distribution/domain.ts` |
| Ciclo de ofertas e aceite | `src/features/lead-distribution/offers.ts` |
| Configuração da fila/política | `leadQueues` + `leadDistributionPolicies`, administradas por `control-service.ts` |
| Regras de entrada Meta | `meta-lead-ads.ts::resolveMetaCampaignIntake`, apenas para decidir captura/fila; nunca para escolher corretor |
| Métricas | catálogo `src/features/reports/metrics` conforme DEC-090 |

`routing-engine.ts` deve ser removido do caminho automático, ou explicitamente adaptado para produzir uma decisão consumida pelo motor canônico. Manter duas fontes de decisão sem contrato de precedência permite que uma regra exibida na tela não tenha efeito real.

## 5. Achados P1

### P1-01 — Aceite sem ID do provedor é ambíguo

`handleLeadOfferWebhookResponse` primeiro procura por `whatsappMessageId`, mas, se não encontrar, escolhe a oferta ativa mais recente do corretor. Se duas ofertas estiverem pendentes, uma resposta atrasada ou sem ID pode aceitar outro lead. O fallback deve exigir uma correlação inequívoca (payload/ID da oferta, token assinado ou janela + destinatário + mensagem) e rejeitar a resposta ambígua.

### P1-02 — Titularidade pré-aceite diverge da regra BR-023

`createLeadOffersForBrokers` grava `leads.corretorId` e `distributionStatus=assigned` no envio da oferta. Isso corresponde à DEC-097 (titularidade provisória), mas contradiz BR-023, que diz que `corretorId` só é gravado após aceite. É necessário escolher uma decisão normativa única e atualizar `docs/business-rules.md`, telas e relatórios para não interpretar owner provisório como aceite confirmado.

### P1-03 — Motor de regras paralelo sem integração

`src/features/lead-distribution/routing-engine.ts` implementa regras por plano, origem, cidade, vidas e qualificação, mas não é chamado por `processQueuedLead` nem pelo intake Meta. Se a UI permitir configurar essas regras, elas podem aparentar estar ativas sem afetar a distribuição. Centralizar a avaliação em `processQueuedLead` ou marcar a superfície como experimental/inativa.

### P1-04 — Entrega WhatsApp não comprovada ponta a ponta

O código registra a oferta e enfileira a mensagem, mas esta auditoria não conectou a um provedor real nem confirmou ACK/entrega. O job não deve considerar a oferta ativa sem `outboundMessageId`; falhas devem permanecer visíveis na outbox e não apagar a intenção de distribuição.

### P1-05 — Falta de teste de concorrência com banco real

O claim do job e o lock da linha do lead são defensivos, porém os testes existentes são determinísticos/unitários. É necessário um teste de integração com dois workers concorrentes verificando: no máximo uma oferta ativa, no máximo um owner provisório e nenhum job perdido.

## 6. Achados P2

- A deduplicação por telefone carrega todos os leads não excluídos do tenant e compara em memória (`create-lead-from-webhook-sync.ts`). Em tenants grandes isso aumenta latência e janela de corrida; normalização/indexação no banco deve ser a evolução.
- `getAutomationContext` exige um Diretor ativo para auditar o worker. Isso é seguro para auditoria, mas pode deixar leads aguardando se o último Diretor for desativado; deve existir alerta operacional claro e uma identidade de sistema governada.
- `resolveMetaCampaignIntake` consulta rotas de campanha, anúncio e formulário separadamente e usa precedência fixa. Essa precedência deve ser exibida e versionada em um único catálogo para evitar configurações conflitantes.
- Métricas de distribuição e relatórios ainda estão em migração para o catálogo canônico da DEC-090; comparações entre `/dashboard`, `/distribuicao` e perfil do corretor precisam ser validadas contra o mesmo resolver.

## 7. Cenários de falha avaliados

| Cenário | Resultado observado |
|---|---|
| Webhook sem assinatura válida | Rejeitado no handler |
| Página sem fonte ativa | Ignorado e registrado |
| Lead Graph sem nome/telefone | Rejeitado sem criar lead |
| Redelivery Meta | Idempotência retorna lead existente |
| Fila inativa | Vínculo reparado e lead reenfileirado |
| Lead excluído, perdido ou sintético | Job concluído como ignorado |
| Nenhum corretor elegível | Job fica retryável/auditável |
| Oferta expirada | Oferta marcada expirada e job pode ser semeado novamente |
| Aceite após outro owner | Aceite perde atomicamente |
| Lease vencido | Job volta para retry |
| Falha de outbox | Lead permanece durável; entrega aguarda retry |

Não foi possível comprovar, sem ambiente de produção, o comportamento real de timeout do provedor, atraso de webhook, duplicação entre réplicas ou indisponibilidade do banco.

## 8. Plano de consolidação seguro

1. Registrar decisão única sobre owner provisório versus owner pós-aceite e alinhar BR-023/DEC-097, tipos, status e relatórios.
2. Tornar a correlação de aceite obrigatória e rejeitar fallback ambíguo; adicionar teste de duas ofertas pendentes.
3. Integrar ou desativar explicitamente `routing-engine.ts`; nenhuma regra editável deve ficar sem consumidor.
4. Adicionar teste de integração concorrente para dois workers e teste de reprocessamento após expiração.
5. Criar um resolver de catálogo para precedência Meta (ad/form/campaign) e fazer a UI, intake e simulação consumirem o mesmo resolver.
6. Migrar métricas restantes para `src/features/reports/metrics` e comparar os resultados por tenant, unidade, corretor e período.
7. Executar uma prova controlada em ambiente de homologação com webhook assinado, duas unidades, três corretores, atraso de entrega e expiração; só depois liberar a validação E2E de produção.

## 9. Validações executadas

- Testes focados: **6 arquivos, 49 testes aprovados** (domínio, jobs, recuperação em lote, roteamento, Meta Lead Ads e handler do webhook).
- `npm run agent:context`: documentação e módulos recomendados carregados.
- `npm run agent:verify -- --level fast`: validação documental concluída; o conjunto completo de testes encontrou uma falha preexistente em `src/features/broker-workspace/broker-lite-experience.test.tsx` e não foi usado como evidência positiva desta auditoria.
- Não foi executado build nem teste E2E contra Meta/WhatsApp nesta etapa de auditoria; não houve alteração de comportamento nem de dados.

## 10. Declarações finais

- Existe um motor central de distribuição? **SIM**, `processQueuedLead`.
- Existe mais de uma definição de roteamento? **SIM**, o `routing-engine.ts` paralelo precisa ser consolidado ou retirado da superfície ativa.
- A entrada Meta é idempotente? **SIM**, com a ressalva de índice/consulta de telefone em memória.
- Há garantia comprovada de entrega WhatsApp? **NÃO**, somente garantia de persistência/outbox foi verificada.
- Há garantia comprovada de concorrência em produção? **NÃO**, falta teste de integração multi-worker.
- Leads terminais/sintéticos são filtrados? **SIM**.
- Há divergência documental que precisa de decisão? **SIM**, BR-023 versus DEC-097.
- O próximo passo seguro é uma refatoração ampla imediata? **NÃO**; primeiro corrigir os P1, adicionar evidência de concorrência e definir a autoridade normativa.

**Conclusão:** a arquitetura atual já tem uma base recuperável e idempotente, mas a promessa “todo lead válido sempre será entregue ao corretor correto, sem duplicidade e com aceite confiável” ainda não está comprovada. A fonte canônica deve permanecer em `/features/lead-distribution`; as demais entradas devem apenas registrar intenção e chamar esse motor.
