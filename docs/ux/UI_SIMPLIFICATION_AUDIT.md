# Auditoria de simplificação da interface

**Etapa:** UX-1
**Data:** 2026-09-04
**Método:** inventário de rotas reais, componentes compartilhados, Design Contract e inspeção heurística. Não foram removidas funcionalidades nesta auditoria.

## Regra de composição

1. **Essencial:** objetivo da tela, contexto, conteúdo principal e uma ação primária.
2. **Contextual:** filtros frequentes, status diretamente relacionado e ações de linha.
3. **Avançado:** configurações raras, exportações, regras, diagnósticos e ações destrutivas em menu, drawer, aba secundária ou accordion.

O usuário deve poder realizar a tarefa sem ver toda a capacidade técnica do produto simultaneamente. Nenhuma ação será removida; ações raras passam a ser reveladas sob demanda.

## Achados transversais

| Área | Evidência | Classificação | Proposta |
|---|---|---|---|
| Superfícies | `Card` sempre aplica borda e fundo; muitas features repetem `border`, `bg-card`, `rounded-xl` e sombra. | DUPLICATED | Reduzir Card padrão a superfície calma, mover elevação para popover/dialog e reservar borda para agrupamento necessário. |
| Fundos | `background`, `card` e superfícies próximas criam blocos visuais mesmo sem mudança de contexto. | TECHNICAL_NOISE | Usar página contínua e fundos sutis apenas em áreas agrupadas, tabela, seleção ou conteúdo recolhido. |
| Cabeçalhos | `PageHeader` canônico existe, mas ações e toolbars continuam duplicadas em features. | DUPLICATED | Tornar `PageHeader` o ponto único de título, contexto, ação primária e `MoreActions`. |
| Navegação | Há mais de 100 rotas reais; expor todas como primeiro nível aumenta carga cognitiva. | REDUNDANT | Sidebar por domínio, com grupos recolhíveis e rotas técnicas fora da navegação principal. |
| Ações | Há botões, ícones e links repetidos em linhas e cabeçalhos. | REDUNDANT | Uma primary por área; secundárias em dropdown; destrutivas separadas ao final. |
| Filtros | Leads e áreas operacionais já possuem filtros por URL, mas múltiplos controles tendem a competir. | CONTEXTUAL | Busca + até dois filtros frequentes; demais em “Mais filtros”, chips ativos e limpar. |
| Motion | Há motion compartilhado em controles. | CONTEXTUAL | Não adicionar motion decorativo; manter somente feedback curto e respeitar reduced-motion. |

## Inventário por rota

As rotas dinâmicas representam a página de detalhe da mesma família e devem herdar o mesmo modelo de cabeçalho, abas e ações agrupadas.

