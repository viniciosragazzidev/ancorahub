# Plano de Implementação Arquitetural: Central de Inteligência do Tenant (Tenant Intelligence Layer)

Este documento estabelece o plano completo de engenharia e produto para a **Central de Inteligência do Tenant** no AncoraHub. Esta camada não é apenas uma área estática de RAG, mas a **camada viva de conhecimento, memória e execução do tenant** que alimenta todo o CRM, agentes de IA, drawer de operações e nós de automação.

---

## 🏗️ Visão Geral da Arquitetura

```text
                  ┌─────────────────────┐
                  │   Material Upload   │
                  │ (PDF, DOCX, XLSX...)│
                  └──────────┬──────────┘
                             ↓
                  Knowledge Ingestion Pipeline
         (Parsing → Classification → Entity Extraction → Conflict Detection)
                             ↓
          ┌──────────────────┼───────────────────┐
          ↓                  ↓                   ↓
   Structured Data     Canonical Knowledge     Suggestions (Diff)
   (Company, Units)    (Categorized Docs)     (Human Approval)
          ↓                  ↓                   ↓
         CRM                RAG              MCP Tools Execution
          ↓                  ↓                   ↓
          └──────────── Tenant Intelligence ─────┘
                             ↓
                   AgentContextBuilder
                             ↓
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
        Qualification    Agent Drawer    Automation
            Agent         (MCP Chat)       Nodes
```

---

## 🚨 User Review Required (Decisões de Design e Produto)

> [!IMPORTANT]
> **1. Infraestrutura Vetorial (pgvector vs Embeddings JSON/Serviço)**:
> - O PostgreSQL do Supabase/Neon já possui a extensão `vector` (pgvector). Proponho ativar o tipo `vector(1536)` na tabela `knowledge_chunks` para busca por simetria de cosseno de alta performance combinada com busca por texto total (Full-Text Search no Postgres) para formar a **Busca Híbrida**.
> - Confirmar se a extensão `vector` está disponível no ambiente do banco de dados principal.

> [!IMPORTANT]
> **2. Fluxo Obrigatório de Aprovação Humana para Atualizações no CRM**:
> - Materiais enviados **nunca alterarão diretamente o banco de dados da corretora/unidades sem revisão**.
> - O pipeline gerará uma `knowledge_suggestion` com **Diff Visual** (`Dado Atual` vs `Dado Detectado no Material`). O administrador poderá clicar em `[Aplicar Todas]`, `[Revisar Individualmente]` ou `[Ignorar]`.
> - Após aprovação, a ferramenta MCP correspondente (`update_company`, `create_unit`) é executada e o conhecimento canônico é atualizado automaticamente.

> [!IMPORTANT]
> **3. Separação Estrita de Categorias de Conhecimento e Autoridade**:
> - Conversas históricas de atendimento servem para **estilo, few-shot e aprendizado de objeções**, mas **nunca sobem de peso em relação a políticas oficiais e tabelas da corretora**.
> - Níveis de autoridade de 1 a 5 estrelas:
>   - `5/5 ★★★★★`: Política Oficial e Regras Internas
>   - `4/5 ★★★★☆`: Material Institucional e Tabelas Oficiais
>   - `3/5 ★★★☆☆`: Material Comercial de Operadoras
>   - `2/5 ★★☆☆☆`: Conversas Históricas de Vendas (Exemplos)
>   - `1/5 ★☆☆☆☆`: Anotações e Rascunhos Informais

---

## ❓ Open Questions

1. **Provedor Padrão para Embeddings**:
   - Qual provedor padrão de embeddings prefere utilizar para indexar os chunks? *(Recomendado: OpenAI `text-embedding-3-small` por baixo custo/alta qualidade, com fallback via OpenRouter)*.

2. **Anonimização de PII em Conversas de Atendimento**:
   - Ao importar conversas de corretores para o módulo de *Exemplos de Atendimento*, deseja que a IA execute a limpeza automática de PII (anonimizando nomes, CPFs e telefones de clientes) antes da persistência? *(Recomendado: Sim, obrigatório para LGPD)*.

