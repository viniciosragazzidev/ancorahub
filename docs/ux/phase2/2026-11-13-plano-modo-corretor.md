# Plano do modo corretor: atender, cuidar da carteira e acompanhar resultados

Data: 2026-11-13. Origem: pedido do Vinicios nesta data. Substitui a proposta de Home rejeitada em
[2026-11-13-corretor-redesign-plan.md](./2026-11-13-corretor-redesign-plan.md) quanto à organização do modo corretor;
os contratos citados lá continuam valendo (Lite atual preservado, componentes existentes, Super-admin, auditoria).

Reorganizar o **modo corretor** em torno de três atividades: **atender, cuidar da carteira e acompanhar seus
resultados**, mantendo o estilo atual do Lite. Critérios de qualidade pedidos: padrão máximo de design, animações
discretas, telas limpas e utilidade real. Toda capacidade nova fica atrás de chave do Super-admin, com auditoria e
validação no servidor; tenant, identidade e carteira vêm da sessão.

## 1. Estrutura de navegação

| Área | Rota | Função |
|---|---|---|
| Início | `/dashboard` | Conversas, assistente e acesso às áreas principais. |
| Meus leads | `/leads?tab=minha-fila` | Fila de atendimento e negociações. |
| Conversa do lead | `/leads/[id]` | Atendimento com a conversa ocupando a tela. |
| Minha carteira | `/clientes` | Contatos, clientes conquistados e clientes antigos. |
| Perfil do cliente | `/clientes/[clientId]` | Relacionamento, histórico e contratos. |
| Plantões | `/plantoes` | Plantão atual, calendário e escala em uma entrada. |
| Operação do plantão | `/plantoes/agora` | Ações do plantão selecionado. |
| Agenda | `/agenda` | Retornos, tarefas e compromissos. |
| Desempenho | `/desempenho` | Resultados, metas e acesso à jornada. |
| Minha jornada | `/jornada` | Evolução, missões e conquistas, aberta pelo Desempenho. |
| Cotação | `/cotacao` | Acesso existente, conforme disponibilidade. |
| Configurações | `/settings` | Preferências e conexões. |

## 2. Início mais limpo

Ordem: Meus leads, Minha carteira, Plantão, Agenda, Desempenho, Cotação. Jack permanece. Configurações,
notificações e mural da gestão nos acessos secundários. Saem do Início: Dicas de Atendimento, Jornada (vai para
Desempenho) e blocos que dupliquem Desempenho. Pendências seguem no flutuante **Agora**; dicas educativas separadas
de avisos importantes. WhatsApp sem faixa permanente: indicador compacto e Configurações.

## 3. Meus leads e conversa

Fila diária: novos, em andamento e retornos. Conversa com nome, olho ao lado do nome, WhatsApp, ligação e etapa no
topo; histórico e campo de mensagem ocupam a tela. O olho abre painel deslizante com dados essenciais, situação,
próxima ação e acesso ao perfil. **Continuar registro** substitui o painel anterior antes de abrir o registro de
venda, sem sobreposição. O fluxo de Registrar venda é preservado.

## 4. Minha carteira

`/clientes` passa a se chamar **Minha carteira**: base do corretor (recebidos da corretora, contatos próprios,
indicações, clientes antigos). Topo: busca por nome ou telefone, **Adicionar contato**, filtros de situação e
origem. Visões: **Em negociação** (abre `/leads/[id]`), **Clientes** (abre `/clientes/[clientId]`), **Precisa de
atenção** (retornos vencidos, tarefas, renovações próximas, quando houver dado), **Arquivados**. Situação comercial e
origem são campos distintos. Fila e carteira consultam registros relacionados, sem duplicar pessoas.

## 5. Cadastro de contatos e clientes antigos

Painel deslizante com **Novo interessado** (abre acompanhamento comercial) ou **Cliente que já possuo** (carteira
anterior, contratos existentes). Formulário curto: nome, telefone, e-mail opcional, origem, observação opcional.
Para clientes antigos: produto, operadora, início de vigência e renovação; desconhecido fica como pendente.
**Não gera venda, comissão, conversão ou pontuação.** Duplicidade checada só no escopo autorizado.

## 6. Perfil do cliente

Cabeçalho com foto ou iniciais, nome, situação, origem e responsável; ações rápidas (contato, registrar atendimento,
agendar retorno); resumo (última interação, próxima ação, contratos, pendências). Navegação **Histórico · Sobre ·
Contratos · Documentos**, com Histórico como visão inicial. Desktop pode ter coluna lateral de resumo.

