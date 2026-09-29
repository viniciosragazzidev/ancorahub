# Fallback contextual da qualificação por IA

Data: 16 de setembro de 2026

## Objetivo

Interpretar respostas naturais recebidas pelo lead quando o extrator de regras
não reconhecer o texto, preservar os fatos já coletados e devolver a escolha da
próxima etapa ao Qualification Engine determinístico.

## Escopo implementado

- Normalização de acentos e aliases de tipo de plano (incluindo “Famíliar”,
  “Família” e “Empresa”).
- Extração de composição familiar (“4 adultos e uma criança”) como cinco vidas.
- Fallback opcional por mensagem: recebe o histórico autorizado e a pergunta
  pendente, mas só pode propor `memoryUpdates` de campos permitidos.
- Valores propostos pela IA são normalizados, validados e mesclados sem apagar
  fatos explícitos; confiança baixa não substitui uma informação confirmada.
- A IA não escolhe pergunta, score, estado, destino ou transferência. Depois da
  mesclagem, `resolveDeterministicQualificationTurn` permanece como única fonte
  da próxima etapa e da mensagem enviada.
- Cada tentativa do fallback gera `aiAttendanceLogs` sem corpo de mensagem,
  telefone ou prompt, com tenant, modelo, latência e resultado.

## Validação

- Testes focados: `qualification-fallback`, `qualification-flow` e `memory` —
  38 testes aprovados.
- Reprodução de regressão: `Famíliar` -> `familiar`; `Empresa` ->
  `empresarial`; `4 adultos e uma criança` -> `5` vidas.
- Type-check não apresenta erro nos arquivos alterados; o workspace ainda
  possui o erro preexistente em `scripts/_tmp-diag2.ts`.

## Próximos portões

- Homologar um inbound real com provedor configurado e registrar a latência/p95
  do fallback.
- Adicionar cenário E2E com múltiplos fatos, resposta ambígua e handoff humano.
- Promover o registro para `completed/` após `npm run agent:verify -- --level full`
  e build de produção.

## Rollback

Reverter o commit dos arquivos de memória, fallback e state machine. Não há
migração nem alteração destrutiva; os logs de tentativa permanecem auditáveis.