---

## 📋 Módulos da Central de Inteligência (`/inteligencia`)

A interface será construída seguindo `docs/ui-foundation.md` (shadcn + Unlumen UI), organizada no menu lateral sob `/inteligencia`:

```text
Central de Inteligência (/inteligencia)
├── 1. Visão Geral (Health, Métricas, Cobertura, Conflitos, Fontes expiradas)
├── 2. Corretora (Perfil institucional estruturado, tom de voz, atendimento)
├── 3. Unidades (Gestão de filiais, endereços, gerentes e horários)
├── 4. Base de Conhecimento (Artigos, manuais, FAQs e regras comerciais)
├── 5. Materiais (Upload inteligente de PDFs, DOCX, XLSX e documentos)
├── 6. Sugestões & Diff (Aprovação humana de alterações detectadas no CRM)
├── 7. Coleções (Agrupamentos de conhecimento por tema)
├── 8. Agentes & Builder (Criador visual de agentes com tools e coleções)
├── 9. Exemplos de Atendimento (Dataset de conversas reais anonimizadas)
├── 10. Regras e Políticas (Diretrizes fortes de comportamento da IA)
├── 11. Ferramentas / MCP (Registro de ferramentas e níveis de risco)
├── 12. Playground (Ambiente interativo de teste e inspeção de chunks)
├── 13. Avaliações (Suítes de testes automatizados para validar agentes)
├── 14. Versionamento (Histórico de edições e versões publicadas)
└── 15. Logs e Auditoria (Rastreabilidade completa de invocações e ferramentas)
```

---

## 🗄️ Estrutura de Banco de Dados (`src/shared/db/schema.ts`)

Serão criadas as seguintes tabelas com **isolamento estrito multi-tenant** (`tenant_id NOT NULL`):

### 1. `tenant_intelligence_profiles`
- Perfil institucional da corretora (Nome fantasia, Razão Social, CNPJ, Posicionamento, Público-Alvo, Tom de Comunicação, Horários, Canais de Atendimento, SLA, Regras de Comissionamento).

### 2. `unit_intelligence_profiles`
- Perfil estruturado de cada unidade/filial (Vinculado a `branches`, Endereço completo, Gerente responsável, Contatos locais, Horários específicos).

### 3. `knowledge_sources`
- Registro dos arquivos originais enviados (Nome, Tipo de Arquivo, URL no R2, Tamanho, Hash MD5, Status de Parsing, Tenant ID).

### 4. `knowledge_documents`
- Conhecimento Canônico derivado (Título, Categoria, Tipo de Entidade, Nível de Autoridade [1-5], Data de Validade `validFrom`/`validUntil`, Versão, Status [`draft`, `review`, `published`, `archived`]).

### 5. `knowledge_chunks`
- Trechos de texto otimizados com `vector(1536)`, Tokens, Categoria, Entidade, Metadata JSON, Nível de Autoridade e Versão.

### 6. `knowledge_suggestions`
- Propostas de atualização do CRM detectadas nos uploads (Tipo de Entidade, Dados Atuais JSON, Dados Detectados JSON, Diff JSON, Status [`pending`, `approved`, `rejected`], Aprovado Por, Data de Aprovação).

### 7. `knowledge_conflicts`
- Mapeamento de divergências entre fontes oficiais (Documento A vs Documento B, Campo Divergente, Status de Resolução).

### 8. `agent_definitions` & `agent_versions`
- Registro de agentes criados no Agent Builder (Nome, Objetivo, Modelo, Fallback, Temperatura, Coleções de Conhecimento associadas, Tools permitidas, Memory Scope, Nível de Custo, Versão Publicada).

### 9. `agent_evaluations` & `evaluation_test_cases`
- Suítes de testes de avaliação (Entrada de teste, Resposta/Ação esperada, Métricas de Precisão, Alucinação, Assertividade de Handoff e Custo por Execução).

