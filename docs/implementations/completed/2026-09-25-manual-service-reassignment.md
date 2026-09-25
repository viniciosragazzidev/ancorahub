# Reatribuição manual com reinício do atendimento

## Decisão e plano

DEC-121 aprovada: reiniciar atendimento/SLA para outro corretor, mantendo histórico.

1. Liberar a ação manual para estágios ativos, validar controle global, elegibilidade e concorrência.
2. Encerrar tentativas antigas e registrar responsáveis, estado e horários anteriores sem apagar mensagens.
3. Explicitar reinício e preservação no drawer existente (UX-M1.10, gestão, ação transferir; estados atuais mantidos).
4. Testar reinício, auditoria, bloqueios e proteção automática; executar harness fast/full e build.

## Validação

- Testes direcionados: 71/71 passaram (management-actions e domínio da distribuição).
- Harness full: 1066/1067 testes passaram; única falha em broker-lite-experience.test.tsx, fora desta alteração e já registrada em implementações anteriores. Lint sem erros (1092 avisos); type-check passou. Relatório: reports/agent/verification/2026-09-25T18-14-56.883Z.md.
- Harness fast registrou um erro de tipagem de trabalho paralelo em inbound.ts; resolvido no workspace antes do type-check do full. Relatório: reports/agent/verification/2026-09-25T18-09-48.188Z.md.
- Diagnóstico de segurança: nenhum achado. Arquitetura/desempenho: tamanho preexistente do roadmap e drawer, sem nova regressão crítica.
- git diff --check passou.
- Build de produção passou (npm run build, saída 0, Next 16.2.10, compilação, TypeScript e 82 páginas concluídos). Sem homologação em ambiente real.

## Comportamento e rollback

Apenas a ação manual passou a aceitar atendimento iniciado. Reinicia marcadores e prazo, encerra tentativas abertas anteriores e acrescenta interação/evento/auditoria com estado anterior; não remove histórico nem mensagens. Permissões e tenant são resolvidos no servidor; atualização compara owner, estágio e início para rejeitar concorrência. O controle existente feature_lead_management_actions_enabled desativa a operação no servidor. Os parâmetros de SLA continuam editáveis por tenant. Proteções do motor automático não foram alteradas.

## Estado

Implementado e validado localmente; aguardando homologação em ambiente real. Alterações de WAHA/conversas/plantão feitas em paralelo foram preservadas. Sem commit ou push nesta tarefa.
