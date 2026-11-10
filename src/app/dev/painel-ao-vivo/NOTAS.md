# Painel ao vivo da operação (exemplo)

Rota: `/dev/painel-ao-vivo` (só em desenvolvimento, dados de exemplo, sem banco).
Parâmetros: `?ritmo=parado|lento|normal|rapido` (intervalo da simulação: parado, 9s, 6s, 2,5s) e `&suposicoes=1` (abre a lista de suposições).

Pedido: página limpa, números grandes, sem rolagem no computador/TV, para o diretor leigo ver como está a operação do dia: leads por turno, corretores escalados por plantão (e quantos confirmaram e estão recebendo) e média de leads por corretor.

## De onde viriam os números (para a implementação)

| Na tela | Fonte no código | Observação |
|---|---|---|
| Leads recebidos hoje | `countsAsReceived` em `src/features/lead-distribution/received-in-day-core.ts` (oferta com corretor, não cancelada) | Começo do dia: o painel do diretor conta "desde 19h" (`today.ts`); o exemplo usa o dia corrido. Decidir na implementação. |
| Comparação "vs. ontem neste horário" | mesma contagem, janela de ontem até o mesmo horário | Suposição: regra nova. |
| Leads por turno (manhã, tarde) | divisão em `src/features/lead-distribution/duty-shifts.ts` (`DEFAULT_SHIFT_SPLIT_AT = "13:30"`, `dutyShifts`) e agrupamento de `duty-leads-shift-groups.ts` | |
| "Leads de hoje": faixa por turno e um cartão por fila (Tatiana: Formulário, WhatsApp; Renan: Formulário PF, Formulário PME, WhatsApp), com o total do dia e "manhã N · tarde N" embaixo | filas do "Resultado do Plantão" (`plantao-report-core.ts`, `DEFAULT_PLANTAO_REPORT_CONFIG.queues`): "Fila TATIANA" separada por `classifyPlantaoLead` em formulário (respostas de form) e WhatsApp (ctwa/sem referência); "Fila PF - Renan"; "Fila PME - Renan"; "Whatsapp Renan" | Fila é a entrada do lead, não o plantão que atende (pedido do usuário em 10/11). O total do turno inclui outras origens (indicação, frios, outras filas); a linha "Total do dia" diz quantas. |
| Noite e extra da noite | escala da noite e o extra (DEC-152), `overnightExtraReceiptGap` em `received-in-day-core.ts`, `extra-shift-domain` | O extra só aparece se houver escala dele no dia. |
| Escalados por plantão | escala do dia: `dated-duty-roster.ts`, `roster-queries.ts`, `active-queue-duty-roster.ts` | |
| Confirmaram presença | `duty-presence-domain.ts`, `duty-presence-whatsapp*.ts` (o corretor só recebe depois de confirmar, com WhatsApp conectado) | |
| Recebendo agora | `classifyBrokerLiveOfferStatus` em `duty-roster-live-status.ts`: conta como recebendo `ready`, `offer_pending` e `cooldown`; fora: `paused`, `blocked`, `capacity_full` | Suposição sobre quais estados contam. |
| Média de leads por corretor | mesma ideia do "Resultado do Plantão" (`src/features/reports/plantao-report-core.ts`, `averagesFor`): leads ÷ corretores que receberam | Só a média geral fica na tela (a média por plantão saiu para enxugar). |
| Ao vivo | hoje o painel do diretor recarrega por eventos de lead novo (ver `diretor-dashboard-preview`, "lead novo em tempo real") | O exemplo simula um acontecimento a cada 6s. |

## Design

Diretor Lite: `venancor-scope.css` + `director-skin.css` (`data-skin="diretor"`), Plus Jakarta Sans 400/500, cartões brancos com `--shadow-resting` e `--radius-panel` sobre `--surface-muted`, azul de série (`--series-1`) como única cor cromática dos gráficos, `--success` só para "ao vivo" e comparação positiva, movimento com `motion-tokens` e `prefers-reduced-motion`.

Suposições (também listadas na tela, no botão "Dados de exemplo · 7 suposições de design"):
1. Números de destaque acima da escala de texto (máx. 48px no Diretor), crescendo com a altura da tela até 128px, para ler de longe ou na TV.
2. Ponto "Ao vivo" pulsando em `--success`; o kit de movimento só tem o pulso único de atenção.
3. Comparação com "ontem neste horário": regra exata a definir.
4. Aviso de lead novo reaproveita o aviso escuro do corretor (DS Lite 5.10) em pílula; no celular aparece embaixo.
5. Chegada de lead: o número dá um pulo curto (escala 1,08) e a célula da fila acende; o kit prevê 1,04 para atenção.
6. Corretores desenhados como pontos (um por pessoa) com o azul de série em dois tons, como no gráfico de barras.
7. No celular a página rola na vertical; sem rolagem vale para computador e TV.

Prints: `docs/implementations/active/2026-11-10-painel-ao-vivo-prints/`.
