# Histórico de Funcionalidades Adicionadas (Features Log)

Este documento registra todas as funcionalidades e melhorias de engenharia adicionadas ao **CorreTop**, organizadas por área e funcionalidade, para manter a rastreabilidade do sistema.

---

## 10. NOC por unidade

O NOC passou a expor uma primeira camada de saude operacional por filial, usando apenas dados reais e escopados pelo contexto autenticado.

* **Visao do Diretor**: tabela consolidada de unidades ativas com volume do dia, atendimentos ativos, fila sem corretor, risco de primeiro contato e capacidade de corretores.
* **Visao do Gestor**: a mesma tabela fica limitada, no servidor, a filial vinculada ao gestor; nenhuma outra unidade e carregada.
* **Criterios de saude**: risco de SLA e fila sem corretor tem prioridade; recebimento pausado, ausencia de corretores ativos ou de disponibilidade tambem geram atencao.
* **Continuidade**: cada unidade possui um atalho para a lista de leads ja filtrada pela propria filial. Esta primeira fatia nao altera distribuicao, SLA ou disponibilidade.
* **Pendente**: controles globais do Super-admin, monitoramento verificavel de integracoes e acoes de intervencao auditadas serao conectados nas proximas etapas.

## ⚡ 1. Sincronização em Tempo Real & Notificações Instantâneas
Notificações e atualização automática das telas do dashboard em tempo real, sem necessidade de atualizar a página (F5).

*   **Arquivos Criados/Modificados**:
    *   [realtime-sync-provider.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/components/providers/realtime-sync-provider.tsx) (Provedor Client-side WebSocket)
    *   [send-push-helper.ts](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/features/notifications/send-push-helper.ts) (Disparador de Push Server-side)
    *   [layout.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/app/(dashboard)/layout.tsx) (Integração Global no app)
    *   [client.ts](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/shared/db/client.ts) (Configuração de Replicação da tabela `leads`)
*   **Comportamento por Cargo**:
    *   **Corretor**: Recebe um toast visual + sinal sonoro de sucesso quando um lead é distribuído pessoalmente para ele.
    *   **Gestor**: Recebe um toast + som de sino quando um novo lead chega na unidade/filial dele.
    *   **Diretor**: Recebe um toast + som de sino quando qualquer lead chega no tenant.
*   **Efeitos Sonoros**: Sintetizados dinamicamente no navegador via Web Audio API com a biblioteca **Cuelume** (sem dependência de arquivos `.mp3` estáticos).
*   **Web Push (Offline)**: Disparo automático de Push Notifications em background para o navegador do usuário caso ele esteja fora do sistema ou com a aba minimizada.

---

## 🔄 1.1. Redistribuição Automática por Estouro de SLA (Primeiro Contato)
Redistribuição ativa de novos leads se o corretor não realizar o primeiro contato dentro do tempo limite.

*   **Arquivos Criados/Modificados**:
    *   [sla.ts](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/features/leads/sla.ts) (Motor de varredura de SLA)
    *   [assignment.ts](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/features/leads/assignment.ts) (Lógica de distribuição round-robin)
*   **Comportamento**:
    *   **Exclusão do Corretor Unresponsive**: O algoritmo de round-robin agora aceita um parâmetro de exclusão, garantindo que o corretor que perdeu o lead por estouro de SLA não o receba de volta imediatamente.
    *   **Reatribuição**: O lead é reatribuído ao próximo corretor disponível na filial. Caso não haja nenhum outro corretor online/disponível, o lead retorna para a fila geral (status `"new"` / `"queued"`).
    *   **Auditoria e Histórico**: Registra uma nota descritiva na timeline do lead e insere um log de auditoria (`"lead.redistributed_sla"`).

---

## 👥 2. Gestão de Equipe & Permissões por Unidade
Regras de escopo de dados e interfaces para diferenciar a atuação dos cargos dentro da corretora.

