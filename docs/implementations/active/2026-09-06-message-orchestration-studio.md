# Estúdio de mensagens por situação

**Estado:** implementado; homologação externa pendente  
**Data:** 2026-09-06  
**Decisão:** DEC-092 / ADR-0041

## Resultado esperado

Em `/qualificacao`, Diretor ou Gestor autorizado sincroniza, cria, testa e consulta
templates Meta, mantém mensagens livres e publica qual mensagem será usada em cada
situação operacional. Ao atribuir um lead, o mesmo vínculo configurado deve gerar a
mensagem ao corretor pela outbox corporativa, respeitando horário, cadência,
idempotência e política Meta/WAHA.

## Plano executável

### Fase 1 — contrato e persistência

- [x] Registrar catálogo tipado de eventos, finalidade, público, janela e variáveis.
- [x] Criar política por `tenant + evento`, com principal, contingência, versão e
  estado.
- [x] Persistir snapshot da política na outbox para que edições futuras não alterem
  mensagens já enfileiradas.
- [x] Migrar vínculos Meta legados sem apagar as tabelas atuais.

### Fase 2 — casos de uso e entrega

- [x] Validar template aprovado da WABA ativa e mensagem livre ativa do tenant.
- [x] Resolver Meta/texto pela janela de 24 horas e política corporativa WAHA.
- [x] Remover o bloqueio que ignorava a seleção nos eventos do corretor, preservando
  os contratos de variáveis e o botão com `lead_id`.
- [x] Fazer distribuição, aceite e primeiro contato consumirem o mesmo resolvedor.
- [x] Enviar contingência apenas antes do aceite do provedor.

### Fase 3 — experiência única

- [x] Substituir o painel legado de templates da Qualificação pelo catálogo rico da
  integração WhatsApp.
- [x] Adicionar editor de situações com principal, contingência, estado e diagnóstico
  de elegibilidade.
- [x] Adicionar CRUD de mensagens livres com preview e variáveis disponíveis.
- [x] Manter `/integrations/whatsapp` focado em conexão/saúde, com atalho para o
  estúdio em `/qualificacao?tab=meta_templates`.

### Fase 4 — verificação

- [x] Testar catálogo, validação multi-tenant, janela, Meta-primeiro, texto livre
  interno, fallback único e compatibilidade legada.
- [x] Testar o produtor real `lead.assigned -> brokerLeadNotification -> outbox`.
- [x] Executar type-check, testes focados, agent verify full e build.
- [ ] Homologar com um lead de teste e confirmar o WAMID/ID WAHA sem expor PII em log.

## Evidência da implementação

- Type-check: passou.
- Testes focados: 4 arquivos, 13 testes passaram.
- Suite completa: 146 arquivos, 659 testes passaram.
- Build de produção: passou com Next.js 16.2.10.
- Lint dos arquivos desta entrega: passou sem erros.
- `agent:verify --level full`: docs, arquitetura, segurança, desempenho, type-check,
  testes e build passaram. O comando geral permanece com status não-zero por um
  erro de lint preexistente em `src/lib/compose-refs.ts`; os diagnósticos de
  arquitetura/desempenho são recomendações para arquivos grandes já existentes.

### Correção operacional de persistência

- A tentativa de publicar uma situação em produção revelou que a migration
  `0142_event_message_policies` ainda era a única pendente no ledger da base.
- A migration aditiva foi aplicada de forma controlada e a existência da tabela,
  colunas, índices e políticas legadas migradas foi conferida depois da execução.
- A Server Action de publicação agora devolve falha estruturada e segura para a
  interface, mantendo o detalhe técnico apenas no log sem conteúdo de mensagem.
- A consulta direta à WABA ativa confirmou que o seletor apresenta todos os
  templates `APPROVED` efetivamente disponíveis nessa conta. Templates vistos em
  outra WABA não são combinados, pois seriam inválidos para envio pelo canal ativo.

### Correção operacional do ciclo de conexão

- Foi reproduzido um estado inconsistente em que um canal desconectado, já sem a
  credencial cifrada da Meta, podia ser marcado como ativo pela ação de reativação.
- A reativação agora exige `phone_number_id`, registro Cloud API concluído e
  credencial cifrada presente. Sem esses requisitos, a interface apresenta
  **Reconexão necessária** e direciona o Diretor ao Embedded Signup.
- O resolvedor de envio também ignora canais sem número ou credencial, impedindo
  que a outbox selecione uma conexão incapaz de entregar mensagens.
- A reconexão completa foi conferida no canal do tenant: estado ativo, registro
  concluído, canal padrão e credencial presente. Testes regressivos cobrem o
  bloqueio e a exibição do estado recuperável, sem registrar token ou telefone.
- Verificação de 06/09: lint dirigido e type-check passaram; 2 arquivos/7 testes
  focados e a suíte completa de 147 arquivos/662 testes passaram; o build de
  produção passou. O harness completo passou em documentação, escopo,
  arquitetura, segurança, desempenho, type-check, testes e build; o lint global
  permanece não-zero por erros preexistentes fora dos arquivos desta correção.

## Catálogo inicial

| Situação | Finalidade atual | Público | Regra |
|---|---|---|---|
| Primeiro contato da qualificação | `leadQualification` | Lead | Meta obrigatório sem janela |
| Novo lead atribuído | `brokerLeadNotification` | Corretor | Meta prioritário; WAHA corporativo permitido |
| Oferta de lead | `newLeadAssignment` | Corretor | Meta prioritário; WAHA corporativo permitido |
| Aceite confirmado e dados do lead | `leadAssignmentConfirmed` | Corretor | Meta prioritário; WAHA corporativo permitido |
| Lead indisponível | `leadAssignmentUnavailable` | Corretor | Meta prioritário; WAHA corporativo permitido |
| Oferta expirada | `leadAssignmentExpired` | Corretor | Meta prioritário; WAHA corporativo permitido |
| Primeiro acesso do corretor | `brokerInvitation` | Corretor | Meta; fallback corporativo permitido |
| Lembrete comercial | `taskReminder` | Usuário | Conforme canal elegível |
| Aviso ao cliente | `clientNotice` | Cliente | Texto somente na janela; Meta fora dela |

## Fora desta entrega

- editor visual genérico de workflows;
- criação arbitrária de eventos sem produtor;
- integração com Intelligence Hub;
- reengajamento automático ainda pendente da DEC-006.

## Rollback

Desativar uma política restaura os nomes homologados e o comportamento legado.
Reverter a interface não apaga catálogo, mensagens livres nem outbox. Reverter a
migration exige remover primeiro apenas os snapshots novos; mensagens já enviadas
continuam no ledger histórico.
