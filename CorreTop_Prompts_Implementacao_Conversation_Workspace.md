# CorreTop — Prompts de Implementação do Conversation Workspace

> Documento operacional para agentes de IA.

## Estado de execução e adaptação ao CorreTop

Este documento é um roadmap de implementação por fatias, não uma autorização para
implementar todas as fases em uma única entrega. A arquitetura Plugin First já possui
uma fundação inicial em `src/platform/`; a primeira execução deste plano fortalece
essa base antes de migrar a tela de conversas.

Adaptações obrigatórias ao estado real do projeto:

- `/conversas` já existe e deve ser migrado gradualmente; não será reescrito de uma vez.
- WhatsApp Web é o canal disponível no MVP; o adapter oficial permanece futuro e controlado por feature flag.
- Lead é o domínio piloto, pois já concentra conversas, tarefas, documentos, cotações e histórico.
- O Workspace é host; nenhum plugin poderá consultar banco ou duplicar regra de domínio.
- Toda etapa precisa ser `partial` até possuir governança editável, auditoria, RBAC, multi-tenant e estados operacionais.
- O próximo ciclo executável é a Fase 1.1: Manifest, Registry, Guards, Context, Lifecycle, Event Bus e Error Boundary.
- Depois da fundação validada, a ordem local será: Conversation Engine mínima, host de `/conversas`, chat contextual no lead e plugins Lead/Cotação/Documentos.
>
> Cada seção abaixo representa uma entrega isolada. O agente deve trabalhar em branch própria, respeitar `AGENTS.md`, `AI_RULES.md`, documentação em `docs/`, RBAC, multi-tenancy, auditoria, arquitetura Plugin First e os padrões da versão instalada do Next.js.

---

# 0. Regras globais para todos os prompts

Antes de qualquer implementação:

1. Leia:
   - `AGENTS.md`
   - `AI_RULES.md`
   - `docs/README.md`
   - `docs/decision-log.md`
   - `docs/business-rules.md`
   - `docs/engineering-checklist.md`
   - `docs/ui-foundation.md`
   - `DESIGN.md`
   - `MACRO-MICRO_ANIMATIONS.md`

2. Antes de alterar código Next.js, leia a documentação correspondente em:

```txt
node_modules/next/dist/docs/
```

3. Não instale, atualize ou remova dependências sem autorização explícita.

4. Preserve:
   - TypeScript estrito;
   - RBAC;
   - isolamento multi-tenant;
   - auditoria;
   - soft delete;
   - versionamento;
   - Server Components por padrão;
   - domínio fora das rotas;
   - componentes compartilhados;
   - acessibilidade;
   - reduced motion.

5. Nenhuma página, plugin, modal, drawer ou componente visual pode acessar diretamente o banco.

Fluxo obrigatório:

```txt
UI
→ Application Service / Use Case
→ Domain
→ Repository
→ Database
```

6. Toda funcionalidade deve ser:
   - utilizável em página própria;
   - utilizável como plugin contextual;
   - chamável por API;
   - chamável por automação;
   - preparada para IA;
   - preparada para feature flags;
   - auditável;
   - multi-tenant;
   - protegida por RBAC.

7. Toda implementação deve ocorrer em uma branch isolada:

```txt
feature/<nome-da-entrega>
```

8. Antes de concluir:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Adapte ao gerenciador real.

---

# FASE 1 — Fundação da Plataforma

## 1.1 — Arquitetura Plugin First

### Prompt de implementação

Atue como Principal Software Architect e implemente a fundação Plugin First do CorreTop.

Crie uma arquitetura em que páginas, workspaces, drawers, dialogs e futuras integrações consumam plugins registrados, sem conhecer diretamente os domínios.

Implemente:

```txt
Plugin Registry
Plugin Manifest
Plugin Host
Plugin Permission Guard
Plugin Feature Flag Guard
Plugin Context
Plugin Lifecycle
Plugin Events
```

Cada plugin deve declarar:

```ts
type PluginManifest = {
  id: string
  name: string
  description?: string
  category: string
  icon: string
  requiredPermissions: string[]
  featureFlag?: string
  minWidth?: number
  minHeight?: number
  preferredWidth?: number
  preferredHeight?: number
  allowedHosts: Array<
    "workspace" |
    "page" |
    "drawer" |
    "dialog" |
    "widget"
  >
  eventsPublished: string[]
  eventsConsumed: string[]
}
```

Regras:

- o host conhece apenas o contrato de plugin;
- plugins não acessam banco;
- plugins não implementam regra de negócio;
- plugins chamam serviços públicos do domínio;
- plugins são carregados somente quando RBAC e feature flags permitirem;
- plugins devem falhar de forma isolada;
- um plugin com erro não pode derrubar o workspace inteiro;
- criar boundary de erro e fallback;
- criar registro central tipado;
- não permitir IDs duplicados;
- não permitir registro dinâmico arbitrário vindo do cliente;
- preparar compatibilidade futura com plugins de terceiros, sem executar código remoto nesta fase.

Entregue:

```txt
src/platform/plugins/
  registry
  manifest
  host
  guards
  context
  events
  types
  tests
```

Critérios de aceite:

