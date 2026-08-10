# Registro de Decisões de Produto e Arquitetura

> **DEC-058 — Intake transacional e outbox de efeitos (aceita em 2026-07-28):** o webhook confirma um lead somente após gravar, na mesma transação, a entrega idempotente, o lead, a timeline, auditoria, evento de distribuição e efeitos pendentes. Distribuição e notificações são executadas fora da requisição por outbox com lease, retry e dead-letter; falha externa não recria o lead nem apaga o trabalho. O Super-admin controla o processador e toda exceção permanece rastreável.
>
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

## DEC-055 - Comportamento versionado do Agente de Atendimento

**Estado:** Aceita
**Data:** 2026-07-28

O comportamento comercial do agente é um artefato imutável por tenant. O Diretor cria rascunho, executa cenários críticos e publica uma única versão ativa; rollback altera apenas novas conversas. Prompt técnico, modelo, embeddings, capacidade global e rollout permanecem exclusivos do Super-admin. Enquanto a recuperação documental não estiver disponível, o agente não pode afirmar preço, carência, cobertura, rede, promoção ou condição comercial.

## Decididas

## DEC-059 - Seletor de período 7/14/30/90 nas rotas de dados

**Estado:** Aceita
**Data:** 2026-08-03

As rotas do núcleo que exibem dados temporais ganham um único seletor de período
(7/14/30/90 dias) persistido em `?period=N`, uniformizando janeiras agregadas
fixas (all-time, 7d, 30d, 6 meses, mês atual). Janelas operacionais (hoje/ontem,
SLA, horário-do-dia, health de filiais) permanecem fixas. Valores fora da
whitelist caem no fallback de 30 dias — nunca propagam input do cliente. O
Financeiro mantém uma opção `all` (total geral) além do período numérico;
`/leads` filtra lista e contador pela janela. Os KPIs do NOC (conversão, ticket
médio) passam a comparar período atual vs período anterior. Todas as queries
respeitam o escopo multi-tenant do papel.

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

## DEC-053 - Início seguro do agente de atendimento

**Estado:** Aceita
**Data:** 2026-07-27

Na primeira entrega do agente de atendimento, respostas automáticas só podem ser
enviadas após uma mensagem inbound no canal oficial do WhatsApp. Um lead recebido por
landing page pode ter a sessão preparada e uma próxima ação criada para o corretor,
mas não recebe mensagem automática até que exista consentimento aplicável e um template
Meta aprovado. A regra é reversível por tenant e pela capacidade global, e seus bloqueios
e transições devem ser auditados.

## DEC-054 - Autonomia limitada do agente no CRM

**Estado:** Aceita
**Data:** 2026-07-27

No MVP, o agente pode executar automaticamente apenas operações de baixo risco,
idempotentes e previamente autorizadas: preencher campos permitidos, adicionar tags e
criar ou atualizar tarefas de retorno. Alterar status, responsável ou encaminhar uma
conversa para uma fila humana exige confirmação explícita de um corretor autorizado.
Toda intenção, confirmação, execução, recusa e falha é auditada. A permissão depende da
capacidade global, da configuração do tenant e do registro individual da ferramenta.

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

## DEC-069 — Captação manual de Meta Lead Ads com credencial técnica central

**Estado:** Aceita
**Data:** 2026-07-29

Enquanto o OAuth/Embedded Signup de Marketing não estiver liberado, cada cliente compartilha manualmente sua Página e ativos com o portfólio empresarial do AncoraHub. A plataforma mantém um único token técnico de Usuário do Sistema somente no ambiente privado; nenhum tenant envia, armazena ou visualiza esse segredo. O Diretor mapeia a Página autorizada para seu tenant e, opcionalmente, para uma unidade. O webhook assinado resolve a empresa exclusivamente pelo `page_id`, busca o `leadgen_id` no servidor e cria o lead pelo intake transacional existente. Uma Página só pode pertencer a um tenant por vez; pausar a fonte interrompe novas captações e preserva histórico. O Super-admin controla a capacidade global por `feature_meta_lead_ads_enabled`, com auditoria.

