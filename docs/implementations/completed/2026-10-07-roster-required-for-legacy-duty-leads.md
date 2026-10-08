# Leads legados no plantão exigem correspondência com o roster

## Causa

No detalhe de um plantão sem escalas simultâneas, a compatibilidade de histórico
incluía qualquer lead atribuído que compartilhasse a fila. Isso fazia leads de
corretores fora do roster aparecerem no plantão e inflava contadores quando a
atribuição explícita era preenchida por um backfill amplo.

## Implementação

- A consulta agora resolve as escalas ativas e as atribuições do roster também
  quando existe apenas um plantão ligado à fila.
- Leads legados com `duty_schedule_id` nulo e corretor atribuído só entram quando
  unidade, fila, janela e roster/presença permitem inferir a ocorrência. Leads
  sem corretor continuam visíveis como aguardando distribuição.
- A lista de distribuídos trata o `duty_schedule_id` explícito como vínculo
  autoritativo da ocorrência; a janela de atribuição continua sendo exigida
  para atribuição legada inferida. Isso alinha leads explicitamente vinculados
  (como os seis do Edinaldo) entre a contagem da escala e a lista.
- `BR-029Y` e o registro N28 do roadmap foram alinhados com essa regra.
- As duas atribuições feitas indevidamente para um corretor fora do roster devem
  ser revertidas para `duty_schedule_id = NULL` com update restrito aos IDs
  confirmados pelo usuário. A correção de dados não foi executada por este agente.

## Validação

- `npm run build`: concluído; compilação, TypeScript e otimização passaram. O build emitiu mensagens `Dynamic server usage` nas rotas que leem `headers`, mas finalizou com código 0.
- `git diff --check`: concluído sem erros.
- Testes automatizados: não executados. Evidência: `reports/agent/verification/2026-10-07-roster-required-for-legacy-duty-leads.md`.