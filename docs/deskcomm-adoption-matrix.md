# Matriz de adoção do Deskcomm

| Capacidade | Decisão no AncoraHub | Direção |
| --- | --- | --- |
| Adaptadores de canal | Adaptar | WAHA isolado; Meta oficial continua independente. |
| Event log genérico | Adaptar depois | Preservar outboxes atuais e introduzir novos eventos sem migração forçada. |
| Cadências e fluxos versionados | Reutilizar padrão | Rascunho, simulação, publicação, pausa e rollback. |
| Guardrails e handoff de IA | Adaptar | Estender o agente já existente, sem ampliar autonomia de alto risco. |
| Orçamento, circuit breaker e avaliações | Adaptar | Governança por tenant e métricas sem PII. |
| Base de conhecimento com citações | Adaptar | Somente fontes autorizadas e publicação humana. |
| MCP externo | Não adotar agora | Primeiro Tool Registry interno; exposição externa permanece desativada. |
| Simulação de comportamento humano/anti-ban | Não adotar | Usar limites e janelas explícitos, sem evasão de políticas de provedores. |
| RLS do Supabase | Não adotar | AncoraHub usa Drizzle/Postgres com escopo de tenant no servidor. |
