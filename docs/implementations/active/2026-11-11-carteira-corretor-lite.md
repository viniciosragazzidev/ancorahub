# Carteira e relacionamento no Corretor Lite

Data: 2026-11-11. Estado: **plano proposto para revisão; implementação não iniciada**.
Pedido: ampliar a experiência do corretor a partir do benchmark Cotador FM, mantendo simplicidade, design e movimento do modo novo.
Referência: `docs/product/benchmark-cotadorfm-clientes.md`.

## Resultado esperado

O corretor consegue encontrar uma pessoa, entender o que precisa fazer, executar a próxima ação e acompanhar contratação ou renovação sem reconstruir o contexto em várias telas. A experiência deve continuar reconhecível como CorreTop Lite: lista de pessoas compacta, linguagem direta, superfícies leves, detalhes sob demanda e feedback imediato.

Entregar em incrementos utilizáveis. A primeira entrega deve melhorar a carteira atual com próxima ação, filtros e retorno; base importada, histórico e novos estados dependem dos contratos de domínio indicados abaixo.

## Base real e decisões que já valem

- `CONTEXT.md`: Lead é oportunidade/unidade de atendimento; Cotação é uma versão histórica imutável; Venda registra contratação aprovada; Cliente ativo é o vínculo pós-venda de uma venda aprovada. Uma família pode ter vários beneficiários.
- DEC-071 mantém um único funil e suas transições. A interface não pode criar estados de comissão/implantação copiados do benchmark ou converter venda pelo arraste de cartão.
- Corretor opera exclusivamente no Lite e só acessa sua carteira. Oferta provisória/aceite, contato protegido, distribuição e SLA continuam nos serviços existentes (incluindo DEC-104).
- `/clientes` já renderiza `LightClientsList`: busca por nome/telefone e acesso à ficha/WhatsApp. Os filtros Ativos/Cancelados estão condicionados à visão de gestão; o corretor ainda não os recebe.
- A consulta Lite do corretor carrega a lista inteira e campos básicos. Será preciso paginação/consulta no servidor para ampliar filtros e volume; não basta acrescentar filtros visuais ao array atual.
- Existe `src/features/broker-workspace/components/light-client-detail.tsx`, com Dados, Vendas, Documentos e Histórico, mas o ramo que a seleciona em `/clientes/[clientId]/page.tsx` atende apenas gestor/supervisor. O corretor segue pelo restante da composição da rota. Isso é um gap de continuidade visual a corrigir em C2, com adaptação explícita ao papel; a ficha de gestão não concede suas ações ao corretor. `client-detail-lite.tsx` da rota é uma composição da direção e também não deve ser copiada como outra ficha independente.
- `src/features/leads/task-actions.ts` já contém conclusão, reabertura/cancelamento de retorno com autorização e auditoria. A primeira etapa deve mapear criação/reagendamento, estados e usos existentes antes de ampliar o contrato.
- O contrato visual e o controle UX permanecem vigentes. UX-M1.10 tem QA autenticado pendente; este plano não aprova sua conclusão nem abre uma migração global.

## Experiência proposta

### Navegação pequena e estável

Manter os destinos existentes do corretor. Leads é o lugar do atendimento e negociação; Clientes é o lugar do relacionamento pós-venda. O Início continua mostrando o que exige ação agora. Uma nova visão de agenda só deve ser exposta depois de confirmar sua rota canônica e autorização; os atalhos de Início, lead e cliente devem abrir o mesmo retorno/tarefa.

Dentro de Clientes, a tela inicial tem busca e recortes **Todos, Precisa de atenção e Renovações**. O último recorte só aparece quando houver consulta autorizada e informação contratual confiável. Histórico e Base importada ficam em menu secundário ou superfície contextual; não se criam nove itens de navegação para reproduzir o benchmark.

No celular, a lista continua em linhas, com nome, um indicador de situação, uma frase de próximo passo e prazo. No desktop, usar o mesmo vocabulário e componentes com mais espaço para contexto; evitar uma segunda experiência com campos e ações diferentes.

### Carteira: abrir e resolver

