# Segurança e Isolamento

- Derive `tenantId`, usuário, papel e unidade no servidor. Nunca aceite esses valores
  como autoridade no body, query string, DOM ou extensão.
- Toda consulta a recurso do tenant usa filtro de tenant e, quando aplicável, filial e
  responsável. A ausência do filtro é defeito de segurança.
- Valide payloads de Route Handlers, Server Actions, webhooks e integrações com Zod ou
  schema equivalente; verifique assinatura/idempotência quando houver provider.
- Registre auditoria sem conteúdo de mensagens, documentos, tokens ou dados pessoais
  desnecessários.
- Use outbox/lock/idempotência para efeitos externos. Operações administrativas devem
  ser reversíveis, governadas e auditadas.
- Ao achar risco, pare a mutação, reduza o escopo e registre evidência em
  `reports/agent/failures/` e `KNOWN_ISSUES.md` quando recorrente.
