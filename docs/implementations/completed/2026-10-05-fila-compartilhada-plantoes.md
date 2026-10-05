# Fila compartilhada entre plantoes simultaneos

## Entrega

- Uma fila pode ser vinculada a varios plantoes ativos simultaneos; a tela avisa quais plantoes compartilham a fila.
- A distribuicao e o simulador unem os corretores elegiveis e aplicam a menor carga (`receivedInDuty`), pacing, falta, pausa, presenca e limite individual por ocorrencia.
- Ofertas e atribuicoes persistem `dutyScheduleId`, escolhendo a ocorrencia com presenca confirmada quando o corretor estiver em mais de uma. Historico, drawer, contadores e exportacoes consultam apenas a ocorrencia gravada.
- Plantoes inativos nao entram no roster compartilhado. Linhas historicas sem atribuicao continuam compativeis, sem backfill.

## Banco

Migration aditiva `drizzle/0183_shared_duty_schedule_attribution.sql`: adiciona colunas nullable `duty_schedule_id` em `leads`, `lead_offers` e `lead_assignment_attempts`; journal Drizzle atualizado. Migration nao aplicada.

## Correcao pos-validacao (2026-10-05)

Lead aguardando corretor (sem `dutyScheduleId`) sumia das paginas dos plantoes quando a fila era
compartilhada com irmao sobreposto. O filtro da pagina passou a incluir leads sem corretor
(`duty-schedule-profile-queries.ts:219`) e `selectLeadsForDutySchedule` distingue lead esperando na
fila (sem corretor, visivel em todos os plantoes da fila) de atribuicao legada (corretor sem
`dutyScheduleId`, tolerada so na visao de plantao unico). Testes novos em
`shared-duty-roster.test.ts`; evidencia em `reports/agent/verification/2026-10-05-shared-queue-waiting-leads-fix.md`.
Indices existentes (`leads_corretor_status_idx`, `leads_branch_queue_distribution_idx`) cobrem as
novas consultas; sem migration adicional.

## Validacao

- TypeScript (`npm exec tsc -- --noEmit`): passou.
- Vitest focado: 140 testes passaram e 1 foi ignorado em 11 arquivos (inclui menor carga entre escalas ativas, exclusao de escala inativa e particao de totais por plantao).
- ESLint dirigido: passou sem erros. A tela de operacoes reporta um aviso existente `react-hooks/set-state-in-effect` na busca de corretores.
- Build nao executado conforme solicitado.

## Correcoes solicitadas depois da validacao (2026-10-05)

- Plantao global agora desperta retry jobs de leads com unidade; escala local continua restrita a unidade correspondente (`jobs.ts`, `duty-job-schedule-scope.ts`).
- Pagina do plantao volta a incluir atribuicoes legadas sem `dutyScheduleId`, alocando-as uma unica vez pelo corretor, unidade e presenca confirmada. Leads novos mantem o vinculo explicito e aguardando distribuicao continua visivel nas filas compartilhadas.
- Gaveta do corretor usa as atribuicoes legadas reconstruidas pelo perfil, junto das atribuicoes explicitas (`duty-actions.ts`).
- Vitest focado: 13 testes passaram; ESLint dos arquivos alterados passou. Typecheck completo reporta um erro fora desta alteracao em `monthly-duty-planner.test.tsx` (fixture sem `warnings`).
- `agent:context` e `agent:verify --level fast` nao iniciaram por erro do Node `uv_os_get_passwd returned ENOMEM`. `agent:verify --level full` nao foi executado porque inclui `npm run build`, solicitado para nao rodar.

## Abas de fila no detalhe do plantao (2026-10-05)

- Com varias filas vinculadas, a lista "Aguardando distribuicao" mostra uma aba por fila, com sua contagem e leads filtrados. A lista "Distribuidos" continua agregando todas as filas; os filtros de canal permanecem.
- A fila selecionada fica no parametro `fila` da URL e a pagina usa apenas filas ja carregadas no escopo tenant do perfil.
- Testes focados e ESLint passaram. O typecheck atual esta bloqueado por sintaxe invalida em `.next/dev/types/routes.d.ts` (artefato gerado), sem erros reportados nos arquivos desta alteracao. `agent:context` continua falhando por `uv_os_get_passwd returned ENOMEM`; build nao executado conforme solicitado.
