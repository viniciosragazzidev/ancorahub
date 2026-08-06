# Implementação — CRM comercial PF/PJ e Kanban

Data: 2026-08-05

## Entrega

- Cadastro de leads passa a usar PF e PJ; registros legados PME continuam compatíveis.
- Lead PJ com razão social cria ou reutiliza uma empresa do mesmo tenant pelo CNPJ normalizado.
- Nova rota `/empresas` mostra a carteira PJ no escopo do Diretor, Gestor ou Corretor.
- Kanban exibe todas as etapas operacionais do funil, sem criar uma segunda máquina de estados.

## Segurança e rollback

- Tenant, unidade e carteira continuam derivados da sessão; o Corretor só vê empresas com oportunidade própria.
- A mudança de status continua usando a regra existente, com timeline e auditoria.
- Rollback de interface: manter lista de leads; rollback de dados: não remover empresas criadas, pois são histórico comercial.

## Validação esperada

- Teste unitário para normalização de CNPJ.
- Type-check, testes, build e `agent:verify --level full` registrados em `reports/agent/verification/`.