| Rota(s) | Objetivo e usuário | Essencial / ação primária | Secundário / avançado | Problema e proposta |
|---|---|---|---|---|
| `/`, `/welcome`, `/primeiro-acesso`, `/onboarding`, `/onboarding/[token]`, `/invite/accept`, `/verify`, `/2fa`, `/login`, `/recuperar-senha`, `/admin/login`, `/access-denied`, `/termos` | Entrada, autenticação e ativação. | Próximo passo da autenticação ou onboarding. | Ajuda, termos e recuperação. | PRIMARY: fluxo único; evitar cards concorrentes e detalhes técnicos. |
| `/dashboard`, `/diretor/resume`, `/gestor`, `/corretor/resumo`, `/minha-meta` | Visão de trabalho por papel. | Próxima decisão operacional. | Período, comparativos, atalhos e relatórios. | CONTEXTUAL: tabs de perspectiva e filtros compactos; métricas sem decisão migram para relatórios. |
| `/leads`, `/leads/[id]`, `/leads/[id]/feedback`, `/l/[id]`, `/l/[id]/feedback`, `/compartilhado/[token]` | Gerir e acompanhar leads. | Listar/abrir lead; no detalhe, conversar ou registrar atividade. | Atribuição, redistribuição, unidade, documentos, feedback, exclusão. | PRIMARY: busca + filtros essenciais + tabela; detalhe em tabs Resumo/Atendimento/Atividades/Documentos/Comercial; ações raras em `MoreActions`. |
| `/leads/distribuicao`, `/leads/distribuicao/plantao`, `/minha-fila` | Configurar ou operar distribuição. | Estado da distribuição e decisão da fila. | Estratégia, capacidade, SLA, exceções, plantão e auditoria. | ADVANCED: configuração progressiva em accordions; nenhum worker, enum ou ID técnico visível. |
| `/conversas`, `/conversas/broker`, `/fluxos-whatsapp` | Atendimento humano e canal do corretor. | Conversa e resposta/encaminhamento permitido. | Filtros, detalhes, histórico, documentos e configuração de fluxo. | PRIMARY: três colunas (lista, conversa, resumo); painel direito recolhível; não cercar chat com cards. |
| `/clientes`, `/clientes/[clientId]`, `/propostas`, `/cotacao`, `/cotacao/[token]` | Relacionamento e proposta comercial. | Encontrar cliente ou iniciar proposta/cotação. | Histórico, dados complementares, exportação. | CONTEXTUAL: lista/tabela como foco; detalhe em abas e dados raros recolhidos. |
| `/equipe`, `/equipe/[id]`, `/equipe/convidar`, `/equipe/cargos`, `/equipe/recuperacoes`, `/filiais`, `/unidades/[branchId]` | Pessoas, unidades, acesso e desempenho. | Adicionar pessoa ou abrir registro. | Convites, cargos, permissões, recuperação, indicadores. | PRIMARY: home de Equipe com tabs Pessoas/Unidades/Cargos; permissões agrupadas por domínio e detalhes progressivos. |
| `/vendas`, `/vendas/[id]`, `/financeiro`, `/financeiro/comissoes`, `/configuracoes/comissoes`, `/metas`, `/metas/desempenho` | Receita, comissões e metas para gestão. | Consultar registro/resultado ou criar ação permitida. | Exportações, regras, filtros analíticos e configurações. | CONTEXTUAL: tabs para perspectivas do mesmo domínio; filtros avançados recolhidos; preservar capability financeira. |
| `/tarefas`, `/documentos`, `/notificacoes`, `/checklist` | Trabalho individual e acompanhamento. | Executar próxima tarefa ou abrir item. | Filtros, histórico, preferências. | PRIMARY: lista e próxima ação; reduzir cartões decorativos e ações por item no menu. |
| `/qualificacao`, `/agentes-ia`, `/assistente`, `/automacoes`, `/inteligencia`, `/inteligencia/agentes`, `/inteligencia/corretora`, `/inteligencia/materiais`, `/inteligencia/playground`, `/inteligencia/sugestoes` | Configurar, supervisionar e testar IA. | Estado operacional e objetivo configurado. | Modelo, conhecimento, automação, histórico, diagnóstico. | ADVANCED: tabs por intenção e accordions; esconder parâmetros dependentes quando a capacidade estiver desligada. |
| `/integrations`, `/integrations/whatsapp`, `/integrations/meta`, `/settings`, `/settings/whatsapp`, `/settings/meta`, `/settings/integrations`, `/settings/extension`, `/settings/feedback-templates`, `/guia`, `/guia/webhook` | Conectar e administrar integrações. | Estado da conexão e gerenciar conexão. | Diagnóstico, comportamento, segurança, webhooks e guias. | PRIMARY: uma página de integração por conexão; configurações em grupos Conexão/Comportamento/Segurança/Diagnóstico. |
| `/marketing`, `/marketing/campanhas`, `/marketing/campanhas/[id]`, `/marketing/importacoes`, `/marketing/meta`, `/catalogo`, `/catalogo/interno`, `/materiais-divulgacao`, `/materiais-divulgacao/gerenciar` | Campanhas, importação e materiais. | Criar/consultar campanha ou material. | Filtros, metadados e configurações de integração. | CONTEXTUAL: tabs por perspectiva do marketing; listas densas, ações de item em menu. |
| `/relatorios`, `/noc`, `/integridade`, `/roadmap` | Inteligência, observabilidade e planejamento. | Escolher perspectiva/alerta com próxima ação. | Exportar, colunas, diagnóstico técnico. | TECHNICAL_NOISE: manter monitoramento técnico fora do dashboard executivo; drill-down substitui cards de alerta sem ação. |
| `/empresas`, `/assinatura`, `/ferramentas-vendas/tabelas-personalizadas`, `/internal/design-system`, `/internal/design-system/motion` | Administração complementar e ferramentas internas. | Ação administrativa permitida. | Configuração, experimentação e manutenção. | ADVANCED/LEGACY: fora da navegação comercial principal; acesso por permissão e contexto. |
| `/super-admin`, `/super-admin/overview`, `/super-admin/tenants`, `/super-admin/tenants/[tenantId]`, `/super-admin/audit`, `/super-admin/catalogo`, `/super-admin/integrations/whatsapp`, `/super-admin/materiais-divulgacao`, `/super-admin/onboarding`, `/super-admin/sessions`, `/super-admin/settings`, `/super-admin/whatsapp-review` | Administração de plataforma. | Saúde do tenant ou ação administrativa explícita. | Auditoria, sessão, catálogo, integrações e revisão. | ADVANCED: shell administrativo separado; navegação por grupos Painel, Tenants, Segurança e Configurações. |
| `/super-dev`, `/super-dev/tenants`, `/super-dev/tenants/[tenantId]`, `/super-dev/audit`, `/super-dev/integridade`, `/super-dev/sessions`, `/super-dev/settings` | Operação técnica autorizada. | Diagnóstico técnico específico. | Sessões, auditoria e configurações. | TECHNICAL_NOISE: manter isolado do CRM; conteúdo técnico somente para papel técnico. |

