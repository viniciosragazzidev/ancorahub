# Registro de Decisões de Produto e Arquitetura

> **DEC-038 — Processamento resiliente da distribuição (aceita em 2026-07-20):** a distribuição automática usa fila persistente no PostgreSQL e executores idempotentes por rota interna protegida. Locks possuem lease recuperável, falhas transitórias usam backoff configurável e parâmetros iniciais conservadores (lote 25, lease 2 minutos, máximo 8 tentativas) são reversíveis e auditáveis pelo Super-admin. A regra comercial já existente de capacidade, round-robin e SLA não é alterada.

Use este registro para decisões que alteram comportamento, escopo, custo, risco ou
contrato. Uma pendência marcada como **bloqueante** não deve ser implementada por
suposição. Quando decidida, mova para "Decididas" com data, responsável e referência
para ADR se aplicável.

## DEC-051 - Centro de configurações de IA em duas camadas

**Estado:** Aceita  
**Data:** 2026-07-23

As configurações que alteram a experiência da corretora ficam em uma aba amigável,
isolada por tenant, editável pelo Diretor, validada no servidor, versionada e auditada.
Provedor, modelo, credenciais, prompt técnico e ativação global permanecem no painel
do Super-admin. Editor de fluxo, RAG, A/B e rollback são etapas posteriores.

## Decididas

## DEC-052 - Proteção contra saturação de conexões do banco

**Estado:** Aceita  
**Data:** 2026-07-23

O cliente de banco mantém um limite pequeno por processo (padrão de uma conexão em
runtime serverless), fecha conexões ociosas rapidamente e aceita `DB_POOL_MAX` como
parâmetro operacional entre 1 e 10. Durante o build estático o limite temporário é
maior para permitir os workers de geração. O proxy usa uma cache de cinco segundos
somente para a consulta de identidade da sessão; permissões e dados de negócio
continuam sempre sendo consultados e validados no servidor. O objetivo é evitar que
prefetch/navegação de duas máquinas consuma o limite do projeto Supabase.

> DEC-041 — Documentos são opcionais e podem ser vinculados ao lead, cliente, titular ou dependente. O checklist orienta o atendimento, mas nunca bloqueia distribuição, conversão ou pós-venda. Arquivos usam armazenamento privado, acesso temporário autorizado, auditoria e exclusão lógica.

| ID | Decisão | Estado | Evidência |
|---|---|---|---|
| DEC-000 | O desenvolvimento começa sem instalar dependências adicionais. | Aprovada — 2026-07-11 | Solicitação de preparação do projeto |
| DEC-007 | App Router é o padrão; Server Actions servem mutações internas e Route Handlers, integrações/webhooks. | Aprovada | Arquitetura §6 |
| DEC-008 | Atualização manual de tabelas é obrigatória; scraping é complementar e não bloqueia o MVP. | Aprovada | RF030–032, roadmap |
| DEC-009 | WhatsApp no MVP é abertura controlada do WhatsApp Web; inbox/API oficial ficam para fase posterior. | Aprovada | RF060–063 |
| DEC-010 | Não há trial; acesso depende de pagamento confirmado. | Aprovada | RF092 |
| DEC-013 | shadcn via MCP, Unlumen UI e `transitions-dev` são a fundação obrigatória para decisões de UI e motion. | Aprovada — 2026-07-11 | Solicitação do projeto |
| DEC-014 | Controles e estilos repetíveis devem usar componentes e tokens compartilhados; variações locais só podem existir para composição única. | Aprovada — 2026-07-11 | Solicitação do projeto |
| DEC-015 | shadcn é obrigatório para primitivas de UI; `dashboard-01` é a base de dashboards e Unlumen complementa estados e feedback animados. | Aprovada — 2026-07-11 | Solicitação do projeto |
| DEC-025 | CorreTop adota evolução modular Plugin First: domínios expõem use cases públicos; páginas e Workspace são hosts; plugins não acessam banco; comunicação entre módulos usa eventos; toda capacidade é multi-tenant, auditável, governável e preparada para feature flags. A migração será incremental, começando por Lead e Financeiro. | Aprovada — 2026-07-15 | Solicitação do projeto |

