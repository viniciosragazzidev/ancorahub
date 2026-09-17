# Refinamento UX da Central de Distribuição

Data: 17 de setembro de 2026

## Objetivo

Tornar o gerenciamento de filas, entradas e plantões mais claro e previsível,
sem alterar regras de roteamento, permissões, persistência ou contratos do motor.

## Escopo implementado

- Abas da central com nomes orientados à tarefa: Operação, Filas, Entradas & Regras,
  Plantões, Resumo e Saúde.
- Fluxo visual curto dentro da central: entrada → fila → plantão → operação,
  com descrição da área ativa e navegação por teclado.
- Campanhas deixaram de ser editadas em dois pontos: os cards de fila exibem apenas
  o resumo e levam à seção canônica de Entradas por campanha Meta.
- Seções de campanha e exceção por anúncio receberam âncoras estáveis para revisão
  contextual e preservam rolagem com altura limitada.
- Criação de plantão passou a explicar dependências, quantidade de regras geradas,
  unidades, dias e filas selecionadas antes do salvamento.
- O botão de novo plantão fica indisponível quando a unidade selecionada não possui
  fila disponível, com orientação explícita de recuperação.

## Contratos preservados

Nenhuma regra de negócio, ação server-side, schema, autorização, tenant scope ou
precedência de roteamento foi alterada. O editor de entradas continua usando as
mesmas Server Actions e a criação de plantão continua gerando as combinações
atuais de unidade, fila e dia.

## Validação

- Contexto de engenharia, contrato UX e playbooks de layout, clareza, hardening,
  acessibilidade, tipografia e UI polish consultados.
- ESLint dirigido nos componentes alterados: aprovado.
- `git diff --check`: aprovado.
- Detector de layout do Impeccable: nenhum achado.
- `npm run agent:verify -- --level full`: documentação, escopo, segurança e lint
  concluídos; type-check parou no erro preexistente em `scripts/_tmp-diag2.ts`
  (`p.userId` possivelmente nulo).
- `npm test`: 783 testes aprovados; 1 falha preexistente em
  `broker-lite-experience.test.tsx`.
- `npm run build`: compilação Turbopack concluída; type-check interrompido pelo
  mesmo script temporário preexistente.
- QA visual autenticado por papel/viewport: ainda recomendado antes de promover
  a etapa UX-M1.10; não bloqueia a composição estática entregue.

## Riscos e rollback

Risco limitado à composição e aos rótulos da central. O rollback consiste em
reverter os arquivos de componentes listados no commit; não há migration nem
alteração destrutiva de dados.