- Cabeçalho compacto, busca e uma ação principal **Adicionar**, quando a política autorizar cadastro manual. Ações secundárias incluem filtros e organização. Se não houver permissão, a lista continua útil sem CTA indisponível.
- Recorte padrão Todos; ao escolher Precisa de atenção, ordenar por prazo e prioridade determinística do servidor. Exibir o motivo: “Retorno atrasado”, “Renovação em 12 dias”. Não classificar ausência de dado como situação em dia.
- Busca por nome/telefone preserva o comportamento atual; incluir e-mail somente após confirmar indexação e autorização. Busca/filtros/página ficam na URL e são restaurados ao voltar da ficha.
- Filtros avançados em sheet: situação contratual, prazo de retorno, operadora contratada, mês de reajuste, origem e etiqueta, conforme campos disponíveis. Mostrar filtros ativos e Limpar; nenhuma opção fictícia.
- Abrir a linha leva à ficha. A ação curta lateral corresponde ao contexto (ex.: contato autorizado), sem competir com vários botões na mesma linha.

### Ficha: contexto antes de detalhes

Cabeçalho: nome, vínculo/estado confirmado e contato autorizado. Abaixo, um bloco de **Próxima ação** com prazo, motivo e um botão contextual. Se não houver pendência conhecida, informar isso sem prometer que o atendimento está em dia.

Consolidar a ficha do corretor no Lite, reaproveitando a organização Dados, Vendas, Documentos e Histórico já disponível na base compartilhada e preservando cada autorização do corretor. Dados agrega contato, perfil PF/PJ, origem/prioridade, plano/operadora e renovação; campos raros ficam em expansão. Vendas preserva registros e suas datas; Documentos reaproveita o fluxo e escopo existentes; Histórico inclui notas e ações auditadas com autoria. Retornos ficam junto à próxima ação e no histórico, sem criar outra timeline.

**Agendar retorno** abre o mesmo sheet usado no lead/agenda: data/hora, propósito e nota opcional. Preservar rascunho ao fechar acidentalmente e retornar o foco ao gatilho. Concluir/reagendar atualiza o contexto da ficha e do Início. Um clique em WhatsApp não pode ser registrado como mensagem enviada ou contato concluído sem confirmação da fonte real.

### Cadastro com disclosure progressivo

Adicionar apresenta opções compatíveis com a etapa habilitada: **Novo contato** usa entrada manual de lead existente; **Cliente antigo** usa o fluxo histórico próprio, após decisão de métricas. A opção de importar só entra após a fase de base importada.

Primeiro passo curto: nome e contato, origem e tipo comercial conforme contrato existente. WhatsApp/CNPJ validam no servidor; não exigir dado desnecessário. CNPJ aparece apenas para PJ. Complementos como cidade/região, vidas/idades, prioridade, interesses, operadora/plano e etiquetas aparecem na seção “Mais informações”. Não transformar o cadastro em obrigação de preencher todos os campos do benchmark.

Idades são um auxílio para cotação; não substituem nascimento/identidade do beneficiário nem viram prontuário. O preenchimento do cotador precisa respeitar o catálogo e a distinção entre simulação demonstrativa e Cotação oficial.

### Agenda de relacionamento

Reutilizar tarefas e retornos. Recortes Hoje, Atrasadas, Próximas e Concluídas, busca e filtros por propósito/prioridade conforme modelo canônico. Lista temporal, sem calendário mensal obrigatório. Cada item mostra quem, o que e quando; ação principal muda conforme pendência.

Criação de várias tarefas fica como ação avançada dentro do mesmo formulário: começar com uma, permitir adicionar/remover blocos e preservar campos em erro. O servidor precisa devolver resultado por item e impedir duplicação no retry. Não anunciar sucesso de todo o lote se um item falhar.

### Base preservada e clientes antigos

**Base importada proposta:** contatos em estágio de revisão, separados do funil/distribuição, com prévia e validação antes de confirmar. Importar não significa oferecer lead automaticamente nem atribuir responsável pelo arquivo. Ao promover, chamar o serviço autorizado e a política canônica de entrada; a forma de atribuição é decisão pendente.

