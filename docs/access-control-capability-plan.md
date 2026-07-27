# Plano de papéis, capacidades e governança de funcionalidades

**Estado:** aprovado para implementação incremental  
**Escopo:** autorização de tenant, unidades, carteira, cargos exibidos e ativação controlada de funcionalidades.

## 1. Decisão de domínio

O CorreTop mantém três papéis de segurança no núcleo: `director`, `manager` e
`broker`. Eles são a base mínima de autorização e não devem ser substituídos por
um cargo textual. O cargo (`jobTitle`) descreve a função exercida e pode conceder
capacidades adicionais, nunca ultrapassando o escopo de tenant, unidade ou carteira.

Os cargos operacionais disponíveis são:

| Cargo exibido | Papel base recomendado | Escopo padrão | Estado |
|---|---|---|---|
| Diretor | `director` | Todas as unidades do tenant | ativo |
| Gestor | `manager` | Unidade(s) autorizada(s) | ativo |
| Corretor | `broker` | Carteira própria | ativo |
| Marketing | `broker` | Matriz; captações/importações permitidas | ativo |
| Financeiro | `broker` | Dados financeiros autorizados | ativo |
| Operações | `manager` | Filiais e filas autorizadas | ativo |
| Suporte | `broker` | Atendimento delegado | ativo |
| Compliance/Privacidade | `broker` | Leitura e auditoria autorizadas | planejado |
| Auditoria/Qualidade | `broker` | Leitura, métricas e evidências | planejado |

Compliance e Auditoria/Qualidade não devem aparecer no convite até que suas
capacidades de leitura sejam implementadas sem herdar ações operacionais do
Corretor. A criação de um cargo sem uma matriz explícita é proibida.

## 2. Separação obrigatória

1. **Cargo exibido:** `tenant_memberships.job_title`; comunicação e organização da equipe.
2. **Papel de segurança:** `tenant_memberships.role`; permissões base server-side.
3. **Escopo:** `tenant_id`, `branch_id` e `user_id`; sempre derivados da sessão e do banco.
4. **Capacidade:** chave estável, por exemplo `leads.assign` ou `documents.approve`.
5. **Funcionalidade:** módulo acionável, por exemplo `lead_distribution` ou `whatsapp_meta`.
6. **Estado operacional:** ativo, desativado, em preparação ou bloqueado por dependência.

Nenhum desses valores pode ser aceito do browser como autoridade.

## 3. Inventário atual de capacidades

### Operação do atendimento

`acessar_conversas`, `acessar_leads`, `acessar_tarefas`, `acessar_cotacoes`,
`acessar_documentos`, `acessar_clientes`, `acessar_vendas`, `acessar_dashboard`,
`criar_lead_manual`, `alterar_status_lead`, `reabrir_lead_perdido`.

### Gestão e distribuição

`ver_dashboard_equipe`, `leads_view_all`, `leads_route_to_unit`, `leads_assign`,
`leads_reassign`, `leads_bulk_assign`, `lead_queues_view`, `lead_queues_manage`,
`distribution_settings_manage`, `duty_schedules_manage`, `distribution_audit_view`,
`convidar_gestor`, `convidar_corretor`, `gerenciar_filiais`, `ver_painel_integridade`.

### Financeiro e metas

`acessar_financeiro`, `ver_fluxo_caixa`, `ver_resultado_corretor`,
`ver_comissionamento`, `ver_taxas_custos`, `ver_relatorios_financeiros`,
`ver_cronograma_repasses`, `gerenciar_financeiro`, `ver_comissao_propria`,
`ver_comissao_equipe`, `gerenciar_comissoes`, `gerenciar_metas`, `ver_meta_propria`,
`ver_meta_equipe`.

### Conteúdo, integrações e administração

