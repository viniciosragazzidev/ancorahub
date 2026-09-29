# Módulo Atendimento IA

O agente conduz qualificação curta em estado persistente e só usa IA após regras determinísticas de Quick Reply. Humano em atendimento, pedido de humano, opt-out, número errado, mídia e cooldown vencem IA. O transporte usa outbox idempotente e logs sem conteúdo sensível.

Consulte `src/features/ai-agent`, `src/features/ai-qualification`, BR-058 a BR-061 e DEC-050. Testes devem cobrir idempotência, tenant, estado de conversa e bloqueio de IA.

## Qualificação contextual — 18/09/2026

- A ordem das perguntas continua determinística; a IA interpreta respostas livres,
  extrai fatos permitidos e atualiza a memória privada da qualificação.
- A primeira informação obrigatória ainda pendente nunca é pulada. Quando a resposta
  não é reconhecida, a próxima mensagem usa uma confirmação contextual em vez de
  repetir literalmente a pergunta ou avançar para outra etapa.
- Respostas livres só são aceitas como cidade quando têm formato plausível e não
  parecem uma frase de conversa. Isso evita concluir a qualificação com textos como
  “Estou saindo p dar aulas”.
- A transferência para humano só ocorre depois dos campos essenciais, de um pedido
  explícito ou de uma regra de interrupção prevista no fluxo.
