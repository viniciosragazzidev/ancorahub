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
9. Pré-confirmação de plantão contíguo: Diretor autorizado pode confirmar a próxima assignment sem criar presença duplicada; a janela é estritamente contígua, com tolerância de 0 minuto, e o evento identifica quem confirmou.

## Decisões adotadas

- “Logo em seguida” significa que início do próximo turno é exatamente igual ao fim do turno confirmado, no mesmo instante UTC calculado para a ocorrência. Não há tolerância adicional: uma lacuna de qualquer duração não oferece a ação.
- A ação fica disponível só a Diretor com `duty_schedules_manage`. A matriz base (`permissions.ts`) concede essa capacidade apenas ao Diretor; o Gestor pode acompanhar a unidade, mas a autorização de escrita da presença não foi ampliada. Cargo customizado continua sujeito ao gate `duty_schedules_manage`. Corretor, Gestor e Supervisor sem autorização de escrita não podem usar a ação.
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

- Commit `c5d12227`: claim condicional por tenant, id, unidade, status e corretor esperado; efeitos e invalidação só ocorrem com linha retornada.
- Testes: disputa concorrente com barreira permite um claim; teste da action prova que o perdedor não grava interação nem auditoria. Vitest passou: 36 testes.
- Botões existentes nas duas telas já ficam desabilitados durante o envio.

### Item 4 concluído

- Commit `07830ca7`: revisão individual, lote e remoção usam condições por status pendente/ativo e `RETURNING`; notificações, checklist, timeline e atualização da UI ficam limitados às linhas retornadas. Perda de disputa retorna mensagem de conflito.
- Testes: concorrência de duas revisões com barreira, comportamento do lote parcial e ficha Lite. Vitest passou: 15 testes; integração PostgreSQL de R10 ficou skip sem `ERP_TEST_DATABASE_URL`. `npx tsc --noEmit` passou.
- Botões de aprovação e remoção ficam desabilitados durante o envio nas telas alteradas.

### Item 5 concluído

- Commit `ccddbd2a`: mover plantão relê e trava a assignment de origem dentro da transação, valida o snapshot integral e faz `UPDATE` condicional com `RETURNING`; auditoria de sobreposição e auditoria da mudança só são gravadas para o vencedor.
- Testes: disputa de duas movimentações com `Promise.all` e barreira unitária; teste PostgreSQL isolado adicionado com a mesma barreira e skip condicional. Vitest passou: 16 testes, 3 skip por suítes PostgreSQL opt-in sem URL de teste; `npx tsc --noEmit` passou.
- O seletor de turno já é desabilitado durante a action.

### Item 6 concluído

- Commit `dbf07ffb`: o convite é consumido no início da transação por `UPDATE` condicionado a tenant, id, status `PENDING` e validade futura com `RETURNING`; ativação, associação, termos, auditoria e aviso posterior só ocorrem para o vencedor.
- Testes: duas aceitações com `Promise.all` e barreira unitária; teste PostgreSQL isolado adicionado com a mesma barreira e skip condicional. Vitest passou: 8 testes e 1 skip pela URL de banco ausente; `npx tsc --noEmit` passou.
- Botão de ativação já fica desabilitado durante o envio.

### Item 7 concluído

- Commit `64c6d6ff`: o retry usa incremento SQL atômico, condicionado ao tenant, sessão em processamento e `retry_count < maxRetries`, com `RETURNING`; no teto, libera a sessão sem aumentar o contador.
- Testes: duas tentativas simultâneas com barreira geram um incremento; teste PostgreSQL isolado adicionado e skip condicional. Vitest passou: 10 testes, 1 skip sem URL de banco; `npx tsc --noEmit` passou.

### Item 8 concluído

- Um helper `lockLeadCreationByPhone` concentra a chave original do Meta: lock transacional PostgreSQL por `hashtext(tenantId)` e `hashtext(últimos 8 dígitos)`. Meta webhook, cadastro manual, CSV/bulk, importação Meta Ads, OpenWA e o ramo de lead sintético do WAHA passam pelo helper e releem leads do tenant dentro da transação antes de inserir.
- Cadastro manual continua aceitando duplicata somente com a confirmação explícita já existente. O bulk/importação contam a duplicata encontrada durante a transação e só disparam distribuição/qualificação para linhas realmente inseridas. OpenWA também passou a validar o ID da mensagem antes de criar lead.
- O ramo atual de lead sintético WAHA está fechado por `shouldCreateSyntheticLead` (sempre `false`); a proteção foi aplicada ao ramo sem alterar essa política.
- Arquivos: `src/features/leads/phone-dedup-lock.ts`, seus testes unitário e PostgreSQL opt-in, `manual-create.ts`, `bulk-import.ts`, `marketing-import/service.ts`, `create-lead-from-webhook-sync.ts`, `src/app/api/webhooks/openwa/[tenantId]/route.ts` e `src/features/waha-cadence/inbound.ts`.
- Testes: teste unitário concorrente com `Promise.all` e barreira; integração PostgreSQL concorrente adicionada, skip sem `ERP_TEST_DATABASE_URL`. `npx vitest run ...` passou com 28 testes e 1 skip (incluindo o DB opt-in); `npx tsc --noEmit` passou.

- Correção integrada com F7: OpenWA usa `openWaPhoneCandidateFilter` nas leituras iniciais e nas releituras protegidas pelo lock. Telefones recebidos com menos de 8 dígitos fazem varredura do tenant; candidatos salvos com menos de 8 dígitos continuam incluídos para preservar `openWaSamePhone`.

### Item 9 concluído

- Commit: a pré-confirmação só aparece para Diretor com `duty_schedules_manage`, quando há presença confirmada agora e exatamente uma assignment ativa do mesmo corretor começa no instante UTC em que o turno atual termina. A tolerância é 0 minuto; sobreposição, lacuna, ambiguidade ou próxima presença já ausente/expirada não exibem a ação.
- `preconfirmContiguousDutyTarget` relê e trava a assignment atual, a confirmação atual e a assignment seguinte em uma transação. `claimDutyPresencePreconfirmation` cria a linha pendente com `ON CONFLICT DO NOTHING` e transiciona somente `pending → confirmed` com `UPDATE ... RETURNING`; o corretor usa a mesma linha e seu upsert não sobrescreve uma confirmação ganha por outro ator. Auditoria do Diretor é inserida na transação somente para a transição vencedora; repetição retorna estado já confirmado.
- A tela de plantões mostra a ação na linha da assignment atual somente quando a próxima ocorrência atende às regras. O botão desabilita durante o envio e dá confirmação inline.
- Testes unitários: disputa de dois Diretores com barreira, corrida entre pré-confirmação e confirmação do corretor, contiguidade exata, lacuna, presença inelegível e ambiguidade. Vitest focado: 39 passaram e 1 integração PostgreSQL foi skip. O teste PostgreSQL isolado cobre duas pré-confirmações concorrentes, uma única transição/auditoria e corrida com confirmação do corretor; ficou skip porque `ERP_TEST_DATABASE_URL` não está configurada. `npx tsc --noEmit` e ESLint focado passaram.
- Risco residual: a validação simultânea em PostgreSQL não foi executada nesta máquina; o teste opt-in exige a instância sintética `erp_test` local na porta 5442 com arquivo de proveniência. Não houve migration, DDL ou escrita em banco real.
