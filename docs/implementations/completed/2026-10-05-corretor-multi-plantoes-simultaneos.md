# Corretor em mais de um plantao no mesmo horario

## Entrega

- Escala semanal: `createRosterAssignmentAction` e `moveRosterAssignmentAction`
  deixam de bloquear quando o corretor ja tem escala ativa sobreposta
  (`assertNoOverlap` virou `findBrokerOverlap`, consulta que retorna o conflito).
  O save segue, registra `duty_roster_assignment.overlap_allowed` no audit log e
  a tela exibe toast informativo com o outro plantao. Capacidade maxima
  (`maximumBrokers`) e os demais bloqueios continuam valendo.
- Plano mensal: sobreposicao do mesmo corretor saiu de `findDraftProblems`
  (bloqueia publicacao/ajuste) para `findDraftOverlaps` (aviso). A revisao mostra
  o aviso em faixa de warning e o botao publicar habilita com apenas sobreposicoes.
  `updateMonthlyDutyDraftAction` e `publishMonthlyDutyPlanAction` ignoram overlap.
- Distribuicao: sem mudanca de comportamento (DEC-131). União das escalas ativas,
  ocorrencia representativa (presenca confirmada vence; senao id deterministico),
  carga (`receivedInDuty`) e limite (`maxLeadsPerBroker`) contados so pela
  ocorrencia representativa; limite por ocorrencia. Falta, pausa, presenca,
  pacing e limites continuam por plantao.

## Registro

- Decisao aprovada pelo usuario (grilling, 2026-10-05): aviso em vez de bloqueio
  nos dois fluxos; mesmo comportamento para mesma fila; vale para qualquer par de
  plantoes; auditoria obrigatoria; docs atualizadas. Ver DEC-132 em
  `docs/decision-log.md` e regra em `docs/business-rules.md`.

## Validacao

- TypeScript (`npx tsc --noEmit`): passou.
- ESLint dirigido nos arquivos alterados: 0 erros; aviso preexistente
  `react-hooks/set-state-in-effect` na busca de corretores da tela de operacoes.
- Vitest focado: `src/features/lead-distribution` 310 testes passaram (9 pulados,
  db tests); `src/app/(dashboard)/leads/distribuicao` 13 testes passaram.
- Suíte completa: 1417 passaram; 12 falhas preexistentes em areas nao tocadas
  (Meta wizard/dialog, WhatsApp connect, motion select/upload, notice link,
  foundation textarea - esta ultima reproduzida no baseline via stash) e 2 flakes
  de timeout do planner que passam isolados.
- Build nao executado.