*   **Arquivos Criados/Modificados**:
    *   [director-wizard.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/features/onboarding/components/director-wizard.tsx) (Onboarding do Diretor)
    *   `src/app/(dashboard)/equipe/` (Telas de listagem e convite de membros)
*   **Diferenças por Cargo**:
    *   **Diretor**: Acesso total a todas as filiais, relatórios consolidados e controle total das configurações.
    *   **Gestor**: Associado a uma ou mais filiais específicas, controlando apenas as oportunidades e corretores dessas unidades.
    *   **Corretor**: Acesso restrito apenas ao seu próprio painel de leads e à sua unidade pessoal.

---

## 🎨 3. Redesign da Tela de Login & Componentes Visuais
Nova interface centralizada, moderna e alinhada ao design system padrão claro (light theme) do sistema.

*   **Arquivos Criados/Modificados**:
    *   `src/app/(auth)/login/` (Layout e formulários de autenticação)
    *   `src/components/ui/badge.tsx` (Estilos globais de tags)
*   **Melhorias Visuais**:
    *   Formulário de login elegante e centralizado com campos de "Lembrar senha", "Esqueci a senha" e links de Termos de Uso.
    *   Correção no redirecionamento pós-login (resolvendo o erro de sincronização de cookies de sessão que exigia F5).
    *   Modernização de badges e tags de status (ex: Leads "Novos", "Em Atendimento", "Ganhos"), adicionando cores semânticas vibrantes e ícones modernos.

---

## 📊 4. PRD e Roteiro de Testes Automatizados
Documento completo de requisitos de produto estruturado para alimentação de robôs de testes automatizados (E2E).

*   **Arquivos Criados/Modificados**:
    *   [PRD_AUTOMATED_TESTING.md](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/docs/PRD_AUTOMATED_TESTING.md)
*   **Conteúdo**:
    *   Mapeamento de 9 fluxos críticos de ponta a ponta (login com 2FA, ingestão por webhook, distribuição round-robin, cotação de planos, upload de documentos e fechamento de vendas).

---

## ⚙️ 5. Ajustes de Layout e Formulários Operacionais
Correção de quebras de tabelas e drawers na área de administração.

*   **Arquivos Criados/Modificados**:
    *   `src/features/catalog/` (Drawers de adição de planos e operadores)
*   **Melhorias**:
    *   Aumento da largura útil (width) dos drawers laterais para exibição limpa e sem cortes horizontais das tabelas de planos e listagem de operadores.
    *   Correção de selects vazios nos detalhes do lead (carregamento reativo de dados).

---

## 🔔 6. Popover de Notificações com Badge "Nova" em Tempo Real
Dropdown de notificações accessível pelo sino no cabeçalho, com indicador visual de notificações que chegam enquanto o popover está aberto.

*   **Arquivos Modificados**:
    *   [notification-popover.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/components/notification-popover.tsx) (Componente completo do popover)
*   **Funcionalidades**:
    *   **Badge "Nova"**: Notificações que chegam via Supabase Realtime enquanto o popover está aberto recebem um pill animado (spring scale 0→1) com o texto "Nova"
    *   **Auto-dismiss**: A badge desaparece após 6 segundos via `setTimeout` com cleanup
    *   **Dismiss por hover**: Passar o mouse sobre a notificação remove a badge instantaneamente
    *   **Dismiss por leitura**: Marcar como lida também remove a badge (via `readAt !== null`)
    *   **Highlight visual**: Fundo `bg-primary/[0.04]` e sombras internas azuladas nas bordas para notificações novas
    *   **Animação de entrada**: Notificações novas chegam com slide-in sutil (`y: -8`) via `motion.div`
    *   **Live state**: `liveIds` (Set) rastreado via `useState` com lazy initializer, limpo a cada abertura do popover
    *   **Assinatura Realtime**: Canal Supabase escuta INSERT/UPDATE na tabela `notifications` filtrado por `recipient_user_id`
    *   **Prioridades visuais**: Bolinha de status colorida (destructive/urgente, warning/atenção, primary/info) e opacidade para itens lidos

