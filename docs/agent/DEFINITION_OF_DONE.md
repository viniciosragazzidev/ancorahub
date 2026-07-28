# Definição de Pronto

Uma tarefa só termina quando:

- o contrato, regras e decisão aplicáveis foram consultados e permanecem coerentes;
- entradas, autorização, tenant e auditoria estão corretos quando aplicáveis;
- os testes proporcionais foram adicionados ou a limitação foi registrada;
- `agent:verify --level full` gerou evidência e as falhas preexistentes foram separadas;
- lint, type-check, testes e build foram executados quando a tarefa altera código;
- documentação, ADR/decisão e roadmap foram atualizados quando o escopo os afeta;
- o registro de implementação informa arquivos, validações, riscos e rollback.

Pare com sucesso apenas quando houver evidência verificável. Pare bloqueado quando a
mesma dependência externa ou decisão necessária impedir progresso por três tentativas
documentadas; nunca invente uma decisão de negócio para “fechar” a tarefa.