| DEC-026 | O pós-venda distingue data de registro, início de vigência, valor aprovado e evidência da operadora; cancelamento nunca desconta valores automaticamente. A janela de chargeback é configurável por tenant, inicia em 90 dias e toda alteração é auditada. | Aprovada como política de segurança — 2026-07-16 | Simulação ponta a ponta e solução de beneficiários |
| DEC-027 | No estouro do SLA de primeiro contato, o owner anterior é removido antes de qualquer nova atribuição. Leads originados pelo Diretor usam a fila central da corretora mãe: tentam outro corretor elegível na unidade e, se não houver, retornam à fila central para nova distribuição. Leads originados pelo Gestor permanecem na fila da unidade para distribuição manual. A origem é persistida, toda transição é auditada e o corretor que perdeu o SLA é excluído da tentativa imediata. | Aprovada — 2026-07-16 | Solicitação do usuário; implementação de `feedback-sla` e distribuição |
| DEC-028 | Notificações operacionais devem ser publicadas por um serviço central com registro in-app/Realtime e push coordenados. Cada capacidade possui uma chave global reversível controlada pelo Super-admin; quando desativada, nenhum dos dois canais é emitido para o evento. O catálogo e a auditoria da configuração são obrigatórios. | Aprovada — 2026-07-16 | Solicitação do usuário; correção de toast junto com push |

## DEC-033 — WhatsApp Cloud API oficial com Embedded Signup

**Estado:** Aceita
**Data:** 2026-07-16

O CorreTop migra de OpenWA para a Cloud API oficial da Meta em etapas. `communication_channels` é o domínio do canal; o webhook confirma assinatura HMAC e resolve o tenant pelo `phone_number_id`. Diretor conecta/pausa canais do seu tenant, Super-admin controla a capacidade global e OpenWA permanece apenas como fallback reversível durante a transição. Tokens são cifrados em repouso e nunca chegam ao frontend.

## DEC-034 — Motion de navegação governado e sem sobreposição de rotas

**Estado:** Aceita
**Data:** 2026-07-19

As rotas do aplicativo usam a integração experimental de View Transitions do Next.js para transições curtas entre snapshots do navegador. A rota anterior e a nova não coexistem no DOM do aplicativo, evitando o efeito de tela dividida. A capacidade é reversível pela chave global `feature_interface_motion_enabled`, administrada exclusivamente pelo Super-admin e auditada em `platform_audit_logs`. A preferência `prefers-reduced-motion` sempre prevalece. Tabelas, filas e métricas não recebem animação de entrada ou reordenação; nelas só são permitidas transições de estado de baixo impacto, como hover e foco.

## DEC-035 — Serviço Fastify isolado para evidência e evolução da Cloud API

**Estado:** Aceita
**Data:** 2026-07-20

O CorreTop usa `services/whatsapp-api` como fronteira Fastify separada para chamadas da Graph API que exigem credenciais privadas da Meta. O CRM não chama a Meta pelo navegador: uma Server Action restrita ao Super-admin e governada pela capacidade global encaminha o pedido ao Fastify usando segredo interno. O serviço recebe somente a solicitação autorizada, usa o token da Meta localmente e devolve ao CRM apenas o resultado seguro. A infraestrutura do Fastify é implantada separadamente da Vercel; Embedded Signup, templates e armazenamento de tokens por WABA continuam como fases explícitas.

## Pendentes bloqueantes

| ID | Decisão necessária | Impacto | Dono sugerido |
|---|---|---|---|
| DEC-001 | Definir máquina de estados do funil: transições permitidas, reabertura e quem pode executá-las. | **Decidida** — 2026-07-20 | ADR-001; implementation in lead-status-constants.ts, change-lead-status.ts, lead-status-selector.tsx |
| DEC-002 | Definir round-robin: ordem inicial, desempate, comportamento quando não há elegível, limite de carga e reatribuição. | Distribuição e SLA. | Produto/Operação |
| DEC-003 | Definir SLAs: duração, fuso, dias úteis/corridos, pausa e política de notificação/redistribuição. | Jobs, alertas e fila. | Operação |
| DEC-004 | Definir comissão: moeda, percentual/base, vigência de regra, estorno/cancelamento e arredondamento. | Motor financeiro e relatórios. | Financeiro/Produto |
| DEC-005 | Definir matriz LGPD: base legal, texto/versionamento de consentimento, retenção, exclusão/anonimização e responsáveis. | Segurança e conformidade. | Jurídico/Produto |
| DEC-006 | Definir reengajamento: canal permitido, opt-out, prazo, templates aprovados e exceções. | Comunicação e LGPD. | Produto/Jurídico |
| DEC-011 | Definir planos comerciais, limites, cobrança, tolerância e provedor de pagamento. | Billing e bloqueio. | Negócio |
| DEC-012 | Definir política de filial: gestores multi-filial, fallback de distribuição e visibilidade consolidada. | Permissões e relatórios. | Produto |

