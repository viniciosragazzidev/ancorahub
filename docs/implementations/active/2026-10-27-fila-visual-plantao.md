---
type: spec
status: implementado (27/10)
updated: 2026-10-27
tags: [crm-ancora, plantao, distribuicao]
---

# Fila visual do plantão com arrastar

Pedido: [[Vinicios Ragazzi]], 27/10. Serve à P3. Mapa do código feito pelo Lince (scratchpad da sessão, `mapa-fila-plantao.md`).

## O que aparece
Em cada plantão ativo (aba Plantão da distribuição), uma lista vertical de quem vai receber o lead seguinte, "1º, 2º, 3º…":
- **Automática:** mesma regra da distribuição (no plantão > recebeu menos no plantão > menos leads sem iniciar > menos leads ativos > ranking). Quem recebe desce para o fim.
- **Empate visível:** quando dois empatam, aparece "empate (sorteio)".
- Quem não pode receber agora (pausado, oferta pendente, limite do plantão atingido, intervalo entre ofertas) aparece embaixo, apagado, com o motivo.
- Atualiza sozinha quando um lead entra ou é aceito (com 2 s de folga) e a cada 60 s com a aba aberta.

## Arrastar
- O diretor arrasta os corretores para qualquer posição. Ao salvar, aquela ocorrência passa a usar a fila manual em rodízio.
- O primeiro corretor disponível recebe e vai para o fim. Bloqueados são pulados e mantêm a posição; novos escalados entram no fim.
- O botão "Voltar ao automático" remove a fila manual. A ordem vale até o fim da ocorrência.
- Fica registrado quem arrastou e quando (auditoria).

## Como funciona por dentro (sem SQL)
1. Função pura nova `previewQueueOrder` usa a mesma decisão da distribuição (`resolveDistributionCandidate`), então a tela não diverge da regra.
2. A fila manual fica em `system_settings` com a chave `manual-queue:<scheduleId>:<dutyDate>`, fora das telas de configurações.
3. É lida e reescrita **dentro da transação da escolha** sob a trava `distribution-pick`. A escolha automática do plantão permanece como referência; sem a trava, a fila não é alterada.
4. Arrastar usa o `@dnd-kit` que já está no projeto, com teclado acessível.
5. A ordem é uma **previsão**: se dois leads chegam juntos, a trava pode reordenar.

## Pacotes
1. `previewQueueOrder` + testes (paridade com a escolha real).
2. Prioridade manual: gravar/desfazer (server action + auditoria) e consumo sob a trava + testes de corrida.
3. Tela: lista com posições, motivos, empate, arrastar, selo e desfazer; 390px; reduce-motion.
4. Atualização viva (evento + 60 s), sem consulta nova no layout.

## Decisões do Vinicios (27/10)
1. **Arrastar livre:** o diretor pode arrastar para QUALQUER posição, deliberadamente (não só para o topo). Regra: assim que ele arrasta, aquele plantão passa a usar a **fila em rodízio** que ele montou: o 1º da lista que puder receber leva o lead e vai para o fim. Corretor novo que entra no plantão vai para o fim. Sem arrastar, segue o automático (nivelamento). Botão "voltar ao automático". A fila manual vale até o fim do plantão.
2. **Indicador visual forte do próximo:** destaque claro de quem é o próximo a receber (selo "Próximo", cor/realce, animação discreta quando muda).
3. **Só o diretor** pode arrastar.
4. Bloqueado no topo (pausado, oferta pendente, limite, intervalo): é pulado nessa rodada e continua na posição (recomendação mantida).

Guardar a fila manual em `system_settings` (`manual-queue:<plantão>:<data>` = lista ordenada), lida e reescrita dentro da transação da escolha, sob a trava `distribution-pick`.

## Implementação desta branch (27/10)

As decisões acima substituem as recomendações antigas de prioridade única: a ordem manual é uma fila por ocorrência, com rodízio contínuo. `previewQueueOrder` usa `resolveDistributionCandidate` e o mesmo nivelamento de recebimentos do serviço; o selo de empate só aparece se os critérios reais restantes também empatam. A fila salva fica em `system_settings` com `manual-queue:<scheduleId>:<dutyDate>`; a data é a da ocorrência em `America/Sao_Paulo`, inclusive no plantão que cruza a meia-noite. A gravação e o reset usam a trava `distribution-pick` e auditam a ação. Sem a trava, a escolha é automática e a fila não gira. O leitor de configurações ignora essas chaves de estado.

A aba Plantão recebe prévias tenant-scoped e, para gestor, limitadas à unidade, com ordem, empate, próximo e bloqueados. Somente diretor pode arrastar; a ação valida a ocorrência ativa e os corretores no servidor. A prévia visual sem banco fica em `/dev/fila-plantao-preview`, apenas em desenvolvimento.

Pacotes entregues nesta implementação: P1 função pura e testes; P2 persistência, validação, trava e auditoria; P3 lista com arrastar, posições bloqueadas e retorno ao automático; P4 atualização por evento com debounce de 2 s e polling de 60 s quando visível.

## Validação final

- `npx vitest run src/features/lead-distribution/duty-queue-order.test.ts src/features/lead-distribution/received-in-day.test.ts --maxWorkers=1`: aprovado, 21 testes.
- `npx tsc --noEmit`: aprovado.
- ESLint focado: sem erros; resta um aviso preexistente de `setState` em efeito em `duty-operations-workspace.tsx`.
- `node scripts/check-lite-skin.mjs`: concluído em modo relatório.
- Capturas revisadas em 1440 e 390 px: `scratchpad/fila-plantao-prints/onda5-fila-plantao-1440.png` e `onda5-fila-plantao-390.png`. Sem rolagem horizontal; no celular a lista rola verticalmente.
- Não foram executados testes de banco, migrations ou push.