---

## 👥 7. Reformulação da Página `/clientes` com Métricas e Lista Estruturada
Redesign completo da página de clientes, removendo o título e adicionando cards de métricas, busca e tabela responsiva.

*   **Arquivos Modificados**:
    *   [page.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/app/(dashboard)/clientes/page.tsx) (Server Component — queries paralelas de métricas)
    *   [clientes-list.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/app/(dashboard)/clientes/clientes-list.tsx) (Client Component — UI completa)
*   **Métricas no Topo** (grid `grid-cols-2 lg:grid-cols-4` com `MiniDonut`):
    *   **Total de clientes** + conversões recentes (azul chart-2)
    *   **Taxa de conversão** (teal chart-4) com badge de tendência up/down
    *   **Média por corretor** (chart-3)
    *   **Renovações próximas** (warning/âmbar)
*   **Busca**: Campo `Input` com ícone de lupa, filtra por nome, email, telefone, corretor ou filial (locale `pt-BR`)
*   **Lista Estruturada**:
    *   Tabela com colunas: Nome + badge "Cliente", Contato (email + telefone), Responsável (OwnershipContext), Data de Conversão, Ação
    *   Botão de navegação com `ArrowRight` aparece no hover da linha (`opacity-0 → 100`)
    *   Link para `/clientes/${client.id}`
*   **Empty State**: Ilustração centralizada com animação de escala para lista vazia
*   **Escopo por papel**: Filtro automático para broker (próprios), manager (unidade), director (todos)
*   **Dados carregados**: 
    *   Total de leads (base para taxa de conversão)
    *   Corretores distintos com clientes
    *   `activeCustomers` com aniversário de contrato nos próximos 30 dias
    *   Conversões nos últimos 30 dias

---

## 📋 8. Página de Detalhe do Cliente `/clientes/[clientId]`
Nova página dedicada com informações completas do cliente, vendas, documentos, timeline e renovação.

*   **Arquivos Criados**:
    *   [page.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/app/(dashboard)/clientes/[clientId]/page.tsx) (Server Component full-data)
*   **Header/Cover**:
    *   Gradiente `chart-2/10` no topo com avatar de iniciais do cliente
    *   Badges de "Cliente ativo" e "Renovação em N dias"
    *   Data de conversão, unidade, e link para o lead original
*   **Coluna Esquerda** (sidebar `24rem`):
    *   **Sobre o cliente**: Telefone (link `tel:`), e-mail (link `mailto:`), unidade, responsável — com ícones `chart-2/10`
    *   **Resumo financeiro**: Total em vendas (formatado BRL), quantidade de vendas, status do contrato (badge Ativo/Cancelado)
    *   **Vigência e renovação**: Início da vigência, aniversário do contrato, dias restantes com destaque warning se ≤45 dias, informações de cancelamento se houver
    *   **PersonRecordDetails**: Reutiliza componente existente com dados de consentimento LGPD, dependentes e documentos
*   **Coluna Direita** (Tabs `variant="line"`):
    *   **Vendas**: Cards com valor, apólice, operadora, plano, notas, status, link para `/vendas/${id}`
    *   **Documentos**: Reutiliza `LeadDocumentsSection` com requirements, documents e beneficiaries
    *   **Linha do Tempo**: Reutiliza `LeadTimeline` com histórico de interações
*   **Dados carregados** (parallel `Promise.all`): Lead original, vendas vinculadas, activeCustomer, timeline, documentos, beneficiários
*   **Escopo**: Respeita regras de permissão por papel (broker/manager/director)

---

## 🔄 9. Lembretes de Renovação de Clientes (Renewal Reminders)
Job diário que notifica corretores, gestores e diretores sobre aniversários de contrato iminentes.