Fluxo: escolher arquivo → mapear colunas → revisar válidos/duplicados/erros → confirmar → consultar resultado. CSV primeiro; XLSX depende de biblioteca já instalada. Limites, codificação e tamanho devem derivar de orçamento técnico/configuração; os 10 MB/10.000 registros do benchmark não são requisitos automaticamente aprovados. Nunca enviar o arquivo a um serviço novo para processar.

**Histórico proposto:** venda antiga preserva data da venda e origem de importação/cadastro; não aumenta a produção/meta atual por data de cadastro. Não cria comissão, cobrança, distribuição, WhatsApp ou automação financeira como efeito colateral. A regra exata precisa de decisão aprovada e validação com o catálogo de métricas antes de gravar dados.

## Mapa de cobertura do benchmark

| Referência | Destino no Lite | Regra de simplicidade |
|---|---|---|
| Visão geral | Início existente e recortes acionáveis de Clientes | Reutilizar prioridades; evitar outro dashboard com KPIs repetidos. |
| Minha carteira | `/clientes` e ficha atual | Lista de pessoas + sheet de filtros; contexto restaurável. |
| Funil comercial | `/leads` e máquina de estados atuais | Resumo por fase apenas se necessário; Kanban é visualização do mesmo funil (DEC-071). |
| Retornos/tarefas | Serviço atual, sheet reutilizado e agenda canônica | Próxima ação visível, detalhe sob demanda. |
| Leads recebidos | Minha fila/aceite atuais | Preservar propriedade provisória, proteção do contato e SLA. |
| Novo cliente | Entrada manual canônica e ficha existente | Cadastro curto, complementos expansíveis. |
| Etiquetas | Biblioteca contextual na carteira | Selecionar/criar sem abandonar formulário; escopo depende de decisão. |
| Base importada | Superfície secundária de revisão | Contatos não promovidos não poluem fila de atendimento. |
| Clientes antigos | Recorte histórico e cadastro próprio | Data e origem explícitas; produção nova protegida. |

## Contrato de design e movimento

Reutilizar `PeoplePage`, `PeopleFilters`, `PeopleSection`, `PeopleRow`, `PeopleEmpty` em `src/components/light/people-list`, Arc Button, Badge, SearchField, SegmentedControl e BottomSheet. Reaproveitar os formulários e primitives UI/Unlumen existentes. Evoluir a API da base quando houver gap comum; registrar o gap no controle UX antes de criar variante. Não copiar estilos locais como padrão novo.

| Momento | Composição e movimento propostos | Critério |
|---|---|---|
| Primeira entrada | Entrada atual da lista ou `LitePageEnter`/stagger compartilhado | Um único controlador de entrada. Não sobrepor animação de PeopleRow e outro stagger; não reapresentar toda lista a cada tecla. |
| Busca/filtro | Seleção com SegmentedControl; troca discreta de conteúdo | Foco no controle, resultados anunciados e posição estável. Evitar blur de nomes/dados durante a leitura. |
| Sheet/formulário | BottomSheet existente; referência modal/panel de `transitions-dev` somente para gap comprovado | Entrada/saída com foco, Escape e restauração; não adicionar segundo motor sobre a animação da primitive. |
| Mais informações | `LiteCollapse` quando compatível | Conteúdo e labels continuam acessíveis ao teclado; fechamento não apaga rascunho. |
| Gravação | Pending no botão, atualização otimista reversível onde segura, confirmação do servidor | Erro preserva formulário e oferece retry; importação/conversão não simulam conclusão antes do commit. |
| Conclusão de tarefa | Atualização curta da linha com presença/sucesso compartilhado | Sucesso só confirmado após servidor; foco migra para item seguinte se a linha sair. |
| Carregamento | Skeleton no formato da lista/ficha; reveal compartilhado | Dimensões reservadas, sem salto de layout. |

Fonte dos tempos/easing: `src/components/arc/motion-tokens.ts` e wrappers compartilhados em `src/components/lite/motion` / `src/components/light/light-motion.tsx`. Os tokens Arc existentes incluem fast 160 ms, exit 180 ms, standard 240 ms, stagger item 35 ms limitado a oito atrasos; usar os valores da base, sem duplicar uma segunda escala de duração. Referências `transitions-dev`: modal, panel, accordion, skeleton e tabs, adaptadas à governança/tokens existentes antes de implementação.

