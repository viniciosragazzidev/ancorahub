# Isenção total da fila Pós Venda na transferência entre unidades e corretores

## Objetivo e decisão

Complemento da DEC-133 confirmado em grilling (2026-10-06). A origem do erro
"Bloqueio de Regra: A campanha ... está vinculada exclusivamente a outra fila"
é a validação de rota campanha→fila em `validateCampaignQueueRoute`
(`src/features/lead-distribution/service.ts`), aplicada na transferência de
unidade e — na versão de produção — na atribuição a corretor. Leads ligados à
fila "Pós Venda" (origem OU destino) deixam de ter qualquer bloqueio de
negócio nessa operação:

- rota de campanha→fila (o bloqueio do screenshot);
- disponibilidade/pausa do corretor (`availabilityStatus`);
- exigência de unidade ativa/aceitando leads (individual, rota+atribuição,
  carteira da equipe e lote por unidade);
- estado do atendimento iniciado (lead em contato pode mudar de unidade).

Identificação da fila pelo nome normalizado — "Pós Venda" sem caixa, acentos
ou hífens (`normalizeQueueName`), decisão do usuário: a fila já existe com
esse nome; nenhum id fixado. Mantêm-se salvaguardas de identidade: vínculo
ativo no tenant, conta ativa, autorização do ator (gestor no próprio escopo)
e Central de redistribuição só para Diretor. Cada transferência isenta
registra auditoria `lead.post_sale_transfer:<fila>` e evento de distribuição
com escopo `post_sale_transfer_exemption`. Por decisão do usuário, sem chave
de Super-admin (permanente no código); o toggle global
`feature_lead_management_actions_enabled` continua governando as ações.

## Módulos

- `src/features/lead-distribution/post-sale-transfer.ts` (novo): nome
  normalizado, `findPostSaleExemptionQueueName` e `postSaleTransferAuditAction`.
- `src/features/lead-distribution/service.ts`: `routeLeadToBranch`,
  `routeLeadToBranchAndAssignBroker` e `assignLeadToBroker` com a isenção.
- `src/app/(dashboard)/equipe/actions.ts`: transferência de carteira sem a
  exigência de unidade ativa quando a Pós Venda é destino.
- `src/app/(dashboard)/leads/status-actions.ts`: lote por unidade aceita
  unidades inativas quando todas as de destino forem Pós Venda.
- regras (`docs/business-rules.md` BR-024G), decisão (complemento DEC-133),
  roadmap e evidência de verificação.

## Validação

- `npx tsc --noEmit`: passou (exit 0).
- ESLint nos cinco arquivos tocados: sem erros/avisos.
- `npx vitest run src/features/lead-distribution`: 318 passados / 9 skipped
  (skips de banco, pré-existentes); inclui `post-sale-transfer.test.ts` (4).
- `npx vitest run src/features/leads src/app`: 225 passados / 1 skipped.
- `npm run build`: registrado ao final (ver evidência).
- `npm run agent:verify -- --level fast`: ambiente com falha pré-existente
  `uv_os_get_passwd returned ENOMEM` no processo `tsx` (já registrada na
  implementação anterior de 06/10); verificação harness continua impedida.

## Risco e rollback

O risco aceito pelo usuário é transferir para unidades pausadas/sem aceitar
leads e corretores pausados quando a Pós Venda está envolvida; o motor
automático não muda (redistribuições futuras voltam às regras normais).
Transferências sem a Pós Venda seguem a DEC-133 original. Rollback: reverter
somente a isenção (arquivo novo + condições `postSaleExempt*`), sem migration.