*   **Arquivos Modificados**:
    *   [renewal-reminders.ts](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/features/customers/renewal-reminders.ts) (Lógica do job)
*   **Funcionamento**:
    *   **Fonte primária**: `activeCustomers.contractAnniversary` — usa a data real do contrato quando disponível
    *   **Fallback**: `clients.convertedAt` com `nextContractAnniversary()` para clientes sem contrato registrado
    *   **Janela**: 30 dias à frente (`RENEWAL_ALERT_WINDOW_DAYS`)
    *   **Deduplicação**: Evita notificações duplicadas no mesmo dia (`leadId:recipientUserId`)
*   **Notificação criada**:
    *   Tipo: `client_renewal_reminder`
    *   Título: "Renovação iminente! ⏰" (≤7 dias) ou "Renovação próxima 📅"
    *   Mensagem: Nome do cliente, aniversário de contrato/conversão, dias restantes e data formatada
    *   Destinatários: Corretor responsável, Diretor, Gestor da unidade
*   **Gate**: Respeita `isNotificationCapabilityEnabled("client_renewal")` — se desativado no Super-admin, o job não executa
*   **Endpoint**: `GET /api/internal/reminders` com `Authorization: Bearer <CRON_SECRET>`
*   **Teste manual**: Realizado com sucesso via cURL — retornou `{"success":true, "renewal":{"reminders":0, "clients":1}}`
### 6.1 Correção de superfície do popover
O painel de notificações recebeu uma camada visual opaca e elevada para não se confundir com o canvas do dashboard, especialmente em viewports estreitos e no tema escuro.

*   **Arquivos modificados**:
    *   `src/components/notification-popover.tsx`
    *   `src/app/globals.css`
    *   `src/features/roadmap/roadmap-data.ts`
*   **Decisão visual**: o painel usa `surface-overlay` como fundo, `isolation: isolate`, borda semântica e sombra contextual por tema. O backdrop permanece limitado ao mobile, preservando o comportamento de popover ancorado no desktop.

### 6.2 Inbox operacional e ativação de Push
A rota `/notificacoes` passou a priorizar triagem e continuidade do trabalho, com ativação de Push explícita no próprio fluxo.

*   **Arquivos modificados**:
    *   `src/app/(dashboard)/notificacoes/notifications-client.tsx`
    *   `src/features/notifications/components/push-notification-manager.tsx`
    *   `src/components/notification-popover.tsx`
*   **Inbox**: filtros por todas, não lidas e ação necessária; agrupamento por data; prioridade visual sem fundos pesados; ação contextual para o lead; estados vazios específicos.
*   **Push**: card lateral visível quando inativo; após ativação, o estado fica resumido e os controles de teste/desativação ficam sob demanda.
*   **Popover**: renderizado por portal em `document.body`, ancorado por coordenadas do sino e com backdrop adaptado ao tema. Isso remove a herança de stacking context do header que fazia a superfície parecer transparente.

### 6.3 Carregamento do popover e convite contextual de Push
O sino agora consulta as notificações recentes sempre que é aberto, usando a mesma fonte escopada por tenant e usuário da inbox completa. O convite de Push também passou a aparecer dentro do próprio popover quando o navegador atual ainda não está inscrito.

*   **Arquivos modificados**:
    *   `src/components/notification-popover.tsx`
    *   `src/features/notifications/components/push-notification-manager.tsx`
    *   `src/features/notifications/push-actions.ts`
*   **Ativação**: o CTA “Ativar” só solicita a permissão nativa após clique explícito no sino/convite; navegadores não aceitam um pedido confiável e respeitoso de permissão disparado automaticamente no carregamento.
*   **Escopo e auditoria**: a leitura de inscrição considera o `PushSubscription` do navegador atual, enquanto as Server Actions validam o payload, impedem reutilização de endpoint de outra conta/tenant e registram ativação, atualização e desativação em `audit_logs`.
*   **Validação**: lint dirigido, 71 testes Vitest, type-check e build de produção concluídos em 16/07/2026.

