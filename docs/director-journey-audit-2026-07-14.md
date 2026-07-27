# Jornada ideal do Diretor no CorreTop

## Objetivo do papel

O Diretor é responsável por fazer a corretora funcionar como negócio: configurar a
estrutura, garantir que a equipe tenha condições de atender, acompanhar os riscos,
tomar decisões de gestão e manter a operação segura.

Ele não deveria precisar visitar várias telas para descobrir se a corretora está
saudável. Ao abrir o sistema, precisa entender rapidamente:

1. O que está acontecendo agora.
2. O que exige sua decisão.
3. Onde existe risco de perda ou atraso.
4. O que está funcionando bem.
5. Qual ação deve ser executada em seguida.

## Fluxo ideal de ponta a ponta

### 1. Entrada e orientação

O Diretor entra e encontra uma home executiva única, com o nome da corretora, o
período analisado e o escopo atual: toda a corretora ou uma filial selecionada.

Deve ver:

- status da assinatura e disponibilidade do sistema;
- progresso de configuração inicial;
- filial/equipe ativa e quantidade de usuários disponíveis;
- alertas críticos não resolvidos;
- data da última atualização dos dados.

Deve poder fazer:

- mudar filial ou período;
- abrir o Guia do sistema;
- ir direto para a pendência mais importante;
- saber quando uma informação está indisponível ou depende de configuração.

### 2. Triage da operação

Antes de olhar métricas, o Diretor precisa saber onde agir.

Bloco recomendado: **Atenção agora**.

Cada item deve ter quantidade real, idade do item mais antigo, origem e CTA:

- leads sem primeiro contato;
- leads estagnados;
- leads sem responsável;
- documentos aguardando aprovação;
- cotações aguardando retorno;
- tarefas urgentes vencidas;
- integrações desconectadas;
- alertas de segurança ou acesso incomum.

O Diretor deve conseguir abrir diretamente o conjunto filtrado e retornar ao resumo
sem perder filial, período ou filtro.

### 3. Leitura da saúde comercial

Depois de tratar urgências, o Diretor avalia o comportamento da corretora.

Deve ver:

- leads recebidos no período;
- distribuição por filial e equipe;
- conversão por etapa;
- tempo até o primeiro contato;
- leads parados por etapa;
- cotações geradas e compartilhadas;
- documentos pendentes e aprovados;
- vendas convertidas;
- metas e progresso;
- clientes ativos e próximos alertas de pós-venda.

Cada métrica precisa responder “o que faço com isso?”. Métrica sem ação deve ficar
secundária, sem disputar com a fila de decisões.

### 4. Intervenção em pessoas e estrutura

Quando o problema é operacional, o Diretor vai para equipe e filiais.

Deve poder:

- criar, editar, ativar e desativar filiais;
- convidar Gestores e Corretores;
- ajustar o papel de um usuário dentro dos limites permitidos;
- verificar disponibilidade da equipe;
- identificar quem está sem carga, sobrecarregado ou com leads parados;
- reatribuir um lead em uma exceção;
- acompanhar o efeito da reatribuição no SLA;
- voltar ao dashboard com o contexto preservado.

### 5. Configuração comercial

O Diretor prepara o ambiente antes de cobrar resultados.

Ordem ideal:

1. Identidade da corretora: nome, logo e cor.
2. Filiais e escopos.
3. Equipe e convites.
4. Operadoras e planos.
5. Preços e faixas etárias.
6. Regras de documentos por plano.
7. Fontes de entrada de leads.
8. WhatsApp e canal de atendimento.
9. Regras de comissão.
10. Metas comerciais.
11. Segurança e autenticação em duas etapas.

Cada configuração deve mostrar estado: não iniciado, precisa de revisão, pronto,
indisponível ou dependente de terceiro.

### 6. Fechamento e financeiro

O Diretor precisa acompanhar o que a operação gerou.

Deve poder:

- visualizar vendas por período, filial e corretor;
- consultar comissões previstas, pendentes e pagas;
- revisar o cronograma de repasse;
- marcar uma parcela como paga e desfazer a marcação;
- exportar relatório financeiro auditado;
- comparar o resultado com as metas;
- identificar vendas sem regra de comissão aplicável.

O exportador de relatório é importante porque fecha o ciclo entre sistema e rotina
administrativa. Sem ele, o Diretor ainda precisa montar parte do controle fora do
CorreTop.

### 7. Governança e segurança

No fim do ciclo, o Diretor revisa riscos e rastreabilidade.

Deve ver:

- alterações de permissões;
- sessões e acessos recentes;
- exportações realizadas;
- eventos de segurança;
- perda anormal de leads;
- leads reabertos ou reatribuídos;
- documentos e dados sensíveis acessados;
- integrações ativas e falhas de conexão.

Deve poder:

- revogar sessão;
- revisar auditoria;
- resolver alerta com link para a evidência;
- registrar ou confirmar uma decisão;
- aplicar controles de privacidade quando solicitado.

### 8. Encerramento do dia

O Diretor termina o dia com três respostas:

- O que foi resolvido?
- O que ficou em risco?
- Quem precisa agir amanhã?

O sistema deve oferecer um resumo curto de pendências abertas, próximos repasses,
alertas de pós-venda e tarefas que não podem começar o próximo dia sem responsável.

## Matriz de capacidade atual