- plugin pode ser registrado;
- host renderiza plugin permitido;
- RBAC bloqueia plugin sem permissão;
- feature flag bloqueia plugin desativado;
- plugin inválido falha isoladamente;
- manifesto é tipado;
- testes cobrem registro, permissão, flag e falha.

Branch:

```txt
feature/plugin-first-foundation
```

---

## 1.2 — Conversation Engine

### Prompt de implementação

Implemente a engine única de conversas do CorreTop.

A engine deve ser independente da tela `/conversas`, do chat contextual e do WhatsApp. Ela representa o domínio central de atendimento.

Modele:

```txt
Conversation
ConversationParticipant
ConversationAssignment
Message
MessageStatus
MessageAttachment
MessageReaction
MessageReplyReference
MessageDraft
ConversationTag
ConversationNote
ConversationEvent
```

A engine deve suportar:

- texto;
- imagem;
- documento;
- áudio;
- localização;
- contato;
- mensagem de sistema;
- nota interna;
- resposta citada;
- status de envio;
- status de entrega;
- status de leitura;
- mensagens recebidas e enviadas;
- rascunhos;
- ordenação cronológica;
- paginação;
- busca;
- soft delete;
- versionamento de notas;
- idempotência por mensagem externa;
- associação com lead/cliente;
- múltiplos canais futuros.

Estados mínimos de conversa:

```txt
open
pending
waiting_customer
waiting_agent
closed
archived
```

Estados mínimos de mensagem:

```txt
queued
sending
sent
delivered
read
failed
received
```

Regras:

- cliente possui um único owner ativo;
- conversa possui responsável operacional;
- mensagens externas não podem ser editadas;
- notas internas podem ser editadas e excluídas visualmente;
- exclusão é soft delete;
- toda edição de nota gera nova versão;
- histórico nunca é apagado;
- queries sempre filtradas por tenant;
- APIs públicas do domínio não recebem tenant arbitrário do cliente;
- preparar adapters de canal;
- não integrar WhatsApp ainda;
- criar interfaces para provider de mensagens;
- criar eventos de domínio.

Eventos mínimos:

```txt
conversation.created
conversation.assigned
conversation.reassigned
conversation.closed
conversation.reopened
message.received
message.sent
message.delivered
message.read
message.failed
note.created
note.updated
note.deleted
```

Critérios:

- engine pode ser usada sem UI;
- mensagens e conversas são multi-tenant;
- idempotência impede duplicidade;
- notas possuem versões;
- eventos são emitidos;
- testes unitários cobrem transições de estado.

Branch:

```txt
feature/conversation-engine
```

---

## 1.3 — Layout Engine e Dock System

### Prompt de implementação

Implemente o motor de workspace com múltiplos painéis simultâneos.

O workspace deve funcionar como host de plugins e permitir:

- painéis lado a lado;
- redimensionamento;
- recolhimento;
- maximização;
- fechamento;
- reordenação;
- abas internas;
- drag and drop quando a infraestrutura atual permitir;
- restauração da sessão;
- persistência por usuário;
- layouts nomeados;
- layouts pessoais;
- layouts de equipe;
- layouts do tenant;
- layouts do sistema.

Modele:

```ts
WorkspaceLayout
WorkspacePanel
WorkspaceTab
WorkspacePreset
WorkspaceUserState
```

Cada estado deve guardar:

```txt
painéis abertos
ordem
dimensões
painéis recolhidos
abas
plugin ativo
filtros locais
layout selecionado
```

Não persistir:

- conteúdo sensível;
- mensagens;
- tokens;
- dados de formulário sem necessidade.

Escopos:

```txt
personal
team
tenant
system
```

Regras:

- corretor cria layouts pessoais;
- gestor cria layouts de equipe;
- diretor ou permissão equivalente cria layouts do tenant;
- layouts oficiais podem ser somente leitura;
- usuário pode duplicar layout oficial;
- toda alteração em layout compartilhado gera auditoria;
- layout pessoal pode ser excluído com soft delete;
- aplicação deve possuir fallback responsivo;
- mobile usa uma ferramenta por vez;
- desktop suporta múltiplos painéis;
- não duplicar estado de domínio dentro do layout.

Critérios:

- abrir três plugins simultaneamente;
- redimensionar;
- salvar;
- recarregar página;
- restaurar layout;
- RBAC controla edição;
- layout de equipe chega à equipe correta;
- layout de outro tenant nunca é acessível.

Branch:

```txt
feature/workspace-layout-engine
```

---

## 1.4 — Auditoria, versionamento e soft delete

### Prompt de implementação

Implemente infraestrutura global de auditoria reutilizável.

A auditoria deve suportar:

```txt
actor
tenant
action
entityType
entityId
before
after
metadata
requestId
timestamp
source
```

Fontes:

```txt
page
workspace
plugin
api
automation
system
integration
```

Regras:

- logs imutáveis;
- não permitir update/delete comum;
- não armazenar secrets;
- não armazenar payload bruto sensível;
- mascarar PII;
- registrar ações administrativas;
- registrar acesso a dados sensíveis conforme política;
- registrar alterações de owner;
- registrar transferências;
- registrar recusas;
- registrar mudanças de SLA;
- registrar notas;
- registrar templates;
- registrar layouts;
- registrar permissões;
- registrar exportações;
- registrar integrações.

