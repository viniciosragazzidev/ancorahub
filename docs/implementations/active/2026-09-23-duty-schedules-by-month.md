# Plantões agrupados por mês

## Escopo

Na grade de plantões, preservar os cards e as ações existentes e organizá-los em
seções recolhíveis por mês de início da vigência (`validFrom`). O mês é baseado na
data de calendário escolhida no formulário; não no momento em que o registro foi
cadastrado.

## Comportamento

- Exibir os meses em ordem: mês atual, próximos meses em ordem crescente e meses
  anteriores do mais recente para o mais antigo.
- Abrir o mês atual inicialmente; na ausência dele, abrir o próximo mês disponível
  ou o mês mais recente já registrado.
- Abrir automaticamente o grupo quando uma criação ou edição alterar o mês de
  vigência de um plantão.
- Manter calendário semanal, cards, cobertura, escalas, filtros e ações sem alteração.
- Exibir o estado expandido com botão acessível e região nomeada.

## Validação

- [x] Testes do agrupamento: mês de vigência, ordenação e mês inicial.
- [x] Harness fast/full: documentação, type-check e segurança passaram; lint sem erros (avisos preexistentes). Suite: 899/900, com uma falha preexistente no contrato de navegação Lite (`broker-lite-experience.test.tsx`), fora do escopo.
- [x] Build de produção concluído com geração das 82 páginas estáticas.
- [ ] QA visual responsivo/autenticado pendente.

## Rollback

Reverter o agrupamento mensal na grade e voltar à chamada única de `DutyTimeline`;
nenhum dado ou regra operacional é migrado.
