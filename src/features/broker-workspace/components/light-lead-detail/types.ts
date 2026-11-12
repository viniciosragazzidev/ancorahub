import type { AiAutoMove } from "@/features/conversation-intelligence/ai-move";
import type { BrokerAdContext } from "@/features/leads/broker-ad-context";

export type ConfirmationDocument = {
  id: string;
  filename: string;
  status: string;
  category?: string | null;
  requirementId?: string | null;
  requirementName?: string | null;
  beneficiaryId?: string | null;
};
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
  /** First WhatsApp message of the broker, with the broker's and the brokerage's names (29/10). */
  brokerGreeting?: string | null;
  branchName?: string | null;
  planName?: string | null;
  carrierName?: string | null;
  livesCount?: number | null;
  hasActiveSale?: boolean;
  monthlyValue?: string | null;
  commercialValueSource?: "sale" | "proposal" | "lead" | null;
  city?: string | null;
  urgency?: string | null;
  summary?: string | null;
  createdAt: Date | string;
  assignedAt?: Date | string | null;
  /** The plantão that handed the lead out (its name, as the broker knows it). */
  dutyName?: string | null;
  slaFirstContactMinutes?: number;
  isCurrentBroker: boolean;
  tipo?: string | null;
  origem?: string | null;
  sourceCampaign?: string | null;
  /** "De onde veio" (10/11): plano anunciado e o que o cliente viu no anúncio, nunca o nome da campanha. */
  adContext?: BrokerAdContext | null;
  tipoCnpj?: string | null;
  beneficiaries?: Array<{
    id: string;
    name: string;
    birthDate: string | null;
    age?: number | null;
    cpf?: string | null;
    hasCpf?: boolean;
    relationship: string;
    isHolder: boolean;
  }>;
  formData?: Record<string, string | null> | null;
  consentimentoLgpd?: boolean;
  aiIntelligence?: any;
  /** Venda vista pela IA (10/11): registrar (já convertido), confirmar (sugestão) ou conferir (trecho não achado). */
  aiSalePrompt?: "register" | "confirm" | "check" | null;
  aiPolicyResult?: any;
  aiLastAutoMove?: AiAutoMove | null;
  redistributionNotice?: { reason: string | null; createdAt: Date | string } | null;
  /** Everything the client told us (AI qualification + form), see buildLeadClientInfo. */
  clientInfo?: Array<{ key: string; label: string; value: string }>;
  /** Desfecho do fechamento (09/11): lead parado em Documentação ou Em análise há mais de 10 dias. */
  closingOutcome?: { pending: boolean; daysInClosing: number; heldUntil: string | null } | null;
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
