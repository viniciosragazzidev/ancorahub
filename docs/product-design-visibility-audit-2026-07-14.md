# Auditoria de visibilidade e conexão do produto — 2026-07-14

## Escopo

Auditoria estática do CorreTop para responder quatro perguntas:

1. O usuário encontra as capacidades já implementadas?
2. Cada ação leva ao próximo passo correto?
3. A UI respeita Diretor, Gestor e Corretor?
4. As configurações existentes estão concentradas e editáveis em `/settings`?

O levantamento cruzou rotas em `src/app/`, menus, permissões, Server Actions,
roadmap, componentes de dashboard e estados de backlog.

Limitação: não foi possível capturar uma sessão autenticada no browser nesta
execução. Portanto, os achados visuais abaixo são inspeção de código e estrutura,
com evidências de screenshots fornecidas na conversa apenas para o padrão de
drawers. Contraste real, foco, responsividade observada e comportamento de
interação precisam de uma rodada posterior com browser autenticado.

## Veredito

O núcleo operacional existe, mas a arquitetura de navegação ainda apresenta uma
diferença importante entre "capacidade criada" e "capacidade descoberta". O usuário
consegue chegar a Leads, Conversas, Cotações, Documentos, Clientes, Tarefas,
Catálogo e Notificações, porém parte das conexões depende de conhecer a URL ou de
abrir um lead específico.

O maior risco não é falta de telas; é a falta de um mapa de próximo passo. A tela
de lead deve ser o hub de trabalho e os módulos de Cotações, Documentos, Tarefas,
Conversas e Clientes devem devolver o usuário ao contexto do lead sem reiniciar a
jornada.

## Inventário de capacidades

| Capacidade | Backend/rota | Visível no menu | Editável | Estado | Ação recomendada |
|---|---|---:|---:|---|---|
| Leads e funil | `/leads`, `/leads/[id]` | Sim | Sim | Operacional | Transformar detalhe do lead no hub de próximos passos |
| Conversas | `/conversas` | Sim | Sim | Operacional | Link bidirecional conversa ↔ lead e ações de cotação/documento |
| Tarefas | `/tarefas`, ações em lead | Sim | Sim | Operacional | Mostrar tarefas do lead no detalhe e CTA de retorno |
| Cotações | `/cotacoes`, `/cotacoes/[id]` | Sim | Sim | Operacional | Exibir histórico no lead e usar o mesmo contexto no PDF/link |
| Catálogo | `/catalogo` | Sim | Sim, Diretor | Operacional | Dar entrada explícita para configurar preços antes de cotar |
| Documentos | `/documentos`, seção no lead | Sim | Sim, conforme papel | Operacional | Conectar checklist, upload, fila e detalhe do lead |
| Clientes | `/clientes` | Sim | Parcial | Básico | Criar detalhe do cliente e dados de pós-venda editáveis |
| Alertas de renovação | Job + notificações | Indiretamente | Não | Criado | Link da notificação para cliente/lead e filtro de próximos vencimentos |
| Notificações | `/notificacoes` | Sim | Leitura | Operacional | Categorias, ação contextual e marcação como lida |
| Integrações de leads | `/settings?tab=integracoes` | Diretor | Diretor | Operacional | Explicar fonte, filial, token e teste de recebimento |
| WhatsApp | `/settings/whatsapp` | Botão na tela de settings/lead | Diretor | Parcial/externo | Consolidar status e fallback no hub de integrações |
| Branding | `/settings?tab=empresa` | Sim | Diretor | Operacional | Mostrar prévia e estado salvo |
| Segurança/2FA | `/settings?tab=seguranca` | Sim | Usuário | Operacional | Integrar sessões recentes e recuperação |
| Metas | `/metas`, `/minha-meta` | Sim | Não | Placeholder | Esconder CTA operacional até existir persistência ou sinalizar prontidão |
| Financeiro | `/financeiro/*` | Via área financeira | Não | Placeholder/fragmentado | Não misturar navegação financeira com CRM sem módulo pronto |
| Assinatura | `/assinatura` | Sim, conforme permissão | Não | Placeholder | Mostrar estado real da assinatura ou retirar do menu |
| Relatórios | `/relatorios` | Sim | Não | Verificar prontidão | Criar catálogo de relatórios ou estado de preparação explícito |
| Integridade/NOC | `/integridade`, `/noc` | Sim, conforme papel | Parcial | Parcial | Remover métricas fixas e ligar cada alerta à evidência |
| Roadmap | `/roadmap` | Sim | Não | Interno | Separar roadmap interno de navegação operacional quando necessário |

## Achados prioritários

### P0 — O detalhe do lead ainda não é um hub completo

O detalhe já reúne status, timeline, tarefas, cotações e documentos, mas o usuário
precisa descobrir essas áreas pela leitura da página. A próxima ação deveria ser
visível no topo: `Fazer contato`, `Criar cotação`, `Solicitar documento`, `Criar
tarefa` ou `Converter`.

Plano: adicionar uma faixa de próxima ação baseada no status, seguida de atalhos
contextuais. Toda ação deve voltar ao mesmo lead e mostrar confirmação do resultado.

### P0 — Capacidades criadas não retornam contexto

Conversas, cotações, documentos e tarefas possuem rotas próprias, mas várias listas
terminam em uma ação genérica. Cada item deve ter `Abrir lead`, e cada detalhe deve
ter `Voltar para o lead`, `Abrir conversa`, `Abrir documentos` e `Criar tarefa`.