Implemente:

```txt
AuditService
AuditRepository
AuditEvent
VersionedEntity helper
SoftDelete helper
```

Notas internas devem ter:

```txt
note
note_version
deleted_at
deleted_by
```

Critérios:

- alteração gera log;
- versão anterior permanece;
- exclusão não remove fisicamente;
- auditoria é consultável por tenant;
- RBAC controla visualização;
- logs não vazam dados de outro tenant;
- testes verificam imutabilidade.

Branch:

```txt
feature/audit-foundation
```

---

## 1.5 — Event Bus interno

### Prompt de implementação

Implemente um barramento interno de eventos de domínio desacoplado.

Requisitos:

- eventos tipados;
- handlers independentes;
- publicação síncrona local nesta fase;
- interface preparada para fila futura;
- retries apenas quando já houver infraestrutura;
- não criar fila improvisada;
- handlers idempotentes;
- correlationId;
- causationId;
- tenantId;
- actorId;
- timestamp;
- versionamento de evento.

Contrato:

```ts
type DomainEvent<TPayload> = {
  id: string
  type: string
  version: number
  tenantId: string
  actorId?: string
  correlationId: string
  causationId?: string
  occurredAt: Date
  payload: TPayload
}
```

Eventos iniciais:

```txt
lead.created
lead.assigned
conversation.created
conversation.assigned
message.received
message.sent
message.failed
sla.warning
sla.breached
task.created
proposal.created
document.requested
```

Regras:

- módulos não importam implementações uns dos outros;
- comunicação transversal ocorre por eventos;
- evento não substitui transação crítica;
- domínio persiste estado primeiro;
- publicar evento após sucesso;
- preparar outbox pattern, sem forçar implementação se não houver decisão.

Critérios:

- registrar handler;
- publicar evento;
- múltiplos handlers recebem;
- falha de handler é isolada;
- idempotência testada;
- tipos impedem payload inválido.

Branch:

```txt
feature/domain-event-bus
```

---

# FASE 2 — Atendimento

## 2.1 — Tela `/conversas`

### Prompt de implementação

Implemente a tela principal de atendimento em:

```txt
/conversas
```

A tela deve consumir a Conversation Engine e o Workspace Host.

Estrutura desktop:

```txt
Lista de conversas
Conversa ativa
Painéis de plugins
```

Implementar:

- lista paginada;
- busca;
- filtros;
- filtro por equipe;
- filtro por responsável;
- não lidas;
- aguardando corretor;
- aguardando cliente;
- SLA em risco;
- arquivadas;
- favoritas;
- tags;
- prioridade;
- origem;
- ordenação;
- conversa ativa;
- composer;
- timeline de mensagens;
- loading;
- empty;
- erro;
- permissão negada;
- conexão indisponível.

Regras:

- corretor vê somente o permitido por RBAC;
- gestor e diretor podem visualizar conforme escopo;
- gestor/diretor não respondem ao cliente neste MVP;
- conversa deve mostrar owner;
- lista deve atualizar em tempo real quando infraestrutura existir;
- não criar polling agressivo;
- preservar seleção durante refetch;
- abrir conversa não marca automaticamente como resolvida;
- leitura deve seguir regra explícita;
- navegação por teclado;
- busca não pode vazar outro tenant.

Critérios:

- lista funciona;
- conversa abre;
- mensagens paginam;
- filtros persistem;
- seleção é preservada;
- RBAC testado;
- estados obrigatórios implementados.

Branch:

```txt
feature/conversations-page
```

---

## 2.2 — Chat contextual em `/leads/[id]`

### Prompt de implementação

Implemente um chat contextual na página existente do lead:

```txt
/leads/[id]
```

O chat deve aparecer apenas para o lead da rota atual e consumir a mesma Conversation Engine de `/conversas`.

Regras:

- não criar segunda engine;
- não duplicar composer;
- não duplicar queries;
- chat preso ao lead atual;
- não exibir outro cliente;
- ao perder permissão, bloquear envio imediatamente;
- preservar rascunho por conversa;
- não abrir múltiplas conversas;
- usar painel lateral ou flutuante conforme design;
- não substituir a área completa do cliente;
- documentos, histórico, propostas e dados completos continuam nos módulos próprios;
- chat apenas fornece comunicação contextual.

Implementar:

- abrir/recolher;
- altura e largura responsivas;
- mensagens;
- composer;
- anexos;
- notas internas;
- status;
- indicador de não lidas;
- loading;
- erro;
- sem conversa;
- criar conversa quando permitido;
- botão para abrir conversa completa em `/conversas`.

Critérios:

- lead A nunca mostra conversa B;
- mesma mensagem aparece em ambos os contextos;
- rascunho é compartilhado;
- envio funciona;
- RBAC funciona;
- mobile utiliza drawer ou full screen conforme padrão.

Branch:

```txt
feature/contextual-lead-chat
```

---

## 2.3 — Tipos de mensagem

### Prompt de implementação

Implemente suporte de domínio e UI para:

```txt
texto
imagem
documento
áudio
localização
contato
nota interna
mensagem de sistema
```

