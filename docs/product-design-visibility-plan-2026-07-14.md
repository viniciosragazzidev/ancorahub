# Plano de execução — visibilidade, edição e conexão do CorreTop

## Objetivo

Fazer com que toda capacidade pronta seja encontrada, entendida e executada pelo
papel correto, conectando as ações entre módulos e concentrando configurações
editáveis em `/settings` sem duplicar regras de domínio.

## Sequência de entrega

### Fase 0 — Contrato de navegação e prontidão

Criar contratos compartilhados para:

- `leadId`, `clientId`, `source` e `returnTo` na URL.
- Destino contextual de notificações.
- Estado de prontidão de cada módulo: pronto, configuração necessária, externo,
  indisponível para papel ou backlog.
- Cabeçalho com papel, tenant/filial e escopo atual.

Saída: nenhuma tela promete uma ação que não existe e nenhum retorno perde o
contexto original.

### Fase 1 — Lead como hub operacional

Entregar no detalhe do lead:

- Próxima ação recomendada por status.
- Ações de até três prioridades: contato, cotação/documento e tarefa.
- Seções recolhíveis ou navegação âncora para timeline, conversa, cotação,
  documentos e tarefas.
- Estado de dependência: sem catálogo, sem requisito documental ou sem responsável.
- Retorno explícito depois de criar, compartilhar, aprovar ou rejeitar algo.

Critério: um corretor completa atendimento → cotação → documentação sem descobrir
rotas manualmente.

### Fase 2 — Conexões entre módulos

Implementar a matriz de interligações do relatório, começando por:

1. Lead ↔ Conversas.
2. Lead ↔ Cotações.
3. Lead ↔ Documentos.
4. Lead ↔ Tarefas.
5. Cliente/lead ↔ Renovação.
6. Notificação ↔ destino contextual.

Critério: toda lista operacional abre o contexto de origem e oferece retorno.

### Fase 3 — Centro de configurações

Expandir `/settings` com abas e permissões:

- Empresa e branding.
- Operação e regras aprovadas.
- Integrações.
- Segurança e sessões.
- Notificações.
- Dados e LGPD, somente após DEC-005.

Cada aba deve possuir leitura, edição, validação server-side, auditoria quando
necessário, estado salvo, erro recuperável e explicação de escopo.

Critério: o usuário não precisa procurar configuração em `/catalogo`, `/settings/whatsapp`,
`/minha-meta` ou no dashboard para alterar uma preferência do sistema.

### Fase 4 — Menu orientado por prontidão

Revisar cada item das sidebars:

- Mostrar se a rota tem valor operacional real para o papel.
- Remover placeholders ou transformá-los em preparação explícita.
- Exibir dependências no ponto de decisão.
- Não revelar ações de outro papel.

Critério: menu de cada papel representa somente trabalho possível hoje.

### Fase 5 — Validação UX e acessibilidade

Executar cenários sintetizados por papel:

- Diretor configura tenant, catálogo, integração e requisito documental.
- Gestor aprova documento, acompanha renovação e reatribui lead.
- Corretor atende lead, cria cotação, solicita documento e acompanha cliente.

Capturar cada passo em desktop e viewport estreito, revisar foco/teclado, estados
de erro/vazio, tema claro/escuro e tema de tenant.

## Backlog priorizado

| Prioridade | Entrega | Dependências |
|---|---|---|
| P0 | Lead hub com próxima ação e CTAs contextuais | Componentes compartilhados |
| P0 | Navegação bidirecional lead/conversa/cotação/documento/tarefa | Contrato de URL |
| P0 | Estado de prontidão para catálogo e documentos | Queries reais |
| P0 | Destino contextual das notificações | Modelo de notification target |
| P1 | Settings operacional e notificações | Decisões de SLA e push |
| P1 | Detalhe do cliente e pós-venda editável | Modelo de data contratual |
| P1 | Menu por papel revisado com prontidão real | Auditoria de permissões |
| P1 | Fila central de documentos ligada ao dashboard | Consultas escopadas |
| P2 | Centro de metas e financeiro | DEC-004 e persistência financeira |
| Externo | Meta Cloud API e push | Verificação/credenciais de terceiros |

## Decisões que bloqueiam implementação

- DEC-004: comissão e métricas financeiras.
- DEC-005: retenção, consentimento e gestão LGPD.
- DEC-006: reengajamento e opt-out.
- DEC-012: política multi-filial consolidada.
- Provedor persistente de storage documental para Vercel.

Enquanto essas decisões não estiverem aprovadas, a UI deve explicar a dependência
e não simular uma configuração funcional.