| Área do fluxo | O que o Diretor precisa | Situação atual | Evidência no projeto | Próximo ajuste |
|---|---|---|---|---|
| Entrada e home executiva | Visão única por papel, tenant, filial e período | Parcial | `/dashboard` entrega dashboard executivo e dados reais; também existem `/diretor/resume`, `/gestor` e `/corretor/resumo` | Consolidar a home oficial do Diretor e adicionar filtros globais persistidos |
| Atenção agora | Filas acionáveis de SLA, documentos, tarefas e integrações | Parcial | Dashboard possui totais, funil, filiais e estados operacionais | Criar um bloco de prioridades reais com CTA contextual e idade do item |
| Saúde comercial | Conversão, atendimento, cotações, documentos e vendas | Parcial | Leads, funil e desempenho por filial estão disponíveis | Ligar cotações, documentos, vendas e pós-venda no mesmo resumo |
| Equipe | Convites, papéis, disponibilidade e intervenção | Atendido | `/equipe`, convites, ações de membro e permissões por papel | Mostrar carga, SLA e saúde por corretor na mesma lista |
| Filiais | CRUD e escopo por unidade | Atendido | `/filiais` protegido para Diretor e consultas por tenant | Conectar seletor global de filial ao dashboard e às listas |
| Catálogo | Operadoras, planos, status e preços | Atendido | `/catalogo` protegido para Diretor, com contagem e gestão de planos | Exibir prontidão do catálogo no onboarding e no cotador |
| Documentos | Checklist, upload, aprovação e pendências | Parcial | Fluxo de documentos e aprovação existe no código e no roadmap | Mostrar documentos bloqueando a venda na home do Diretor |
| Configurações | Marca, integrações, segurança e preferências | Parcial | `/settings` reúne empresa, integrações e segurança; WhatsApp ainda possui rota própria | Transformar settings em centro por domínio com URLs de abas e estado salvo |
| WhatsApp | Status, conexão, fallback e impacto operacional | Parcial | `/settings/whatsapp`, CTA no lead e fallback Web | Centralizar status, conexão e alternativa em um hub de integração |
| Comissões | Regras, cronograma, baixa manual e relatório | Parcial | Regras, cronograma e marcação paga estão implementados | Implementar exportação de relatório e garantir migration em produção |
| Metas | Criar, acompanhar, recalcular e comparar | Atendido com ressalvas | `/metas`, `/minha-meta` e serviço de cálculo existem | Completar escopo de equipes e conectar metas à home executiva |
| Pós-venda | Renovações, aniversários e reengajamento | Parcial | Alertas de renovação/aniversário implementados; reengajamento ainda pendente | Adicionar destino contextual das notificações e decisão de reengajamento |
| Notificações | Inbox com leitura, prioridade e destino | Parcial | `/notificacoes` lista eventos e links de lead | Adicionar marcar como lida, filtros, agrupamento e CTA por tipo |
| Governança | Integridade, auditoria, exportações e evidências | Parcial | Auditoria, sessões e exportação de evidências existem; Integridade ainda tem placeholder | Ligar cada alerta a evidência e retirar métricas/CTAs sem fonte real |
| Segurança | 2FA, sessões, papéis e escopo | Atendido | BetterAuth, 2FA, sessões e autorização por tenant/papel | Expor estado de segurança resumido no dashboard |
| Ajuda | Aprender o sistema sem suporte constante | Atendido | `/guia` com busca, sumário, filtros e passos por papel | Manter conteúdo sincronizado a cada nova funcionalidade |

## Diagnóstico final

### O que já encaixa bem

- O papel do Diretor está reconhecido no servidor e na navegação.
- O isolamento por tenant e as permissões são tratados em várias rotas e ações.
- Equipe, filiais, catálogo, leads, segurança, 2FA, comissões básicas e metas já
  têm caminhos reais.
- A central de ajuda agora reduz a dependência de treinamento informal.
- O Diretor consegue operar boa parte do ciclo comercial sem sair do sistema.

### O que ainda quebra a jornada

1. A home mostra dados, mas ainda não organiza claramente “o que exige decisão
   agora”.
2. Existem várias homes e dashboards com sobreposição de propósito.
3. Financeiro está parcialmente funcional e depende de sincronização de banco e de
   exportação de relatório.
4. Integridade, relatórios, assinatura e alguns painéis ainda se apresentam como
   destinos operacionais sem entregar o ciclo completo.
5. Notificações informam, mas nem sempre fecham o ciclo com leitura, prioridade,
   destino e confirmação.
6. A configuração está dividida entre `/settings`, `/catalogo`, `/metas`,
   `/configuracoes/comissoes` e `/settings/whatsapp`.
7. O Diretor vê muitos destinos, mas não recebe uma sequência guiada de preparação
   e operação.

## Prioridades recomendadas

### P0 — tornar a home do Diretor decisória

- Definir `/dashboard` como única home oficial do Diretor.
- Adicionar filtros globais de filial, equipe e período.
- Criar “Atenção agora” com dados reais e links contextuais.
- Remover cards sem consequência e placeholders do caminho principal.

### P1 — fechar o ciclo administrativo

- Consolidar configurações por domínio.
- Conectar notificações aos destinos e ações de origem.
- Adicionar visão financeira completa e exportação auditada.
- Mostrar prontidão de catálogo, WhatsApp, documentos, comissões e metas.

### P2 — melhorar decisão estratégica

- Comparativos de filial/equipe e tendência por período.
- Pós-venda com agenda e reengajamento conforme decisão de produto.
- Resumo diário do Diretor com pendências carregadas para o próximo dia.

## Teste de aceitação da jornada

Um Diretor deve conseguir, em menos de cinco minutos e sem treinamento:

1. Descobrir quantos leads exigem atenção agora.
2. Abrir o lead mais antigo sem primeiro contato.
3. Ver por que ele está parado e quem é o responsável.
4. Reatribuir ou criar a próxima tarefa.
5. Conferir se há documento, cotação ou comissão bloqueando o avanço.
6. Voltar ao resumo sem perder filial e período.
7. Identificar uma pendência administrativa para o fim do dia.

Se qualquer passo exigir procurar em três ou mais menus, a jornada ainda está
fragmentada.