## DEC-070 — Autorização guiada de ativos Meta para piloto

**Estado:** Aceita
**Data:** 2026-07-30

Lead Ads deixa de solicitar token ou identificadores técnicos ao Diretor. A plataforma exibe somente o nome do parceiro, Business ID e suporte; depois de o cliente compartilhar ativos na Meta e liberar o app Corretop API Oficial em Acesso a Leads, o servidor descobre ativos usando a credencial técnica central. O Diretor seleciona uma ou mais Páginas e elas entram na fila central do tenant. A descoberta é permitida apenas para tenants explicitamente habilitados no piloto pelo Super-admin; cada confirmação revalida a seleção contra a Meta e é auditada. WhatsApp permanece em trilha independente.

## DEC-071 — Inscrição automática de Página para Meta Lead Ads

**Estado:** Aceita
**Data:** 2026-08-05

Após validar que a Página foi compartilhada e ainda está visível à credencial técnica central, a ativação no AncoraHub inscreve o aplicativo Corretop API Oficial no evento `leadgen` pelo servidor. A fonte local só é criada ou reativada quando a Meta confirma a inscrição. O Diretor não recebe, informa ou visualiza token; a falha externa interrompe a ativação, preserva a configuração anterior e é apresentada sem segredos.

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

**Estado:** Substituída por DEC-069
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
## DEC-056 — Qualificação como porta de distribuição inteligente

**Estado:** Aceita
**Data:** 2026-07-28

O Qualification Engine é a única autoridade para o estado, score e resultado da
qualificação. A IA somente propõe ou extrai dados; o servidor valida os campos do
perfil publicado, persiste o resultado e registra auditoria. Quando a capacidade
estiver ativa, leads concluídos ou que solicitarem humano entram na fila de
distribuição por job idempotente. A política prioriza plantão ativo, ranking
configurável, menor carga e tempo sem novo lead. O Diretor pode excluir corretores;
o Super-admin pode desligar as capacidades sem apagar histórico. Ao assumir, o CRM
pausa a automação e não oferece envio de mensagens; somente Diretor ou Gestor pode
retomar a IA.

## DEC-059 — Fila geral central para leads sem unidade resolvida

**Estado:** Aceita
**Data:** 2026-07-28

Um lead aceito cujo canal ou regra de entrada não determine uma unidade entra na
fila geral central do tenant, sem atribuição automática a corretor. O Diretor é
responsável por encaminhá-lo para uma unidade; após esse encaminhamento, o Gestor
pode direcioná-lo dentro do escopo da própria unidade. Essa ordem preserva o
isolamento entre unidades e evita que um Gestor visualize uma fila central de
outra unidade. Cada encaminhamento deve manter o motivo e o ator em auditoria.

## DEC-060 — Titularidade operacional de exceções de intake e outbox

**Estado:** Aceita
**Data:** 2026-07-28

O Diretor é o dono primário das exceções centrais de intake, distribuição e
outbox. O Gestor atua apenas sobre exceções de leads de sua unidade. O prazo
operacional inicial é de até 30 minutos para uma exceção P0 e até o fim do dia
útil para uma P1; o alerta e qualquer reprocessamento permanecem auditados e
idempotentes.

## DEC-061 — Cobertura mínima e arquivamento de plantões

**Estado:** Aceita
**Data:** 2026-07-28

Plantões permanecem regras semanais recorrentes por unidade e fila. Cada regra define
um mínimo de corretores escalados, com valor inicial de um. A cobertura inferior ao
mínimo cria uma pendência operacional visível, mas não bloqueia a distribuição aos
corretores já elegíveis. A remoção de um plantão é arquivamento reversível: a regra
sai da seleção de distribuição, as atribuições ativas ligadas a ela são inativadas e
o histórico permanece disponível para auditoria. Exceções por data não fazem parte
desta versão.

## DEC-062 — Criação coordenada de plantões em múltiplas unidades