### 10. `conversation_examples` & `playbooks`
- Exemplos de atendimentos de sucesso (Conversa anonimizada, Tags, Produto, Objeções contornadas, Etapas da venda, Boas práticas aprovadas).

---

## ⚙️ Ingestion Pipeline & Auto-Update CRM (`src/features/tenant-intelligence/ingestion/`)

```text
UPLOAD MATERIAL (PDF, DOCX, XLSX, TXT, CSV)
      ↓
[1. File Parsing & Text Extraction]
      ↓
[2. Material Classification (IA)]
   (Determina se é Perfil da Empresa, Unidade, Produto, Operadora, FAQ, etc.)
      ↓
[3. Entity & Structure Extraction]
   (Extrai Razão Social, CNPJ, Telefones, Unidades, Tabela de Preços)
      ↓
[4. Conflict Detection]
   (Compara com a base atual. Se houver divergência entre fontes oficiais, cria alert)
      ↓
[5. CRM Update Suggestions (Diff Visual)]
   (Se encontrar dados estruturados novos ou diferentes, cria proposta de aprovação)
      ↓
[6. Human Review & Approval]
   (Administrador aprova → Executa Tool MCP `update_company` / `create_unit`)
      ↓
[7. Canonical Knowledge Generation]
   (Gera documento otimizado e limpo para retrieval, independente do PDF bruto)
      ↓
[8. Structural Chunking]
   (Divide por seções lógicas: Cobertura, Carências, Elegibilidade, Valores)
      ↓
[9. Vector Embeddings Generation]
   (Gera vetores via OpenAI/OpenRouter e persiste em `knowledge_chunks`)
      ↓
[10. Publication & Version Release]
   (Atualiza a versão ativa do conhecimento do tenant)
```

---

## 🔍 Retrieval & AgentContextBuilder (`src/features/tenant-intelligence/rag/`)

Em vez de cada agente implementar seu próprio RAG:

1. **`AgentContextBuilder` Central**:
   ```ts
   export async function buildAgentContext(params: {
     agentId: string;
     tenantId: string;
     userRole: string;
     leadId?: string;
     queryText?: string;
   }): Promise<AgentContextPayload>
   ```
   Retorna um contexto montado dinamicamente:
   - **CRM Structured Context** (Dados oficiais da Corretora + Unidade + Lead).
   - **Hybrid Retrieval Results** (Top 5 chunks relevantes ordenados por simetria + autoridade da fonte + filtro de expiração `validUntil > now`).
   - **Operational Memory** (Histórico da conversa + campos coletados).
   - **Policies** (Regras estritas de comportamento da IA).
   - **Allowed MCP Tools** (Ferramentas filtradas pelo papel do usuário).

2. **Busca Híbrida (`hybrid-retrieval.ts`)**:
   - `Vector Search` (Simetria de cosseno via pgvector) + `Full-Text Search` (Postgres `to_tsquery`) + `Metadata Filters` (`tenant_id`, `authority_level >= 3`, `valid_until > NOW()`).

---

## 🤖 Agent Builder, Playground & Evaluation (`/inteligencia/agentes`, `/inteligencia/playground`, `/inteligencia/avaliacoes`)

1. **Agent Builder**:
   - Interface visual para criar e editar agentes especializados:
     - **Qualificador de Leads**
     - **Assistente de Vendas & Cotação**
     - **Especialista em Documentação**
     - **Agente de Follow-up**
     - **Agente de Suporte à Gestão**
   - Configuração de Modelo, Instruções, Coleções de Conhecimento, Memória, Tools (com Risk Level: `READ`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) e Schemas de Saída.

2. **Agent Playground**:
   - Painel interativo de testes com inspetor lateral de execução:
     - Visualização do Prompt montado pelo `AgentContextBuilder`.
     - Chunks recuperados no RAG e suas fontes.
     - Ferramentas MCP invocadas e argumentos.
     - Métricas de tempo de resposta (latência em ms), tokens consumidos e custo em R$.

