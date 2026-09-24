# Confirmação de presença para elegibilidade no plantão

## Resumo do que foi implementado

O CRM grava uma confirmação por ocorrência do plantão (tenant, escala, vínculo
do corretor, data e horário). Com a flag global ativa, o job de distribuição
cria o registro uma única vez e tenta enfileirar o template Meta
`plantao_confirm_presence` 30 minutos antes do início. A janela permanece aberta
até o fim do turno, então uma confirmação atrasada só libera o restante daquela
ocorrência.

O link `/confirm_presence?id=...` é público e usa um UUID imprevisível. A
confirmação é atômica, auditada, idempotente e recusada se o turno terminou ou a
escala/vínculo deixou de estar ativo. O motor automático e a seleção manual de
corretores da fila usam o mesmo gate: sem confirmação válida, o corretor não é
elegível para aquele plantão; o lead continua sujeito às regras normais da fila
e aos fallbacks já configurados.

No detalhe do plantão, o diretor vê o checklist de corretores, o total
confirmado e os badges de estado. O lembrete é exclusivamente Meta: não há
fallback de texto livre nem WAHA. O sweep usa o endpoint de distribuição
existente, sem exigir uma nova schedule.

## Guia de teste para um agente

### Pré-requisitos seguros

1. Faça os testes de integração somente em staging/tenant de teste. O endpoint
   `/api/internal/jobs/distribution` também processa a distribuição normal;
   não o dispare manualmente em produção para testar lembretes.
2. Aplique a migration `0156_duty_presence_confirmation.sql` pelo processo
   habitual de migrations do CRM. Não habilite a flag antes disso.
3. Sincronize para a WABA do tenant de teste o template aprovado
   `plantao_confirm_presence`, com `nome` e `hora` no corpo e um botão de URL
   dinâmica que receba o UUID da confirmação.
4. Use um corretor de teste ativo, com membership ativo e telefone apto a
   receber mensagens Meta; crie uma escala ativa e vínculo válidos para a fila.
5. Confirme que a flag global está desligada antes de preparar o cenário. Como
   ela vale para todos os tenants daquela instalação, só a ligue em um ambiente
   de staging isolado depois de validar os pré-requisitos.

### Testes automatizados

Execute os testes focados da ocorrência, catálogo, template, resolvedor e outbox:

```bash
npm run test -- src/features/lead-distribution/duty-presence-domain.test.ts src/features/communication-channels/templates.test.ts src/features/communication-channels/message-event-catalog.test.ts src/features/communication-channels/outbound-service.test.ts src/features/communication-channels/template-sync-service.test.ts
```

Valide também tipo, migration e build:

```bash
npm run type-check
npm run db:check
npm run build
```

O teste geral registrado em 2026-09-23 teve 921 aprovações e uma falha em
`src/features/broker-workspace/broker-lite-experience.test.tsx`, que verifica a
ordem de leitura do contrato da rota Lite e não pertence a esta feature. Se
essa falha continuar, reporte-a separadamente; não a trate como aprovação total
da suíte.

### Cenário de integração em staging

1. Configure um plantão cujo início esteja dentro dos próximos 30 minutos e
   mantenha o vínculo do corretor ativo. Invoque o job existente com a
   autenticação interna já usada pelo ambiente de staging.
2. Confira na resposta JSON o objeto `dutyPresence` (`enabled`, `considered`,
   `queued`, `failed`, `expired`). Para o corretor, confirme que foi criado um
   único registro da ocorrência e um item no outbox com propósito
   `dutyPresenceConfirmation`, template `plantao_confirm_presence`, destinatário
   correto e URL contendo o ID da confirmação.
3. Invoque o mesmo job de novo. A ocorrência não deve gerar outro lembrete/outbox
   para o mesmo corretor, vínculo, data e intervalo.
4. Antes de confirmar e durante o turno, verifique que o corretor não aparece
   como elegível para a distribuição automática nem na seleção manual da fila;
   o lead deve permanecer na fila ou seguir apenas o fallback que já estiver
   configurado para ela.
5. Abra o link recebido. A página deve identificar o plantão e exibir o botão de
   confirmação. Confirme e confira a resposta de sucesso, a auditoria
   `duty_presence_confirmed` e o estado confirmado no detalhe do plantão.
6. Rode novamente a distribuição: o corretor confirmado deve ficar elegível
   somente para essa ocorrência até o fim do horário. Repetir o POST deve ser
   idempotente e não criar uma segunda confirmação/auditoria.
