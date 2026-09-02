# Contexto de domínio do CorreTop

## Atendimento e pós-venda

- **Lead**: oportunidade comercial e unidade de atendimento; pode representar uma família.
- **Contexto de propriedade**: identifica o corretor responsável e a unidade responsável por um registro operacional. Para o Diretor, a unidade deve aparecer sempre que a visualização puder reunir mais de uma filial; um registro sem filial é explicitamente geral/sem unidade.
- **Beneficiário**: pessoa incluída na contratação de um lead. Todo lead deve ter um titular; dependentes são beneficiários adicionais.
- **Titular**: beneficiário marcado como responsável principal pela contratação. Há exatamente um titular por lead.
- **Cotação**: versão histórica e imutável de uma proposta para um lead; seus itens detalham plano, beneficiário e valor calculado.
- **Catálogo oficial**: base de operadoras, planos, tabelas e versões comerciais mantida pela plataforma. Não pertence a uma corretora e somente o Super-admin pode publicá-la.
- **Extensão privada de catálogo**: operadora ou plano de acordo exclusivo de uma corretora. Pertence a exatamente um tenant, não é compartilhável e pode ser administrada apenas pelo Diretor desse tenant.
- **Tabela comercial**: identidade lógica das condições de um plano; não é o preço em si.
- **Versão de tabela**: publicação imutável de uma tabela comercial, com vigência e valores por faixa. Cotação, venda e PDF devem guardar a versão usada.
- **Disponibilidade de catálogo**: decisão administrativa que habilita um plano oficial para um tenant e, opcionalmente, o restringe em uma unidade. Uma restrição nunca reabilita um item oculto acima dela.
- **Documento por beneficiário**: evidência individual, como identidade ou declaração de saúde. Documentos familiares, como comprovante de residência, não precisam apontar para uma pessoa.
- **Venda**: registro da contratação aprovada pela operadora; a data de registro, o início da vigência e o valor aprovado são fatos diferentes.
- **Cliente ativo**: vínculo pós-venda criado a partir de uma venda aprovada, com vigência e aniversário contratual próprios.
- **Cancelamento**: encerramento do cliente ativo informado à corretora; não desconta dinheiro automaticamente e gera pendências financeiras auditáveis.
- **Estorno pendente**: sinalização de uma parcela já paga que pode estar dentro da janela de chargeback; sua resolução é manual.

## Distribuição de leads

- **Plantão multiunidade**: criação coordenada de regras de plantão independentes para mais de uma unidade. Não é uma regra compartilhada: cada unidade conserva fila, escala, cobertura e histórico próprios.
- **Central de distribuição**: superfície operacional única para configurar filas, acompanhar exceções e explicar decisões. Ela não substitui o motor: toda ação manual, qualificação e automação deve usar o mesmo resolver determinístico.
- **Decisão de distribuição**: resultado explicável de uma tentativa de roteamento, contendo fila, candidatos elegíveis, estratégia, corretor selecionado — quando houver — e os motivos de exclusão ou fallback.
- **Fila de espera**: estado recuperável de um lead sem corretor elegível. O lead permanece visível para ação humana e nunca é descartado silenciosamente.
- **Agenda pessoal do corretor**: janelas semanais declaradas pelo próprio corretor, no fuso operacional. Elas determinam quando ele entra na distribuição automática e não revogam a possibilidade de atribuição manual assistida.

## Canais de comunicação

