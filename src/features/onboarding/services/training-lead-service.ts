import "server-only";

import { randomUUID } from "node:crypto";
import type { TenantContext } from "@/shared/auth/tenant-context";

export type TrainingLead = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  origem: string;
  qualificationStatus: string;
  isTrainingData: true;
};

export async function getOrCreateTrainingLead(context: TenantContext): Promise<TrainingLead> {
  return {
    id: "training-lead-maria-exemplo",
    nome: "Lead de Treinamento - Maria Exemplo",
    telefone: "+5511988887777",
    email: "maria.treinamento@exemplo.com.br",
    origem: "Treinamento Guiado",
    qualificationStatus: "pending",
    isTrainingData: true,
  };
}