Respeitar `prefers-reduced-motion` e a configuração de movimento já governada pela plataforma. Com redução ativa, remover deslocamento/stagger/spring e manter feedback imediato compreensível. Garantir alvos de toque de pelo menos 44 px, foco visível, contraste, nomes acessíveis e ausência de informação apenas por cor. Motion nunca atrasa aceitar lead, abrir ficha ou enviar uma ação.

## Contratos de dados e serviço

- Identidade, tenant, papel e responsável vêm do servidor; consultas de lista, contagem, detalhe e busca usam o mesmo resolvedor de escopo.
- Não tratar `leadId`/`clientId` enviado pela UI como autorização. Revalidar acesso em cada leitura/mutação, incluindo tarefa, etiqueta, documento, arquivo de importação e promoção.
- Reaproveitar `clients`, vínculo ativo, vendas, propostas, beneficiários e tarefas existentes; campos novos e tabelas ficam condicionados à inspeção de `src/shared/db/schema.ts` e decisões da fase C0. Este plano não autoriza uma migração específica.
- Situação de lead, status da venda, vigência, renovação, prioridade e prazo de tarefa são dimensões diferentes. Comissões não viram etapas do lead apenas por aparecerem assim no benchmark.
- Preservar precedência de fonte já aprovada para valor/vidas: venda/proposta formal e snapshot conforme decisão atual. Marcar dados ausentes ou inferidos; não exibir zero como valor confirmado.
- Datas de venda, cadastro, vigência, aniversário e retorno são distintas. Datas civis não mudam de dia por timezone; retornos usam instante e fuso operacional America/Sao_Paulo.
- Paginação/ordenação no servidor; filtros e contadores precisam concordar. Sem carregamento de toda a base pessoal no browser; incluir índices apenas após analisar consultas e custo.
- Idempotência e vínculo ao autor em criação em lote/promoção/importação; promoção repetida não cria lead duplicado. Critério de duplicidade usa normalização e escopo do tenant; não revelar responsável ou PII de registro fora da carteira.

## Governança obrigatória

Capacidades novas: carteira avançada, retorno na ficha, etiquetas, base importada e cadastro histórico. Nomes de flags ainda serão definidos seguindo o catálogo existente; não criar uma flag redundante para capacidade já governada.

Cada capacidade deve ter interruptor real, configuração validada, explicação de indisponibilidade e auditoria no Super-admin. O servidor aplica o estado; desativar mantém registros e restaura acesso seguro ao fluxo canônico. Auditar ativação, alteração, desativação, criação/edição relevante, promoção e importação/exportação sem registrar conteúdo pessoal em claro. Se faltarem controles administrativos, a entrega fica parcial.

Desativar somente uma superfície não deve cancelar tarefa já confirmada nem apagar cliente/importação. A política de pausar processamento em andamento precisa estar definida antes de habilitar importadores/automação.

## Fases e critérios de aceite