Para cada tipo, definir:

- schema;
- validação;
- renderer;
- preview;
- fallback;
- acessibilidade;
- status de envio;
- download quando aplicável;
- limite de tamanho;
- MIME types;
- tratamento de erro.

Áudio no MVP:

- reproduzir;
- pausar;
- barra de progresso;
- duração;
- velocidade 1x, 1.5x e 2x;
- download quando permitido;
- manter arquivo original.

Preparar campos futuros:

```txt
transcriptionStatus
transcription
summary
intent
sentiment
aiProcessedAt
```

Todos desativados por feature flag.

Não implementar IA agora.

Critérios:

- todos os tipos renderizam;
- arquivo inválido é rejeitado;
- áudio funciona;
- fallback de mídia indisponível funciona;
- nenhuma análise IA é executada.

Branch:

```txt
feature/conversation-message-types
```

---

## 2.4 — Upload e anexos

### Prompt de implementação

Implemente pipeline de anexos para conversas.

Requisitos:

- upload privado;
- URLs temporárias;
- validação server-side;
- tamanho máximo;
- MIME permitido;
- preview;
- progresso;
- cancelamento;
- retry;
- remoção antes do envio;
- estado de erro;
- antivírus apenas se houver infraestrutura;
- não guardar arquivo público;
- não confiar no MIME do cliente;
- associar arquivo ao tenant;
- impedir acesso cruzado;
- auditar download sensível quando necessário.

Fluxo:

```txt
selecionar
→ validar
→ reservar upload
→ enviar storage
→ confirmar upload
→ anexar à mensagem
→ enviar mensagem
```

Critérios:

- upload cancelável;
- erro não perde rascunho;
- tenant A não acessa arquivo do B;
- URL expira;
- attachment órfão é limpo por política futura.

Branch:

```txt
feature/conversation-attachments
```

---

## 2.5 — Editor inteligente

### Prompt de implementação

Implemente o composer inteligente do chat.

Funcionalidades:

- comandos `/`;
- snippets;
- templates;
- variáveis;
- anexos rápidos;
- emojis;
- assinatura automática;
- favoritos;
- histórico de rascunhos;
- resposta citada;
- atalhos de teclado;
- extensões futuras;
- IA futura desativada.

Variáveis iniciais:

```txt
{{nome}}
{{primeiro_nome}}
{{corretor}}
{{empresa}}
{{filial}}
{{plano}}
```

Regras:

- variáveis são resolvidas no servidor antes do envio;
- preview antes de enviar;
- variável ausente deve gerar aviso;
- template nunca envia automaticamente sem confirmação;
- origem do template deve ser registrada;
- mensagem final pode ser editada pelo corretor;
- editor não pode permitir HTML inseguro;
- respeitar limites do WhatsApp;
- comandos e integrações devem ser registrados por extensão;
- composer deve funcionar em `/conversas` e `/leads/[id]`.

Critérios:

- slash command abre catálogo;
- snippet insere texto;
- template resolve variáveis;
- assinatura aplica corretamente;
- rascunho persiste;
- envio registra origem do template.

Branch:

```txt
feature/smart-message-composer
```

---

## 2.6 — Templates, snippets e base compartilhada

### Prompt de implementação

Implemente o sistema de conteúdos reutilizáveis.

Escopos:

```txt
personal
team
tenant
system
```

Permissões:

- corretor cria apenas conteúdos pessoais;
- gestor cria conteúdos para sua equipe;
- diretor ou permissão equivalente cria conteúdos do tenant;
- conteúdos de sistema são somente leitura;
- conteúdos compartilhados podem exigir aprovação configurável.

Tipos:

```txt
template
snippet
attachment
script
playbook
faq
checklist
signature
```

Funcionalidades:

- criar;
- editar;
- duplicar;
- arquivar;
- excluir visualmente;
- versionar;
- aprovar;
- rejeitar;
- publicar;
- desativar;
- organizar por pasta;
- tag;
- favoritar;
- buscar;
- auditar.

Regras:

- corretor não publica global;
- conteúdo compartilhado respeita equipe;
- origem da mensagem registra contentId e versionId;
- editar conteúdo não altera mensagens antigas;
- sistema mantém versões;
- soft delete obrigatório.

Critérios:

- escopos funcionam;
- RBAC testado;
- aprovação opcional;
- versões preservadas;
- template disponível no composer.

Branch:

```txt
feature/message-content-library
```

---

# FASE 3 — Distribuição, Owner e SLA

## 3.1 — Owner do cliente

### Prompt de implementação

Implemente o conceito de owner permanente do lead/cliente.

Regra principal:

- todo lead/cliente possui um corretor responsável;
- novas mensagens retornam ao mesmo owner;
- mudança de canal ou número não altera owner;
- alteração exige fluxo explícito.

Exceções:

```txt
corretor inativo
desligado
férias
afastado
licença
transferência manual
regra de contingência
```

Modele histórico:

```txt
owner_assignment
previousOwner
newOwner
reason
changedBy
changedAt
source
```

Regras:

- somente RBAC autorizado altera owner;
- mudança exige motivo;
- toda alteração gera auditoria;
- owner anterior permanece no histórico;
- cliente órfão entra em fila de contingência;
- não atribuir automaticamente sem regra aprovada.

Critérios:

- mensagens retornam ao owner;
- troca registrada;
- owner inativo gera contingência;
- nenhum lead fica invisível.

Branch:

```txt
feature/customer-owner
```

---

## 3.2 — Distribuição automática e manual

### Prompt de implementação

Implemente o motor de distribuição.

Modos:

```txt
automatic
manual
```

Gestor autorizado pode:

- ligar/desligar automático;
- distribuir manualmente;
- reatribuir;
- pausar distribuição por equipe;
- alterar capacidade;
- visualizar motivo da decisão.

Estratégia inicial:

- round-robin;
- filial;
- equipe;
- disponibilidade;
- capacidade;
- especialidade futura;
- região futura;
- horário.

Tudo deve ser configurável por tenant.

Cada decisão registra:

```txt
mode
eligibleAgents
selectedAgent
rule
reason
actor
timestamp
previousOwner
newOwner
```

Regras:

- tenant define modo;
- gestor não pode distribuir fora do escopo;
- distribuição manual exige motivo;
- reatribuição exige motivo;
- algoritmo é determinístico e testável;
- não usar estado apenas em memória;
- concorrência não pode atribuir o mesmo lead duas vezes;
- usar transação/lock adequado.

Critérios:

- automático distribui;
- manual funciona;
- gestor alterna modo;
- auditoria completa;
- concorrência testada;
- outro tenant não interfere.

Branch:

```txt
feature/lead-distribution-engine
```

---

## 3.3 — Capacidade operacional

### Prompt de implementação

Implemente limites configuráveis de atendimento simultâneo.

Escopos:

```txt
tenant
team
role
user
```

Precedência deve ser definida e documentada.

Estados de conversa com peso configurável:

```txt
active
waiting_agent
waiting_customer
priority
vip
```

Versão inicial pode usar contagem simples, mas preparar weighted capacity.

Exemplo futuro:

```txt
waiting_customer = 0.2
active = 1
waiting_agent = 2
hot_lead = 3
vip = 5
```

Quando atingir capacidade:

- corretor continua atendendo conversas existentes;
- não recebe novos leads;
- motor tenta próximo elegível;
- gestor pode alterar limite;
- alteração é auditada.

Estados de disponibilidade:

```txt
available
paused
meeting
lunch
training
vacation
away
offline
```

Critérios:

- limite é aplicado;
- override por usuário funciona;
- pausa remove elegibilidade;
- histórico é auditado;
- métricas de carga existem.

Branch:

```txt
feature/agent-capacity
```

---

## 3.4 — Recusa de atendimento

### Prompt de implementação

Implemente recusa de lead pelo corretor.

Regras:

- corretor pode recusar;
- motivo obrigatório;
- lead volta à fila;
- gestor é notificado;
- tudo auditado;
- tempo entre atribuição e recusa registrado;
- histórico de recusas mantido;
- métricas por corretor.

Motivos devem ser configuráveis:

```txt
duplicado
região incorreta
produto não atendido
indisponibilidade
conflito
outro
```

Proteções:

- limite diário configurável;
- limite consecutivo;
- motivos que exigem aprovação;
- alerta de comportamento anormal;
- bloqueio automático apenas se aprovado;
- corretor não escolhe próximo responsável.

Critérios:

- recusa exige motivo;
- redistribuição ocorre;
- gestor recebe alerta;
- histórico preservado;
- métricas disponíveis.

Branch:

```txt
feature/lead-rejection
```

---

## 3.5 — Transferência e reatribuição

### Prompt de implementação

Implemente transferência entre:

```txt
corretores
equipes
filiais
```

Fluxo:

```txt
solicitar
→ validar permissão
→ validar destino
→ exigir motivo
→ atualizar owner
→ atualizar conversation assignment
→ registrar auditoria
→ notificar envolvidos
```

Regras:

- mensagens antigas permanecem;
- novo owner acessa histórico;
- antigo owner perde envio quando política determinar;
- transferência pode ser imediata ou exigir aceite, configurável;
- não transferir para usuário inativo;
- não transferir fora do tenant;
- transferências sensíveis podem exigir aprovação.

Critérios:

- transferência completa;
- permissões atualizadas imediatamente;
- envio bloqueado para antigo owner;
- notificações geradas;
- auditoria preservada.

Branch:

```txt
feature/conversation-transfer
```

---

## 3.6 — Motor de SLA

### Prompt de implementação

Implemente um motor configurável de SLA.

Tipos:

```txt
first_response
continuity_response
stage_stagnation
customer_waiting
agent_waiting
```

Configurações por:

```txt
tenant
channel
team
lead type
priority
VIP
business hours
```

Escalonamento:

```txt
reminder corretor
alerta corretor
notificação gestor
conversa em risco
redistribuição opcional
escalonamento diretor
```

Regras:

- respeitar horário comercial;
- permitir pausa fora do horário;
- exceções por indisponibilidade;
- provider indisponível pode suspender SLA;
- feriados futuros;
- redistribuição só se habilitada;
- tudo auditado;
- job idempotente;
- não duplicar alertas;
- thresholds configuráveis;
- usar timestamps persistidos.