## DEC-042 — Contingência de cron no Vercel Hobby

**Estado:** Contingência temporária; upgrade urgente pendente
**Data:** 2026-07-21

O plano Vercel Hobby aceita somente uma execução diária de cron. Para manter o deploy de produção publicável enquanto o upgrade não é realizado, o CorreTop usa `0 3 * * *` em `vercel.json`. Essa execução não atende o SLA de distribuição automática; a fila permanece persistida e pode ser processada pelo Super-admin.

O critério para encerrar a contingência é migrar para Vercel Pro ou para um executor externo autorizado e restaurar `*/2 * * * *`, validar duas execuções consecutivas e confirmar o processamento de um lead de teste sem intervenção manual.

## Pendentes não bloqueantes para o MVP inicial

| ID | Decisão necessária | Observação |
|---|---|---|
| DEC-020 | Provedor de banco, storage e autenticação. | Avaliar e instalar somente quando a fundação técnica for iniciada. |
| DEC-022 | Estratégia de PWA e push. | Requer escopo de browser e políticas de permissão. |

## Decisões registradas durante a implementação

| ID | Decisão | Estado | Evidência |
|---|---|---|---|
| DEC-023A | White-label usa nome, logo e uma cor primária por tenant; o servidor valida hex e assets, o shell calcula foreground legível e a alteração é auditada. | Aprovada — 2026-07-13 | Settings, AppShell e sidebar |
| DEC-024 | TOTP é opcional por usuário; ativação e desativação exigem senha, login aceita aplicativo autenticador ou código de recuperação e a geração de novos códigos invalida os anteriores. | Aprovada — 2026-07-13 | Better Auth two-factor, /settings e /2fa |
## DEC-029 — Onboarding contextual por rota

Estado: aprovada em 2026-07-16. A apresentação é persistida por tenant, usuário e rota; o Super-admin pode desativar globalmente ou reiniciar o conjunto de rotas de um usuário. A operação gera auditoria.

## DEC-030 — Lembrete de feedback configurável por tenant com push

Estado: aprovada em 2026-07-16. O lembrete de feedback agora opera com intervalo configurável por tenant (default 30 min), máximo de tentativas (default 5), e flags independentes para push e toast. O job roda a cada N minutos em vez de 1x/dia. Quando o limite de tentativas é excedido, a urgência da mensagem escala. O push respeita a capacidade global DEC-028.

## DEC-031 — Catálogo oficial global com extensão privada por corretora

**Estado:** Aceita
**Data:** 2026-07-16

O CorreTop manterá uma base oficial global de operadoras, planos, tabelas e versões comerciais, publicada exclusivamente pelo Super-admin. Cada corretora pode manter uma extensão privada para acordos exclusivos, isolada pelo seu `tenant_id` e administrada somente pelo Diretor. A consulta de cotação usará um resolvedor único que combina itens oficiais publicados, visíveis por padrão a todos os tenants e sujeitos apenas a ocultações explícitas por tenant/unidade, com itens privados do próprio tenant.

Tabelas comerciais serão versionadas e vigentes; registros históricos devem manter snapshot e referência da versão utilizada. Importação assistida por IA poderá gerar propostas de alteração, mas jamais publicar ou alterar o catálogo sem revisão explícita do Super-admin.

**Consequência:** o CRUD legado por tenant permanece apenas como adaptador de migração. Nenhum consumidor novo deve consultar as tabelas legadas diretamente.

## DEC-032 — Termos públicos de uso e responsabilidade do CRM

**Estado:** Aceita como versão operacional
**Data:** 2026-07-16

O CorreTop disponibilizará uma rota pública de termos que explica o uso permitido do CRM, a responsabilidade da corretora sobre seus usuários e dados de clientes, os limites da plataforma e orientações gerais de proteção de dados. O texto não substitui contrato, política de privacidade específica, definição formal de controlador/operador nem revisão jurídica. A versão jurídica definitiva exigirá identificação da pessoa jurídica, canal de privacidade e política de retenção aprovados.

## ADR-001 — Máquina de estados do funil de leads

**Estado:** Aceita
**Data:** 2026-07-20
**Decisor:** Engenharia (implementação)

### Contexto

O funil de leads não tinha transições formalizadas. O seletor de status permitia qualquer combinação de status ativo, o que levava a pipelines inconsistentes (ex: pular de "Em Atendimento" para "Em Análise" sem enviar cotação). Além disso, a opção "Convertido" aparecia no seletor mas era bloqueada no backend com erro, criando UX confusa.

