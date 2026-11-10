# Follow-up leve quando o lead para de responder na qualificação da IA

Branch: `feat/followup-qualificacao-ia` (cortada de `origin/feat/diretor-visual-lite`). Sem migration.

## Caso

Andréia Deia (Matriz 7º Andar, sem corretor): a IA perguntou às 14:48 "Quantos anos tem quem vai usar o plano?" e a
cliente não respondeu mais. Hoje nada acontece até o tempo limite da qualificação (15 min no tenant Âncora Saúde,
30 min nos outros); aí o lead vira frio (ou morno) e vai para a fila.

## Como funciona hoje

- **Conversa da IA**: `processInboundAiResponse` (`src/features/ai-agent/conversation-state-machine.ts`) responde cada
  mensagem do cliente e envia por `sendAiOutbound`: WAHA quando a conversa veio de um número WAHA (`wahaRunId`),
  senão o canal Meta do lead (`getPreferredMetaCloudChannel`).
- **Frio**: `runQualificationTimeoutSweep` (`src/features/ai-agent/qualification-timeout-sweep.ts`, job
  `/api/internal/jobs/qualification-timeout`, a cada 2 min). Conta o tempo desde a **última mensagem trocada** (de
  qualquer lado). Estourou `timeoutMinutes`: frio se não deu nenhum dado válido, morno se deu, quente se já tem dados de
  cotação; a fila decide se o frio espera ("Segurar frios") ou é distribuído; a IA é encerrada.
- **Cadências que já existem** (nenhuma cobre este caso):
  - Qualificação turbo T1–T4 (`src/features/qualification-turbo/cadence*.ts`): só para quem **nunca respondeu** à 1ª
    mensagem, por template Meta; para na primeira resposta.
  - Recuperação de mensagem sem resposta (`unanswered-recovery.ts`): o contrário — a IA que não respondeu o cliente.
  - Regras de follow-up em /qualificacao (`followup-service.ts`, gatilho "Lead abandonou a qualificação"): só
    cadastro, nunca executa (`isFollowUpExecutionAllowed` só libera a reativação de frios).
  - Requalificação/reativação de frios: depois que já virou frio.

## Decisões (todas na opção recomendada)

| Ponto | Decisão |
| --- | --- |
| Quando dispara | Metade do tempo limite da empresa, mínimo 5 min (15 min → 7 min; 30 min → 15 min) de silêncio depois da última pergunta da IA. Só até 2 min antes do tempo limite; tempo limite menor que 9 min não tem follow-up. |
| Quantos | 1 por lead, no máximo (id fixo da mensagem `ai_silence_followup_<leadId>`: duas execuções juntas não mandam duas). |
| Horário | Todos os dias, das 8h às 21h (São Paulo). Fora disso não manda e o lead segue a regra de frio de hoje. |
| Texto | Modelo fixo pelo assunto da última pergunta da IA, com o primeiro nome. Ex.: "Andréia, consegue me dizer a idade de quem vai usar o plano? Assim eu já calculo pra você agora mesmo." Sem custo de IA e previsível. |
| Canal | Configurável em /qualificacao › Turbo: **Mesmo canal da conversa** (padrão), Só Meta ou Só WAHA. No "mesmo canal", se o canal da conversa não valer ou falhar, tenta o outro (fallback). Validação: Meta só com mensagem do cliente pela Meta nas últimas 24h (janela de atendimento) e canal Meta ativo do lead; WAHA só com execução WAHA do lead. A mensagem aparece na conversa como "IA Assistente", com o canal. |
| Flag | Interruptor "Follow-up de quem parou de responder" em /qualificacao › Turbo (por empresa, `system_settings`, sem deploy). Ligado por padrão, independente da 1ª mensagem inteligente. |
| Não manda quando | o cliente respondeu depois da pergunta; a última mensagem não é uma pergunta da IA (ex.: corretor ou humano falou); o lead nunca respondeu (isso é da cadência turbo); tem corretor; lead perdido, convertido, apagado ou arquivado; qualificação já encerrada (frio, morno, quente, descartado etc.); IA pausada, humano assumiu, opt-out ou número errado; lead segurado (`manual_hold`) ou tirado da distribuição; já mandou; fora do horário; flag desligada. |
| Depois do follow-up | O relógio do frio conta da última mensagem, então o lead ganha um novo prazo para responder ao follow-up (15 min no Âncora Saúde). Se não responder, vira frio como hoje. |

## Onde roda

Dentro do job que já existe `/api/internal/jobs/qualification-timeout` (a cada 2 min), **depois** do sweep de tempo
limite (o frio tem precedência). Sem Scheduled Task nova; o runbook foi atualizado na linha desse job.

## Arquivos

- `src/features/ai-agent/silence-follow-up-rules.ts` (+ teste): decisão pura (manda ou não, canal, texto).
- `src/features/ai-agent/silence-follow-up.ts`: busca candidatos, grava a mensagem e envia.
- `src/app/api/internal/jobs/qualification-timeout/route.ts` (+ teste): chama o sweep.
- `src/features/qualification-turbo/service.ts`, `actions.ts`, `components/turbo-admin*.tsx`: flag e canal.
- `docs/runbooks/coolify-scheduled-tasks.md`.
