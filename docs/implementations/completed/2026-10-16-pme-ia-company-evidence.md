# Evidência empresarial na qualificação por IA

## Regra entregue

Uma mensagem com evidência empresarial positiva atualiza `planType` para `empresarial`, inclusive após uma resposta anterior `individual` ou `familiar`. Ao substituir `individual`, a qualificação remove somente `numberOfLives` implícito (`confidence=0`) e sua entrada em `collectedFields`, para perguntar a quantidade correta. Vidas informadas explicitamente permanecem. "Não tenho CNPJ" não confirma `companyHasCnpj` nem classifica a memória como empresarial. A persistência grava `PJ` para plano empresarial ou CNPJ confirmado; a qualificação não escolhe nem altera fila.

## Implementação

- `src/features/ai-agent/memory.ts`: usa `companyEvidence()` para reclassificar mensagens positivas e validar evidência de CNPJ contra negação.
- `src/features/ai-agent/conversation-state-machine.ts`: reaplica fatos determinísticos depois das sugestões do modelo e dá precedência a plano empresarial/CNPJ confirmado ao persistir `PJ`.
- `src/features/ai-agent/memory.test.ts`: cobre reclassificação após resposta individual, limpeza de vidas implícitas, negação de CNPJ e MEI.
- `src/features/ai-agent/conversation-state-machine.test.ts`: cobre a classificação persistida como `PJ`/`PF`.
- `docs/business-rules.md` (BR-085), `docs/decision-log.md` (DEC-147), `docs/ai-whatsapp-qualification.md` e `src/features/roadmap/roadmap-data.ts` registram a regra e seu limite de roteamento.

## Validação

- `npm run test -- src/features/ai-agent/memory.test.ts src/features/ai-agent/conversation-state-machine.test.ts`: 35 testes passaram.
- `npm run type-check`: passou.
- ESLint dirigido aos arquivos TypeScript alterados: 0 erros e 8 avisos já existentes nesses arquivos.
- `npm run build`: o Turbopack encerra antes de compilar porque o link de `node_modules` aponta para fora da raiz reconhecida. `npm run build -- --webpack`: compilação e geração estática passaram.
- `npm run agent:verify -- --level full`: documentação, arquivos alterados, arquitetura, segurança, desempenho e type-check passaram. O lint global parou no scanner com 952 ocorrências de mojibake em 3 arquivos preexistentes. A suíte ampla teve 434 arquivos aprovados, 16 ignorados e 4 testes falhando em 3 arquivos não tocados (dependência de `DATABASE_URL`, mock Drizzle incompleto e expectativa de mensagem Meta). Relatório: `reports/agent/verification/2026-10-16T19-40-01.614Z.md`.
- Os diagnósticos full apontaram arquivos grandes preexistentes em `conversation-state-machine.ts` e `roadmap-data.ts`; segurança não encontrou achados.

## Risco e recuperação

A mudança classifica o tipo de lead durante a qualificação e mantém o roteamento no processamento da fila. Reverter este commit restaura o comportamento anterior sem alterar schema ou distribuição.
