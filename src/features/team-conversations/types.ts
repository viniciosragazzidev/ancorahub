export type TeamConversationSummary = {
  leadId: string;
  leadName: string;
  brokerId: string | null;
  brokerName: string | null;
  lastBody: string;
  lastAt: string;
  lastFromClient: boolean;
  lastByAi: boolean;
  messages: number;
};

export type TeamConversationMessage = {
  id: string;
  body: string;
  at: string;
  fromClient: boolean;
  byAi: boolean;
  mediaKind: string | null;
};

export type TeamConversationDetail = {
  leadId: string;
  leadName: string;
  brokerName: string | null;
  messages: TeamConversationMessage[];
};
