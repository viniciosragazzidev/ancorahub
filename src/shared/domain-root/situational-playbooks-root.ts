import { createDomainRoot } from "./definition";

export interface SituationalPlaybookItem {
  id: string;
  key: string;
  title: string;
  category: "first_contact" | "inquiry" | "objection" | "followup" | "handoff" | "timing" | "custom";
  description: string;
  triggerCondition: string;
  exampleCustomerInput: string;
  recommendedResponse: string;
  enabled: boolean;
  toneOverride?: "friendly" | "professional" | "consultative" | "direct";
  suggestedLeadStatus?: string;
  keywords: string[];
}

export interface SituationalPlaybooksConfig extends Record<string, unknown> {
  enabled: boolean;
  defaultTone: "friendly" | "professional" | "consultative" | "direct";
  allowAiAdaptation: boolean;
  autoGreetingEnabled: boolean;
  humanHandoffTag: string;
  supportedVariables: string[];
  playbooks: SituationalPlaybookItem[];
}

export const situationalPlaybooksDomainRoot = createDomainRoot<SituationalPlaybooksConfig>({
  key: "situational-playbooks",
  contractVersion: 1,
  criticality: "CRITICAL",
  defaults: {
    enabled: true,
    defaultTone: "friendly",
    allowAiAdaptation: true,
    autoGreetingEnabled: true,
    humanHandoffTag: "[SOLICITOU_HUMANO]",
    supportedVariables: [
      "cliente_nome",
      "assistente_nome",
      "corretora_nome",
      "operadoras_principais",
      "cidade_cliente",
      "vidas_cliente",
      "tipo_plano",
      "horario_atendimento",
    ],
    playbooks: [
      {
        id: "pb_organic_first_contact",
        key: "ORGANIC_INBOUND_WHATSAPP",
        title: "Primeiro Contato Direto no WhatsApp",
        category: "first_contact",
        description: "Quando o cliente manda mensagem por iniciativa própria no WhatsApp sem cadastro prévio.",
        triggerCondition: "Primeira mensagem recebida de um número novo ou conversa sem histórico.",
        exampleCustomerInput: "Olá, bom dia! Gostaria de saber mais sobre planos de saúde.",
        recommendedResponse: "Olá! Tudo bem? Sou a {assistente_nome} da {corretora_nome}. Que ótimo que você entrou em contato! Para te passar as melhores opções de planos e valores, como posso te chamar?",
        enabled: true,
        toneOverride: "friendly",
        keywords: ["ola", "bom dia", "boa tarde", "boa noite", "gostaria", "plano", "informacoes"],
      },
      {
        id: "pb_meta_ads_intake",
        key: "META_ADS_LEAD_INTAKE",
        title: "Lead vindo de Anúncio / Meta Ads",
        category: "first_contact",
        description: "Quando o lead preencheu formulário no Instagram/Facebook e já temos dados básicos.",
        triggerCondition: "Lead originado de campanha da Meta com nome e interesse identificados.",
        exampleCustomerInput: "(Lead preencheu formulário de cotação no Instagram)",
        recommendedResponse: "Olá, {cliente_nome}! Tudo bem? Sou a {assistente_nome} da {corretora_nome}. Vi que você solicitou uma simulação de plano de saúde no nosso anúncio. Para te passar as tabelas certinhas, quantas pessoas pretendem usar o plano?",
        enabled: true,
        toneOverride: "friendly",
        keywords: ["anuncio", "simulacao", "formulario", "instagram", "facebook"],
      },
      {
        id: "pb_price_inquiry",
        key: "PRICE_QUOTE_DIRECT_INQUIRY",
        title: "Pergunta Direta de Preço / Valores",
        category: "inquiry",
        description: "Quando o cliente pergunta o valor antes de informar as idades ou a quantidade de vidas.",
        triggerCondition: "Cliente pergunta 'quanto custa', 'qual o valor', 'tabela de preços'.",
        exampleCustomerInput: "Quanto custa o plano da Amil? Me passa a tabela de preços.",
        recommendedResponse: "Com certeza! Os valores dos planos variam de acordo com a faixa etária e a categoria (Individual, Familiar ou CNPJ). Para eu te passar o valor exato e os melhores descontos, quantas pessoas seriam e qual a idade de cada uma?",
        enabled: true,
        toneOverride: "consultative",
        keywords: ["quanto custa", "qual o valor", "qual o preco", "tabela de preco", "valor", "precos", "orcamento"],
      },
      {
        id: "pb_network_inquiry",
        key: "NETWORK_HOSPITALS_INQUIRY",
        title: "Dúvida sobre Hospitais & Rede Credenciada",
        category: "inquiry",
        description: "Quando o cliente quer saber se determinado hospital, laboratório ou médico atende no plano.",
        triggerCondition: "Cliente cita hospitais, laboratórios ou pergunta sobre rede credenciada.",
        exampleCustomerInput: "Vocês atendem no Hospital São Luiz e laboratório Fleury?",
        recommendedResponse: "Trabalhamos sim com operadoras que atendem os melhores hospitais e laboratórios, como SulAmérica, Bradesco, Amil e Porto Seguro. Em qual cidade ou região você prefere atendimento para eu conferir a rede certinha?",
        enabled: true,
        toneOverride: "consultative",
        keywords: ["hospital", "laboratorio", "rede", "clinica", "atende no", "fleury", "einstein", "sirio", "sao luiz"],
      },
      {
        id: "pb_reengagement_silence",
        key: "REENGAGEMENT_SILENCE",
        title: "Retomada após Silêncio / Reengajamento",
        category: "followup",
        description: "Quando o cliente já conversou anteriormente e voltou a responder após horas ou dias.",
        triggerCondition: "Mensagem recebida em conversa que estava parada com dados parciais coletados.",
        exampleCustomerInput: "Oi, desculpa a demora, tive um imprevisto.",
        recommendedResponse: "Oi, {cliente_nome}! Sem problemas nenhum, imagino a correria! Estávamos falando sobre as opções de planos para você. Quer que eu retome de onde paramos?",
        enabled: true,
        toneOverride: "friendly",
        keywords: ["desculpa a demora", "oi voltei", "estava ocupado", "pode falar agora", "voltei"],
      },
      {
        id: "pb_human_handoff",
        key: "HUMAN_HANDOFF_REQUEST",
        title: "Solicitação de Atendente Humano / Corretor",
        category: "handoff",
        description: "Quando o cliente pede para falar com um humano, corretor ou especialista.",
        triggerCondition: "Detecção de pedido de corretor, humano, telefone ou dúvidas complexas.",
        exampleCustomerInput: "Quero falar com uma pessoa de verdade, não com robô.",
        recommendedResponse: "Perfeito, {cliente_nome}! Vou te conectar agora mesmo com um dos nossos corretores especialistas da equipe para tirar todas as suas dúvidas. Só um minutinho! {humanHandoffTag}",
        enabled: true,
        toneOverride: "friendly",
        keywords: ["humano", "pessoa", "corretor", "atendente", "falar com alguem", "robo", "ligar"],
      },
      {
        id: "pb_out_of_hours",
        key: "OUT_OF_HOURS_CONTACT",
        title: "Contato Fora do Horário Comercial",
        category: "timing",
        description: "Mensagem recebida à noite, madrugada ou finais de semana fora da janela de atendimento.",
        triggerCondition: "Mensagem fora da janela configurada de horário comercial.",
        exampleCustomerInput: "Boa noite, estou pesquisando planos agora.",
        recommendedResponse: "Olá! Recebemos sua mensagem. Nosso horário de atendimento com corretores é de segunda a sexta, das 08h às 18h. Já anotei seu interesse e logo no início do expediente nossa equipe vai te chamar com as tabelas completas!",
        enabled: true,
        toneOverride: "friendly",
        keywords: ["fora do horario", "madrugada", "domingo", "feriado"],
      },
      {
        id: "pb_adaptive_memory",
        key: "ADAPTIVE_CONTEXTUAL_REPLY",
        title: "Resposta Adaptativa com Memória (Sem Perguntas Repetidas)",
        category: "custom",
        description: "Garante que a IA aproveite dados já informados na frase anterior sem re-perguntar.",
        triggerCondition: "Cliente já mencionou nome, idades, empresa ou vidas na mesma mensagem.",
        exampleCustomerInput: "Meu nome é Carlos, preciso de plano pra mim (38 anos) e meu filho (10 anos), moramos em Campinas.",
        recommendedResponse: "Prazer, Carlos! Já anotei: plano para você (38 anos) e seu filho (10 anos) em Campinas. Você tem preferência por alguma operadora específica como Amil ou Bradesco, ou gostaria de ver as opções mais em conta da região?",
        enabled: true,
        toneOverride: "consultative",
        keywords: ["meu nome e", "anos", "moro em", "filho", "esposa", "empresa", "cnpj"],
      },
    ],
  },
  strategies: [
    { key: "SITUATIONAL_PROMPT_INJECTION", technicalLabel: "Injeção Dinâmica de Roteiros Situacionais no Prompt" },
    { key: "EXACT_TEMPLATE_FALLBACK", technicalLabel: "Uso Direto de Template Polido em Casos Específicos" },
  ],
  properties: {
    enabled: {
      key: "enabled",
      resolutionStrategy: "NEAREST_OVERRIDE_WINS",
      overrideAllowedAt: ["TENANT"],
    },
    defaultTone: {
      key: "defaultTone",
      resolutionStrategy: "NEAREST_OVERRIDE_WINS",
      overrideAllowedAt: ["TENANT", "UNIT"],
    },
    allowAiAdaptation: {
      key: "allowAiAdaptation",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
    },
    autoGreetingEnabled: {
      key: "autoGreetingEnabled",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
    },
    humanHandoffTag: {
      key: "humanHandoffTag",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
    },
    supportedVariables: {
      key: "supportedVariables",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
    },
    playbooks: {
      key: "playbooks",
      resolutionStrategy: "MERGE",
      overrideAllowedAt: ["TENANT"],
    },
  },
  invariants: [
    {
      name: "ESSENTIAL_SITUATIONS_EXIST",
      description: "As situações essenciais (Primeiro Contato, Dúvida de Preço e Handoff Humano) devem estar presentes.",
      check: (config) => {
        const keys = config.playbooks.map((p) => p.key);
        const hasOrganic = keys.includes("ORGANIC_INBOUND_WHATSAPP");
        const hasPrice = keys.includes("PRICE_QUOTE_DIRECT_INQUIRY");
        const hasHandoff = keys.includes("HUMAN_HANDOFF_REQUEST");
        return {
          valid: hasOrganic && hasPrice && hasHandoff,
          reason: "As situações ORGANIC_INBOUND_WHATSAPP, PRICE_QUOTE_DIRECT_INQUIRY e HUMAN_HANDOFF_REQUEST são obrigatórias.",
        };
      },
    },
  ],
});
