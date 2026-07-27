# Plano de Implementação — Escala Visual de Plantão

## 1. Objetivo

Transformar a configuração de plantões em uma escala semanal visual, permitindo que Gestores e Diretores organizem corretores por dia e horário com arrastar-e-soltar, sem duplicar ou substituir as regras de distribuição já existentes.

A tela será uma nova superfície de operação. A fonte de verdade continuará no domínio de distribuição de leads e todas as alterações passarão por use cases do domínio, com validação, auditoria, escopo por filial e possibilidade de desfazer.

## 2. Diagnóstico do estado atual

A base operacional existente já oferece:

- `unit_duty_schedules`: filial, fila, dia da semana, horário, prioridade, vigência e status.
- `duty-actions.ts`: valida janela, fila da filial, conflitos de prioridade, permissão de Gestor/Diretor e auditoria.
- `lead-distribution/domain.ts`: validação determinística de janela.
- Motor de distribuição que resolve fila, elegibilidade, capacidade, disponibilidade e round-robin.
- Isolamento de Gestor na própria filial no servidor.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers` e `@dnd-kit/utilities` já instalados.

### Lacuna estrutural

`unit_duty_schedules` representa a regra operacional da unidade/fila, não a escala individual de pessoas. Portanto, arrastar corretores na semana não deve gravar diretamente nessa tabela.

Separar:

1. Regra operacional: qual fila/unidade está ativa no horário.
2. Escala: quais corretores estão alocados naquele dia e horário.
3. Elegibilidade: se cada corretor está ativo, disponível e dentro da capacidade.

Assim, a UI não quebra round-robin, SLA, pausas ou redistribuição.

## 3. Decisões necessárias antes da implementação

Registrar em `docs/decision-log.md` antes de codificar:

1. Escala recorrente por dia da semana, por datas específicas ou os dois?
2. Fuso da filial ou fuso único do tenant?
3. Um corretor pode ter turnos sobrepostos?
4. Um plantão pode ter vários corretores simultâneos?
5. Soltar em espaço vazio cria plantão ou apenas escala em plantão existente?
6. O que ocorre quando o corretor é pausado, desativado ou transferido?
7. Gestor edita apenas a própria filial e Diretor todas as filiais?
8. Alteração é imediata ou existe rascunho/publicação?
9. Há limite mínimo/máximo de cobertura por faixa?
10. Como funcionam substituições e folgas pontuais?

Recomendação para o primeiro corte: escala semanal recorrente, fuso da filial, vários corretores por faixa, proibição de sobreposição individual e edição imediata com histórico completo.

## 4. Modelo de domínio

### 4.1 Nova entidade: `duty_roster_assignments`

Campos sugeridos:

- `id`, `tenant_id`, `branch_id`, `schedule_id`, `broker_id`
- `day_of_week`, `starts_at`, `ends_at`
- `valid_from`, `valid_until`
- `status`: `draft`, `active`, `inactive`, `cancelled`
- `created_by`, `updated_by`, `created_at`, `updated_at`

Criar índices por tenant/filial/dia/horário e por corretor/vigência. A unicidade exata fica no banco; sobreposição de intervalos será validada no use case dentro de transação.

### 4.2 Exceções futuras: `duty_roster_exceptions`

Para folga, férias, feriado e substituição por data:

- `assignment_id`, `reference_date`, `action`: `remove`, `replace`, `add`
- `replacement_broker_id`, `reason`, ator e timestamps.

Não destruir a regra recorrente para representar uma exceção.

### 4.3 Use cases públicos

Criar no domínio de distribuição:

- `listDutyRoster(context, filters)`
- `listEligibleBrokersForRoster(context, branchId)`
- `createDutyRosterAssignment(input, context)`
- `moveDutyRosterAssignment(input, context)`
- `resizeDutyRosterAssignment(input, context)`
- `copyDutyRosterWeek(input, context)`
- `removeDutyRosterAssignment(input, context)`
- `publishDutyRoster(input, context)`, se houver publicação
- `resolveRosterForDateTime(branchId, dateTime)`

Cada use case deve obter tenant/papel da sessão, validar filial e corretor ativo, rejeitar conflito, executar transação, auditar antes/depois, publicar evento e revalidar a leitura.

## 5. Integração com o motor de leads

1. O motor atual continua resolvendo a janela de plantão e a fila.
2. `resolveRosterForDateTime` filtra os corretores escalados no horário.
3. O motor aplica depois ativo, disponibilidade, pausa, capacidade e round-robin.
4. Escala sem elegíveis preserva o comportamento atual de fila, alerta ou lead não atribuído.
5. Redistribuição por SLA consulta a escala válida no momento da tentativa.
6. Alterar escala não reatribui leads já atribuídos sem uma regra de negócio explícita.
7. A tabela atual e o calendário devem consultar a mesma fonte.

## 6. Eventos

Publicar:

- `duty.roster_assignment_created`
- `duty.roster_assignment_moved`
- `duty.roster_assignment_resized`
- `duty.roster_assignment_removed`
- `duty.roster_week_copied`
- `duty.roster_published`
- `duty.roster_conflict_detected`

Payload: tenant, filial, plantão, corretor, janela anterior/nova, ator, origem e timestamp. Sem PII desnecessária.

## 7. Experiência visual

### Estrutura

Manter `/leads/distribuicao/plantao` como modo completo e adicionar uma aba ou alternância visual:

- Cabeçalho com filial, semana, status e ação principal.
- Toolbar: anterior, próxima, Hoje, filial, corretor, plantão/fila e modo Escala/Regras.
- Grade semanal: segunda a domingo, eixo de horário e cartões de corretores.
- Painel lateral/drawer com corretores elegíveis, busca, disponibilidade e carga.
- Legenda textual para rascunho, publicado, conflito, pausado e sem cobertura.

### Interações

- Arrastar corretor da lista para um dia/horário cria alocação prévia.
- Arrastar cartão move a alocação.
- Alças alteram início/fim em grade de 15 ou 30 minutos.
- Duplicar replica para dias selecionados.
- Copiar semana replica atribuições válidas sem copiar exceções indevidas.
- Salvar otimista mostra “Salvando…”, confirma sucesso ou faz rollback.
- Conflito abre diálogo com causa e opções de cancelar, ajustar ou substituir.
- Teclado permite selecionar corretor, dia e horário sem depender de drag-and-drop.

### Estados obrigatórios

Carregamento, vazio, sem elegíveis, conflito, corretor pausado/desativado, permissão negada, falha com rollback, edição concorrente, sem cobertura, publicado/bloqueado, dark mode, viewport estreito e `prefers-reduced-motion`.

Não usar apenas cor: incluir texto, ícones, padrões e labels acessíveis.

## 8. Permissões

### Diretor

Pode visualizar e editar qualquer filial do próprio tenant, trocar a filial, copiar semanas, publicar e consultar auditoria consolidada.

### Gestor

Pode visualizar e editar somente a filial da própria associação. Não recebe corretores, escalas ou dados de outras filiais em queries, buscas, payloads, exportações ou eventos.

### Corretor

Não edita. Pode consultar apenas sua própria escala, se essa visão for necessária. Não recebe a lista completa de corretores.

Toda autorização deve existir no servidor; esconder controles no cliente não é segurança.

## 9. Governança do Super-admin

Criar feature flag por tenant:

- `visual_duty_roster_enabled`
- estado ativo/inativo
- rollout gradual
- parâmetros editáveis: intervalo da grade, limites de cobertura, sobreposição e publicação
- auditoria de ativação, desativação, edição e publicação
- histórico com ator, filial e antes/depois
- retorno à tela de regras sem apagar escalas

Quando desativada, mostrar motivo e alternativa, mantendo a configuração tradicional acessível.

## 10. Fases de execução

### Fase 0 — contrato

Aprovar decisões, atualizar regras/ADR, definir timezone, recorrência, conflitos, eventos e feature flag.

### Fase 1 — domínio e banco

Criar migration, schema, índices, validators, use cases, detecção transacional de sobreposição e testes determinísticos.

### Fase 2 — leitura visual

Criar consulta semanal, calendário somente leitura, filtros por filial/corretor/fila e comparar dados com a tabela atual.

### Fase 3 — drag-and-drop

Reutilizar dnd-kit, implementar criação, movimento, resize, duplicação e remoção, com feedback otimista, rollback e revalidação.

### Fase 4 — operação

Adicionar copiar semana, exceções por data, publicação se aprovada, integração com `resolveRosterForDateTime`, eventos e notificações.

### Fase 5 — governança e rollout

Adicionar controles do Super-admin, auditoria, rollout gradual, documentação de ajuda e atualização do roadmap. Marcar como `partial` até governança e integração estarem completas.

## 11. Testes e aceitação

### Domínio

- Rejeita corretor de outra filial, inativo ou sem vínculo.
- Rejeita janela inválida, invertida ou fora da vigência.
- Detecta sobreposição do mesmo corretor.
- Mantém isolamento de tenant.
- Copiar semana não duplica nem cruza filial.
- Exceções não destroem recorrência.

### Interface

- Drag, movimento e resize refletem intenção imediatamente.
- Falha restaura posição anterior.
- Conflito concorrente informa e permite recarregar.
- Funciona com teclado, foco visível e leitor de tela.
- Funciona em tela estreita, dark mode e reduced motion.

### Integração

- Lead usa a escala válida do horário.
- Pausa remove corretor da elegibilidade mesmo escalado.
- SLA preserva histórico.
- Escala vazia não cria atribuição indevida.
- Tabela e calendário exibem a mesma fonte.

### Entrega

Executar type-check, testes de domínio/integração, lint disponível, build de produção e validação manual com Diretor, Gestor e Corretor. Verificar auditoria, feature flag e ausência de PII desnecessária.

## 12. Resultado esperado

O CorreTop terá uma escala visual rápida para operação diária sem transformar a UI em uma segunda regra de distribuição. O calendário organiza a disponibilidade humana; o domínio permanece responsável por filial, fila, elegibilidade, capacidade, round-robin, SLA, auditoria e multi-tenant.