| Fase | Escopo e dependências | Aceite objetivo |
|---|---|---|
| C0 — contratos e prévia | Mapear schema/serviços/permissões reais; conferir decisões pendentes; desenhar prévia sintética de carteira, ficha, retorno e cadastro com componentes existentes; registrar papel/ação/estados/disclosure no controle UX. | Matriz RF/BR/DEC e campos com fonte; decisões propostas revisadas; prévia desktop/celular mostrando vazio, carregamento, erro, dados e redução de movimento. Sem gravação de dados reais. |
| C1 — carteira útil | Depende C0. Consulta paginada e filtros pessoais; preservação da URL; motivo/próxima ação; governança e auditoria. | Voltar da ficha restaura busca/posição; resultados/contadores com mesmo escopo; vazio de base e vazio de busca distintos; sem outros corretores/tenants; desligar capacidade preserva lista atual. |
| C2 — ficha e retornos | Depende C1 e serviço canônico de tarefas validado em C0. Corrigir a seleção/composição da ficha Lite para o corretor, preservando ações autorizadas; acrescentar próxima ação, agendar/concluir/reagendar e vínculo com Início. | Lista e ficha mantêm a mesma linguagem Lite; nenhuma ação de gestor/diretor é ampliada ao corretor; retorno salvo aparece no mesmo contexto em ficha/Início/agenda; erro mantém entrada; reenvio não duplica; ausência de canal tem alternativa explícita; contatos protegidos continuam protegidos. |
| C3 — cadastro e relacionamento | Depende C2 e permissões de entrada manual. Cadastro progressivo, CNPJ condicional, origem/prioridade e vidas/interesses/operadora quando suportados. | Mesma entrada manual do domínio; servidor valida campos; informação não se duplica em cadastros paralelos; uso de vidas no cotador respeita origem e catálogo. |
| C4 — organização e tarefas em conjunto | Depende C2/C3 e decisão de escopo das etiquetas. Biblioteca contextual, seleção/criação preservando rascunho; múltiplas tarefas. | Regras de rename/desativação claras, sem remoção de histórico; tarefa por item idempotente, com falha parcial recuperável; não perder formulário ao abrir etiqueta. |
| C5 — carteira histórica | Depende C3 e decisão de métricas/financeiro. Cadastro e recorte de vendas anteriores. | Venda antiga de outro mês não aumenta produção/meta do mês atual; consulta por data correta; nenhuma comissão/cobrança/comunicação disparada implicitamente; ação auditada e governada. |
| C6 — base importada | Depende C3/C4 e regras de duplicidade/promoção aprovadas. Leitura, mapeamento, prévia, erros, confirmação e promoção segura. | Arquivo inválido nunca grava; retry não duplica; limite aplicado no servidor; conflito não expõe carteira alheia; interrupção/retomada e flag desligada têm estado definido; promoção usa a política canônica. |
| C7 — acabamento e piloto | Após cada incremento e revisão integrada final. Testar jornada inteira com dados sintéticos e depois piloto controlado no escopo autorizado. | QA de layout/motion, acessibilidade, segurança e jornadas registrado; build/typecheck/checks proporcionais aprovados ou impedimentos discriminados; rollback exercitado e monitoramento disponível. |

Primeiro corte publicável: **C0 → C1 → C2**. C3–C6 entram em lotes próprios. Publicar por capacidade/tenant após validação; nenhum cronograma de dias é assumido sem estimar C0.

### Registro de execução C0 (2026-11-11)

| Campo | Fonte real | Uso nesta entrega |
|---|---|---|
| Identidade do cliente e proprietário | `clients.id`, `tenant_id`, `lead_id`, `corretor_id`, `branch_id`, `nome`, `telefone`, `email`, `converted_at` | Lista/ficha do corretor no tenant e usuário da sessão; nome/telefone na busca. |
| Origem e estágio comercial | `leads.origem`, `leads.status`, `leads.tenant_id`, `leads.corretor_id` | Leitura contextual e filtro de origem, sempre sem alterar o funil. |
| Próxima ação | `lead_tasks.lead_id`, `tenant_id`, `title`, `due_at`, `completed_at`, `priority` | Uma única tarefa aberta mais próxima por lead; serviço canônico para criar, concluir e reagendar. |
| Contrato e renovação | `active_customers.status`, `renewal_window_start_date`, `contract_anniversary`, `expiration_date` | Recorte Renovações e sinal de atenção apenas com contrato ativo e janela persistida. |
| Permissão e governança | `getRequiredTenantContext`, `buildClientScopeWhere`, `FEATURE_FLAGS`, `platformAuditLogs` | Tenant/corretor sempre derivados no servidor; feature flag global e auditada pelo Super-admin. |

Decisão adotada pelo recomendado: preservar a identidade e os fluxos canônicos, usar tarefas existentes como retorno e não inferir atenção a partir de ausência de dado (DEC-178, BR-098). Pesquisa confirma que etiquetas, base importada, clientes antigos, comissão e outros estados não têm contrato autorizado em C0-C2; permanecem fora. Não há migration necessária. A prévia sintética fica em `/dev/carteira-corretor-lite`, bloqueada em produção.

### Organização sugerida das alterações

Cada fase deve separar commits revisáveis: (1) contrato/decisão e governança, (2) serviço/consulta com validações, (3) composição UI usando base compartilhada, (4) validação/evidência/documentação. Cada commit de código precisa permanecer coerente; migrações, quando aprovadas, têm pré-requisitos de deploy e compatibilidade documentados.