**Estado:** Aceita
**Data:** 2026-07-28

O Diretor pode selecionar mais de uma unidade ao criar um plantão. A operação cria uma regra independente por unidade e fila, em uma única transação. Cobertura, escala, edição, arquivamento e auditoria permanecem locais a cada regra; o Gestor continua limitado à própria unidade. Unidade sem fila ativa bloqueia toda a criação antes da gravação.

## DEC-057 — Liberação global auditável do Centro de Treinamento

**Estado:** Aceita
**Data:** 2026-07-28

O Centro de Treinamento do Agente permanece desativado por padrão e só pode ser
liberado pelo Super-admin em **Configurações da Plataforma → IA e treinamento**.
A alteração atualiza `feature_agent_training_center_enabled`, registra o ator e o
valor na auditoria de plataforma e invalida as telas de configuração. A liberação
global não concede escopo extra: Diretores continuam restritos ao próprio tenant e
ao fluxo de versões publicado.

## DEC-063 — Integração manual temporária da Meta por tenant

**Estado:** Aceita
**Data:** 2026-07-28

Enquanto o Embedded Signup não for a rota principal, o Diretor pode conectar manualmente a conta Meta de sua corretora por um assistente guiado. O servidor deriva o tenant e valida WABA, número e token pela Graph API antes de ativar o canal; o token é cifrado no registro do canal e nunca volta ao navegador, logs ou auditoria. App Secret, verify token e chave de cifra permanecem variáveis privadas do ambiente AncoraHub, pois são compartilhados pelo app oficial e não podem ser cadastrados pelo cliente. IDs de página, conta de anúncios, pixel e dataset são isolados por tenant, auditados e preparados para sincronização futura. O Super-admin mantém o kill switch global existente.

## DEC-064 — Cargos personalizados delegáveis por tenant

**Estado:** Aceita
**Data:** 2026-07-29

Diretor, Gestor e Corretor continuam perfis de sistema imutáveis. O Diretor pode criar
cargos personalizados no próprio tenant a partir de capacidades explicitamente
delegáveis. Um cargo substitui as capacidades herdadas do papel legado enquanto a
feature estiver ativa; ele nunca concede privilégios de Super-admin, gestão de
filiais, gestão financeira ou elevação de acesso. O piloto exige flag global e
liberação por tenant, preserva o fallback legado ao ser desligado e audita criação,
edição, atribuição e arquivamento.

## DEC-066 — Escopo de unidade para cargos administrativos

**Estado:** Aceita
**Data:** 2026-07-29

Gestor e Corretor continuam perfis operacionais e exigem vínculo com uma única
unidade ativa. Cargos administrativos personalizados podem ser criados com
abrangência **Geral da empresa** ou **Uma unidade**. No primeiro caso, o membro
não precisa de unidade; no segundo, o servidor exige e valida uma unidade do
mesmo tenant. O cargo padrão Marketing é geral por padrão, mas o Diretor pode
criar uma variante local de Marketing quando a operação pedir. A abrangência
limita permissões elegíveis, nunca amplia acesso de Diretor, e toda alteração
permanece auditável dentro do piloto de cargos personalizados.

## DEC-067 — Temporadas de desempenho e reinício preservam histórico

**Estado:** Aceita
**Data:** 2026-07-29

O ranking comercial usa temporadas por tenant como recorte temporal. Somente uma temporada pode estar ativa; o Diretor pode preparar rascunhos, ativar um ciclo e reiniciar o ranking. Reiniciar nunca apaga ou reescreve resultados: encerra o ciclo atual com o motivo auditado e inicia uma nova temporada. Premiações são regras de reconhecimento registradas por colocação; não iniciam pagamento, comissão ou qualquer obrigação financeira automaticamente. Metas existentes permanecem a fonte oficial dos objetivos comerciais e não são duplicadas pelo módulo de desempenho.

## DEC-068 — Perfil administrativo de membro respeita unidade e carteira

**Estado:** Aceita
**Data:** 2026-07-29

