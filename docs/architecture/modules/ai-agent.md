# Módulo Atendimento IA

O agente conduz qualificação curta em estado persistente e só usa IA após regras determinísticas de Quick Reply. Humano em atendimento, pedido de humano, opt-out, número errado, mídia e cooldown vencem IA. O transporte usa outbox idempotente e logs sem conteúdo sensível.

Consulte `src/features/ai-agent`, `src/features/ai-qualification`, BR-058 a BR-061 e DEC-050. Testes devem cobrir idempotência, tenant, estado de conversa e bloqueio de IA.
