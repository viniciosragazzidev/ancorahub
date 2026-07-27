export type GuideRole = "director" | "manager" | "broker";

export type GuideSection = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: string;
  audience: GuideRole[];
  links: Array<{ label: string; href: string }>;
  steps: Array<{ title: string; description: string }>;
  tip?: string;
};

export const guideCategories = ["Comece aqui", "Atendimento", "Gestão", "Configuração"] as const;

export const guideSections: GuideSection[] = [
  {
    id: "primeiros-passos",
    title: "Comece por aqui",
    eyebrow: "Comece aqui",
    description: "Entenda o caminho mais simples para colocar sua corretora em operação e saber onde cada tarefa acontece.",
    icon: "RocketLaunch",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir resumo", href: "/dashboard" }, { label: "Abrir configurações", href: "/settings" }],
    steps: [
      { title: "Confira seu espaço de trabalho", description: "Veja o nome e a identidade da sua corretora no menu. O que você enxerga depende do seu papel e da sua carteira." },
      { title: "Siga a ordem do dia", description: "Comece por Conversas, Leads ou Tarefas. Essas áreas mostram o que precisa de atenção e qual é o próximo passo." },
      { title: "Use o ícone de ajuda quando precisar", description: "Este guia explica cada área em linguagem simples. Você pode pesquisar uma palavra ou voltar ao sumário a qualquer momento." },
    ],
    tip: "Se você acabou de entrar, não precisa conhecer tudo: comece pela sua fila e avance uma ação por vez.",
  },
  {
    id: "leads",
    title: "Leads: sua fila de oportunidades",
    eyebrow: "Atendimento",
    description: "Cadastre, encontre e avance cada oportunidade sem perder o histórico do atendimento.",
    icon: "Users",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir Leads", href: "/leads" }],
    steps: [
      { title: "Encontre o lead", description: "Use a busca ou os filtros para encontrar por nome, telefone, status ou filial. O filtro fica preservado quando você volta para a lista." },
      { title: "Abra o detalhe", description: "No detalhe você vê contato, responsável, status, histórico, tarefas, cotações e documentos ligados à mesma oportunidade." },
      { title: "Escolha a próxima ação", description: "Inicie o atendimento, abra uma conversa, crie uma tarefa, prepare uma cotação ou registre uma observação." },
      { title: "Avance o status com contexto", description: "Atualize a etapa quando algo realmente mudar. Ao marcar uma perda, informe o motivo para manter a visão da corretora confiável." },
    ],
    tip: "A melhor fila é a que termina com uma próxima ação clara para cada lead.",
  },
  {
    id: "conversas",
    title: "Conversas e atendimento",
    eyebrow: "Atendimento",
    description: "Centralize a conversa com o cliente e mantenha o contexto do lead à mão.",
    icon: "ChatCircleText",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir Conversas", href: "/conversas" }, { label: "Conectar WhatsApp", href: "/settings/whatsapp" }],
    steps: [
      { title: "Escolha uma conversa", description: "Pesquise pelo nome, telefone ou e-mail. A lista mostra a última mensagem e o status do atendimento." },
      { title: "Leia antes de responder", description: "O histórico fica no centro da tela, enquanto o perfil do cliente reúne contato, responsável, plano e consentimento." },
      { title: "Use uma ação rápida", description: "Prepare uma mensagem sobre cotação, contrato ou plano. Revise o texto antes de enviar." },
      { title: "Responda pelo canal disponível", description: "Quando o WhatsApp estiver conectado, o envio fica disponível. Se não estiver, abra Configurações para conectar o canal." },
    ],
    tip: "Uma mensagem bem contextualizada evita retrabalho: confira o lead e a última interação antes de escrever.",
  },
  {
    id: "tarefas",
    title: "Tarefas e próximos passos",
    eyebrow: "Atendimento",
    description: "Transforme cada decisão em uma ação com prazo, prioridade e responsável.",
    icon: "ClipboardText",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir Tarefas", href: "/tarefas" }],
    steps: [
      { title: "Crie a tarefa dentro do lead", description: "Assim ela já nasce ligada ao contexto certo e aparece para as pessoas responsáveis." },
      { title: "Dê um prazo realista", description: "Use o agendamento para que a equipe saiba quando agir. Prioridade urgente deve representar risco ou oportunidade imediata." },
      { title: "Acompanhe sua operação", description: "Na lista, veja o que está atrasado, quem está responsável e qual lead precisa de atenção." },
      { title: "Volte ao lead para decidir", description: "A tarefa é um próximo passo, não uma tela isolada. Abra o lead para registrar o resultado." },
    ],
  },
  {
    id: "documentos",
    title: "Documentos e aprovações",
    eyebrow: "Atendimento",
    description: "Saiba o que falta, envie arquivos e acompanhe a aprovação sem procurar em várias telas.",
    icon: "Note",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir Documentos", href: "/documentos" }],
    steps: [
      { title: "Veja o checklist aplicável", description: "Os documentos pedidos dependem da cotação, operadora e plano. Assim você evita pedir arquivos desnecessários." },
      { title: "Envie o arquivo correto", description: "Faça o upload pelo lead ou pela fila de documentos. O arquivo fica ligado ao requisito e ao cliente." },
      { title: "Acompanhe o resultado", description: "Gestores e Diretores podem aprovar ou rejeitar. Quando houver rejeição, corrija o arquivo e envie novamente." },
      { title: "Use ações em lote com cuidado", description: "A aprovação em lote agiliza a operação, mas confira se todos os documentos selecionados pertencem ao mesmo contexto." },
    ],
  },
  {
    id: "clientes-vendas",
    title: "Clientes e vendas",
    eyebrow: "Gestão",
    description: "Quando um lead vira venda, acompanhe o cliente ativo e o que acontece depois do fechamento.",
    icon: "Handshake",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir Clientes", href: "/clientes" }, { label: "Abrir Vendas", href: "/vendas" }],
    steps: [
      { title: "Converta no momento certo", description: "A conversão transforma o lead em cliente ativo e preserva o vínculo com o histórico comercial." },
      { title: "Consulte a carteira", description: "Em Clientes, veja quem já foi convertido e mantenha o acompanhamento organizado." },
      { title: "Acompanhe a venda", description: "Em Vendas, veja o valor, o plano e as parcelas de comissão associadas ao fechamento." },
      { title: "Cuide do pós-venda", description: "Alertas de renovação e aniversário aparecem nas notificações quando estiverem próximos do período de atenção." },
    ],
  },
  {
    id: "gestao-equipe",
    title: "Equipe, filiais e distribuição",
    eyebrow: "Gestão",
    description: "Organize quem atende, onde cada pessoa trabalha e como os leads entram na fila.",
    icon: "Buildings",
    audience: ["director", "manager"],
    links: [{ label: "Abrir Equipe", href: "/equipe" }, { label: "Abrir Filiais", href: "/filiais" }],
    steps: [
      { title: "Cadastre a estrutura", description: "Crie filiais e convide Gestores ou Corretores com o papel adequado para cada pessoa." },
      { title: "Mantenha a disponibilidade atualizada", description: "O status disponível ou pausado ajuda a distribuir novos leads para quem realmente pode atender." },
      { title: "Acompanhe a fila da filial", description: "Gestores trabalham no escopo da sua filial; Diretores têm a visão completa da corretora." },
      { title: "Corrija exceções rapidamente", description: "Quando um lead precisar de outro responsável, reatribua pelo detalhe e confira o impacto no próximo atendimento." },
    ],
    tip: "Permissão e responsabilidade andam juntas: cada pessoa deve enxergar apenas o que precisa para trabalhar bem.",
  },
  {
    id: "distribuicao-leads",
    title: "Distribuição de leads",
    eyebrow: "Gestão",
    description: "Entenda como um lead sai da Inbox geral, chega à unidade e é atribuído a um corretor elegível.",
    icon: "Users",
    audience: ["director", "manager"],
    links: [{ label: "Abrir distribuição", href: "/leads/distribuicao" }, { label: "Abrir Leads", href: "/leads" }],
    steps: [
      { title: "Revise a Inbox geral", description: "Leads aguardando unidade ou corretor aparecem na área de distribuição. Selecione um ou vários para operar em lote." },
      { title: "Envie para uma unidade", description: "O Diretor pode escolher qualquer unidade ativa que aceite leads. O Gestor opera somente na própria unidade." },
      { title: "Escolha a fila e o modo", description: "A fila geral é criada para a unidade quando necessário. Filas automáticas procuram corretores disponíveis; filas manuais aguardam ação do Gestor." },
      { title: "Atribua ou distribua automaticamente", description: "Use Atribuir para escolher um corretor elegível ou Auto para aplicar capacidade e carga ativa. Corretores pausados não recebem novos leads." },
      { title: "Acompanhe o histórico", description: "Cada envio, atribuição, conflito e alteração fica registrado no histórico de distribuição e na auditoria do tenant." },
    ],
    tip: "Se nenhum corretor aparecer, confira se ele está ativo, vinculado à unidade, disponível e dentro da capacidade configurada.",
  },
  {
    id: "comissoes-metas",
    title: "Comissões e metas",
    eyebrow: "Gestão",
    description: "Configure regras, acompanhe repasses e transforme objetivos comerciais em acompanhamento diário.",
    icon: "Target",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir Comissões", href: "/configuracoes/comissoes" }, { label: "Abrir Metas", href: "/metas" }, { label: "Minha meta", href: "/minha-meta" }],
    steps: [
      { title: "Defina a regra de comissão", description: "O Diretor pode configurar percentuais por operadora, plano ou regra geral, incluindo parcelas futuras." },
      { title: "Acompanhe o cronograma", description: "Cada venda mostra as parcelas previstas, pendentes e pagas com suas datas de referência." },
      { title: "Registre o pagamento", description: "Diretores podem marcar uma parcela como paga e reverter a marcação se necessário." },
      { title: "Crie metas acompanháveis", description: "Configure objetivos por pessoa, equipe ou filial. Corretores acompanham o próprio progresso em Minha meta." },
    ],
    tip: "Uma meta boa é específica e revisada durante o período; use o progresso para decidir a próxima ação, não apenas para olhar o resultado final.",
  },
  {
    id: "configuracoes-seguranca",
    title: "Configurações e segurança",
    eyebrow: "Configuração",
    description: "Ajuste a identidade da corretora, integrações, acesso e proteção da conta.",
    icon: "SlidersHorizontal",
    audience: ["director"],
    links: [{ label: "Abrir Configurações", href: "/settings" }, { label: "Segurança", href: "/settings?tab=security" }, { label: "Integrações", href: "/settings?tab=integrations" }],
    steps: [
      { title: "Atualize a identidade", description: "Defina nome, logo e cor da corretora. A identidade aparece no ambiente de trabalho da equipe." },
      { title: "Conecte as integrações", description: "Gere e gerencie fontes de leads e configure o WhatsApp quando o canal estiver pronto." },
      { title: "Proteja seu acesso", description: "Revise sessões e ative a autenticação em duas etapas para aumentar a proteção da conta." },
      { title: "Confirme o papel de cada pessoa", description: "Permissões determinam o que cada usuário pode ver e alterar. Convide com o papel mínimo necessário." },
    ],
  },
  {
    id: "notificacoes",
    title: "Notificações e alertas",
    eyebrow: "Configuração",
    description: "Use os avisos para agir no momento certo, sem transformar o sistema em uma lista de ruídos.",
    icon: "Bell",
    audience: ["director", "manager", "broker"],
    links: [{ label: "Abrir Notificações", href: "/notificacoes" }],
    steps: [
      { title: "Abra a central", description: "Veja alertas relacionados à sua carteira ou ao escopo da sua função." },
      { title: "Leia o contexto", description: "Cada aviso deve indicar o que aconteceu e qual tela ajuda a resolver a situação." },
      { title: "Aja pelo link de origem", description: "Volte diretamente ao lead, tarefa ou configuração relacionada para não perder tempo procurando." },
      { title: "Priorize urgências", description: "Leads sem contato, estagnados e eventos de pós-venda pedem atenção diferente de uma atualização informativa." },
    ],
  },
  {
    id: "webhook-integracao",
    title: "Integração via Webhook (Landing Page)",
    eyebrow: "Configuração",
    description: "Configure um formulário externo para enviar leads automaticamente ao CorreTop via API.",
    icon: "RocketLaunch",
    audience: ["director"],
    links: [{ label: "Abrir Configurações", href: "/settings?tab=integrations" }],
    steps: [
      { title: "Crie uma fonte de captura", description: "Em Configurações > Integrações, clique em Nova fonte. Escolha o nome, a origem padrão (landing_page) e a filial de destino." },
      { title: "Copie o token gerado", description: "O token completo (crt_live_...) é exibido apenas uma vez. Copie e guarde em local seguro." },
      { title: "Adicione o snippet no site", description: "Cole o script de inicialização antes do código do formulário. Defina a URL com o ID do tenant e o token." },
      { title: "Configure o envio do formulário", description: "No submit, monte o payload com name (obrigatório), phone (obrigatório), source (obrigatório) e campos opcionais como email e planInterest." },
      { title: "Trate a resposta da API", description: "Verifique se success é true. Em caso de erro, leia o code para entender o problema (422 = dados inválidos, 401 = token inválido)." },
    ],
    tip: "Use o header Idempotency-Key com um identificador único para evitar duplicação caso o cliente envie o formulário duas vezes.",
  },
];

export const guideRoleLabels: Record<GuideRole, string> = {
  director: "Diretor",
  manager: "Gestor",
  broker: "Corretor",
};
