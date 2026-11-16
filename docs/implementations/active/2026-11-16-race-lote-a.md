# Race conditions do CRM, Lote A

Data: 2026-11-16. Branch `fix/race-lote-a`.

## Objetivo

Fechar concorrências de proposta/venda, documentos, atribuição, plantões, convite, retry de qualificação e entrada de leads usando garantias duráveis no PostgreSQL. Sem migration, DDL, escrita em produção, Redis, fila nova ou lock em memória.

## Escopo e sequência

1. Proposta aprovada para venda: claim condicional na proposta; só o vencedor cria cliente, venda, comissão, lembretes e efeitos.
2. Registrar venda: reler e bloquear lead, beneficiários, requisitos e documentos em ordem fixa; revisão e remoção serializam na mesma linha.
3. Assumir investigação: update condicional por tenant, etapa e corretor esperado; efeitos somente com retorno.
4. Revisão individual e em lote: pending → reviewed com condição e RETURNING; efeitos apenas dos documentos conquistados.
5. Mover assignment: verificar e atualizar estado de origem dentro da transação.
6. Aceitar convite: claim pending e não expirado antes da ativação.
7. Retry da qualificação: incremento condicional limitado por maxRetries.
8. Criar lead: protocolo único de lock por tenant e últimos 8 dígitos aplicado ao webhook Meta, cadastro manual, CSV, marketing import, OpenWA e WAHA, com releitura transacional. A confirmação manual de duplicata permanece válida.
9. Pré-confirmação de plantão contíguo: gestão pode confirmar a próxima assignment sem criar presença duplicada; a janela é estritamente contígua, com tolerância de 0 minuto, e o evento identifica quem confirmou.

## Decisões adotadas

- “Logo em seguida” significa que início do próximo turno é exatamente igual ao fim do turno confirmado, no mesmo instante UTC calculado para a ocorrência. Não há tolerância adicional: uma lacuna de qualquer duração não oferece a ação.
- A ação fica disponível a Diretor e Gestor conforme o acesso atual à tela/ação de plantões; o Gestor continua limitado à unidade efetiva. Cargo customizado precisa manter `duty_schedules_manage`. Corretor e Supervisor sem acesso de gerenciamento não podem usar a ação.
- Reutilizar a flag existente de confirmação de presença. Não criar nova flag nem mudar a matriz de cargos.

## Validação e limites

- Testes unitários concorrentes com duas chamadas, Promise.all e barreira; testes PostgreSQL isolados são opt-in por `ERP_TEST_DATABASE_URL` e não usarão `DATABASE_URL` ou `.env.local`.
- TypeScript, Vitest focado, ESLint e build serão executados. Se o PostgreSQL isolado não estiver disponível, os casos de integração ficam skip e isso será reportado.
- Sem migrações ou alterações de schema. Rollback: reverter os commits do lote.

## Registro de execução

### Item 2 concluído

- Commit `5ab7da5b`: trava lead, beneficiários, requisitos e documentos em ordem fixa; a validação transacional exige confirmação aprovada, titular e todos os requisitos ativos aprovados.
- Revisão individual, revisão em lote e remoção atualizam somente documentos ainda pendentes/ativos e só executam efeitos para linhas retornadas.
- Testes: lógica unitária aprovada; integração concorrente com PostgreSQL isolado adicionada, mas skip porque `ERP_TEST_DATABASE_URL` não está configurada. `npx tsc --noEmit` passou.
- Risco residual: inclusão concorrente de novos requisitos/beneficiários não é serializada por locks de linhas já existentes; a gravação desses elementos deve manter o lock do lead para fechar também essa janela.

### Item 3 concluído

- Commit em preparação: claim condicional por tenant, id, unidade, status e corretor esperado; efeitos e invalidação só ocorrem com linha retornada.
- Testes: disputa concorrente com barreira permite um claim; teste da action prova que o perdedor não grava interação nem auditoria.
- Botões existentes nas duas telas já ficam desabilitados durante o envio.

Item 4 em andamento. Arquivos, testes, commits e riscos serão atualizados na conclusão.