## Arquitetura de navegação alvo

| Grupo | Rotas principais | Revelação secundária |
|---|---|---|
| Principal | Dashboard, Leads, Atendimento, Clientes | detalhe via tabs/links contextuais |
| Operação | Equipe, Vendas, Tarefas | Unidades, cargos, recuperação e comissões como subrotas |
| Gestão | Distribuição, Metas, Financeiro, Relatórios | regras, plantão, desempenho e exportação sob demanda |
| Integrações | WhatsApp, Meta | guias, webhooks e diagnóstico em subníveis |
| Sistema | Qualificação/IA, Configurações | automações, agentes, extensões e diagnósticos progressivos |

## Sequência de implementação proposta

1. **Foundation:** reduzir contraste entre página/card, simplificar borda padrão, limitar sombras e consolidar PageHeader + MoreActions. Sem alterar dados ou permissões.
2. **Shell:** aplicar agrupamento de sidebar, tooltips no estado recolhido e preservar cada rota existente.
3. **Padrões:** FilterBar compacto, toolbar de DataTable e DetailHeader com tabs e menu de ações.
4. **Migração por domínio:** Leads e Conversas primeiro; depois Equipe/Unidades, Distribuição, Qualificação e Integrações.
5. **Validação:** cenários de Diretor, Gestor, Supervisor e Corretor; teclado, tela estreita, dark mode, loading, vazio, erro e permissão negada.

## Decisões pendentes de aprovação humana

- A estrutura final de grupos da sidebar e quais rotas internas devem ficar totalmente ocultas da navegação comercial.
- A persistência de preferências de colunas/filtros por usuário.
- Quais ações de lead podem ser reunidas sem aumentar o risco operacional do fluxo.

## Não escopo desta etapa

- Não altera distribuição, SLA, qualificação, permissões, dados, integrações ou workers.
- Não remove rotas, ações nem dados; apenas define como serão revelados no próximo ciclo.