Arquivos candidatos: `src/app/(dashboard)/clientes/page.tsx`, `src/app/(dashboard)/clientes/[clientId]/page.tsx`, `src/features/broker-workspace/components/light-clients-list.tsx`, `light-client-detail.tsx`, serviços de tarefas em `src/features/leads`, pós-venda/renovação em `src/features/customers` e `src/features/post-sale`, resolvedores de escopo e componentes compartilhados. Serviços novos ficam no domínio correto definido em C0, sem concentrar regra de negócio nas páginas.

## Decisões de produto propostas, ainda não aprovadas

| Assunto | Recomendação para revisão | Dependência |
|---|---|---|
| Organização principal | Preservar Leads e Clientes com suas definições; integrar próxima ação e dados, sem outra máquina de estados. | C0. Compatível com glossário e DEC-071. |
| Etiquetas | Começar pessoais ao corretor; biblioteca compartilhada exigiria permissão, autoria, renomeação e escopo próprios. | C4. Registrar aprovação no decision-log antes de implementar. |
| Histórico | Histórico de venda fora da produção/meta nova e sem efeitos financeiros automáticos; quem pode cadastrar/validar é decisão explícita. | C5. Conferir métricas e regras financeiras. |
| Promoção da base | Usar serviço e política de entrada manual autorizada; não inferir que importar torna o corretor proprietário ou dispara distribuição. | C6. Definir fluxo e permissões com a operação. |
| Comissões | Exibir apenas fatos financeiros próprios já autorizados; resolver DEC-004 e capacidades aplicáveis antes de qualquer fluxo novo. | Sem dependência para C1/C2. |
| Kanban | Reaproveitar o existente; iniciar carteira com lista. Mudança de visualização nunca altera o domínio. | Sem bloqueio para primeiro corte. |

Uma decisão acima só vira aprovada após validação com Vinicios e registro. Não alterar `CONTEXT.md` nem criar ADR como se esses termos/contratos já tivessem sido aceitos. Na revisão, resolver um assunto por vez, com recomendação e exemplo concreto, conforme `grill-with-docs`/`domain-modeling`.

## Registro de execução C1 (2026-11-11)

A carteira Lite do corretor passa a consultar somente clientes do tenant e do corretor autenticados, com verificação adicional de que o lead vinculado pertence ao mesmo tenant. A consulta retorna 20 por página, ordena pelas conversões mais recentes e usa o mesmo resolvedor de predicados para lista, contagens e recortes. Busca limitada a nome e telefone; filtros somente por origem real do lead, status real do contrato e prazo real de tarefa.

Recortes: Todos; Precisa de atenção, quando houver retorno vencido/hoje ou janela de renovação persistida até 30 dias; Renovações, exibido somente com ao menos um contrato ativo que tenha renewal_window_start_date. A lista mostra motivo e próxima tarefa, sem converter falta de dado em estado positivo. URL guarda busca, recorte, filtros e página; a URL da ficha recebe o caminho de retorno para a integração C2.

A rota nova só aparece para corretor Lite quando feature_broker_client_wallet_lite_enabled está ligada. Com a flag desligada, o ramo antigo de /clientes permanece intacto. A prévia C1 usa fixtures sintéticas; C2 continua fora desta branch. Nenhuma migration foi necessária e não houve escrita em dados operacionais.

Validação da UI: capturas C1 em reports/agent/carteira-corretor-lite/c1-carteira-360.png, c1-carteira-390.png e c1-carteira-1440.png; c1-filtros-390.png mostra o sheet. As capturas -fim mostram o fim da lista com rolagem vertical em 360/390. c1-layout.json registra dimensões da viewport e do scroller, ausência de overflow horizontal e erros de console vazios nas três larguras; os rótulos dos três recortes cabem no controle em 360/390. Resultado de testes e build: reports/agent/verification/2026-11-11-carteira-corretor-lite-c1.md. O registro do preview inclui uma divergência pré-existente de hidratação na ficha C0 em light-client-detail, fora do escopo C1 e reservada à revisão/fase da ficha.

