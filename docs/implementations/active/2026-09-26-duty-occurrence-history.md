# Histórico de ocorrências encerradas do plantão

## Contrato

- `unit_duty_schedules` define uma regra semanal recorrente. Encerrar o turno de uma data não desativa essa regra para a semana seguinte.
- Uma ocorrência usa a data local e a janela de início/fim no fuso do plantão; depois do fim aparece como **Terminado**, em leitura, com link próprio por data.
- Atribuições de leads devem vir de eventos persistidos (`lead_distribution_events`), conservando o corretor da época mesmo que o lead seja reatribuído depois. A fila e a janela temporal são filtros; sem identificador explícito do plantão, um evento legado em fila compartilhada tem vínculo estimado, não comprovado.
- O histórico não deve usar `leads.corretor_id` ou `assigned_at` atuais como fonte retrospectiva. Leads removidos conforme política de retenção não podem ser reconstituídos.
- A regra continua a operar somente nos dias/horários configurados. O histórico não faz mutação nem executa roteamento.

## Entrega

1. O detalhe oferece as oito ocorrências encerradas mais recentes e um seletor para qualquer data anterior válida. Fora do turno ativo ou do turno ainda por começar no dia, abre a última ocorrência encerrada em leitura; no turno atual mantém a tela operacional.
2. A ocorrência encerrada mostra **Terminado**, horário local, corretor da atribuição, ofertas aceitas/recusadas/expiradas, presenças e vínculos de escala encontrados. Não apresenta ações de convidar, pausar ou editar aquela ocorrência.
3. A atribuição confirmada por oferta vem de `lead_offers.accepted_at`; atribuições diretas vêm dos eventos de distribuição. Uma oferta nova em fila exclusiva registra `offerId`, `scheduleId` e `dutyDate` no evento `offer_sent` quando o corretor pertence a uma única ocorrência ativa. O dado antigo é classificado como estimado pela fila.
4. A consulta é auditada, escopada por tenant/unidade e controlada por flag global reversível do Super-admin. A flag não apaga registros.
5. A migration 0161, aditiva, foi aplicada de forma isolada e transacional ao banco configurado em `.env.local` porque o código já consultava `duty_date` em `duty_roster_assignments`; sem ela, a rota de plantões retornava erro. O hash foi registrado no histórico de migrações.

## Refinamento visual de 26/09

O detalhe ativo e o encerrado compartilham a mesma hierarquia: nome em título principal, estado em badge, descrição curta e etiquetas para data, horário, unidade e fila. As seções usam `SectionCardHeader` para título e descrição consistentes, com contagens em badges. O histórico terminado mantém a tabela em leitura e a indicação de vínculo estimado; o ativo mantém filtros, cobertura e checklist sem alterar ações. Um turno futuro sem ocorrências passadas não mostra um card histórico vazio. Nenhum dado, permissão ou regra de distribuição foi alterado por este refinamento.

## Segurança e reversão

Todas as leituras usam tenant da sessão e escopo de unidade do Gestor. A capacidade de leitura pode ser desativada no Super-admin sem apagar eventos. Não há exclusão nem reescrita de histórico.

## Limites conhecidos

- Eventos legados sem `scheduleId` podem ter origem em outra regra que compartilhava a mesma fila e horário. A interface explicita esse grau de confiança.
- A escala passada é reconstruída dos vínculos cuja vigência cobre o dia; remoções e mudanças posteriores podem limitar sua fidelidade. Leads apagados conforme a política de retenção não são reconstituíveis.
- Quando mais de uma ocorrência está ativa para o mesmo corretor, a oferta nova não recebe vínculo exato e continua identificada como estimada. Atribuições manuais sem seleção explícita do plantão também são estimadas.
- QA autenticado de Gestor e Corretor Lite e revisão visual em viewports estreitos continuam pendentes; ver `reports/agent/verification/2026-09-26-duty-occurrence-history.md`.
