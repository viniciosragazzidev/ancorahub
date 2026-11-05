# Gestor cuida do plantão da própria unidade (05/11/2026)

**Pedido do Vinicios (05/11):** no modo Gestor, o gestor vê o plantão ativo e os próximos, põe e tira corretores,
cria e edita plantões futuros e escolhe se a fila da unidade é automática ou manual. Regra: só o que é
**exclusivo da unidade dele**, nada misturado com outra unidade.

## Regra de exclusividade (`manager-unit-scope.ts`)

Um plantão é da unidade U quando:
1. está gravado em U (`unit_duty_schedules.branch_id = U`); ou é da empresa (`branch_id` nulo) e o tipo foi marcado
   só para U (`duty_schedule_types.branch_ids = [U]`); ou é da empresa, o tipo vale para todas as unidades e o plantão
   alimenta ao menos uma fila, todas de U (caso "Plantão 7° Andar" → Venâncio Leads, Matriz 7° Andar, 05/11); **e**
2. toda fila que recebe o plantão é de U (fila global ou de outra unidade derruba).

Pelos dados de 05/11: Matriz 7° Andar vê "Plantão 7° Andar"; Niterói 1 vê os "Plantão Niterói"; Matriz vê o
"Plantão PME" gravado na unidade. FRIOS, Presencial, PME (fila global) e Teste ficam só com o Diretor.

Fora disso o gestor não vê nem altera: plantão da empresa toda, tipo com várias unidades, fila de outra unidade.
Corretor e fila: só de U. Gestor sem unidade: nada.

## Onde a regra vale (servidor)

- `findScheduleForMutation` (duty-actions): pausar, duplicar, arquivar, excluir, restaurar, ausência, presença,
  leads do plantão. Fecha o furo antigo: plantão da empresa (`branch_id` nulo) passava para o gestor.
- Criar plantão: o do gestor nasce gravado na unidade; só filas da unidade; só tipo existente que vale para a
  unidade (não cria tipo); sem origem de webhook. Editar: idem, e o plantão fica gravado na unidade.
- Escala semanal (roster-actions), convidados sem conta (duty-roster-pending-actions), troca (duty-swap-actions).
- Escala mensal: gestor põe e tira corretores da unidade nos plantões exclusivos (rascunho e publicada), sem
  "escalar mesmo assim" fora da unidade. Gerar e publicar a escala continua só com o Diretor.
- Leitura: snapshot do plantão, prévia da ordem da fila, detalhe do plantão e escala mensal mostram só o exclusivo.
- Filas oferecidas no formulário de plantão: só da unidade (antes vinham todas as filas da empresa).
- Fila automática/manual: `setUnitQueueModeAction` (queue-mode-actions), só fila ativa gravada na unidade;
  ao voltar para automática, os leads que esperavam são distribuídos na hora.

## Telas

- Modo Gestor (Lite): `/distribuicao` mostra só a aba Plantão; "Plantão da unidade" no menu Mais; detalhe do
  plantão liberado. Reaproveita o workspace de plantão existente (sem tela nova).
- Card "Distribuição da fila da unidade" (Automática / Manual) acima do plantão, para o gestor.

## Testes

`manager-unit-scope.test.ts` (regra de exclusividade e modo da fila), `light-routes-manager.test.ts` (rotas).

## Pendências

- Conferência visual com um gestor real (Lite ligado) antes do merge.
- Num plantão de tipo "todas as unidades", o gestor vê e mexe só nos corretores da unidade dele; corretor de outra
  unidade escalado pelo Diretor continua lá, fora da visão do gestor.
