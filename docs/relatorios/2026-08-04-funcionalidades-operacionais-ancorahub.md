# AncoraHub — o que a corretora consegue fazer hoje

O AncoraHub organiza o ciclo comercial: o lead entra, vai para a pessoa certa, recebe atendimento, vira cotação e venda, e segue no pós-venda.

**Legenda:** ✅ pronto para uso | 🟡 em evolução | ⚪ preparado para a próxima fase

## Captação de leads

### Integração com Meta Lead Ads ✅

Leads de formulários do Facebook e Instagram entram na empresa correta. A origem da campanha fica registrada no lead, o webhook é validado e eventos repetidos não criam duplicidade.

O Diretor escolhe as páginas da empresa; o Super-admin controla os pilotos e a ativação global.

### Outras entradas de lead ✅

Também há cadastro manual, webhook por empresa para sites e importação de listas. Assim, a corretora não depende somente da Meta.

## Distribuição e plantão

### Fila central e distribuição automática ✅

O sistema encaminha o lead para unidade e corretor considerando disponibilidade e carga de trabalho. Sem pessoa disponível, ele fica protegido na fila central, em vez de se perder.

### Redistribuição por atraso ✅

Quando o primeiro contato não acontece no prazo, o SLA alerta a gestão e o lead pode voltar para a fila para outra tentativa de distribuição.

### Plantões por unidade ✅

Diretores e gestores criam plantões e o sistema mostra quando uma unidade tem pouca cobertura. Os corretores já disponíveis continuam podendo receber leads.

## Área do corretor

### Workspace do Corretor 🟡

O dashboard mostra a prioridade do dia: próxima ação, tarefas, agenda, leads da carteira, meta e atalhos para conversa, documentos e detalhe do lead.

A prioridade considera mensagens aguardando resposta, risco de SLA, tarefa vencida, retorno marcado, lead novo e pendência documental. O corretor também pode pausar sua disponibilidade.

### Minha fila, Kanban e filtros ✅

O corretor pode trabalhar em lista ou Kanban, filtrar por etapa e unidade, pesquisar e abrir o lead sem perder o contexto.

## Perfil e atendimento do lead

### Ficha completa do lead ✅

O lead reúne contato, origem, etapa do funil, responsável, unidade, histórico, tarefas, cotações, documentos e qualificação em um só lugar.

### Timeline e auditoria ✅

Notas, mudanças de status, documentos, distribuições e ações relevantes ficam registradas. Isso facilita passagem de atendimento, supervisão e conferência de problemas.

### Central de conversas ✅

A central organiza conversas por lead, com busca, histórico, perfil lateral e atalhos para cotação, documentos e ligação. Cada pessoa vê apenas os dados permitidos pelo seu papel, unidade e carteira.

## IA e qualificação

### Qualificação por IA 🟡

Quando habilitada, a IA faz perguntas iniciais, organiza respostas e classifica o interesse do lead. Ela pode preencher campos autorizados, tags e tarefas, mas não muda responsável, etapa do funil ou transferência sem confirmação humana.

Pedido de atendimento humano interrompe a automação e deixa o encaminhamento claro para o corretor.

### Distribuição inteligente 🟡

O sistema pode usar qualificação, plantão, ranking, carga atual e tempo sem receber lead para decidir quem deve receber a próxima oportunidade.

## Cotação, documentos e venda

### Cotação de planos ✅

O corretor monta cotação usando operadoras, planos, faixas etárias e beneficiários. Cada versão fica guardada, pode gerar PDF e preserva o histórico.

### Documentos e aprovação ✅

Há checklist por plano/operadora, upload privado, revisão por gestor/diretor e aprovação em lote. Os documentos são acessados somente por usuários autorizados.

### Venda e cliente ativo ✅

Ao confirmar a venda, o sistema cria o cliente ativo e conecta a operação de comissão e pós-venda. A conversão exige dados importantes para evitar vendas incompletas.

## Financeiro e pós-venda

### Comissão e repasses ✅

O Diretor define regras de comissão por operadora, plano ou regra geral. A venda gera parcelas, permite marcar pagamentos e exportar relatórios em CSV.

### Pós-venda e renovação 🟡

Clientes ativos, vigência, riscos e renovação já têm base operacional. Os fluxos automáticos de acompanhamento e prevenção de cancelamento seguem em evolução.

## Equipe e gestão

### Corretores, gestores e unidades ✅

Diretores e gestores criam unidades, convidam equipe e controlam acesso. O isolamento entre empresas, unidades e carteiras é aplicado no servidor.

### Perfil administrativo do corretor 🟡

Gestores e diretores conseguem acompanhar carteira, primeiro contato, perdas, vendas, cotações, tarefas e redistribuições de cada membro. Comparativos avançados ainda serão ampliados.

### Metas, temporadas e premiações 🟡

O Diretor pode criar ciclos de desempenho, metas e premiações sem apagar resultados anteriores. Ranking automático detalhado é a próxima evolução.

## Segurança e controle da plataforma

### Configurações por corretora ✅

Cada empresa pode ter marca, unidades, equipe, regras de distribuição e catálogo próprio, sempre isolados das outras corretoras.

### Permissões, 2FA e LGPD ✅

Há papéis de Diretor, Gestor e Corretor, 2FA opcional, histórico de sessões, auditoria e recursos de privacidade. O Super-admin pode desligar recursos sem apagar dados históricos.

### NOC e notificações 🟡

Alertas mostram leads sem primeiro contato, estagnados e pendências operacionais. O NOC já acompanha saúde das unidades e ganhará mais métricas e atalhos.

## Integrações e produtividade

### WhatsApp oficial da Meta 🟡

O sistema possui canal oficial, inbox, templates, status de entrega e auditoria. A ativação depende das credenciais e aprovações da Meta para cada empresa.

### Cadência WhatsApp por WAHA ⚪

Existe uma fundação técnica para rodar uma frota de números em VPS separada. Ela terá cadências versionadas, fila segura, descadastro, respostas recebidas e IA limitada. Antes de usar, ainda precisa de migration, VPS, segredos e homologação com dados sintéticos.

### AncoraHub Assistant para WhatsApp Web 🟡

A extensão pode mostrar contexto do lead e sugestões ao corretor sem enviar mensagens por conta própria. Base de conhecimento e integração real com WhatsApp Web ainda estão em evolução.

## O maior impacto para a corretora

1. **Menos leads perdidos:** captação integrada, fila central, SLA e redistribuição.
2. **Atendimento mais rápido:** o corretor sabe o que fazer agora e encontra tudo na ficha do lead.
3. **Gestão mais clara:** unidades, plantões, equipe, desempenho e auditoria no mesmo sistema.
4. **Venda mais organizada:** cotação, documentos, aprovação, venda, cliente e comissão ficam conectados.
5. **Mais segurança:** permissões, privacidade e Super-admin reduzem riscos operacionais.

## Próximas melhorias que mais valem a pena

- Concluir homologação de Meta Lead Ads e WhatsApp oficial com empresas piloto.
- Ampliar Inbox do corretor e indicadores do NOC.
- Finalizar automações de pós-venda, renovação e ranking.
- Implantar WAHA na VPS somente após homologação técnica e de segurança.
- Adicionar base de conhecimento e ferramentas internas para IA antes de liberar automações mais avançadas.