3. **Agent Evaluation (Suítes de Testes)**:
   - Permite rodar 50-100 casos de teste predefinidos contra uma versão do agente (`v12`).
   - Exibe relatórios de **Precisão de Qualificação**, **Assertividade de Handoff**, **Taxa de Alucinação** e **Custo por Atendimento**.

---

## 🧱 Automações Visuais (Novos Nodes no Workflow)

Expandir o runtime de automações (`src/features/workflow-automation/`) com os novos Nodes:

1. **`Execute Agent`**: Executa um agente específico publicado na Central de Inteligência passando o contexto do lead.
2. **`Search Knowledge`**: Executa busca híbrida na base de conhecimento e retorna os chunks em formato estruturado.
3. **`Extract Entities`**: Processa textos/mensagens e extrai entidades como Idade, Tipo de Plano, CNPJ e Quantidade de Vidas.
4. **`Suggest CRM Changes`**: Dispara uma proposta de atualização no CRM para aprovação humana.
5. **`Human Approval`**: Pausa o fluxo até que um supervisor/gestor aprove a ação pendente no painel.

---

## 🔄 Fases de Implementação Propostas

### Fase 1: Fundação & Schemas do Banco
- Criar tabelas da Central de Inteligência em `src/shared/db/schema.ts` com isolamento multi-tenant e pgvector.
- Implementar as rotas base da API e o serviço `TenantIntelligenceService`.

### Fase 2: Perfil da Corretora e Unidades
- Construir as páginas `/inteligencia/corretora` e `/inteligencia/unidades` para edição dos dados estruturados oficiais.

### Fase 3: Ingestão Inteligente & Propostas com Diff Visual
- Implementar o `KnowledgeIngestionPipeline` (Upload R2, Parsing PDF/DOCX/XLSX, Extração de Entidades por IA).
- Construir a tela de `/inteligencia/sugestoes` com o **Diff Visual** e botões de aprovação humana.

### Fase 4: Engine RAG Híbrida & Canonical Knowledge
- Implementar chunking estruturado e geração de embeddings.
- Desenvolver o `hybrid-retrieval.ts` com busca vetorial + full-text + filtros por autoridade/validade.
- Construir o `AgentContextBuilder` unificado.

### Fase 5: Agent Builder, Playground & Evaluation
- Desenvolver as telas `/inteligencia/agentes`, `/inteligencia/playground` e `/inteligencia/avaliacoes`.

### Fase 6: Nodes de Automação Visual & Integração Total
- Adicionar os novos nodes ao runtime de automação.
- Conectar o Agent Drawer e os agentes de qualificação/WhatsApp à nova Central de Inteligência do Tenant.

---

## 🎯 Verification Plan (Plano de Testes)

### Automated Tests
1. **Testes do Ingestion Pipeline**:
   - `src/features/tenant-intelligence/ingestion.test.ts`: Testar a extração de entidades, classificação e geração de propostas com diff.
2. **Testes da Engine RAG Híbrida & Multi-Tenant**:
   - `src/features/tenant-intelligence/rag.test.ts`: Verificar isolamento estrito por `tenant_id`, filtragem por data de validade (`validUntil`) e cálculo de simetria vetorial.
3. **Testes do AgentContextBuilder**:
   - `src/features/tenant-intelligence/context-builder.test.ts`: Validar se o contexto combina corretamente CRM estruturado, chunks com maior autoridade e regras de políticas.

### Manual Verification
1. Fazer upload de um PDF/XLSX institucional na tela `/inteligencia/materiais`.
2. Verificar a detecção automática de dados da corretora/unidade e a criação da proposta na aba de Sugestões.
3. Aprovar a proposta via Diff Visual e validar se a ferramenta MCP atualiza os dados estruturados do CRM.
4. Testar uma pergunta no Playground do Agente ou no Agent Drawer e confirmar se a resposta utiliza o novo conhecimento canônico publicado com suas citações de fonte.