7. Teste a confirmação atrasada: em um turno ativo ainda sem confirmação,
   confirme o mesmo link e verifique que a elegibilidade passa a valer até o
   fim daquele turno; não deve liberar ocorrências futuras.
8. Teste as recusas: link inválido (HTTP 400), turno encerrado (HTTP 410) e
   vínculo/escala arquivado ou inativo (HTTP 410). Nenhum desses casos pode
   liberar o corretor para receber leads.
9. Com o template não sincronizado/aprovado, confirme que nenhum texto livre,
   outro template ou WAHA é usado. O envio deve aparecer como falha/pendência de
   lembrete, e o corretor continua inelegível.
10. Desligue a flag e confirme que a distribuição volta ao comportamento
    anterior. O histórico de confirmações não deve ser apagado.

### Checklist visual do diretor

- O cabeçalho informa `confirmados / escalados`.
- Cada corretor tem badge de confirmação ou de pendência; a confirmação mostra
  o horário quando disponível.
- Falta de confirmação é indicada como bloqueio, mas não esconde o corretor da
  lista de escala.
- Se todos estiverem bloqueados, a página explica que ninguém está elegível e
  que os leads permanecem aguardando.

## Entrega

- [x] Persistir cada ocorrência por tenant, escala, vínculo de escala, data local e intervalo.
- [x] Enfileirar o template Meta `plantao_confirm_presence` de forma idempotente, com parâmetro de URL próprio e sem fallback de mensagem livre/WAHA.
- [x] Disponibilizar `/confirm_presence?id=...` e confirmação pública validada por token imprevisível, expiração da ocorrência e vínculo de escala ainda ativo.
- [x] Exigir confirmação da ocorrência ativa na distribuição automática e na seleção manual de corretores da fila; confirmação tardia libera apenas o restante do mesmo plantão.
- [x] Mostrar checklist individual e badges pendente/confirmado no detalhe do plantão.
- [x] Adicionar kill switch global auditado no Super-admin, desligado por padrão, e instrução explícita para aplicar a migration antes de ativar.
- [x] Registrar regra e decisão em BR-029V / DEC-119.

## Operação / rollout

1. Aplicar `drizzle/0156_duty_presence_confirmation.sql` no banco do CRM.
2. Sincronizar na WABA do tenant o template Meta aprovado `plantao_confirm_presence`, com variáveis de corpo `nome` e `hora` e botão URL dinâmico terminado em `confirm_presence?id={{1}}` (parâmetro enviado pelo CRM).
3. Confirmar que o agendamento Coolify já existente chama `/api/internal/jobs/distribution` com a frequência operacional esperada. A varredura de lembretes roda junto com a distribuição; não é necessária uma nova task.
4. Ativar “Confirmação obrigatória” em Super-admin → Configurações depois dos passos acima.
5. Verificar o checklist no detalhe do plantão e monitorar a resposta `dutyPresence` no job. Para rollback imediato, desligar a flag; os registros históricos são preservados.

## Evidências

- Testes focados: 5 arquivos / 33 testes aprovados, incluindo janela e fuso, confirmação tardia, validade por ocorrência e uso exclusivo do template aprovado.
- `npm run db:check`: aprovado.
- `npm run type-check`: aprovado no harness full.
- `npm run lint`: aprovado; o repositório reportou avisos existentes, sem erros.
- `npm run build`: aprovado, incluindo a geração da rota pública e da página `/confirm_presence`.
- Harness full: docs, changed-files, arquitetura, diagnóstico de segurança/desempenho, lint e type-check concluídos. O scanner de segurança registrou dois achados heurísticos nos arquivos de ações do Super-admin e da rota pública; a rota pública valida o corpo com Zod (`safeParse`) e o endpoint deriva tenant/identidade exclusivamente do token aleatório persistido. A suíte geral teve 921 testes aprovados e 1 falha não relacionada em `src/features/broker-workspace/broker-lite-experience.test.tsx` (asserção de ordem de leitura do contrato da rota Lite); o harness interrompeu antes do build, que foi executado e aprovado separadamente.
- Relatório do harness: `reports/agent/verification/2026-09-23T21-28-52.775Z.md`.

## Limites

- A flag permanece desligada até migration e template Meta aprovados estarem disponíveis.
- Nenhuma migration foi aplicada a um banco, e nenhuma publicação/push foi feita nesta entrega.
- As demais mudanças locais encontradas no worktree foram preservadas; algumas são de escopo alheio a esta funcionalidade.
