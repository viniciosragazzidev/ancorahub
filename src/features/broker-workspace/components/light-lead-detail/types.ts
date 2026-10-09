

export type ConfirmationDocument = { id: string; filename: string; status: string };
export type CarrierOption = { id: string; name: string };

export type LiteRequirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  appliesPerBeneficiary: boolean;
};

export type LightLeadDetailData = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string;
  qualificationStatus?: string | null;
  qualificationState?: string | null;
  corretorId?: string | null;
  corretorNome?: string | null;
  branchName?: string | null;
  planName?: string | null;
  carrierName?: string | null;
  livesCount?: number | null;
  city?: string | null;
  urgency?: string | null;
  summary?: string | null;
  createdAt: Date | string;
  assignedAt?: Date | string | null;
  slaFirstContactMinutes?: number;
  isCurrentBroker: boolean;
  tipo?: string | null;
  origem?: string | null;
  sourceCampaign?: string | null;
  tipoCnpj?: string | null;
  beneficiaries?: Array<{
    id: string;
    name: string;
    birthDate: string;
    relationship: string;
    isHolder: boolean;
  }>;
  formData?: Record<string, string | null> | null;
  consentimentoLgpd?: boolean;
  aiIntelligence?: any;
  aiPolicyResult?: any;
  redistributionNotice?: { reason: string | null; createdAt: Date | string } | null;
  /** Everything the client told us (AI qualification + form), see buildLeadClientInfo. */
  clientInfo?: Array<{ key: string; label: string; value: string }>;
};

export const DECLINE_REASONS = [
  "Estou sem disponibilidade",
  "Estou com muitos atendimentos",
  "Lead fora do meu perfil",
  "Não consigo atender agora",
  "Outro",
];

export const STEP_OPTIONS = [
  {
    id: "quote_sent",
    label: "Cotação enviada",
    description: "Cotação enviada para o cliente",
    targetStatus: "quote_sent",
  },
  {
    id: "negotiation",
    label: "Em negociação",
    description: "Negociando condições da proposta",
    targetStatus: "negotiation",
  },
  {
    id: "no_contact",
    label: "Não consegui contato",
    description: "Sem retorno após tentativas",
    targetStatus: "lost",
  },
  {
    id: "no_interest",
    label: "Sem interesse",
    description: "Cliente optou por não seguir",
    targetStatus: "lost",
  },
];
