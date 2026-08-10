# Matriz de densidade e clareza operacional

## Padrão adotado

O AncoraHub mostra primeiro a decisão que a pessoa precisa tomar. Dados de contexto ficam próximos da decisão; identificadores, histórico técnico, logs e configurações raras ficam em abas, painéis expansíveis ou configurações avançadas.

| Área | Essencial visível | Ação principal | Conteúdo recolhido ou secundário | Limite de densidade | Estado |
| --- | --- | --- | --- | --- | --- |
| Dashboard do Corretor | Próxima ação, quatro contagens, fila, agenda e meta | Continuar atendimento | Alertas detalhados e documentos/propostas seguem pela Inbox e pelas telas próprias | 4 KPIs, 1 prioridade, 2 painéis secundários | Entregue |
| Minha fila | Lead, urgência, próxima ação e status | Abrir lead prioritário | Dados cadastrais completos | Lista operacional | Revisão visual contínua |
| Leads | Lead, qualificação, responsável, última atividade e próxima ação | Abrir ou criar lead | Origem, campanha, tags e metadados via filtros/detalhes | Busca, filtros frequentes e mais filtros | Em andamento |
| Lead 360 | Contato, estágio, responsável e próxima ação | Continuar atendimento ou concluir tarefa | Dados de formulário, auditoria e rastreabilidade | Uma ação frequente visível | Em andamento |
| Conversas | Lista, conversa atual e contexto do lead | Responder/abrir atendimento | Logs de canal e metadados | Três painéis apenas no desktop | Revisão visual contínua |
| Tarefas | Título, prazo, prioridade e lead | Concluir ou reagendar | Histórico da tarefa | Busca e até dois filtros rápidos | Revisão visual contínua |
| Gestão | Exceções, SLA e itens sem responsável | Abrir lista filtrada | Métricas sem ação imediata | Até quatro indicadores | Próxima onda |
| Direção e relatórios | Tendência e indicadores acionáveis | Abrir recorte filtrado | Séries e exportações técnicas | Até quatro KPIs e um gráfico principal | Próxima onda |
| Configurações, integrações e IA | Estado, fluxo e destino | Configurar/salvar | Tokens, IDs, retries, custos e logs | Informação técnica sob demanda | Próxima onda |
| Super-admin | Saúde, tenants, flags e auditoria | Intervir com controle auditado | Diagnóstico detalhado | Exceções por área | Em andamento |

## Controles e navegação

- Nenhum botão pode indicar uma ação que ainda não existe. Se a função não estiver pronta, ela não aparece como atalho operacional.
- Filtros ativos devem continuar na URL. Ao abrir um lead, conversa ou tarefa, o retorno preserva a lista e o recorte de origem.
- O modo confortável é padrão. Tabelas podem oferecer densidade compacta sem mudar dados, permissões ou colunas obrigatórias.
- Corretor vê fila, leads, conversas, tarefas e notificações; os demais papéis veem somente os módulos necessários ao seu trabalho.

## Critérios de avanço

Cada rota só muda para o novo padrão quando houver ação principal funcional, estado vazio claro, foco de teclado, contraste adequado e nenhum dado necessário escondido antes de a pessoa precisar dele.
