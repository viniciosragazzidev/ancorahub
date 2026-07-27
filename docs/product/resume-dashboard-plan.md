# Plano de conteúdo — `/resume`

**Papel primário:** Diretor da corretora

**Objetivo:** abrir o sistema e entender, em menos de um minuto, a saúde comercial,
operacional e de risco da corretora — com caminhos diretos para agir. Não é uma página
de relatórios genéricos; é o ponto de comando executivo do tenant.

## Princípios da tela

- Mostrar primeiro o que exige decisão, depois desempenho e, por último, detalhe.
- Cada número deve responder a uma pergunta e, quando acionável, abrir a lista já
  filtrada que explica aquele número.
- Começar com dados do tenant inteiro; filial, equipe e período são filtros globais,
  nunca filtros esquecidos dentro de cada card.
- Usar comparações com o período anterior somente onde ajudam a decisão. Não criar
  gráficos sem decisão associada.
- Respeitar escopo de tenant, filial e papel no servidor; o filtro visual não é o
  controle de acesso.

## Estrutura da navegação lateral

Sidebar persistente no desktop, com o logotipo/marca do tenant no topo. Em telas
compactas, vira um painel lateral fechado por padrão. Badges aparecem apenas para itens
que precisam de atenção.

| Grupo | Item | Destino/intenção | Badge |
|---|---|---|---|
| Principal | **Resumo** | `/resume`; visão executiva e home do Diretor. | — |
| Principal | Leads | Fila, funil, retrabalho e filtros. | Leads novos/SLA crítico |
| Principal | Cotações | Histórico e acompanhamento de cotações. | — |
| Principal | Documentos | Fila de pendências e aprovações. | Pendentes de revisão |
| Principal | Clientes | Clientes ativos, renovação e pós-venda. | Renovações próximas |
| Gestão | Equipe | Pessoas, disponibilidade e reatribuições. | — |
| Gestão | Metas | Metas por corretor, equipe e filial. | — |
| Gestão | Relatórios | Análises detalhadas e exportações auditadas. | — |
| Gestão | Integridade | Alertas de perdas anormais, estagnação, exportações e acessos. | Alertas pendentes |
| Administração | Filiais | Unidades e escopos operacionais. | — |
| Administração | Catálogo | Operadoras, planos e tabelas. | Tabelas desatualizadas |
| Administração | Assinatura | Plano, cobrança e status do tenant. | Cobrança pendente |
| Administração | Configurações | Marca, regras operacionais, notificações e permissões. | — |

O rodapé da sidebar reúne: sino de notificações, ajuda/suporte, menu de perfil e
indicador da filial/tenant ativo. A assinatura não deve competir com a operação: só
recebe destaque persistente quando houver risco de bloqueio.

## Conteúdo da tela `/resume`

### 1. Cabeçalho de contexto

- Saudação curta, por exemplo: “Bom dia, Ana. Aqui está a visão da corretora.”
- Período: `Este mês` como padrão, com comparação opcional ao período anterior.
- Filtros globais: filial (`Todas as filiais`), equipe (`Todas as equipes`) e período.
- Ação primária contextual: `Ver relatórios`; ação secundária: `Exportar resumo` quando
  a exportação e a auditoria estiverem disponíveis.
- Indicador discreto de atualização: “Atualizado agora” ou data/hora da última carga.

### 2. Faixa “Atenção agora”

É a primeira área de conteúdo e não deve ser um mural de notificações. Exibir até
quatro cartões priorizados; cada cartão tem contagem, impacto, contexto e CTA.

1. **Leads com SLA em risco ou vencido** — quantidade, filial mais afetada e CTA para
   a fila filtrada.
2. **Leads estagnados** — quantidade e etapa com maior concentração; CTA para lista de
   estagnação.
3. **Documentos bloqueando conversão** — propostas paradas por checklist; CTA para a
   fila documental.
4. **Alertas de integridade** — perdas anormais, exportação relevante ou acesso fora do
   padrão; CTA para Integridade.

Se não houver pendências, trocar a faixa por uma confirmação discreta: “Nenhuma ação
crítica no momento”, sem ocupar a mesma altura dos alertas.

### 3. Saúde comercial

Quatro indicadores em uma linha no desktop e grade responsiva no mobile:

