# Atendimento — pendência fechada em 21/07/2026

## Entregue

Ao compartilhar uma cotação, o CorreTop agora executa uma única transação que:

1. valida o tenant e o escopo do responsável (corretor por lead e gerente por filial);
2. marca a cotação como `shared`;
3. registra a interação no histórico do lead;
4. cria uma tarefa de retorno para 48 horas, atribuída ao corretor do lead;
5. reprograma a mesma tarefa quando a cotação é compartilhada novamente, evitando duplicidade;
6. registra auditoria da cotação e da tarefa.

A ação é refletida na tela do lead com a confirmação “Proposta compartilhada. Retorno criado para 48h.”

## Critério de operação

O atendimento não termina no envio do link: o próximo contato aparece em Tarefas e no detalhe do lead. Se a operação repetir o compartilhamento, o prazo é renovado em vez de gerar uma nova tarefa.

## Pendências que continuam fora deste ciclo

Estas melhorias ainda dependem de decisões de produto ou de infraestrutura e não foram mascaradas como concluídas:

- cálculo automático de preço por faixa etária na cotação;
- fila financeira para cancelamentos;
- testes ponta a ponta do fluxo completo;
- executor de jobs em intervalo de dois minutos (o Vercel Hobby mantém apenas a contingência diária atual).

Esses itens permanecem explicitamente como parciais no roadmap.