### Decisão

1. **Transições sequenciais forçadas:** O pipeline segue ordem estrita: `new → distributed → in_contact → quote_sent → negotiation → documentation_pending → under_analysis → converted`. Cada status só avança para o próximo válido.

2. **Conversão exclusiva via registerSale:** O status "converted" não pode ser definido manualmente. Ele é atribuído automaticamente por `registerSaleAction()` ao registrar uma venda (que cria client, sale, activeCustomer e commissionSchedule atomicamente).

3. **Perda permite reabertura:** De qualquer status ativo pode ir para "lost". Ao reabrir de "lost", pode voltar para qualquer status ativo (gestor/diretor).

4. **Validação server + client:** O mapa `VALID_TRANSITIONS` em `lead-status-constants.ts` é consumido tanto pelo server (`change-lead-status.ts`) quanto pelo client (`lead-status-selector.tsx`).

### Consequências

- Código morto para conversão em `change-lead-status.ts` foi removido (linhas 183-226 originais).
- A enum `lead_interaction_type` ganhou o valor `service_started` para representar início de atendimento (antes usava `whatsapp_msg`).
- A tabela `leads` ganhou coluna `updatedAt` para rastrear modificações.
- `assumeLeadForInvestigation` continua saltando o pipeline para status `under_analysis` — é uma ação de gestão legítima.
## DEC-043 — Armazenamento privado dos documentos de atendimento

**Estado:** Aceita
**Data:** 2026-07-21

Documentos de leads e clientes não serão gravados no sistema de arquivos local do deploy.
O upload usará bucket privado do Supabase Storage, acessado somente no servidor com
`SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DOCUMENTS_BUCKET`. Downloads continuam passando
pela rota autenticada e escopada. Se a configuração estiver ausente, o upload retorna
503 com orientação clara e não cria registro incompleto.
## DEC-044 - Conversao condicionada a confirmacao de venda

**Estado:** Aceita
**Data:** 2026-07-21

O status `converted` nao sera alterado por um seletor de status nem por uma acao parcial.
Ao solicitar a conversao, o CRM abre um dialogo com os dados da venda. A conversao so
ocorre quando a acao de servidor valida apolice, vigencia, valor, titular/beneficiarios,
documento aprovado da operadora e permissoes do usuario. Em caso de falha, o lead
permanece no status anterior e o formulario informa a pendencia.

## DEC-045 - Canal oficial corporativo e outbox assíncrono

**Estado:** Aceita
**Data:** 2026-07-22

O produto inicial terá um único canal oficial de WhatsApp por tenant, conectado
pela matriz. Canais por unidade permanecem compatíveis no schema, mas não ficam
expostos no Embedded Signup até uma decisão específica. Envios de negócio usam
modelos aprovados, ledger idempotente e processamento assíncrono; o cron do Vercel
Hobby serve apenas como recuperação diária, não como garantia de latência.
## DEC-046 — Fallback de texto para convites de primeiro acesso

- **Status:** aprovado
- **Decisão:** quando o template oficial de convite pelo WhatsApp falhar de forma não transitória, o outbox cria uma segunda tentativa idempotente de mensagem de texto com o link direto de primeiro acesso.
- **Proteções:** o link é montado no worker a partir do token cifrado; nenhum token ou corpo da mensagem é registrado em logs; o fallback é limitado ao propósito `brokerInvitation`, mantém escopo do tenant e permanece auditável.
- **Limitação conhecida:** a Meta pode rejeitar texto fora de uma janela de atendimento válida. Nessa situação o acesso continua criado e o link manual exibido no CRM é a recuperação oficial.

## DEC-047 — Marketing e Financeiro como jobTitle com capacidades estendidas

**Estado:** Aceita
**Data:** 2026-07-22

Marketing e Financeiro permanecem como `jobTitle` (cargo exibido), não como `role` (papel de segurança). O `role` (director/manager/broker) continua definindo as permissões base; o `jobTitle` concede capacidades adicionais via `JOB_TITLE_CAPABILITIES`.

### Separação formalizada dos quatro conceitos

| Conceito | Coluna/Atributo | Finalidade |
|---|---|---|
| Cargo exibido | `jobTitle` | Função descritiva exibida na interface |
| Papel de segurança | `role` | Permissões base (director/manager/broker) |
| Escopo de filial | `branchId` | Unidade operacional a que o usuário pertence |
| Capacidade operacional | `hasCapability(role, permission, jobTitle)` | Permissão combinada (role base + capacidades do cargo) |

