# Fallback contextual da qualificação por IA

Data: 16 de setembro de 2026

## Correção do incidente de produção - 05/11/2026

- Causa do `invalid_output (length, 0 chars)`: no endpoint OpenAI-compatible da Anthropic, o Haiku 5.5 iniciava pensamento adaptativo por padrão; os tokens internos consumiam o `max_tokens: 450` antes de existir texto visível. O gateway lia somente `message.content`, então registrava zero caracteres. A compatibilidade também não aplicava schema estruturado.
- O interpretador passa a usar `/v1/messages`, pensamento desativado, saída JSON estruturada a partir do schema Zod e `max_tokens: 1000`. A cadeia sensível permanece só em provedores pagos; Haiku direto recebe uma repetição para JSON inválido/timeout, seguido por OpenAI direto e OpenRouter pago.
- 401/402 colocam o provedor e a classe de modelo (pago/gratuito) em cooldown process-local de 10 minutos e não consomem limite de chamadas; um 402 do OpenRouter pago não desativa os modelos `:free`.
- As tentativas do perfil interpreter compartilham deadline total de 12 segundos, incluindo o retry Haiku. O turno enviado ao interpretador fica limitado a 50 mensagens e 12.000 caracteres; a consulta de pendências tem limite de 50 linhas.
- A recuperação de mensagens sem resposta roda depois do timeout, respeita o orçamento de 60 s do job e só inicia um turno com 40 s restantes. Ela relê conversa e lead antes do turno, exclui `manual_hold`, respeita a janela de timeout configurada pelo tenant e remove instruções automáticas do texto consolidado.
- O turno pendente inclui mensagens vinculadas à conversa e mensagens inbound do mesmo lead ainda sem `conversationId`; fatos originados nesse turno são reconstruídos em ordem antes de validar a resposta. Lista de idades em uma linha durante pergunta de vidas informa quantidade e média empresarial.
- Arquivos: `src/features/ai-gateway/{gateway.ts,profiles.ts}`, `src/features/ai-agent/{qualification-interpreter.ts,conversation-state-machine.ts,memory.ts}` e testes de gateway, interpretador, memória e máquina de estados.
- Validação desta entrega: `npx tsc --noEmit` passou; `npx vitest run src/features/ai-agent src/features/ai-gateway src/app/api/internal/jobs/qualification-timeout/route.test.ts` passou com 32 arquivos e 312 testes, sem variáveis de banco. Uma chamada real e única ao Messages API, com mensagens sintéticas e `interpreterOutputSchema`, retornou HTTP 200 e JSON válido. O harness integral foi interrompido a pedido durante a suíte completa; snapshots alterados por ela foram restaurados. Build não executado.

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
