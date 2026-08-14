# Meta Lead Ads: entrega e campanhas ativas

## Objetivo

Restaurar a entrega de Lead Ads ao callback canônico do CRM e manter `/marketing/campanhas` focado apenas nas campanhas operacionais ativas.

## Escopo e arquivos

- `src/features/meta-ads/meta-analytics-service.ts`
- `src/features/meta-ads/components/campaigns-dashboard-view.tsx`
- `src/features/meta-ads/meta-graph-client.ts`
- `src/features/meta-ads/meta-diagnostic-service.ts`
- `src/features/meta-ads/meta-sync-service.ts`
- `src/features/meta-ads/meta-graph-client.test.ts`

## Decisões

- Sincronização continua armazenando campanhas pausadas para histórico; a lista operacional consulta apenas status `ACTIVE`.
- O diagnóstico passa a validar a assinatura `leadgen` do app da plataforma na página, sem assumir sucesso.
- Falhas ao consultar formulários não podem virar lista vazia silenciosamente.
- O callback da assinatura global `page/leadgen` foi apontado na Meta para `https://crm.ancorasaude.cloud/api/webhooks/meta/lead-ads`.

## Validações

- Verificação Graph por página da assinatura `leadgen`.
- Verificação Graph da assinatura global `page/leadgen` e do callback canônico.
- Sonda assinada ao endpoint de produção, sem criação de lead real.
- Testes unitários e de handler focados.

## Riscos e rollback

- Leads já recebidos antes da correção do callback não são reenviados automaticamente; o rollback do callback é possível no painel da Meta, mas não é recomendado.
- Um envio real controlado após a alteração continua necessário para homologar `webhook -> leadgen_id -> lead -> distribuição`.