Eventos:

```txt
sla.started
sla.warning
sla.escalated
sla.breached
sla.resolved
sla.redistributed
```

Critérios:

- primeira resposta funciona;
- continuidade funciona;
- horário comercial funciona;
- alertas não duplicam;
- redistribuição é opcional;
- métricas são produzidas.

Branch:

```txt
feature/conversation-sla-engine
```

---

# FASE 4 — Plugins do Workspace

## 4.1 — Plugin Host do Conversation Workspace

### Prompt de implementação

Integre o Plugin Host ao `/conversas`.

O host deve:

- abrir vários plugins;
- redimensionar;
- mover;
- fechar;
- persistir estado;
- verificar RBAC;
- verificar feature flags;
- passar contexto seguro.

Contexto mínimo:

```ts
type ConversationPluginContext = {
  tenantId: string
  userId: string
  conversationId: string
  leadId: string | null
  customerId: string | null
  permissions: string[]
}
```

Não expor dados além do necessário.

Critérios:

- abrir Lead + Cotador + Agenda;
- fechar e restaurar;
- plugin sem permissão não abre;
- erro fica isolado;
- layout é persistido.

Branch:

```txt
feature/conversation-plugin-host
```

---

## 4.2 — Lead Plugin

### Prompt de implementação

Crie o plugin contextual de lead.

Mostrar:

- identificação;
- contato;
- status;
- origem;
- owner;
- filial;
- tags;
- prioridade;
- resumo;
- próximas tarefas;
- SLA;
- ações rápidas.

Ações:

- alterar etapa;
- criar tarefa;
- agendar retorno;
- alterar tag;
- alterar prioridade;
- abrir página completa.

Regras:

- usar serviços do domínio de leads;
- não duplicar formulário completo;
- ações sensíveis exigem RBAC;
- alterações geram auditoria;
- plugin atualiza via eventos.

Branch:

```txt
feature/lead-workspace-plugin
```

---

## 4.3 — Cotador Plugin

### Prompt de implementação

Crie plugin contextual do cotador.

Permitir:

- iniciar cotação;
- selecionar beneficiários;
- operadora;
- plano;
- visualizar resultado;
- salvar versão;
- enviar ao cliente;
- abrir módulo completo.

Regras:

- consumir domínio de cotação;
- não duplicar regra;
- manter versões;
- registrar origem `workspace`;
- RBAC;
- auditoria;
- não implementar scraping.

Branch:

```txt
feature/quote-workspace-plugin
```

---

## 4.4 — Agenda Plugin

### Prompt de implementação

Crie plugin de agenda contextual.

Permitir:

- visualizar próximos eventos;
- criar retorno;
- reagendar;
- cancelar;
- criar lembrete;
- abrir calendário completo.

Regras:

- vincular ao lead;
- timezone correto;
- impedir conflito quando regra existir;
- auditar alterações;
- não integrar Google/Outlook ainda;
- preparar adapter futuro.

Branch:

```txt
feature/calendar-workspace-plugin
```

---

## 4.5 — Documentos Plugin

### Prompt de implementação

Crie plugin contextual de documentos.

Permitir:

- checklist;
- documentos pendentes;
- solicitar;
- visualizar;
- fazer upload;
- aprovar/rejeitar quando permitido;
- abrir página completa.

Regras:

- storage privado;
- RBAC;
- dados sensíveis;
- URLs temporárias;
- auditoria de acesso;
- não copiar documento para o chat;
- enviar apenas link seguro quando necessário.

Branch:

```txt
feature/documents-workspace-plugin
```

---

## 4.6 — Propostas Plugin

### Prompt de implementação

Crie plugin contextual de propostas.

Permitir:

- criar;
- visualizar versões;
- gerar;
- enviar;
- acompanhar status;
- abrir página completa.

Regras:

- domínio independente;
- versionamento;
- auditoria;
- origem da ação registrada;
- assinatura eletrônica futura via adapter;
- não acoplar a provider externo.

Branch:

```txt
feature/proposals-workspace-plugin
```

---

## 4.7 — Timeline Plugin

### Prompt de implementação

Crie timeline unificada contextual.

Exibir:

```txt
mensagens
mudanças de status
owner
transferências
tarefas
cotações
propostas
documentos
notas
SLA
auditoria permitida
```

Regras:

- ordenar por tempo;
- filtros por tipo;
- paginação;
- não expor auditoria restrita;
- eventos padronizados;
- cada domínio fornece adapter de timeline;
- plugin não consulta tabelas diretamente.

Branch:

```txt
feature/timeline-workspace-plugin
```

---

## 4.8 — IA Plugin placeholder

### Prompt de implementação

Crie apenas a estrutura do plugin de IA, desativado por feature flag.

Estados:

```txt
disabled
unavailable
ready
processing
error
```

Preparar contratos para:

- sugerir resposta;
- resumir conversa;
- transcrever áudio;
- classificar intenção;
- sentimento;
- próximos passos;
- risco de perda.

Não chamar modelo externo.

Não enviar dados.

Não armazenar prompt real.

Exibir placeholder apenas para ambientes autorizados.

