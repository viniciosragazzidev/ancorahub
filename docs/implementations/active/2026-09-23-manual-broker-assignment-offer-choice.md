# Atribuição manual com opção de aceite

## Objetivo

Na atribuição manual individual de um lead sem corretor, permitir que Diretor ou
Gestor escolham entre atribuir diretamente ou enviar uma oferta exclusiva ao
corretor selecionado. O caminho de oferta deve retornar ao roteamento normal quando
for recusada, expirar ou falhar definitivamente.

## Decisões

- Aplicar somente ao lead individual sem corretor; atribuições em lote, trocas de
  responsável e roteamento automático permanecem inalterados.
- Atribuição direta: owner confirmado, sem WhatsApp de aceite e com aviso interno/push.
- Oferta: template `new_lead_broker`, somente para o corretor escolhido, com prazo
  baseado no SLA `slaFirstContactMinutes` do tenant.
- O SLA de primeiro contato segue ativo depois do aceite. O toggle de redistribuição
  por falta de primeiro contato não bloqueia retorno à fila de uma oferta expirada,
  recusada ou definitivamente não entregue.
- Falha transitória da outbox mantém a oferta para retry; falha definitiva libera o
  owner provisório e aciona distribuição normal. Nunca converter uma tentativa de
  oferta em atribuição direta silenciosamente.
- Kill switch global do Super-admin, ativado por padrão e auditado.

## Plano técnico

1. Adicionar o controle reversível do Super-admin e validação do modo na Server
   Action; tenant, papel, filial e elegibilidade são sempre revalidados no servidor.
2. Interceptar a atribuição individual de lead sem responsável tanto na Inbox de
   `/distribuicao` quanto no drawer de `/leads`; abrir as opções de atribuição
   direta ou envio de oferta usando os componentes de diálogo existentes. Não
   alterar atribuições em lote nem a troca de responsável existente.
3. Reusar a entidade de oferta exclusiva; registrar origem manual, expiração e
   transições sem alterar o fluxo de ofertas automáticas.
4. Agendar o job durável para o vencimento. Em recusa, expiração ou falha terminal,
   limpar somente o vínculo provisório daquela oferta e reenfileirar idempotentemente.
5. Adicionar cobertura para direto sem WhatsApp, aceite, recusa, expiração, canal
   ausente/falha, corrida com aceite/reatribuição, toggle, feature flag e isolamento
   de tenant.

## Validação

- [x] Testes direcionados de domínio: `domain.test.ts` (48 testes aprovados).
- [x] O diálogo é disparado no drawer de `/leads` para lead sem corretor e na Inbox de `/distribuicao`; reatribuições seguem sem prompt.
- [x] `git diff --check` sem erros.
- [x] Type-check passou; lint global sem erro (avisos existentes registrados no relatório do harness).
- [x] Testes direcionados: `domain.test.ts` (48 aprovados).
- [x] `npm run build` concluiu com sucesso; Next compilou e finalizou a geração das rotas.
- [x] Suíte geral: 897/898 testes passaram. Falha isolada em `broker-lite-experience.test.tsx` (`reportingLookup` ausente), fora dos arquivos desta alteração; evidência em `reports/agent/verification/2026-09-23T16-23-49.915Z.md`.
- [ ] `npm run agent:verify -- --level fast` e `--level full` registrados.
- [ ] `npm run build` concluído.
- [ ] Roadmap atualizado com evidência e limitações.

## Riscos e rollback

O flag `feature_manual_lead_assignment_offer_choice_enabled` desliga a nova escolha
e restaura o submit manual anterior, sem remover ofertas ou auditoria existentes.
Toda liberação do owner exige comparação do tenant, lead, corretor e origem
provisória para não desfazer aceite ou atribuição concorrente.
