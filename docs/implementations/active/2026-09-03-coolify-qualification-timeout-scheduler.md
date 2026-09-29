# Job periódico de timeout da qualificação

**Data:** 03/09/2026  
**Estado:** pronto para ativação no Coolify

## Objetivo

Executar a cada dois minutos a varredura de conversas da Qualificação IA que estão
aguardando a resposta do cliente por mais tempo que o limite configurado no tenant.

## Implementação

- `runQualificationTimeoutSweep` seleciona exclusivamente `ai_conversations` em
  `WAITING_CUSTOMER` e `AI_ACTIVE`, usando `lastActivityAt` como marco real da
  última pergunta ou resposta da conversa.
- O endpoint autenticado `GET|POST /api/internal/jobs/qualification-timeout`
  executa somente a varredura de qualificação.
- Cada timeout mantém a fila e a unidade já resolvidas, finaliza a qualificação,
  persiste o job e tenta atribuir imediatamente um corretor elegível.
- Sem elegível, a distribuição continua em retry auditável; fora do horário
  comercial, ela é adiada pelo motor existente.

## Operação pendente

Após o deploy, configurar no Coolify uma Scheduled Task a cada 2 minutos. O comando,
o segredo exigido e o teste de homologação estão em
`docs/runbooks/coolify-qualification-timeout-scheduler.md`.

## Verificações

- Teste de rota: rejeição sem token e execução autenticada.
- Testes de regressão de roteamento/timeout/handoff.
- TypeScript estrito.
- Build de produção em andamento no ambiente local; não há migração de banco.
