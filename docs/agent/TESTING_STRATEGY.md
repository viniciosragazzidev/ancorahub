# Estratégia de Testes

| Camada | Objetivo | Comando |
| --- | --- | --- |
| Unitário/domínio | regras determinísticas, schemas e guards | `npm test` |
| Tipos | contratos TypeScript | `npm run type-check` |
| Qualidade estática | encoding e ESLint | `npm run lint` |
| E2E | fluxo crítico autenticado | `npm run test:e2e` |
| Produção | compilação e rotas | `npm run build` |

Mudança de domínio exige teste de sucesso, rejeição de escopo/permissão e borda relevante.
Mudança em webhook exige idempotência. Mudança em UI interativa exige estados de erro e
recuperação; E2E é obrigatório quando fecha um ciclo operacional, não para ajuste visual
isolado. Dados de teste são sintéticos e nenhum segredo é registrado.