O perfil administrativo de um membro é uma visão de supervisão, não uma página pública ou uma área de autoatendimento. Diretor pode consultar qualquer membro do próprio tenant. Gestor só pode consultar membro com vínculo na própria unidade, e todas as métricas e listas do perfil recebem o mesmo filtro de unidade. A rota não distingue membro inexistente de membro fora do escopo, evitando revelar a estrutura de equipe. Cada consulta autorizada é registrada na auditoria; o Super Admin pode desativar globalmente a capacidade sem apagar histórico.

## DEC-069 — Armazenamento privado unificado no Cloudflare R2

**Estado:** Aceita
**Data:** 2026-08-03

O armazenamento persistido de binários do CorreTop passa a usar um único bucket privado Cloudflare R2, na classe Standard. O banco mantém a autoridade sobre metadados, vínculos e autorização; documentos são servidos somente pela rota autenticada do servidor. Como o ambiente ainda não contém objetos a preservar, o bucket Supabase Storage não terá cópia histórica. O prefixo `documents/<tenantId>/` assegura a organização física, mas não substitui a autorização derivada da sessão, tenant, unidade e carteira. A capacidade tem kill switch global `feature_r2_storage_enabled`, controlado e auditado pelo Super-admin, sem apagar objetos ou registros.

## DEC-070 — Workspace do Corretor como home operacional reversível

**Estado:** Aceita
**Data:** 2026-08-03

`/dashboard` permanece a única entrada por papel. Para Corretores, a capacidade
`feature_broker_workspace_enabled` troca a visão legada pelo Workspace operacional;
desativá-la restaura a visão anterior sem apagar dados. A prioridade é calculada no
servidor por fatos persistidos e ordem determinística: mensagem aguardando resposta,
SLA vencido/em risco, tarefa vencida, retorno, lead novo, cotação, documentos e
estagnação. A central `/conversas` continua a única experiência de chat. Sem canal
oficial disponível, o sistema não simula envio interno: mantém o fluxo auditado para
o WhatsApp autorizado. O Super-admin controla a capacidade globalmente e cada
alteração fica em `platform_audit_logs`.

## DEC-071 — Perfil comercial PF/PJ e Kanban único

**Estado:** Aceita
**Data:** 2026-08-05

O CRM mantém um único funil, com a mesma máquina de estados já aprovada. Novos
cadastros empresariais usam `PJ`; o valor histórico `PME` continua legível e é
agrupado como PJ. Uma empresa é sempre pertencente ao tenant, vinculada por CNPJ
normalizado quando disponível, e não concede acesso novo a um corretor. O Kanban é
somente uma visualização operacional desse funil: não cria etapas paralelas, não move
uma venda manualmente para convertida e preserva as validações, timeline e auditoria
do serviço de status existente. O Super-admin pode desligar a visualização comercial
pela configuração global sem apagar empresas ou leads.

## DEC-072 — Interface operacional simplificada como padrão reversível

**Estado:** Aceita
**Data:** 2026-08-10

A experiência operacional simplificada é o padrão para todas as empresas. Ela reduz
informações simultâneas sem remover dados, permissões ou regras comerciais: uma ação
frequente permanece visível e o restante aparece no contexto necessário. O
Super-admin pode desligar a capacidade para toda a plataforma ou devolver uma empresa
específica ao layout anterior. Ambas as alterações são auditadas; o fallback não exige
migração nem remove histórico.

## DEC-073 — Governança individual centralizada no detalhe da empresa

**Estado:** Aceita
**Data:** 2026-08-10

Configurações da plataforma mantêm apenas controles globais e dados técnicos
compartilhados. Liberações que dependem de uma empresa, incluindo piloto de Facebook
Lead Ads, exceção de interface operacional e piloto de cargos personalizados, ficam
na página individual do tenant. O Super-admin continua sendo a única autoridade para
essas alterações; cada ação valida a empresa no servidor, registra auditoria de
plataforma e pode ser revertida sem excluir histórico. Uma liberação individual não
substitui nem ignora o kill switch global correspondente.
