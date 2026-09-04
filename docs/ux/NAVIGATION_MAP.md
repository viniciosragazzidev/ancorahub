# Mapa Canônico de Navegação — Âncora CRM

**Data:** 2026-09-04  
**Etapa:** UX-1A (Auditoria)  
**Fonte:** Arquitetura de Rotas e Permissões do Sistema

---

## 1. Estrutura de Agrupamento e Homes Canônicas

O sistema consolida 29 rotas em 5 grandes domínios funcionais, com uma única **Home Canônica** para cada domínio:

```
[ ÂNCORA CRM ]
  │
  ├── 1. VISÃO GERAL & OPERAÇÃO
  │     ├── /dashboard (Home Canônica: Visão Executiva & Alertas)
  │     └── /relatorios (Métricas e Inteligência Comercial)
  │
  ├── 2. OPERAÇÃO COMERCIAL
  │     ├── /conversas (Home Canônica: Atendimento WhatsApp & Chat)
  │     ├── /leads (Gestão de Oportunidades & Pipeline)
  │     ├── /minha-fila (Fila Pessoal do Corretor)
  │     ├── /vendas (Fechamentos e Apólices Concluídas)
  │     └── /documentos (Repositório de Anexos e Propostas)
  │
  ├── 3. ROTEAMENTO & INTELIGÊNCIA
  │     ├── /distribuicao (Home Canônica: Roletas e Plantão ao Vivo)
  │     ├── /qualificacao (Agente de IA e Templates Meta WhatsApp)
  │     └── /marketing/campanhas (Gestão de Campanhas e Origens)
  │
  ├── 4. ESTRUTURA ORGANIZACIONAL
  │     ├── /equipe (Home Canônica: Colaboradores, Cargos e Permissões)
  │     └── /filiais (Unidades Físicas e Regionais)
  │
  └── 5. INTEGRAÇÕES & SISTEMA
        ├── /integrations (Home Canônica: Catálogo de Conexões)
        ├── /settings (Preferências do Tenant e Notificações)
        └── /settings/whatsapp (Conexões Cloud API e WAHA)
```

---

## 2. Matriz de Navegação e Acessibilidade por Cargo

| Rota Canônica | Diretor / Admin | Gerente / Supervisor | Corretor (Full) | Corretor (Light Mode) |
|---|---|---|---|---|
| `/dashboard` | Visão Geral Executiva | Visão da Equipe/Unidade | Visão da Carteira Própria | Card Único do Próximo Lead + Contadores |
| `/minha-fila` | Não aplicável | Não aplicável | Fila Pessoal Completa | Fila Otimizada (Touch-First) |
| `/leads` | Visão Global | Visão da Unidade/Supervisão | Leads Atribuídos | Redirecionado para `/minha-fila` |
| `/conversas` | Monitoramento Geral | Monitoramento da Equipe | Chat e Atendimento Direto | Interface de Chat Otimizada |
| `/distribuicao` | Configuração Total | Gestão de Plantão | Visualização de Status | Não visível |
| `/qualificacao` | Configuração Total | Visualização de IA | Não visível | Não visível |
| `/equipe` | Gestão Total | Gestão de Unidade | Não visível | Não visível |
| `/relatorios` | Acesso Total (inc. Financeiro) | Comercial e Equipe | Não visível | Não visível |
| `/settings/*` | Configurações do Tenant | Não visível | Preferências Pessoais | Preferências Pessoais |

---

## 3. Padrões de Deep Linking e Persistência de Estado na URL

Todas as rotas preservam parâmetros essenciais de navegação na URL:
1. **Período Granular:** `?period=7|14|30|90` (persistido globalmente em relatórios e dashboards).
2. **Abas de Domínio:** `?tab=commercial|team|units|financial` (permite bookmark e compartilhamento direto).
3. **Filtros e Busca:** `?search=joao&status=in_contact&branch=sp-centro` (sincronizado com os `ActiveFilterChips`).
4. **Contexto de Lead no Chat:** `/conversas?lead={leadId}` (abre diretamente a conversa e carrega a gaveta contextual).
