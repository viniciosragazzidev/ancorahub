/**
 * Perfil do lead Lite com peças reais e dados de exemplo, para as rotas de desenvolvimento (/dev/diretor-lead-real e a
 * moldura real em /dev/diretor-shell-real). Não existe em produção.
 */
import { DirectorLiteLeadDetail } from "@/app/(dashboard)/leads/[id]/director-lite-lead-detail";
import { SupervisionPanel } from "@/app/(dashboard)/leads/[id]/supervision-panel";
import { DeleteLeadControl } from "@/app/(dashboard)/leads/[id]/delete-lead-control";
import { BeneficiariesSection } from "@/app/(dashboard)/leads/[id]/beneficiaries-section";
import { StartQualificationButton } from "@/app/(dashboard)/leads/_components/qualifying-lead-actions";
import { AiConversationInsightCard } from "@/features/conversation-intelligence/components/ai-conversation-insight-card";
import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";
import { LeadDocumentsSection } from "@/features/documents/components/lead-documents-section";
import { LeadChat } from "@/features/leads/components/lead-chat";
import { LeadStatusSelector } from "@/features/leads/components/lead-status-selector";
import { LeadTasks } from "@/features/leads/components/lead-tasks";
import { LeadTimeline } from "@/features/leads/components/lead-timeline";
import { NextBestActionCard, resolveLeadNextBestAction } from "@/features/next-best-action";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const createdAt = new Date("2026-10-24T12:00:00.000Z");
const tasks = [
  { id: "task-1", title: "Ligar para a cliente", description: null, priority: "urgent" as const, dueAt: new Date("2026-10-25T13:00:00.000Z"), completedAt: null, createdAt: new Date("2026-10-24T12:30:00.000Z"), assignedTo: "broker-1", assigneeName: "Ana Souza" },
];
const interactions = [
  { id: "i1", tipo: "status_change" as const, conteudo: "Status alterado para Em atendimento", userName: "Ana Souza", createdAt: new Date("2026-10-24T12:20:00.000Z") },
  { id: "i2", tipo: "note" as const, conteudo: "Cliente pediu cotação para 4 vidas, com coparticipação.", userName: "Ana Souza", createdAt: new Date("2026-10-24T12:40:00.000Z") },
];
const brokers = [{ id: "broker-1", name: "Ana Souza" }, { id: "broker-2", name: "Bruno Lima" }];
const formData = { dependentes: null, mediaIdades: null, razaoSocial: "Padaria Nova Ltda", cnpj: "12.345.678/0001-90", funcionarios: "8" };

export function LeadDetailFixture() {
  const action = resolveLeadNextBestAction({
    id: LEAD_ID, name: "Maria Nova", status: "in_contact", qualificationStatus: null, score: null, phone: "21 90000-0101", hasSlaBreach: false,
    documentsPendingCount: 0, documentsApprovedCount: 0, totalDocumentsRequired: 0, hasCompletedSale: false, firstContactCompleted: true,
  }, "director", "director");
  return (
    <DirectorLiteLeadDetail
      lead={{
        id: LEAD_ID, nome: "Maria Nova", telefone: "21 90000-0101", email: "maria@exemplo.com", status: "in_contact", tipo: "PME",
        origem: "webhook", sourceCampaign: "Campanha PME", sourceAd: null, sourceForm: null, sourceChannel: null, sourceMetadata: null,
        capturedAt: new Date("2026-10-24T11:58:00.000Z"), createdAt, metaCampaignId: null, metaAdId: null, metaFormId: null,
        branchNome: "Centro", corretorNome: "Ana Souza", motivoPerda: null, lossCategory: null,
      }}
      meta={{ campaignName: null, adName: null, formName: null, entry: null, adsLabel: null, tipoCnpj: "MEI", tipoPlano: "Empresarial", tipoPlanoStatus: null, operadora: null, productLabel: "Empresarial" }}
      qualification={{ numberOfLives: "4", averageAge: "34", individualAges: null, neighborhood: "Centro", currentPlan: null }}
      formData={formData}
      canSeePersonalData
      shouldMask={false}
      maskedPhone="(21) •••••-0101"
      maskedEmail="m••••@exemplo.com"
      stageRank={2}
      defaultTab="service"
      documentsCount={0}
      openTasksCount={1}
      canAccessConversas
      sla={{ urgent: false, label: "SLA em acompanhamento" }}
      slots={{
        actions: (
          <>
            <DeleteLeadControl leadId={LEAD_ID} leadName="Maria Nova" />
            <LeadStatusSelector leadId={LEAD_ID} currentStatus="in_contact" role="director" isOwner={false} isSameBranch qualificationDetails={null} documents={[]} carriers={[]} />
          </>
        ),
        nextBestAction: <NextBestActionCard action={action} />,
        supervision: (
          <SupervisionPanel
            leadId={LEAD_ID} currentStatus="in_contact" currentOwner="Ana Souza" currentOwnerId="broker-1"
            assignedAt={new Date("2026-10-24T12:05:00.000Z")} stageEnteredAt={new Date("2026-10-24T12:20:00.000Z")} serviceStartedAt={new Date("2026-10-24T12:20:00.000Z")}
            brokers={brokers} slaFirstContactMinutes={15} tasks={tasks} isLost={false} currentUserId="director-1"
          />
        ),
        insight: <AiConversationInsightCard leadId={LEAD_ID} leadStatus="in_contact" canManage />,
        startQualification: <StartQualificationButton leadId={LEAD_ID} leadName="Maria Nova" variant="default" size="sm" />,
        person: <PersonRecordDetails kind="lead" hideRegistrationDate={false} createdAt={createdAt} consentimentoLgpd dependents={[]} documentCount={0} formData={formData} />,
        beneficiaries: <BeneficiariesSection leadId={LEAD_ID} contactName="Maria Nova" initialBeneficiaries={[]} />,
        chat: <LeadChat leadId={LEAD_ID} phone="21 90000-0101" />,
        documents: <LeadDocumentsSection leadId={LEAD_ID} requirements={[]} documents={[]} checklist={[]} beneficiaries={[]} />,
        timeline: <LeadTimeline leadId={LEAD_ID} interactions={interactions} />,
        tasks: <LeadTasks assignees={brokers} leadId={LEAD_ID} tasks={tasks.map((task) => ({ ...task, dueAt: task.dueAt.toISOString(), completedAt: null, createdAt: task.createdAt }))} />,
      }}
    />
  );
}
