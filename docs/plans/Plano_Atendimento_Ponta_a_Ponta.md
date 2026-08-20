# Plano de implementação — Atendimento ponta a ponta

## Objetivo

Sustentar uma jornada única e auditável desde a entrada do lead até cotação,
documentação, aprovação da operadora, venda, comissão, cliente ativo e eventual
cancelamento, sem duplicar regras nas páginas.

## Decisões adaptadas ao CorreTop

1. Todo lead terá beneficiários. A criação do titular será automática quando o atendimento ainda não tiver cadastrado a família.
2. A cotação continuará compatível com o formato atual de faixas etárias durante a migração, mas passará a persistir linhas por beneficiário quando houver dados individuais.
3. Checklist será materializado por beneficiário somente para requisitos marcados como “aplica por beneficiário”; documentos familiares continuarão únicos.
4. Registro de venda exigirá apólice, início de vigência, valor aprovado e prova da aprovação da operadora.
5. Cliente ativo será uma entidade própria ligada à venda. `clients` permanece como índice de pós-venda compatível até a migração das telas.
6. Cancelamento muda o cliente ativo para cancelado, cancela parcelas futuras e sinaliza parcelas pagas dentro da janela configurada. Nunca haverá desconto automático.
7. A janela de chargeback será configurável por tenant, com padrão inicial de 90 dias, e toda alteração será auditada.

## Fases

### Fase 0 — Contrato e governança

- Atualizar glossário, regras BR-033 a BR-043 e decisão de produto.
- Registrar feature flag e configuração de chargeback.
- Definir eventos `beneficiary.created`, `quote.created`, `documents.completed`, `sale.registered`, `customer.cancelled` e `commission.chargeback_pending`.
- Auditar dados pessoais, documentos, venda, cancelamento e alteração de configuração.

### Fase 1 — Modelo de dados compatível

- Criar `lead_beneficiaries` e `quote_line_items`.
- Adicionar vínculo opcional de beneficiário a `lead_documents`.
- Adicionar `applies_per_beneficiary` aos requisitos.
- Adicionar dados de apólice e vigência em `sales`.
- Criar `active_customers` e configuração de pós-venda por tenant.
- Expandir estados de comissão para cancelada e estorno pendente.
- Migrar sem apagar dados existentes; campos novos começam opcionais.

### Fase 2 — Beneficiários e cotação

- Criar use cases para listar, incluir, editar e remover dependentes, preservando exatamente um titular.
- Exibir beneficiários no detalhe do lead e permitir captura durante a triagem.
- Calcular cotações com data de nascimento/faixa e guardar snapshot por linha.
- Manter versões anteriores e gerar PDF com detalhamento por pessoa.

### Fase 3 — Checklist documental por pessoa

- Materializar requisitos por lead e beneficiário de forma idempotente.
- Separar documentos pessoais de documentos familiares.
- Exibir fila agrupada por lead e beneficiário para gestor/diretor.
- Bloquear avanço para análise quando requisito obrigatório estiver pendente ou rejeitado.

### Fase 4 — Registro de venda

- Criar use case transacional `registerSale`.
- Validar checklist aprovado, confirmação da operadora, apólice, vigência e valor.
- Criar venda, cliente ativo, cronograma de comissão, timeline, auditoria e notificação numa transação.

### Fase 5 — Cancelamento e reconciliação

- Criar `cancelActiveCustomer` com motivo, data e evidência opcional.
- Cancelar parcelas futuras não pagas.
- Sinalizar parcelas já pagas dentro da janela como `chargeback_pending`.
- Criar fila financeira auditável para decisão manual sem apagar histórico.

### Fase 6 — Interfaces completas e contextuais

- Detalhe do lead: Beneficiários, Cotação, Checklist e Registrar venda.
- Cliente ativo: vigência, apólice, beneficiários, comissões e cancelar.
- Financeiro: pendências de estorno por unidade/corretor com escopo RBAC.
- Plugin contextual: os mesmos use cases em drawer, conversas e workspace.
- Super-admin: feature flag, janela de chargeback, auditoria e ativação por tenant.

## Critérios de aceite ponta a ponta

- Família com titular, cônjuge e filho pode ser cotada com valores individuais.
- Checklist mostra itens pessoais por pessoa e itens familiares uma única vez.
- Venda não registra sem aprovação documental, apólice, vigência, valor e evidência.
- Venda cria cliente ativo e comissão sem valor fictício.
- Cancelamento não apaga venda nem documentos, cancela futuro e sinaliza possível estorno sem descontar automaticamente.
- Diretor vê corretor e unidade em filas administrativas; gestor vê somente seu escopo.
- Cada mutação possui validação server-side, tenant scope, autorização, auditoria, feedback e testes determinísticos.
