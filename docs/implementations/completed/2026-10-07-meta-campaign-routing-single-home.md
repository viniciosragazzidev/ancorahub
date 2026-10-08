# Captura Meta e fila herdadas da campanha

## Estado

Implementação de código concluída; type-check e build de produção passaram.
O script retroativo fica em prévia por padrão. As regras da conta CA1 e os
leads sem fila identificáveis foram aplicados em produção.

## Escopo

- Centralizar ativação/pausa e seleção da fila na página de detalhe da campanha.
- Fazer anúncios e formulários herdarem a rota da campanha identificada na
  atribuição do lead; não deixar regras antigas de ativo filho desviarem a fila.
- Recusar captura de campanha sem fila ativa, incluindo o modo global liberado,
  evitando leads sem fila e fallback para entrada direta.
- Tornar lista de campanhas e Central de Filas superfícies de consulta com link
  para a única configuração canônica.
- Exibir todos os anúncios sincronizados e formulários que tenham atribuição
  real à campanha por lead ou anúncio. ID é exibido quando o cadastro do
  formulário não estiver sincronizado.
- Incluir script tenant-scoped para associar leads Meta sem fila à fila ativa
  de sua campanha, alterando somente o vínculo de fila.
- Suportar fila padrão por conta de anúncios e herdar o destino em novas
  campanhas sincronizadas.

## Causa observada

A configuração antiga em lote podia gravar elegibilidade sem fila em campanha,
anúncio e formulário. O webhook também lia apenas a chave externa da Meta,
enquanto algumas rotas legadas usavam o UUID interno do CRM; a tela compensava
essa diferença, o intake não. Sem rota resultante, o caminho `direct_leads`
permitia criar lead sem fila. O intake agora resolve as duas chaves dentro do
tenant e só cria lead quando encontra uma campanha habilitada com fila ativa.

## Arquivos principais

- `src/features/meta-ads/campaign-route-resolver.ts`
- `drizzle/0184_meta_ad_lead_form_link.sql` and `src/shared/db/schema.ts` (link form used by ad creative)
- `src/features/meta-ads/meta-graph-client.ts` and `src/features/meta-ads/meta-sync-service.ts` (sync form link with fallback to the existing ad sync)
- `src/features/meta-ads/meta-capture-policy.ts`
- `src/features/communication-channels/meta-lead-ads.ts`
- `src/features/communication-channels/meta-ctwa-intake.ts`
- `src/features/meta-ads/meta-analytics-service.ts`
- `src/features/meta-ads/actions.ts`
- `src/features/lead-distribution/control-service.ts`
- `src/features/meta-ads/components/campaign-detail-view.tsx`
- `src/features/meta-ads/components/meta-capture-controls.tsx`
- `src/features/meta-ads/components/campaigns-dashboard-view.tsx`
- `src/app/(dashboard)/marketing/campanhas/[id]/page.tsx`
- `src/app/(dashboard)/leads/distribuicao/_components/queues/meta-entries.tsx`
- `scripts/repair-meta-leads-without-queue.ts` (prévia padrão; exige tenant ou campanha)
- `scripts/route-meta-ad-account-to-queue.ts` (prévia padrão; altera só fila e destino padrão da conta)
- `drizzle/0185_meta_ad_account_default_queue.sql`

## Segurança e auditoria

As consultas usam o tenant resolvido no servidor ou derivado da campanha CRM.
A fila deve estar ativa no mesmo tenant. Alterações de rota da campanha e do
controle global continuam registrando auditoria; o controle global não cria
regras filhas. Formulário compartilhado segue a campanha atribuída ao lead.
O script ignora rotas ausentes/inativas e formulários ambíguos, altera apenas
`queueId` e registra evento por lead mais auditoria de execução.
O padrão de conta fica em `meta_ad_accounts.default_queue_id`; campanhas novas
sincronizadas criam rota para essa fila, e uma rota específica existente segue
como exceção explícita.

## Validação

- Revisão estática do fluxo de atribuição do Lead Ads e CTWA e dos caminhos de
  configuração, sem modificar o banco de produção.
- `npm run type-check`: passou.
- `npm run build`: compilação, TypeScript e geração das rotas passaram; Next
  reportou mensagens esperadas de renderização dinâmica por `headers` em rotas
  autenticadas.
- `git diff --check`: passou.
- Testes automatizados não executados nesta rodada.
- Relatório: `reports/agent/verification/2026-10-07-meta-campaign-routing.md`.

## Próximas ações operacionais

Para revisar os leads históricos sem fila:

```powershell
npx tsx scripts/repair-meta-leads-without-queue.ts --campaign <crm-campaign-id>
```

Depois de conferir a prévia, aplicar explicitamente:

```powershell
npx tsx scripts/repair-meta-leads-without-queue.ts --campaign <crm-campaign-id> --apply
```

O script associa somente a fila ativa da campanha, sem redistribuir o lead ou
alterar corretor, unidade, status, SLA ou atendimento.

Execução feita em 2026-10-07: 17 leads receberam somente o vínculo `queueId`
pela rota ativa da campanha; depois, a conta CA1 foi configurada com FILA
TATIANA como padrão, suas 112 campanhas sincronizadas foram alinhadas e mais
2 leads sem fila receberam somente esse vínculo. Leads já em fila, incluindo
Pós Venda, permaneceram nos destinos existentes. Quatro leads com campanha
Meta `120252982074720392` não foram associados à conta porque ela não está
sincronizada no CRM e a origem CA1 não pôde ser confirmada.