Plano: criar contrato de navegação contextual usando `leadId`, preservando filtros
e origem na URL quando o usuário sair e voltar.

### P0 — Configurações estão incompletas

`/settings` possui Empresa, Sistema, Integrações e Segurança, mas Sistema é um
placeholder. Há capacidades espalhadas fora dali: WhatsApp em rota própria,
branding em Empresa, integrações de captura em Integrações e disponibilidade do
corretor no resumo pessoal.

Plano: transformar `/settings` em centro de configuração por domínio, sem duplicar
ações:

- Empresa: nome, identificação, branding e prévia.
- Operação: SLA, horários, distribuição e preferências de alerta, somente quando
  as regras estiverem aprovadas.
- Integrações: fontes de leads, WhatsApp, webhook, status e teste.
- Segurança: 2FA, sessões, recuperação e auditoria pessoal.
- Notificações: preferências in-app e push quando o canal existir.
- Dados: retenção, consentimento e exportação, somente após decisão LGPD aprovada.

### P1 — Placeholders aparecem como destinos normais

Metas, Assinatura, partes de Financeiro e alguns painéis apresentam navegação real
com conteúdo de preparação. Isso cria uma promessa falsa. O usuário deve ver o
estado correto: disponível, em configuração, dependência externa ou ainda não
liberado para seu papel.

Plano: substituir cada placeholder por uma tela de prontidão com motivo, ação
possível e próximo passo; ou remover o item do menu até haver valor acionável.

### P1 — Permissão existe no servidor, mas não é explicada na interface

As rotas filtram papel/filial em vários pontos, porém a navegação deve antecipar o
escopo: "Minha carteira", "Minha filial" e "Toda a corretora". A mesma ação não
deve parecer indisponível por erro técnico quando é apenas restrita por papel.

Plano: aplicar rótulos de escopo nos cabeçalhos, estados de acesso negado com
alternativa e esconder ações impossíveis sem esconder o resultado do fluxo.

### P1 — Notificações são uma lista, não uma central de ação

O sino e `/notificacoes` existem, mas o tipo de alerta não define claramente a
ação seguinte. Renovação deve levar ao cliente/lead; documento ao documento; SLA ao
lead filtrado.

Plano: modelar cada notificação com destino, CTA, tipo legível, estado lido/não
lido e origem. Não usar apenas cor para urgência.

### P2 — Catálogo e cotação dependem de conhecimento prévio

O cotador precisa de planos e preços cadastrados, mas não orienta o diretor sobre
essa dependência. O estado vazio deveria explicar: `Configure o catálogo`, com
CTA direto para `/catalogo`.

Plano: estados vazios encadeados e checagem de prontidão antes de abrir o cotador.

## Matriz de interligações desejada

| Origem | Ação | Destino | Retorno |
|---|---|---|---|
| Lead | Criar cotação | `/cotacoes?leadId={id}` | Cotação aponta para lead |
| Lead | Ver cotações | `/cotacoes?leadId={id}` | Botão abrir lead |
| Lead | Ver documentos | `/leads/{id}#documentos` | Fila aponta para lead |
| Lead | Criar tarefa | Sheet contextual no próprio lead | Tarefa aponta para lead |
| Lead | Abrir conversa | `/conversas?leadId={id}` | Conversa aponta para lead |
| Conversa | Criar cotação | `/cotacoes?leadId={id}` | Retorna à conversa/lead |
| Cotação | Compartilhar/PDF | Link/arquivo | Mantém cotação e lead |
| Documento | Aprovar/rejeitar | Fila central | Link para lead e requisito |
| Cliente | Renovação próxima | `/clientes/{id}` ou lead vinculado | Notificação volta ao cliente |
| Notificação | Abrir ação | Destino específico por tipo | Marcar como lida |
| Configuração | Salvar | Mesmo tab/URL | Feedback e estado salvo |

## Regras de visibilidade por papel

### Diretor

Deve encontrar visão geral, leads da corretora, catálogo, documentos, equipe,
filiais, integrações, segurança, integridade e configurações do tenant. Pode editar
branding, catálogo, requisitos documentais, integrações e membros conforme as
permissões existentes.

### Gestor

Deve encontrar a própria filial, equipe, fila de documentos, leads, conversas,
cotações, tarefas e alertas. Não deve receber ações de branding global, catálogo
global ou gestão de integrações do tenant sem permissão explícita.

### Corretor

Deve encontrar resumo pessoal, minha fila, conversas, tarefas, cotações,
documentos, clientes, notificações, disponibilidade e segurança da própria conta.
Não deve descobrir dados de outros corretores por menu, busca, URL ou notificações.

## Checklist de validação da próxima rodada

- Cada rota de menu tem uma ação principal funcional.
- Cada ação de sucesso mostra resultado e próximo passo.
- Cada ação de erro mantém o trabalho e explica recuperação.
- Cada lista tem loading, vazio, erro, permissão e indisponibilidade quando aplicável.
- Cada CTA que depende de outro módulo aponta para a configuração necessária.
- Cada item de notificação possui destino contextual.
- Cada mutação valida tenant, papel e filial no servidor.
- Nenhuma métrica ou badge operacional é fixa no código.
- Navegação por teclado e foco são verificadas no browser.
- Desktop, viewport estreito, dark mode e tema por tenant são capturados e revisados.