## 7. Histórico como linha do tempo

Atendimentos, observações, retornos, mudanças de etapa, documentos, vendas/contratos e renovações, cada um com autor,
data, tipo e conteúdo. Registrar atendimento, observação e anexos. Filtros: Tudo, Atendimentos, Observações,
Contratos, Documentos. Conversas longas como resumo; eventos automáticos discretos; fixar registros importantes.
Edição de observação identificável; auditoria preservada. Sem curtidas, seguidores ou publicações.

## 8. Plantões em uma entrada única

`/plantoes`: **Seu plantão atual** (nome, horário, modalidade/local, situação, botão **Abrir plantão** para
`/plantoes/agora`), **Calendário** (dias escalados destacados, detalhe ao tocar) e **Minha escala** (próximos
plantões). Estados: em andamento, sem plantão agora (mostra o próximo), sem escala, mais de uma atribuição (escolher),
falha de carregamento (tentar de novo, sem afirmar ausência). Links diretos de confirmação de presença continuam.

## 9. Agenda conectada

Retornos de leads, contatos de acompanhamento, reuniões, tarefas com prazo e renovações. Cada item abre o lead ou o
perfil; agendar pelo perfil aparece na Agenda e no histórico. Escala é editada em Plantões.

## 10. Desempenho e Jornada

Período, resumo, indicadores de atendimento e conversão, metas e bloco **Minha jornada** com progresso e **Ver minha
jornada** (volta para Desempenho). Ranking e missões ficam na Jornada. Sem novos cálculos financeiros.

## 11. Padrão de design

Estilo Lite atual; botões e cores do tema; campos compactos dos componentes compartilhados; espaçamento regular;
ícones alinhados; painéis deslizantes para consultas e ações curtas; páginas completas para gestão extensa;
transições discretas com movimento reduzido; estados de carregamento, vazio, erro e sem permissão. Tamanho geral da
fonte preservado.

## 12. Acessos e governança

Corretor: leads atribuídos, carteira própria, agenda, plantões e desempenho próprio. Supervisor/gestor e diretor
conforme escopo já autorizado. Super-admin liga, desliga e parametriza. Cadastros próprios não são compartilhados por
mudança visual. Cadastros, alterações relevantes, documentos, exportações e mudanças de responsável auditados.

## 13. Sequência e estado

| Etapa | Entrega | Estado |
|---|---|---|
| 1 Navegação | Início sem Dicas e Jornada, Minha carteira nos acessos, Mais reorganizado | Implementada em `feat/corretor-navegacao-etapa1` (chave `feature_broker_navigation_reorg_enabled`), sem push |
| 2 Desempenho | Resultados concentrados e acesso à Jornada | Implementada em `feat/corretor-desempenho-etapa2` (mesma chave da etapa 1): período, resultados, atendimento e conversão, metas e Minha jornada; sem push |
| 3 Plantões | Card atual, calendário e escala em `/plantoes` | Implementada em `feat/corretor-plantoes-etapa3` (mesma chave da etapa 1; calendário e escala seguem `BROKER_DUTY_CALENDAR`), sem push |
| 4 Carteira | Visões, cadastro próprio, cliente antigo e vínculos | 4a implementada em `feat/corretor-carteira-etapa4a` (Minha carteira com Em negociação, Clientes, Precisa de atenção e Arquivados; Adicionar contato com Novo interessado; chaves `feature_broker_navigation_reorg_enabled` e `feature_broker_client_wallet_lite_enabled`), sem migration e sem push. 4b (Cliente que já possuo e contratos anteriores) aprovada pela opção recomendada em [proposta](./2026-11-13-plano-modo-corretor-etapa4b.md); pendente de DEC e implementação |
| 5 Perfil | Perfil, histórico, contratos e documentos | Implementada em `feat/corretor-perfil-etapa5` (mesma chave da etapa 1), sem push; fixar registros, anexos pelo histórico e edição de observação pendentes |
| 6 Agenda | Retornos e tarefas ligados a leads e perfis | Pendente |
| 7 Validação | Fluxos, permissões, auditoria, responsividade | Pendente |

Pronto quando o corretor conseguir receber ou cadastrar um contato, atendê-lo, acompanhar o histórico, concluir o
fluxo comercial existente e manter o relacionamento pela carteira, com caminhos claros entre as áreas.
