# Etapa "Entrei em contato" (24/11/2026)

Pedido: "adicione em etapa do leads na hora do registro, a etapa de 'Entrei em contato' com uma área de
observação (para descrever o processo do contato)". Decisão: DEC-193.

## Modelo

- `lead_status` ganha `contacted`, depois de `in_contact`. Migration `drizzle/0237_lead_status_contacted.sql`
  (aditiva, `ALTER TYPE ... ADD VALUE IF NOT EXISTS ... AFTER 'in_contact'`). **Aplicar em produção só com ok do
  Vinicios**, antes do deploy que usa a etapa.
- `LEAD_STATUS_ORDER.contacted = 2.5` (entre 2 e 3, sem renumerar as outras etapas).
- `VALID_TRANSITIONS`: toda etapa aberta (e reabrir perdido) pode ir para `contacted`; `contacted` vai para as
  mesmas de Em atendimento, inclusive ela mesma (novo contato).

## Servidor

- `src/features/leads/contact-observation.ts`: regras puras (relato obrigatório para pessoa, texto da linha do tempo).
- `changeLeadStatus` aceita `observacao` (até 2000). Em `contacted` sem relato e sem `system`: erro
  "Conte em poucas palavras como foi o contato.". O relato vai para `lead_stage_history.reason`, para o texto da
  interação `status_change` e para `metadata.observation`. Observação em outras etapas (Negociação) também é gravada.
- `changeLeadStatusAction` lê `observacao` (ou `notes`, que o registro do corretor já mandava e se perdia).
- Lote: recusa `contacted`. Sasá (Desfazer) e agente do diretor não levam para ela.
- IA (`policy-executor.ts`): `contacted` nunca é destino; a partir dela a IA anda como se fosse Em atendimento.
- Super-admin: `feature_lead_contacted_stage_enabled` (padrão ligada).

## Interface (Lite)

- Corretor, "Como está o atendimento?": segmento "Contato feito" com "Como foi o contato?" (obrigatório). Lead em
  atendimento abre a folha já nele. Confirmação só depois da resposta do servidor (FEEDBACK nível 1, igual às outras
  etapas); erro reabre a folha com o texto escrito.
- Gestor, "Alterar etapa": área "Como foi o contato?" quando escolhe Entrei em contato.
- Ficha do diretor (`LeadStatusSelector`): diálogo com o relato.
- Kanban ganha a coluna (config salva no navegador recebe a coluna nova no lugar certo), filtros e rótulos.

## Listas atualizadas

Onde `in_contact` aparecia como etapa aberta, `contacted` entra junto: SLA, lead parado (Em atendimento não é
vigiado, Entrei em contato também não), pós-venda (`AUTO_RULE_OPEN_STATUSES`, R0, regras), distribuição,
relatórios e funil, supervisor e gestor, Sasá, agente.

## Verificação

- Testes: `contact-observation.test.ts`, `stage-advance.test.ts` (IA), `manager-lead-status-action.test.ts`,
  snapshots legados de kanban e filtros atualizados (etapa nova aparece).
- `/dev/laboratorio` > "Registrar etapa: Entrei em contato": ficha real do corretor, servidor simulado com as
  mesmas regras e a linha do tempo simulada.