Branch:

```txt
feature/ai-plugin-foundation
```

---

# FASE 5 — Gestão e Supervisão

## 5.1 — Supervisão de conversas

### Prompt de implementação

Implemente visão de supervisão para gestor e diretor.

Permitir:

- visualizar conversas;
- acompanhar em tempo real;
- filtrar por equipe;
- corretor;
- SLA;
- status;
- prioridade;
- não lidas;
- risco;
- capacidade;
- recusas;
- transferências.

Permitir:

- notas internas;
- tarefas;
- lembretes;
- alertas ao corretor.

Não permitir neste MVP:

- responder ao cliente;
- digitar como corretor;
- apagar mensagem;
- editar mensagem;
- assumir conversa sem fluxo de transferência.

Toda visualização sensível pode ser auditada conforme configuração.

Branch:

```txt
feature/conversation-supervision
```

---

## 5.2 — Notas internas versionadas

### Prompt de implementação

Implemente notas internas em conversa e lead.

Regras:

- criar;
- editar;
- excluir visualmente;
- versionar;
- auditar;
- marcar importante;
- mencionar usuário;
- vincular tarefa;
- invisível ao cliente.

Exclusão:

```txt
status = deleted
deletedAt
deletedBy
```

Conteúdo original permanece.

Gestor/diretor podem ver versões conforme permissão.

Branch:

```txt
feature/versioned-internal-notes
```

---

## 5.3 — Dashboard operacional

### Prompt de implementação

Implemente dashboard de atendimento com:

```txt
tempo de primeira resposta
tempo médio de resposta
SLA violado
conversas abertas
aguardando corretor
aguardando cliente
recusas
transferências
taxa de conversão
capacidade
carga por corretor
```

Filtros:

```txt
período
filial
equipe
corretor
origem
canal
```

Regras:

- métricas derivadas de eventos e estados;
- não fazer query pesada sem índices;
- usar agregações;
- RBAC;
- multi-tenant;
- exportação auditada;
- cards clicáveis levam à fila filtrada.

Branch:

```txt
feature/conversation-operations-dashboard
```

---

## 5.4 — Gestão de layouts

### Prompt de implementação

Implemente página completa para layouts.

Permitir:

- listar;
- criar;
- duplicar;
- editar;
- publicar;
- arquivar;
- definir padrão;
- definir obrigatório;
- atribuir a equipe;
- visualizar versões;
- auditar.

Escopos:

```txt
personal
team
tenant
system
```

Regras:

- pessoal pelo usuário;
- equipe pelo gestor;
- tenant pelo diretor/permissão;
- sistema somente leitura;
- layout obrigatório não pode ser removido, mas pode permitir extensão;
- alterações compartilhadas versionadas.

Branch:

```txt
feature/workspace-layout-management
```

---

# FASE 6 — IA futura

## 6.1 — Pipeline de áudio

### Prompt de implementação

Implemente a arquitetura da pipeline de áudio, inicialmente desativada.

Fases futuras:

```txt
store
transcribe
summarize
classify intent
detect urgency
sentiment
extract entities
suggest next steps
```

Regras:

- feature flag por tenant;
- consentimento;
- retenção;
- provider adapter;
- fila assíncrona;
- status persistido;
- retries idempotentes;
- custo por tenant;
- auditoria;
- fallback sem IA;
- áudio original preservado.

Não ativar provider sem autorização.

Branch:

```txt
feature/audio-ai-pipeline
```

---

## 6.2 — Sugestão de respostas

### Prompt de implementação

Implemente contratos e UI para sugestões de resposta por IA.

Regras:

- nunca enviar automaticamente;
- corretor revisa;
- indicação clara de conteúdo gerado;
- registrar aceitação/edição/rejeição;
- prompts versionados;
- escopo por tenant;
- conteúdo sensível protegido;
- feature flag;
- provider desacoplado;
- custo monitorado;
- logs sem prompt sensível bruto.

Branch:

```txt
feature/ai-reply-suggestions
```

---

## 6.3 — Coach de atendimento

### Prompt de implementação

Implemente estrutura de coach invisível ao cliente.

Sugestões:

- próxima pergunta;
- objeção;
- risco;
- tom;
- produto;
- follow-up;
- compliance.

Regras:

- somente corretor vê;
- gestor pode ver métricas agregadas;
- não expor pensamentos internos;
- não automatizar resposta;
- feature flag;
- auditoria de uso;
- sem punição automática baseada apenas em IA.

Branch:

```txt
feature/ai-conversation-coach
```

---

## 6.4 — Resumo automático

### Prompt de implementação

Implemente resumo estruturado de conversa.

Campos:

```txt
contexto
necessidades
objeções
planos discutidos
documentos
pendências
próximo passo
sentimento
risco
```

Regras:

- resumo editável;
- versão gerada e versão aprovada;
- não substituir histórico;
- indicar fonte IA;
- auditar edição;
- feature flag;
- não processar sem consentimento aplicável.

Branch:

```txt
feature/ai-conversation-summary
```

---

# FASE 7 — Omnichannel

## 7.1 — WhatsApp Oficial

### Prompt de implementação

Implemente integração oficial do WhatsApp através de adapter de canal.

