# Reatribuição no drawer usando os corretores do plantão

## Causa

A reatribuição anterior validava todos os destinos pelo fluxo genérico de
transferência: exigia unidade escolhida, filtrava o corretor por essa unidade e
gravava a fila padrão da unidade. O commit `4afaef77` substituiu a validação
anterior do roster ativo da fila ao habilitar transferências entre unidades.
Assim, o drawer deixou de aplicar a regra já aprovada em BR-024C/DEC-116.

## Implementação

- O drawer consulta `getLeadDutyReassignmentOptions` ao abrir e, com plantão
  ativo na fila, oculta unidade e mostra apenas corretores elegíveis daquele
  roster. Durante a consulta, não permite escolher um destino genérico; erros
  não ampliam o escopo como fallback.
- A ação de servidor relê a fila e o roster com tenant confiável, valida que o
  corretor e a escala continuam elegíveis, preserva a unidade/fila do lead e
  registra `dutyScheduleId` no lead, tentativa e evento de distribuição.
- Oferta manual também revalida o roster no serviço; eventual falha volta à
  distribuição normal da mesma fila. Sem plantão ativo, permanece o fluxo
  aprovado de transferência manual entre unidades (DEC-133).
- UX e regra de produto registrados em `docs/ux/UX_REDESIGN_CONTROL.md`,
  `docs/business-rules.md` (BR-024C) e `src/features/roadmap/roadmap-data.ts`.

## Validação

- `node node_modules/typescript/bin/tsc --noEmit` — passou.
- `npm run build` — passou; compilação otimizada, verificação TypeScript e
  geração estática concluídas (86/86 páginas).
- `git diff --check` — passou; apenas avisos informativos de conversão LF/CRLF.
- Testes automatizados não foram executados nesta solicitação.
- Evidências detalhadas em
  `reports/agent/verification/2026-10-07-lead-drawer-duty-reassignment.md`.