## Validação, rollout e rollback

- Cenários sintéticos: novo corretor sem carteira, busca vazia, 1.000+ registros paginados, cliente sem contrato, contrato cancelado, retorno atrasado/hoje/futuro, falta de permissão, canal indisponível, erro de rede, duplo clique/retry, troca de owner, dois tenants e duas carteiras da mesma unidade.
- Histórico: mesma venda cadastrada agora preservando data antiga; clientes com mais de uma venda; data de aniversário em virada de ano e datas civis sem deslocamento; nenhum efeito de produção/financeiro sem regra aprovada.
- Importação: CSV inválido, colunas ausentes, telefone/CNPJ inválido, duplicidade interna e já existente, registro fora da carteira, arquivo acima do limite, upload/worker interrompido, promoção concorrente e flag desligada durante lote.
- UI: 360/390/768/1440 px, teclado, zoom 200%, leitor de tela, reduced motion e configuração de animação desligada. Layout sem scroll horizontal na lista e sem CTA oculto pelo teclado virtual. Ao remover linha ou trocar aba, preservar foco de forma previsível.
- Medir antes/depois: tempo para encontrar cliente e agendar retorno, quantidade de passos, erros/retries e pendências concluídas; instrumentação mínima, sem PII. Alvo de UX a validar na prévia: encontrar/abrir cliente em até duas ações após digitar busca e agendar retorno sem sair do contexto.
- A cada fase: contexto do harness, verificações focadas, `agent:verify --level fast`, e `--level full` antes de encerrar implementação; build obrigatório para código. Não repetir suíte global por mudança só no texto sem justificar. Registrar baseline e falhas alheias, sem declarar aprovação global.
- Rollout gradual com flag servidor, piloto de corretor autorizado e métricas de erro/latência. Rollback desliga a capacidade e mantém dados; importações/migrações precisam de estratégia própria de compatibilidade e retomada.
- Após implementação atualizar este registro, `docs/features-log.md` e o controle UX; entrega fica parcial enquanto houver governança/QA relevante pendente.

## Registro desta entrega de planejamento

Entregue: proposta funcional, mapa de cobertura, fontes locais consultadas, contrato de design/movimento, fases, critérios de aceite, decisões pendentes e estratégia de validação/rollback. Nenhum código, schema, regra aprovada, feature flag ou configuração de produção foi alterado. A descoberta do benchmark segue limitada à conta vazia e não comprova estados preenchidos.

Validação desta versão documental: ver evidência em `reports/agent/verification/2026-11-11-carteira-corretor-lite-plano.md`.

### Registro de execução C2 (2026-11-11, branch feat/carteira-ficha-lite)

Entregue atrás da flag `feature_broker_client_wallet_lite_enabled` (padrão desligada):

- `src/features/carteira/proxima-acao-core.ts`: classificação da próxima ação pelo dia civil de São Paulo (atrasado, hoje, futuro, sem prazo, nenhum), validação do prazo (futuro, até 365 dias) e detecção de repetição idêntica em 2 minutos.
- `src/features/carteira/retorno-servico.ts` e `retorno-queries.ts`: agendar, reagendar e ler a próxima ação para o corretor dono. Usa `autorizarTarefaDoLead` e `criarTarefaDoLead` (tarefa canônica). Reagendar grava só se a tarefa segue aberta e do corretor, com auditoria `reagendou`. Gestor e diretor não usam essas ações.
- `src/features/carteira/retorno-actions.ts`: server actions que revalidam a ficha e o Início.
- `light-client-next-action.tsx`: bloco Próxima ação (Agendar, Reagendar, Já falei). Concluir reusa `setLeadTaskDoneAction`. Erro mantém data e observação. WhatsApp não registra contato.
- `clientes/[clientId]/page.tsx`: o corretor Lite recebe a ficha Lite só com a flag ligada; com a flag desligada a rota segue como antes.

Pendências: prints mobile 390 e desktop 1440 da ficha real (exigem sessão autenticada); repetição concorrente entre duas requisições simultâneas é best-effort (sem índice único, que exigiria migração não autorizada); cobertura de banco real ainda não executada, apenas testes com dependências simuladas.