Suportar:

- múltiplos números por tenant;
- números institucionais;
- números de equipe;
- números de corretor;
- mensagens recebidas;
- mensagens enviadas;
- status;
- mídia;
- templates;
- webhooks;
- idempotência;
- reconciliação;
- erros;
- rate limits;
- janela de atendimento;
- auditoria.

Regras:

- marketing usa número institucional;
- atendimento pertence ao corretor;
- resposta do cliente institucional pode entrar em distribuição;
- owner recebe novas mensagens;
- provider não entra no domínio;
- adaptar BSP/Cloud API;
- secrets privados;
- webhooks assinados;
- payloads validados;
- nenhum token no cliente.

Branch:

```txt
feature/whatsapp-channel-adapter
```

---

## 7.2 — Chat do site

### Prompt de implementação

Implemente adapter futuro de chat web.

Requisitos:

- widget externo;
- sessão anônima;
- consentimento;
- criação de lead;
- conversa;
- distribuição;
- transferência;
- identidade após captura;
- anti-spam;
- rate limiting;
- origem `website_chat`;
- mesma Conversation Engine.

Branch:

```txt
feature/website-chat-channel
```

---

## 7.3 — Instagram/Facebook

### Prompt de implementação

Implemente adapters para Instagram e Messenger usando a mesma engine.

Regras:

- providers isolados;
- webhook validado;
- idempotência;
- thread mapping;
- mídia;
- limitações de canal;
- owner;
- distribuição;
- auditoria;
- feature flag;
- nenhuma regra de negócio específica dentro do adapter.

Branch:

```txt
feature/meta-messaging-channels
```

---

# FASE 8 — Plataforma de Plugins

## 8.1 — SDK interno de plugins

### Prompt de implementação

Implemente SDK interno tipado para plugins.

Fornecer:

```txt
manifest
context
permissions
events
commands
storage namespaced
navigation
telemetry
error boundary
```

Regras:

- sem acesso direto ao banco;
- sem acesso a secrets;
- storage isolado por plugin/tenant/user;
- permissões declarativas;
- eventos tipados;
- API versionada;
- compatibilidade futura.

Branch:

```txt
feature/plugin-sdk
```

---

## 8.2 — Marketplace futuro

### Prompt de implementação

Crie apenas modelagem e contratos para marketplace.

Entidades futuras:

```txt
plugin
pluginVersion
installation
permissionGrant
tenantInstallation
review
publisher
```

Não permitir código remoto ainda.

Preparar:

- catálogo;
- instalação;
- versão;
- aprovação;
- permissões;
- desinstalação;
- auditoria.

Branch:

```txt
feature/plugin-marketplace-foundation
```

---

# FASE 9 — Enterprise

## 9.1 — Multi-BSP e múltiplos números

### Prompt de implementação

Implemente abstração para múltiplos providers de WhatsApp.

Requisitos:

- provider adapter;
- múltiplas contas;
- múltiplos números;
- health status;
- fallback;
- roteamento;
- credenciais isoladas;
- auditoria;
- custos;
- limites.

Não acoplar domínio ao provider.

Branch:

```txt
feature/multi-bsp
```

---

## 9.2 — LGPD e retenção

### Prompt de implementação

Implemente políticas de:

- consentimento;
- retenção;
- anonimização;
- exclusão lógica;
- exportação;
- acesso;
- trilha;
- documentos;
- áudio;
- IA.

Regras:

- dados de saúde são sensíveis;
- princípio de minimização;
- exclusão respeita obrigações legais;
- exportações auditadas;
- acesso temporário;
- revisão jurídica necessária.

Branch:

```txt
feature/privacy-retention
```

---

## 9.3 — Observabilidade e resiliência

### Prompt de implementação

Implemente observabilidade para atendimento.

Métricas:

```txt
webhook latency
message delivery
provider errors
queue lag
SLA jobs
event failures
plugin errors
upload failures
```

Requisitos:

- logs estruturados;
- requestId;
- correlationId;
- tenant seguro;
- alertas;
- dashboards;
- health checks;
- retries;
- dead-letter future;
- sem PII em logs.

Branch:

```txt
feature/conversation-observability
```

---

# Ordem recomendada

```txt
1. Plugin First
2. Conversation Engine
3. Auditoria
4. Event Bus
5. Layout Engine
6. /conversas
7. Chat contextual
8. Tipos de mensagem
9. Upload
10. Composer inteligente
11. Templates
12. Owner
13. Distribuição
14. Capacidade
15. Recusa
16. Transferência
17. SLA
18. Plugin Host
19. Plugins de domínio
20. Supervisão
21. Dashboards
22. WhatsApp
23. IA
24. Omnichannel
25. Marketplace
26. Enterprise
```

# Critério global de conclusão

Nenhum item está concluído se:

- possuir `TODO` em fluxo crítico;
- não tiver testes;
- não tiver RBAC;
- aceitar tenant do cliente;
- acessar banco pela UI;
- duplicar regra de negócio;
- não gerar auditoria quando aplicável;
- não possuir estados de loading, erro, vazio e permissão;
- não respeitar componentes compartilhados;
- não passar lint, type-check, testes e build.
