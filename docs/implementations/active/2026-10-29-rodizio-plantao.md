---
type: spec
status: implementado (29/10)
updated: 2026-10-29
tags: [crm-ancora, plantao, distribuicao]
---

# Rodízio do plantão com pulos (DEC-161)

Pedido: Vinicios, 29/10. "Todo mundo tem sua vez": quem chega tarde no plantão não segura os leads dos outros até nivelar.

## Regras
- A fila de cada ocorrência começa na ordem de confirmação de presença (sem presença exigida: ordem da escala). Quem confirma depois entra no fim.
- Cada oferta gasta a vez. Aceitou: indicação. Expirou ou recusou: indicação e pulo. O lead pulado vai na hora para o próximo.
- Bloqueado na vez (pausado, oferta aguardando aceite, limite do plantão): guarda a posição.
- 3º pulo do dia no plantão: pausa a escala do dia (linha semanal e publicada juntas, mesmo horário de pausa), avisa o supervisor ou os gerentes da unidade e o corretor. Despausar uma linha despausa as irmãs da mesma pausa. A cada 3 pulos depois disso, nova pausa.
- Limite de leads por plantão e capacidade da fila continuam valendo. Filas de plantão não mostram mais "Menor carga / Round robin" (só "Estratégia fora do plantão" quando a fila usa a equipe da unidade fora do plantão).

## Código
- `duty-rotation.ts`: ordem de chegada, pulo e limite (puro, testado em `duty-rotation.test.ts`).
- `duty-presence.ts`: `arrivedAtByAssignment` (hora da confirmação) e `isDutyRotationEnabled`.
- `service.ts`: `rotationRosterBrokerIdsBySchedule`; com o rodízio, sem `fairPick` e com `manualPick.rotation`.
- `offers.ts` / `duty-queue-order.ts`: `seedMissing` cria a fila na primeira escolha, sob `distribution-pick`.
- `duty-skips.ts`: conta pulos e pausa; chamado na expiração e nas duas recusas (botão do WhatsApp e app).
- Tela: `duty-queue-order-board.tsx` mostra Anterior, Recebendo agora e Próximo com animação (desliza quando a vez muda; pulso lento em quem está recebendo; sem animação com reduce-motion), e por corretor: vezes, pulos, tempo médio de aceite e hora de chegada. Prévia em `/dev/fila-plantao-preview` com simulação de leads.

## Chave
`feature_duty_rotation_enabled` (global, ligada). Desligada, volta o nivelamento da DEC-154. Sem migration.