- **Agente de atendimento**: capacidade governada que conduz uma conversa com um lead pelo canal autorizado, preserva seu estado e pode solicitar ações CRM somente por ferramentas validadas. Na primeira entrega, ele só responde após mensagem inbound no WhatsApp oficial.
- **Sessão de atendimento automatizado**: estado persistido, único por tenant, lead e canal, que registra os campos coletados, perguntas pendentes e o ponto seguro de retomada de uma conversa do agente.
- **Canal de comunicação**: identidade operacional de um provedor associada a um tenant e, opcionalmente, a uma unidade. Para WhatsApp oficial, a chave externa é o `phone_number_id` da Meta.
- **Canal Meta Cloud**: canal empresarial conectado por Embedded Signup; seu token é cifrado no servidor e nunca é devolvido ao navegador.
- **Fonte Meta Lead Ads**: vínculo auditável entre uma Página Meta compartilhada e um tenant/unidade. A Página identifica o tenant no webhook; a credencial técnica de leitura é central da plataforma e nunca pertence ao cliente.
- **Conexão de aquisição Meta**: conexão canônica, pertencente a uma corretora, que autoriza explicitamente os ativos de Marketing usados pelo CRM. Ela é a fonte de campanhas, atribuição e performance; tokens permanecem privados no servidor.
- **Atribuição Meta**: conjunto imutável de IDs oficiais de Página, conta, campanha, conjunto, anúncio, formulário e leadgen que explica de qual ativo um lead entrou. Nomes servem apenas para leitura.
- **Regra de entrada Meta**: configuração que resolve uma fila a partir da atribuição de mídia. Ela nunca escolhe um corretor; depois dela, o motor central de distribuição decide elegibilidade, capacidade e responsável.
- **Catálogo de integrações**: ponto de entrada administrativo que lista conectores disponíveis e planejados. Ele não concede acesso por si só: cada conector conserva sua própria autorização, configuração e controles de capacidade.
- **Canal legado OpenWA**: conexão temporária por QR Code mantida apenas durante a migração. Não deve receber novas capacidades estruturais.
- **Atendimento externo temporário**: enquanto o chat interno não estiver operacional, o Corretor inicia o atendimento auditado no CorreTop e é direcionado ao WhatsApp pessoal pelo número autorizado do lead. A interface não apresenta mensagens como se estivessem sincronizadas.

## Extensão CorreTop Assistant

- **CorreTop Assistant**: painel contextual privado do CRM que acompanha somente a conversa aberta no WhatsApp Web; não é um disparador nem uma caixa de entrada paralela.
- **Sessão da extensão**: vínculo revogável por dispositivo, derivado de uma autorização temporária iniciada no CRM; nunca aceita tenant, unidade ou permissões enviados pelo navegador como autoridade.
- **Lead acessível**: lead cuja visibilidade foi confirmada pelo backend para o tenant, unidade, carteira e papel do corretor; telefone sozinho nunca concede acesso.
- **Sugestão de resposta**: texto gerado ou selecionado pelo backend a partir do contexto autorizado, que pode ser inserido no compositor sem executar o envio.

## Relatórios

- **Relatório operacional supervisionado**: exportação de leads, qualificação, tarefas, distribuição, conversão e desempenho restrita aos corretores ativos vinculados ao Supervisor. Nunca contém valores ou comissões.
- **Relatório consolidado**: exportação autorizada no escopo do Diretor (tenant) ou Gestor (filial atual), com as limitações da permissão do relatório.
- **Métrica canônica**: definição versionada de um indicador (identificador estável, numerador, denominador e dimensões permitidas) mantida no catálogo de métricas. Toda superfície consome a mesma definição; nenhuma tela recalcula o indicador localmente.
- **Taxa de conversão (coorte de entrada)**: leads recebidos em um período que alcançaram o estágio `converted` divididos pelos leads recebidos no mesmo período, excluídos duplicados e descartados. Numerador e denominador pertencem à mesma população de leads.
- **Família de relatórios**: agrupamento de análises sobre o mesmo recorte do negócio (Visão geral, Comercial, Equipe, Unidades, Financeiro) dentro da rota única de relatórios. Não é uma rota nem uma regra de negócio própria.
- **Drill-down**: caminho de um número agregado até a população exata de registros que o compõe, respeitando o escopo da sessão. Todo número de relatório precisa ter um drill-down explicável.
- **Item de atenção**: contagem derivada de fatos persistidos (não de opinião) que aponta uma pendência operacional atual, com threshold configurável pelo Diretor e população recuperável por drill-down.
- **Janela anterior equivalente**: período imediatamente anterior ao selecionado, com a mesma duração, usado para comparação. Diferenças entre taxas são apresentadas em pontos percentuais, nunca como variação percentual.

## Engenharia

- **Engineering Harness**: contrato versionado que orienta descoberta de contexto, execução limitada, verificação e registro de evidências para mudanças no CorreTop.
- **Gate de aceite**: conjunto proporcional de verificações objetivas que precisa passar antes de uma mudança ser considerada concluída.
- **Registro de implementação**: evidência durável que relaciona objetivo, escopo, decisões, validações, riscos e rollback de uma entrega técnica.