`acessar_catalogo`, `acessar_configuracoes`, `acessar_configuracoes_pessoais`,
`acessar_configuracoes_unidade`, `gerenciar_configuracoes_unidade`,
`configurar_whatsapp_proprio`, `configurar_white_label`, `acessar_materiais_divulgacao`,
`gerenciar_materiais_divulgacao`, `importar_planilhas`, `importar_leads_meta`,
`ver_importacoes_meta`, `exportar_relatorios`, `acessar_roadmap`, `acessar_guia`,
`acessar_notificacoes`, `acessar_ferramentas_vendas`, `aprovar_documentos`.

Esse inventário é a fonte para testes de autorização; uma rota nova não pode criar
uma verificação textual isolada.

## 4. Sistema de ligar/desligar

### Modelo proposto

Criar um catálogo versionado de `capability_definitions` e `feature_controls`:

- `key`, `label`, `description`, `category`;
- `default_enabled`, `status` (`active`/`inactive`/`preparation`);
- `required_capabilities` e `dependencies`;
- `scope` (`global`, `tenant`, `branch`);
- `sensitive` e `requires_audit`;
- `min_role` e cargos que podem receber a capacidade.

O valor efetivo será resolvido no servidor nesta ordem:

1. Super-admin desativou globalmente → negar;
2. dependência inativa ou ausente → negar com motivo operacional;
3. tenant/unidade desativou → negar;
4. papel, cargo e escopo autorizam → permitir;
5. caso contrário → negar.

### Superfície administrativa

Adicionar ao Super-admin uma central com busca, filtros por módulo e três ações:

- ativar/desativar;
- configurar escopo e dependências;
- visualizar histórico e restaurar versão anterior.

Cada alteração deve registrar ator, tenant/unidade afetados, valor anterior,
valor novo, dependências e resultado em `platform_audit_logs`. Desativar nunca
apaga dados; somente impede novas ações e informa a recuperação disponível.

### Proteções

- Guards server-side reutilizáveis para páginas, Server Actions e Route Handlers.
- Escopo calculado pela sessão; nunca por `tenant_id`, `role` ou `branch_id` do payload.
- Cache curto versionado por tenant e invalidação após alteração administrativa.
- Fail closed para capacidades sensíveis.
- Testes de matriz para cada papel, cargo, tenant e filial.
- Auditoria de leituras e mutações envolvendo documentos, vendas, exportações e permissões.

## 5. Fases de implementação

### Fase 1 — consolidar o que já existe (agora)

- Centralizar todas as verificações em `hasCapability`/`requireCapability`.
- Formalizar Operações e Suporte no catálogo de capacidades sem ampliar escopo de dados.
- Remover verificações diretas de `jobTitle` das rotas e sidebars.
- Gerar matriz automática de cobertura: rota → capacidade → papel → escopo.

### Fase 2 — catálogo persistido (próximo ciclo)

- Migration para definições, dependências e overrides por tenant/unidade.
- Resolver efetivo único com cache e logs de decisão (sem PII).
- Tela Super-admin com confirmação, auditoria e rollback.
- Adaptar menus para refletir estado real, não apenas esconder visualmente.

### Fase 3 — cargos especializados (depois)

- Implementar Compliance/Privacidade e Auditoria/Qualidade como perfis de leitura,
  com deny-by-default para ações de atendimento e exportações.
- Revisar escopos por documento, venda e dado sensível.
- Criar convites e edição de cargo somente após a matriz ser testada.

### Fase 4 — cobertura e operação

- Testes automatizados por rota e por mutação.
- Matriz de regressão em dois tenants e pelo menos duas filiais.
- Painel de capacidades negadas, dependências quebradas e últimos overrides.
- Procedimento de emergência para desligar uma integração sem deploy.

## 6. Critérios de conclusão

- Toda rota protegida declara uma capacidade e usa o guard server-side.
- Nenhuma autorização depende apenas de ocultação de UI.
- Cada cargo possui papel base, escopo e matriz documentados.
- Super-admin consegue desligar e reativar uma funcionalidade, com auditoria.
- Testes confirmam isolamento entre tenants, filiais e carteiras.
- Build, type-check e testes de autorização passam antes de cada publicação.
