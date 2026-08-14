# Matriz de Controle de Acesso (RBAC + Scope)

Este documento especifica a matriz de autorização do sistema, relacionando **Cargos (Roles)**, **Permissões (O QUE)** e **Escopos (ONDE)**.

---

## 1. Princípios de Segurança

1. **Separação de Dimensões:**
   - **Role / Capability:** O que o usuário pode fazer (`acessar_leads`, `ver_fluxo_caixa`, `importar_planilhas`).
   - **Scope:** Onde o usuário pode operar (`GLOBAL`, `UNITS`, `SELF`, `NONE`).
2. **Interseção Estrita de Escopo:**
   - O escopo efetivo é calculado no servidor: `effectiveScope = requestedScope ∩ allowedScope`.
   - Filtros ou IDs passados na requisição pelo frontend jamais ampliam o escopo do usuário.
3. **Isolamento de Tenant:**
   - O `tenantId` é resolvido estritamente através da sessão do servidor e nunca aceito via payload ou query parameter.

---

## 2. Matriz de Cargos e Escopos

| Cargo | Escopo Padrão | Permissões Padrão | Restrições |
|---|---|---|---|
| **Director** | `GLOBAL` (Tenant) | Acesso total a unidades, membros, relatórios e dashboards do tenant. | Restrito estritamente ao próprio `tenantId`. Jamais acessa outros tenants. |
| **Manager** | `UNITS` (Filiais vinculadas) | Gestão comercial, atribuição de corretores, visualização de relatórios da filial. | Bloqueado para unidades fora do `allowedUnitIds`. Não pode se promover a Diretor. |
| **Supervisor** | `UNITS` / `TEAMS` | Acompanhamento de equipe, reatribuição de leads e plantões. | Restrito aos membros e leads da filial/equipe associada. |
| **Broker** | `SELF` (Próprios dados) | Leitura e atualização de seus próprios leads, tarefas e conversas. | Bloqueado para visualização de leads de colegas de equipe sem compartilhamento explícito. |
| **Marketing** | `GLOBAL` ou `UNITS` | Integrações Meta Ads, importação de planilhas, campanhas e criativos. | Quando atribuído a unidades, limita a visão a criativos e leads dessas unidades. |
| **Financeiro** | `GLOBAL` ou `UNITS` | Fluxo de caixa, relatórios de repasses, taxas e comissionamento. | Quando atribuído a unidades, restringe o balanço financeiro às unidades autorizadas. |
