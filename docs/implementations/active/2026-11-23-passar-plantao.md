# Passar o plantão para alguém (23/11/2026)

Pedido do diretor: "troca de plantão sem a outra pessoa já estar escalada". A pessoa A abre mão de
uma ocorrência e B entra no lugar, sem B ter plantão em outro dia. Só uma cadeira muda de dono.

## Regra (`src/features/lead-distribution/duty-pass.ts`)

- Recusa: quem entra não é corretor ativo; quem sai não está no plantão; plantão começado ou
  terminado; B já está nesse mesmo plantão.
- Avisa e pede confirmação: unidade de B fora do tipo do plantão; B em outro plantão que cruza o
  mesmo horário (inclui turno que passa da meia-noite).
- `passSeat`: tira A, põe B; se a entrada falhar, A volta (a cadeira nunca fica vazia por erro).
- O agente do diretor (`plantao_passar_cadeira`) usa a mesma regra e o mesmo `passSeat`. O choque
  de horário vira aviso na resposta do agente, sem bloquear.

## Servidor (`duty-pass-actions.ts`)

- `listDutyPassOptionsAction` e `passDutySeatAction`. Diretor e Gestor (gestor só com corretor
  da unidade), capacidade `duty_schedules_manage`, chave do Super-admin
  `feature_duty_seat_pass_enabled` (padrão ligada).
- Lê e escreve pelo backend do agente: escala publicada (atualiza o rascunho mais novo junto),
  rascunho do mês e plantão avulso (escala semanal de um dia). As ações de baixo mantêm
  permissão, escopo, auditoria e aviso no app para quem sai e quem entra.
- Auditoria extra: `duty_roster.passed` em `duty_occurrence`, com A, B, origem e avisos aceitos.
- Sem WhatsApp (não usa o número oficial com corretor).

## Interface (Lite)

- `DutyPassPicker` (novo, compartilhado): busca, cartão "Sai A, entra B" com avisos, um botão
  ("Passar o plantão" ou "Passar mesmo assim"), toast com Desfazer.
- Entradas: "Efetuar troca" do painel do corretor ganhou "Trocar com alguém | Passar para alguém";
  folha do plantão do calendário ("Passar" ao lado de "Tirar do plantão"); planner do mês (seta na
  etiqueta do corretor); escala do plantão avulso ("Passar" em cada escalado).
- `SearchAddList` ganhou `actionLabel` e `actionIcon` (padrão continua "Adicionar" e +).

## Testes

- `duty-pass.test.ts`: publicado, rascunho, avulso, B no mesmo plantão, B no mesmo horário,
  fora do tipo, recusas e volta de A quando a entrada falha.
- `duty-pass-picker.test.tsx`: passar com Desfazer, aceite de fora do tipo, aviso de rascunho,
  recusa do servidor.
- Agente e roteiro do laboratório (`director-agent-script`) seguem passando.
- `agent:verify --level fast`: falhas só em arquivos de outras frentes (lead-journey,
  lead-recovery sem regra de cargo; accept-lead-button; nav-registry pós-venda).
