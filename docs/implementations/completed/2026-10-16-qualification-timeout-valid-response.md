# Timeout de qualificacao exige resposta valida

## Regra entregue

O timeout so classifica como warm quando a memoria da conversa tem pelo menos um campo explicito, valido e originado em mensagem de entrada posterior a uma pergunta enviada pela qualificacao. A mensagem inicial do lead nao conta como resposta a uma pergunta. Respostas sem dado valido, como "Nenhuma" ou zero vidas, resultam em cold.

O timeout distribui o lead com qualification_state = PARTIAL e sem qualification_completed_at, pois a coleta nao foi concluida. Reabrir manualmente a qualificacao reinicia o prazo pelo evento de auditoria qualification.manually_reverted_to_qualifying; uma mensagem mais recente ainda prevalece como inicio do prazo.

## Implementacao

- src/features/ai-agent/qualification-timeout-policy.ts: validacao pura da resposta elegivel e calculo do ancoramento do prazo.
- src/features/ai-agent/qualification-timeout-sweep.ts: memoria, historico de mensagens e evento de reabertura consultados com escopo de tenant; classificacao incompleta gravada antes da distribuicao.
- src/features/ai-agent/qualification-timeout-policy.test.ts: cobertura para o caso Rita, resposta valida, zero vidas e reinicio do timeout.
- Sem alteracao de schema ou migration.

## Validacao

- npx vitest run src/features/ai-agent/qualification-timeout-policy.test.ts src/features/ai-agent/qualification-timeout-sweep.test.ts: 5 testes passaram.
- npx tsc --noEmit -p .: passou.
- ESLint dos tres arquivos de codigo alterados: passou.
- npm run build: Turbopack parou antes da compilacao porque o junction de node_modules aponta para fora da raiz reconhecida. npx next build --webpack tambem encerrou com o worker code 3221226505, sem diagnostico TypeScript.
- npm run agent:verify -- --level full: documentacao, escopo, arquitetura, seguranca e desempenho passaram; o type-check passou. Lint completo falhou no scan de encoding (mojibake preexistente em 3 arquivos). A suite ampla passou 415 arquivos/2.281 testes e falhou 6 testes em 5 arquivos: dois dependem de DATABASE_URL, dois tiveram timeout, um usa mock Drizzle incompleto e um teste Meta espera texto ausente. O relatório esta em reports/agent/verification/2026-10-16T14-09-09.840Z.md.
- Diagnosticos de arquitetura e desempenho apontaram somente o tamanho preexistente de src/features/roadmap/roadmap-data.ts (167 KB).

## Risco e recuperacao

Leads com memoria antiga sem sourceMessageId, resposta de origem rastreavel ou confianca explicita ficam cold no timeout. Isso evita promover um lead com base em inferencias ou na mensagem inicial. A recuperacao continua sendo a reabertura manual da qualificacao.