## 7. Refinamento operacional do detalhe do Lead

O detalhe em `/leads/[id]` foi reorganizado para reduzir a disputa entre informações, ações e formulários.

*   **Cabeçalho compacto**: identidade, status, responsável, unidade, SLA e ações imediatas ocupam uma única superfície, sem capa decorativa alta.
*   **Área de trabalho primeiro**: próxima ação e abas operacionais ocupam a coluna principal; contato, dados organizados, beneficiários e intervenções ficam no contexto lateral.
*   **Gestão sem concorrência**: reatribuição e investigação agora são dois fluxos exclusivos dentro do mesmo cartão, com impacto explicado antes da confirmação.
*   **Superfícies**: fundos reduzidos a `card` e `muted` semânticos, bordas mais leves e menor altura entre blocos para preservar a informação importante acima da dobra.

## 8. Fundação do catálogo global e extensões privadas

O domínio de catálogo passa a ter uma separação explícita entre a base oficial da plataforma e acordos exclusivos de cada corretora.

* **Migração `0045_global_catalog_foundation`**: cria entidades globais, tabelas/preços versionados, allow-list por tenant, restrição por unidade, lotes de importação, change sets e auditoria de catálogo. O conteúdo legado é copiado de forma idempotente para a extensão privada, preservando IDs para a transição.
* **Administração**: `/super-admin/catalogo` permite controlar capacidades, cadastrar/publicar operadoras, planos e primeira tabela oficial, além de liberá-los por corretora com auditoria de plataforma.
* **Corretora**: `/catalogo/interno` é exclusivo ao Diretor e permite cadastrar operadora, plano e tabela de acordo privado; Gestor e Corretor recebem acesso negado.
* **Contrato público**: `listAvailableCatalogPlans()` resolve planos oficiais autorizados, respeita restrição de filial e acrescenta somente os itens privados do tenant autenticado.
* **Estado**: primeira fase entregue. A troca gradual dos consumidores legados (cotador, documentos, vendas, comissões e PDFs) continua registrada no roadmap N32 para evitar alterações históricas involuntárias.

## 9. Fundação do WhatsApp oficial da Meta

* **Domínio e migração**: `0047_meta_whatsapp_cloud_foundation` adiciona canais de comunicação por tenant/unidade, ledger idempotente de webhook e proveniência de mensagens.
* **Segurança**: o endpoint `/api/webhooks/meta/whatsapp` valida challenge e HMAC; resolve o tenant pelo `phone_number_id`; o access token é cifrado no servidor e não é registrado em auditorias.
* **Operação**: Diretor conecta ou pausa o canal pelo Embedded Signup em `/settings/whatsapp`; Super-admin controla a capacidade global e cada alteração é auditada.
* **Transição**: envio escolhe o canal Meta ativo da unidade antes do fallback OpenWA. Texto inbound/outbound e status foram preparados; templates, mídia, janelas de conversa e fila assíncrona permanecem no roadmap N34.

## 10. Organização do núcleo de utilitários

O código técnico reutilizável ganhou um ponto central em `src/utils`, separado
por categoria e com documentação local.

* **Categorias**: `core`, `formatting`, `async`, `animation`, `supabase`,
  `validation` e `plugins`.
* **Compatibilidade**: os caminhos legados (`src/lib/utils.ts` e utilitários em
  `src/shared`) agora funcionam como barrels de transição, evitando quebra de
  Server Components e Client Components existentes.
* **Limites**: autenticação, banco, armazenamento, features e serviços externos
  continuam nos diretórios de domínio apropriados; não foram movidos para
  `utils`.
* **Validação**: type-check, 118 testes e build de produção concluídos. O lint
  global continua incluindo artefatos gerados em `.vercel/output` e pendências
  anteriores do código; não foram alterados como parte desta reorganização.