### Mudanças implementadas

1. `JOB_TITLE_CAPABILITIES` em `permissions.ts` — mapeia capacidades extras por jobTitle:
   - `marketing`: `importar_planilhas`, `importar_leads_meta`, `ver_importacoes_meta`, `acessar_leads`
   - `finance`: `acessar_financeiro`, `ver_fluxo_caixa`, `ver_resultado_corretor`, `ver_taxas_custos`, `ver_relatorios_financeiros`, `ver_cronograma_repasses`, `exportar_relatorios`, `ver_comissao_propria`, `ver_comissao_equipe`
2. `hasCapability(role, permission, jobTitle)` — nova função que combina role base + jobTitle
3. `requireCapability(context, permission)` — função server-side que valida a capability combinada
4. Removidos hardcoded `jobTitle === "marketing"` bypasses em `marketing-import/actions.ts`, `bulk-import.ts`, `marketing/importacoes/page.tsx` — substituídos por `hasCapability`
5. Plugins (`PluginContext`) agora incluem `jobTitle` para verificação de permissão
6. Sidebars (`corretop-sidebar`, `corretor-sidebar`, `corretop-financeiro-sidebar`) usam `hasCapability` com jobTitle

### Efeitos colaterais conhecidos

- Rotas de restrição por função no `dashboard/layout.tsx` e sidebars continuam usando `jobTitle` diretamente (são decisões de UI/navegação, não de permissão).
- O escopo de dados de leads (`leads/page.tsx`, `leads/[id]/page.tsx`) continua usando `jobTitle` para definir visibilidade (decisão de escopo, não de permissão).

## DEC-048 — Catálogo de capacidades e cargos especializados

**Estado:** Aceita  
**Data:** 2026-07-22

O núcleo continuará com os papéis de segurança `director`, `manager` e `broker`.
Marketing, Financeiro, Operações e Suporte são cargos exibidos com capacidades
estendidas e escopo derivado da sessão. Compliance/Privacidade e Auditoria/Qualidade
ficam planejados até existir uma matriz de leitura com deny-by-default para ações
operacionais. A ativação e desativação de funcionalidades deverá ser feita por um
catálogo persistido, com dependências, escopo e auditoria do Super-admin.

O plano executável e o inventário de capacidades estão em
`docs/access-control-capability-plan.md`.

## DEC-049 — Atribuição de Leads por Oferta em 2 Etapas via WhatsApp com Resposta Rápida

**Estado:** Aceita  
**Data:** 2026-07-22

O CorreTop adota o fluxo de ofertas em duas etapas para distribuição de novos leads por WhatsApp:
1. **Oferta Privada (`new_lead_assignment`):** Apenas metadados gerais (empresa, tipo de lead, unidade, tempo de resposta) são enviados no primeiro template com botões de resposta rápida ("Aceitar lead" / "Recusar"). Nenhum dado sensível do cliente é exposto antes do aceite.
2. **Confirmação Atômica com Row Locking:** O clique no botão aciona a transação no servidor (`SELECT FOR UPDATE`), que garante que apenas o primeiro corretor elegível assuma o lead.
3. **Template de Confirmação (`lead_assignment_confirmed`):** Enviado somente após confirmação do aceite, com o link direto para o atendimento no CRM (`https://corretop.vercel.app/leads/{{lead_id}}`).
4. **Resolução de Disputas e Expiração:** Corretores que perderem a disputa recebem o modelo `lead_assignment_unavailable`. Ofertas não respondidas dentro do SLA expiram (`lead_assignment_expired`) e o lead retorna para a fila de distribuição.
5. **Resiliência e Fallbacks:** Todos os 4 modelos contam com geradores automáticos de mensagens de texto alternativas caso a entrega do modelo oficial falhe. Toda transição é registrada nos logs de auditoria.
## DEC-050 - Qualificação inicial opcional por IA no canal oficial

**Estado:** Aceita  
**Data:** 2026-07-23

O CorreTop pode iniciar uma sessão curta de qualificação para novos leads quando o
motor de IA global, o canal Meta Cloud do tenant e a capacidade
`feature_ai_whatsapp_qualification_enabled` estiverem ativos. A sessão é única por
lead, guarda apenas respostas operacionais, não solicita documentos/segredos e pode
ser transferida ao atendimento humano. O envio usa o mesmo outbox idempotente do
WhatsApp; texto fora da janela da Meta pode ser rejeitado até que um template inicial
seja aprovado. Desativar a capacidade interrompe novas sessões sem apagar histórico.