| Indicador | Leitura | Clique leva a |
|---|---|---|
| Leads recebidos | Volume do período e variação. | Leads filtrados por período/origem |
| Conversão | Convertidos ÷ leads elegíveis, com comparação. | Funil e relatório comercial |
| Tempo até primeiro contato | Média e percentual dentro do SLA. | Fila/SLA por corretor |
| Meta de vendas | Realizado versus meta consolidada. | Metas por equipe/filial |

Não mostrar receita ou comissão no primeiro card enquanto DEC-004 não definir a base
financeira. Quando definida, o indicador financeiro entra como quinto item em quebra de
linha, não substitui a conversão.

### 4. Funil e eficiência operacional

Card principal, em duas colunas no desktop:

- **Funil do período:** Novo → Distribuído → Em atendimento → Cotação enviada →
  Negociação → Documentação → Análise → Convertido/Perdido. Mostrar volume e conversão
  entre etapas; clique em etapa aplica o filtro correspondente na fila.
- **Gargalos:** três etapas com maior tempo médio, volume parado e status de SLA. A
  finalidade é direcionar melhoria operacional, não exibir todos os números do funil.

O gráfico precisa ter alternativa tabular acessível e legenda textual; cores não são a
única codificação de sucesso, perda ou risco.

### 5. Desempenho por filial e equipe

Tabela comparativa, não um conjunto de cards. Colunas: filial/equipe, leads recebidos,
conversão, primeiro contato dentro do SLA, vendas realizadas, progresso da meta e
alertas em aberto. Ordenação inicial: maior impacto/risco, com opção de ordenar por
qualquer métrica. Cada linha abre a visão filtrada da unidade.

Para um tenant de filial única, substituir a comparação por **desempenho dos
corretores**, mantendo as mesmas métricas e respeitando as permissões do Diretor.

### 6. Receita, comissão e retenção

Área abaixo do desempenho, visível após o motor financeiro ser aprovado:

- comissão prevista, paga e pendente no período;
- próximos repasses relevantes;
- clientes com renovação nos próximos 30/60 dias;
- oportunidades pós-venda sem interação recente.

Enquanto comissão e pós-venda não estiverem implementados, a área não mostra zeros
fictícios: usa estado de preparação com CTA para configurar regras de comissão ou
catálogo, conforme o caso.

### 7. Atividade recente

Timeline compacta dos acontecimentos que alteram a leitura executiva: conversão,
documento rejeitado/aprovado, meta atingida, lead reatribuído e alerta revisado. Não
incluir conteúdo de mensagens ou documentos; mostrar ator, evento, alvo autorizado e
momento.

## Primeiro acesso do Diretor

No primeiro login, a área “Atenção agora” dá lugar temporariamente ao checklist não
bloqueante já previsto no requisito: criar filial, convidar equipe, revisar catálogo,
personalizar marca e definir metas. O Diretor pode fechar o checklist; seu progresso
permanece disponível no topo de `/resume` até ser concluído.

## Estados e regras de apresentação

- **Sem dados:** explicar a próxima ação útil (“Cadastre ou receba seu primeiro lead”),
  sem gráficos vazios ou métricas `0` sem contexto.
- **Carregamento:** skeleton apenas nos blocos que dependem de dados; preservar o
  cabeçalho e filtros. Aplicar `transitions-dev` com movimento reduzido respeitado.
- **Erro parcial:** manter os demais blocos disponíveis e indicar qual fonte falhou;
  nunca esconder alertas críticos por erro de um gráfico secundário.
- **Permissão/escopo:** Diretor vê o tenant todo; Gestor reutiliza a estrutura com
  escopo de filiais/equipes sob gestão. Corretor terá outra home, centrada em sua fila e
  meta pessoal.
- **Mobile:** filtros em painel; “Atenção agora” e indicadores antes do funil; tabela
  vira lista comparativa com drill-down, sem scroll horizontal obrigatório.

## Ordem de entrega recomendada

1. Cabeçalho, filtros, atenção agora e saúde comercial.
2. Funil, gargalos e navegação por drill-down.
3. Comparativo de filial/equipe e metas.
4. Atividade recente e primeiro acesso.
5. Comissão, retenção e integridade ampliada quando seus motores estiverem prontos.

## Dependências de decisão

- DEC-001, DEC-002 e DEC-003 para métricas de funil, distribuição e SLA.
- DEC-004 para números financeiros e comissão.
- DEC-005 para retenção/exibição de dados sensíveis e auditoria.
- DEC-012 para filtros e comparativos entre filiais.
