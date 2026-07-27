# Plano de visualização - Resumo do Corretor

**Rota sugerida:** `/corretor/resumo`

**Objetivo:** iniciar o dia de trabalho pelo próximo lead que precisa de ação, mantendo
o corretor focado em velocidade de resposta, avanço de proposta e meta individual.
Esta página não exibe comparativos de equipe, indicadores financeiros globais ou
alertas de auditoria de outros usuários.

## Princípio de hierarquia

1. **O que fazer agora:** lead prioritário, SLA e ação rápida.
2. **Meu placar:** leads, conversão e meta individual.
3. **Minha fila:** trabalho pendente, ordenado por urgência.
4. **Meu acompanhamento:** cotações, documentos e renovações sob responsabilidade.

## Navegação lateral do Corretor

| Grupo | Item | Finalidade |
|---|---|---|
| Principal | **Resumo** | Home pessoal e prioridades do dia. |
| Principal | Minha fila | Lista filtrável de leads atribuídos ao corretor. |
| Principal | Cotações | Versões, propostas enviadas e próximas ações. |
| Principal | Documentos | Checklists dos próprios leads/clientes. |
| Principal | Clientes | Pós-venda, renovação e interações próprias. |
| Acompanhamento | Minha meta | Progresso individual e histórico mensal. |
| Acompanhamento | Notificações | Eventos pessoais, leitura e preferências de push. |
| Rodapé | Perfil e disponibilidade | Pausar/retomar recebimento de novos leads. |

Não incluir Filiais, Equipe, Integridade, Relatórios globais, Assinatura ou
Configurações do tenant. O corretor não pode descobrir dados de outro corretor pela
navegação, busca ou URL.

## Composição da tela

### 1. Header compacto

- Breadcrumb: `Corretor / Resumo`.
- Busca limitada à própria fila e clientes.
- Sino de notificações com eventos pessoais.
- Ação primária: `Novo lead` somente se a política do tenant permitir cadastro manual.

### 2. Bloco principal: próxima ação

Ocupa a primeira posição e maior peso visual. É um `Card` shadcn de superfície escura,
com borda de atenção quando o SLA estiver próximo do vencimento.

Conteúdo:

- Nome do lead, origem e tempo desde o recebimento.
- Etapa atual e contador de SLA, com texto além da cor.
- Próxima ação recomendada: `Fazer 1º contato`, `Retomar negociação`, `Enviar cotação`
  ou `Solicitar documento`.
- Botões: `Abrir lead` como ação primária e `Registrar interação` como secundária.
- Ao não haver pendência crítica, mostrar o melhor próximo lead da fila e uma mensagem
  discreta de que não há SLA vencido.

### 3. Faixa de urgência

Três indicadores compactos, acionáveis e pessoais:

| Indicador | Pergunta respondida | Destino |
|---|---|---|
| SLA em risco | Quais leads exigem contato imediato? | Minha fila filtrada |
| Sem atualização | Onde a negociação pode esfriar? | Minha fila filtrada |
| Documentos pendentes | O que bloqueia proposta ou análise? | Meus documentos |

Não usar quatro cards genéricos de direção. Cada card deve ter uma contagem, uma frase
curta e um clique para a lista filtrada.

### 4. Meu placar do mês

Linha de três métricas com o componente compartilhado `MetricCard`:

1. **Conversão pessoal** - vendas convertidas sobre leads elegíveis.
2. **Meta do mês** - realizado e percentual da meta configurada.
3. **Leads trabalhados no SLA** - percentual de primeiro contato dentro do limite.

Evitar exposição de comissão prevista/paga até que o papel do corretor tenha regra
financeira definida. Não comparar o corretor com colegas nesta tela.

### 5. Minha fila prioritária

Tabela shadcn, não kanban, preservando a decisão do MVP. Ordenação padrão:

1. SLA vencido.
2. SLA próximo de vencer.
3. Lead em etapa estagnada.
4. Próxima ação mais antiga.

Colunas: prioridade, lead, etapa, última interação, prazo de SLA e próxima ação. Em
mobile, transformar em lista de linhas com etapa, SLA e botão `Abrir`, sem tabela larga.

### 6. Acompanhamento de propostas

Dois painéis compactos abaixo da fila:

- **Cotações aguardando retorno:** até cinco itens, data de envio e CTA `Retomar`.
- **Clientes para renovar:** até cinco itens nos próximos 30 dias e CTA `Registrar
  contato`.

Se o módulo correspondente ainda não estiver habilitado, usar estado vazio com a ação
que desbloqueia o fluxo. Nunca mostrar números fictícios como se fossem dados reais.

## Estados e comportamento

- **Novo lead:** banner de alta prioridade no topo, notificação in-app e push somente
  com permissão explícita. O banner não revela dados sensíveis além do contexto mínimo.
- **Disponibilidade pausada:** status persistente ao lado do perfil, com ação clara de
  retomar. Não esconder esse estado.
- **Loading:** `ShimmerSkeleton` Unlumen preserva o formato do lead prioritário, das
  métricas e da fila.
- **Motion:** tabs e troca de visão usam `transitions-dev`; fila e valores críticos não
  recebem animação decorativa.
- **Sem leads:** explicar que novos leads aparecerão ali e oferecer acesso ao cadastro
  manual quando autorizado.

## Diferença deliberada para a visão do Diretor

| Diretor | Corretor |
|---|---|
| Decide onde a corretora precisa agir. | Executa a próxima ação no próprio lead. |
| Vê filiais, equipes, risco e saúde global. | Vê somente seus leads, clientes e meta. |
| Usa comparativos e gargalos consolidados. | Usa fila ordenada por prazo e próximo passo. |
| Acessa integridade e relatórios globais. | Recebe alertas pessoais de SLA/documento. |

## Ordem de implementação

1. Shell do papel Corretor, header e bloqueio de escopo.
2. Card de próximo lead e faixa de urgência.
3. Métricas pessoais e fila prioritária.
4. Cotações, documentos, renovação e disponibilidade.
5. Push/browser notifications após o service worker e consentimento estarem aprovados.
