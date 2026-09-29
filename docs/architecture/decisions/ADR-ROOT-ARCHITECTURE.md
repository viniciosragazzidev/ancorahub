# ADR: Domain Root Architecture & Governance Foundation

- **Status**: Accepted
- **Date**: 2026-08-31
- **Author**: Architecture & Platform Team
- **Context Document**: `docs/architecture/AUTHORITY_MAP.md`
- **Technical Specification**: `docs/architecture/ROOT_ARCHITECTURE.md`

---

## Context

O CRM ÂncoraHub (CorreTop) opera em produção multi-tenant e expandiu rapidamente sua base de funcionalidades (distribuição inteligente, atendimento IA via WhatsApp, pipeline comercial, cálculo de comissões, múltiplos canais de comunicação).

A auditoria arquitetural consolidada em `docs/architecture/AUTHORITY_MAP.md` revelou sintomas críticos de fragmentação:
1. **Dual-Path de Distribuição**: Coexistência de dois motores concorrentes de entrega de leads (`chooseAvailableBroker` em `leads/assignment.ts` vs `processQueuedLead` em `lead-distribution/service.ts`).
2. **Autorização Ad-Hoc**: Mais de 250 locais no código realizam verificações manuais de strings literais (`context.role === "director"` ou `context.role === "manager"`), contornando a fundação de custom roles e capabilities.
3. **Multi-Unit Manager Órfão**: A tabela `tenant_manager_branches` existe no banco de dados mas é ignorada por 100% das queries da aplicação.
4. **UI Determinando Regras de Negócio**: A ordem e visibilidade das colunas do funil no Kanban são gravadas no `localStorage` de cada cliente, enquanto etapas do funil como `lost` são suprimidas visualmente.
5. **Divergências de SLA e Defaults**: Workers de SLA possuem comportamentos conflitantes (redistribuição real vs supressão em `feedback-sla.ts`), e defaults no schema SQL divergem de fallbacks em TypeScript.

---

## Decision

Decidimos estabelecer uma **Fundação Arquitetural de Governança por Domain Roots** (`src/shared/domain-root/`), baseada no princípio central:

> **"Uma regra → Um dono → Uma fonte canônica → Vários consumidores."**
> 
> *Consumer nunca é autoridade.*

### Pilares da Decisão Técnica

1. **Domain Root Contract (`createDomainRoot`)**:
   Cada domínio de negócio possui uma definição canônica com defaults imutáveis, especificações de propriedade, estratégias registradas e invariantes estritas.
2. **Controlled Extensions (Deny-by-default)**:
   Propriedades de domínio só podem receber overrides nos níveis explicitamente autorizados no contrato (`SYSTEM`, `TENANT`, `UNIT`, `TEAM`, `USER`). Qualquer override em nível não autorizado é rejeitado com `OverrideNotAllowedError`.
3. **Strategy Registry (`StrategyRegistry`)**:
   Diretores e gestores não podem criar código ou regras lógicas arbitrárias (No-Code Rule Builder). A UI e os consumidores podem apenas selecionar e parametrizar estratégias oficiais registradas pela engenharia.
4. **Versionamento e Publicação Híbrida (`DomainVersionService`)**:
   Configurações críticas passam obrigatoriamente pelo ciclo de vida `DRAFT` -> `VALIDATED` -> `PUBLISHED` -> `ARCHIVED`. Versões anteriores são arquivadas sem perda de histórico.
5. **Resolução Pura com Provenance (`resolveEffectiveConfiguration`)**:
   O cálculo da configuração efetiva é determinístico, puro e livre de side-effects. Todo valor retornado carrega metadados de Provenance (`level`, `sourceId`, `version`, `appliedStrategy`).
6. **Decision Trace e Explicabilidade Sem PII (`createDecisionTrace`)**:
   Toda execução de negócio produz um rastro de decisão estruturado, expurgando automaticamente dados pessoais sensíveis (CPF, telefone, e-mail, tokens, mensagens).
7. **Isolamento Total do Core**:
   A camada `domain-root` não possui dependências de React, `next/*`, Server Actions ou clientes de banco de dados, sendo verificada continuamente por Architecture Fitness Tests.
8. **Migração Não-Destrutiva (Strangler Fig Pattern)**:
   Nesta etapa a fundação é entregue de forma isolada, sem alterar o comportamento atual do sistema ou substituir o código legado de produção.

---

## Consequences

### Positive
- **Fonte Canônica de Autoridade**: Elimina a duplicidade de decisões de negócio entre UI, Server Actions, Workers e APIs.
- **Rastreabilidade e Auditoria Total**: Possibilita responder instantaneamente a perguntas operacionais como: *"Por que este lead foi para o corretor B e não para o A?"* e *"De onde veio a capacidade máxima configurada para esta unidade?"*.
- **Suporte Nativo a Gestores Multi-Unidade**: O contrato de escopo suporta conjuntos de unidades (`unitIds`) de forma elegante e segura.
- **Segurança Reforçada**: Deny-by-default em todas as especializações de escopo e invariants invioláveis no Root.

### Neutral / Trade-offs
- Exige que novos fluxos passem pelo Canonical Executor em vez de executar mutações diretas em tabelas Drizzle.
- Exige uma estratégia de migração faseada para evitar qualquer regressão em produção.

---

## Alternatives Rejected

### Alternativa A: Manter regras espalhadas em Server Actions e componentes
- **Motivo da Rejeição**: Inviabiliza a auditoria, torna impossível garantir isolamento multi-tenant consistente e cria divergências operacionais silenciosas entre canais.

### Alternativa B: Rule Builder arbitrário / No-code genérico ("SE X E Y ENTÃO Z")
- **Motivo da Rejeição**: Extremamente propenso a falhas de consistência, impossível de tipar de forma segura, difícil de auditar e adiciona complexidade desnecessária para as regras do negócio.

### Alternativa C: Big-bang Rewrite de todo o CRM
- **Motivo da Rejeição**: Risco operacional inaceitável para um sistema com corretores e clientes ativos em produção real.

### Alternativa D: UI como fonte de configuração e estado
- **Motivo da Rejeição**: Violação grave de segurança; o cliente web não pode ser autoridade sobre permissões, limites ou fluxos de negócio.

### Alternativa E: Um grande JSON global de configurações ("JSON Graveyard")
- **Motivo da Rejeição**: Perda de validação estrutural por domínio, falta de granularidade de escopo e incapacidade de rastrear proveniência por propriedade.

---

## Migration Plan Reference

A migração gradual seguirá a ordem documentada na Seção 18 do `ROOT_ARCHITECTURE.md`:
1. **Fase 1**: Fundação de RBAC e Escopo Multi-Filial.
2. **Fase 2**: Unificação do Motor de Distribuição de Leads (`DistributionEngine`).
3. **Fase 3**: Unificação do Funil e Pipeline (`PipelineContract`).
4. **Fase 4**: Canais de Comunicação e Limpeza de Telas Redundantes.
