---
type: spec
status: aprovado (27/10, seguiu as recomendações)
updated: 2026-10-27
tags: [crm-ancora, plantao, waha, corretor]
---

# Lembrete de plantão 24h antes (texto livre pelo WAHA)

Pedido: [[Vinicios Ragazzi]], 27/10. Serve à P3 (experiência do corretor). Mapeamento feito pelo Lince no repo `ancorahub-lite-listas`.

## O que o corretor recebe
Mensagem de texto livre no WhatsApp, enviada pelo número corporativo (WAHA), 24h antes de cada turno em que ele está escalado:

> Oi, {nome}! Lembrete: amanhã, {dia da semana} {dd/mm}, você está no plantão **{plantão}**, das {início} às {fim} ({presencial na unidade X | online}). 30 min antes chega o pedido de confirmação de presença. Não vai conseguir? Peça a troca pelo app.

O texto fica editável em Configurações > Mensagens, como evento novo (`DUTY_SHIFT_REMINDER`).

## Como funciona (sem SQL)
1. **Quem recebe:** as ocorrências efetivas do dia seguinte (escala semanal + mensal publicada, mesma regra do `selectEffectiveDutyAssignments`). Ficam de fora: escalado pausado, fora da validade e convidado sem conta (`duty_roster_pending`).
2. **Quando:** uma passada a cada 2 min, dentro do job `distribution` que já roda (sem tarefa nova no Coolify). Envia quando `agora >= início do turno - 24h` e `agora < início - 2h`. Assim, quem foi escalado em cima da hora também recebe, sem colidir com a confirmação de 30 min.
3. **Canal:** `enqueueMetaTextMessage` com rota `waha_direct` pelo número corporativo. Se o WAHA corporativo não estiver conectado, **não cai para a Meta** (a Meta exige template fora da janela de 24h): registra o erro `COMPANY_NUMBER_UNAVAILABLE`.
4. **Sem duplicidade:** `idempotencyKey = duty-reminder-24h:{assignmentId}:{brokerId}:{shiftStartsAt}`. O outbox já tem chave única por tenant e idempotencyKey, então ele vira o registro do aviso. Não precisa de tabela nova.
5. **Fim de semana:** o aviso é classificado para não ficar retido fora do horário comercial (senão o lembrete de domingo só sairia na segunda). Volume esperado: ~30 a 40 por dia, dentro do limite do número (40/h, 250/dia).
6. **Sem telefone:** pula e registra `BROKER_PHONE_UNAVAILABLE` no outbox. Aparece no diagnóstico.
7. **Chave liga/desliga:** `feature_duty_reminder_24h_<tenant>`, desligada por padrão. Liga pelo Super-admin, sem SQL.

## Troca e cancelamento
- Troca de plantão depois do aviso: o corretor novo recebe o lembrete na passada seguinte (a chave inclui o brokerId). O antigo não recebe correção na v1, porque a mensagem da troca (`dutySwap`) já avisa os dois.
- Pausa ou remoção depois do aviso: nada é enviado (v1).

## Pacotes
1. Evento `DUTY_SHIFT_REMINDER` no catálogo de mensagens, com texto padrão e variáveis (nome, dia, data, plantão, início, fim, modo, unidade).
2. `processDutyShiftReminders(now)` puro e testável (seleção da janela + montagem do texto) + chamada no job `distribution` atrás da chave.
3. Classe de entrega que não segura no fim de semana, mais testes do guard.
4. Status vivo: "Lembretes de amanhã: X enviados, Y sem telefone" na aba Resumo da distribuição.
5. Testes: janela 24h/2h, pausado, convidado, troca, sem telefone, chave desligada, idempotência.

## Decisões aprovadas

1. Antecedência fixa de 24 horas, sem configuração por plantão.
2. Convidado sem conta não recebe, pois ainda não pode confirmar presença pelo app.
3. O envio acontece também nos fins de semana.

## Implementação

- Feature flag por tenant `feature_duty_reminder_24h_<tenantId>`, default `false`, administrada e auditada no Super-admin.
- O job `distribution` executa o sweep sem criar agendamento novo. A janela operacional é de 24 a 2 horas antes; a outbox mantém idempotência por atribuição, corretor e início da ocorrência.
- O evento `DUTY_SHIFT_REMINDER` usa texto livre configurável. O envio é restrito ao WAHA corporativo; telefone ou conexão ausentes geram motivo seguro na outbox e não acionam a Meta.
- A faixa de status da distribuição informa lembretes enviados e falhas por ausência de telefone.
- Não houve migration, SQL, alteração do vault ou cadastro de tarefa no Coolify.

## Validação

- Vitest focado: 11 arquivos, 107 testes aprovados, com `--maxWorkers=1`.
- `npx tsc --noEmit -p .`: concluído sem erros após correção do narrowing de plano de mensagem.
- ESLint focado nos arquivos TypeScript/TSX alterados: sem erros; somente avisos preexistentes em `actions.ts` e `outbound-service.ts`.
- Sem testes de banco, migration, build ou acesso a `.env.local`.
