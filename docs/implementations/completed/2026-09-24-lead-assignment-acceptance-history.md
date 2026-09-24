# Aceite de oferta, início do atendimento e histórico de atribuição

## Resultado

O drawer de `/leads` registra aceite, recusa explícita e expiração sem resposta com o
corretor e horário corretos. O início do atendimento agora confirma imediatamente a
oferta e impede que um job atrasado retire o lead da carteira do corretor.

## Causa encontrada

- O worker re-semeava leads ainda marcados como `assigned` + `automatic_offer`, mesmo
  quando `firstContactAt` ou `serviceStartedAt` já estavam preenchidos.
- `processQueuedLead` permitia rotacionar qualquer owner de origem provisória, sem
  verificar se o atendimento já tinha começado.
- O botão de início atualizava o estágio, mas não confirmava a oferta nem concluía os
  jobs/ofertas pendentes; isso deixava estado operacional contraditório.
- A rotina destinada a detectar a primeira mensagem de saída estava importada, mas sem
  chamada; os webhooks de saída também persistiam a mensagem sem marcar primeiro contato.

## Implementação

- O botão e os webhooks de saída WAHA usam a mesma transação de início: grava status,
  primeiro contato e horário de início; aceita a oferta do corretor; encerra ofertas
  concorrentes e cancela entregas ainda pendentes; conclui jobs de distribuição; registra
  interação e auditoria.
- A oferta e a atribuição mantêm `corretorId`, `queueId` e `distributionStatus=assigned`.
  Assim o lead sai imediatamente da distribuição acionável e da fila de aceite, mas segue
  corretamente na carteira, no histórico e na contagem de capacidade da fila.
- A semeadura exclui leads iniciados; o processador bloqueia rotação de owners com
  atendimento/contato ou etapa comercial já avançada. A criação final da oferta revalida
  o estado sob lock, protegendo contra início simultâneo.
- Um worker que perdeu o lease para o início do atendimento não pode reabrir um job já
  concluído.
- O histórico do drawer mostra aceite com nome/hora, recusa explícita e prazo expirado
  como resultados distintos, sem expor ofertas fora do escopo autorizado do lead.

## Validação

- Reprodutor vermelho inicial: lead `in_contact` com `serviceStartedAt` ainda era
  considerado rotacionável (`true` esperado `false`).
- Testes focados: 6 arquivos, 72 testes aprovados; inclui proteção de rotação, continuidade
  de expiração sem contato, evento de mensagem de saída WAHA e histórico de ofertas.
- `npx tsc --noEmit --pretty false`: aprovado.
- `npm run agent:verify -- --level full`: documentação, escopo, arquitetura e segurança
  passaram; a suíte completa tem uma falha pré-existente e fora do escopo em
  `src/features/broker-workspace/broker-lite-experience.test.tsx` (contrato de ordem das
  rotas Lite/relatórios). Relatório: `reports/agent/verification/2026-09-24T15-34-29.211Z.md`.
- Build final pendente.

## Risco e reversão

A mudança preserva a atribuição e os campos usados por carteira, histórico e capacidade;
somente encerra oferta/job depois do início. Rollback do código reverte o comportamento,
mas as ofertas/jobs concluídos permanecem auditáveis como registros históricos. Nenhuma
migration foi necessária.
