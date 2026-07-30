# Temporadas, metas e premiações de desempenho

## Objetivo

Permitir que o Diretor defina ciclos de ranking, mantenha metas comerciais
existentes, reinicie a apuração sem apagar histórico e registre premiações por
colocação. O acesso deve ser isolado por empresa, auditado e reversível pelo
Super Admin.

## Escopo e arquivos

- `performance_seasons` preserva rascunhos, ciclos ativos, fechados e
  arquivados, incluindo o motivo de um reinício.
- `performance_awards` registra a premiação declarada por temporada e posição;
  não executa pagamentos ou comissões automaticamente.
- `/metas/desempenho` é exclusivo do Diretor e reúne temporadas, metas e
  premiações em uma única superfície.
- `feature_performance_ranking_enabled` é o kill switch global, auditado em
  `platform_audit_logs` e exposto em `/super-admin/settings`.

## Decisões

- DEC-067 e BR-063/BR-064 definem que o reinício fecha a temporada corrente e
  cria outra; dados anteriores não são apagados.
- Metas existentes permanecem a fonte oficial. Esta entrega não duplica a
  entidade de metas nem cria pagamento, comissão ou distribuição de prêmios.

## Validações

- `npm run type-check`: aprovado.
- `npx vitest run src/features/performance/schema.test.ts`: 3 testes aprovados.
- `npm run agent:verify -- --level fast`: aprovado, incluindo 215 testes;
  evidência em `reports/agent/verification/2026-07-29T18-04-01.230Z.md`.
- `npm run db:check`: aprovado.
- `npm run agent:verify -- --level full`: aprovado; type-check, 215 testes e
  build de produção concluídos. Permanecem apenas 184 avisos de lint
  preexistentes; evidência em
  `reports/agent/verification/2026-07-29T18-10-28.403Z.md`.

## Riscos e rollback

Desativar o controle global bloqueia novos ajustes, sem remover temporadas,
metas, premiações ou auditoria. A migration 0098 é aditiva; rollback de código
deve preservar as tabelas até a revisão dos registros históricos.
