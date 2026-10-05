# Fila compartilhada entre plantoes simultaneos

## Entrega

- Uma fila pode ser vinculada a varios plantoes ativos simultaneos; a tela avisa quais plantoes compartilham a fila.
- A distribuicao e o simulador unem os corretores elegiveis e aplicam a menor carga (`receivedInDuty`), pacing, falta, pausa, presenca e limite individual por ocorrencia.
- Ofertas e atribuicoes persistem `dutyScheduleId`, escolhendo a ocorrencia com presenca confirmada quando o corretor estiver em mais de uma. Historico, drawer, contadores e exportacoes consultam apenas a ocorrencia gravada.
- Plantoes inativos nao entram no roster compartilhado. Linhas historicas sem atribuicao continuam compativeis, sem backfill.

## Banco

Migration aditiva `drizzle/0183_shared_duty_schedule_attribution.sql`: adiciona colunas nullable `duty_schedule_id` em `leads`, `lead_offers` e `lead_assignment_attempts`; journal Drizzle atualizado. Migration nao aplicada.

## Validacao

- TypeScript (`npm exec tsc -- --noEmit`): passou.
- Vitest focado: 140 testes passaram e 1 foi ignorado em 11 arquivos (inclui menor carga entre escalas ativas, exclusao de escala inativa e particao de totais por plantao).
- ESLint dirigido: passou sem erros. A tela de operacoes reporta um aviso existente `react-hooks/set-state-in-effect` na busca de corretores.
- Build nao executado conforme solicitado.
