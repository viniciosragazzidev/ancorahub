# Modelo de Domínio

Os termos oficiais estão em `CONTEXT.md`. Os limites mais usados são:

| Contexto | Responsabilidade | Invariantes centrais |
| --- | --- | --- |
| Leads | oportunidade, funil e proprietário | tenant, unidade/carteira, transição válida |
| Distribuição | fila, elegibilidade, SLA e oferta | idempotência, lock, auditoria |
| Atendimento IA | conversa automatizada e handoff | estado persistido, humano vence IA, opt-out pausa |
| Comunicação | canais, outbox e templates | token privado, provider idempotente, sem PII em log |
| Cotação/Venda | versões comerciais e conversão | snapshot histórico, aprovação antes de venda |
| Extensão | contexto de WhatsApp Web | backend resolve acesso, nunca envio automático |

Ao criar termo novo, defina-o em `CONTEXT.md` sem detalhes de implementação. Ao decidir
um trade-off duradouro e difícil de reverter, registre ADR ou decisão aprovada antes do
código.
