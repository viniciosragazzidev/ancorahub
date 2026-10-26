# Humanização da qualificação e parentesco opcional

## Entrega

- F1: saudação por período em `America/Sao_Paulo`, repetida na abertura e depois de seis horas sem saída do bot, e prevenção de repetição com as três mensagens recentes.
- F2: perguntas, confirmações, resumo, plano atual, retomadas de pergunta e prefixo da última pergunta receberam textos mais acolhedores. O `customText` do diretor continua exatamente como escrito.
- Preço: `priceConcernLine` acolhe a preocupação antes da próxima pergunta, sem acrescentar a fala automática quando existe pergunta personalizada do diretor.
- Parentesco opcional: convite após a qualificação completa para planos individuais ou familiares com duas ou mais idades. A resposta não é requisito de qualificação. O parser só associa parentescos por idade explícita ou por ordem com contagem exata, e preserva texto ambíguo sem adivinhar.
- Persistência: idades e parentescos em `qualification_details.beneficiarios`, sem migração. A ficha do lead mostra as relações confirmadas ou sinaliza o parentesco como não informado.

## Correções da revisão (26/10)

- O mapeamento por ordem agora exige coerência entre parentesco e idade: titular e cônjuge adultos, filhos/netos mais novos que o titular e pai/mãe mais velhos. Contradição permanece ambígua e não recebe associação.
- No pós-handoff, correções são aplicadas antes de tentar capturar a resposta opcional de parentesco. Idades novas junto a parentesco entram na correção e no resumo ao corretor; o texto livre não entra no resumo.
- A captura e a correção usam `lockVersion` ao gravar `lastProcessedMessageId`. A ficha mantém o texto original com o rótulo `O cliente escreveu:`.

## Validação

- Vitest focado: 9 arquivos, 115 testes aprovados, sem testes de banco.
- `npx tsc --noEmit -p .`: aprovado.
- ESLint nos arquivos alterados: sem erros. Os avisos existentes foram registrados no relatório de verificação.
- Validação das correções da revisão: Vitest em 7 arquivos, 92 testes aprovados; `npx tsc --noEmit -p .` aprovado; ESLint sem erros, com 16 avisos preexistentes.
- A verificação global de codificação apontou três arquivos não alterados: `docs/business-rules.md`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`.

## Fora desta entrega

- O restante do plano de humanização segue as fases atribuídas ao Vigia e às próximas etapas. Esta nota registra apenas F1, F2 e a seção 9 implementadas nesta branch.
