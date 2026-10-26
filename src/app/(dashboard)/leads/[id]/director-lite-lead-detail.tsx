/**
 * Perfil do lead no visual Lite do diretor (chave ligada e /leads/[id] fora do opt-out). Mesmos dados, mesmas ações e
 * as mesmas peças da tela atual (status, supervisão, IA, documentos, histórico, tarefas), que chegam prontas da página
 * como `slots`: aqui só muda a moldura. Cabeçalho com nome e etapa, ações de 44px numa linha própria, abas do atendimento
 * e, ao lado, os dados do lead. Sem título repetido: "Perfil do lead" fica no topo da moldura.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Lock, Mail, MessageCircle, Phone, Share2, UserPlus } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { liteStageLabel } from "../lite-stage-labels";
import styles from "./director-lite-lead-detail.module.css";

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
const shortDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export type DirectorLiteLeadDetailProps = {
  lead: {
    id: string;
    nome: string;
    telefone: string;
    email: string | null;
    status: string;
    tipo: string;
    origem: string;
    sourceCampaign: string | null;
    sourceAd: string | null;
    sourceForm: string | null;
    sourceChannel: string | null;
    sourceMetadata: unknown;
    capturedAt: Date | null;
    createdAt: Date;
    metaCampaignId: string | null;
    metaAdId: string | null;
    metaFormId: string | null;
    branchNome: string | null;
    corretorNome: string | null;
    motivoPerda: string | null;
    lossCategory: string | null;
  };
  meta: {
    campaignName: string | null;
    adName: string | null;
    formName: string | null;
    entry: string | null;
    adsLabel: string | null;
    tipoCnpj: string | null;
    tipoPlano: string | null;
    tipoPlanoStatus: string | null;
    operadora: string | null;
    productLabel: string;
  };
  qualification: Partial<{
    numberOfLives: string | null;
    qtdVidas: string | null;
    averageAge: string | null;
    individualAges: string | null;
    cidade: string | null;
    neighborhood: string | null;
    currentPlan: string | null;
    resumoAtendimento: string | null;
    resumoNecessidade: string | null;
    urgenciaContratacao: string | null;
    beneficiaries: Array<{ age: number | null; relation: string | null; text: string | null }>;
    beneficiaryRaw: string | null;
  }>;
  formData: Record<string, string | null>;
  canSeePersonalData: boolean;
  shouldMask: boolean;
  maskedPhone: string;
  maskedEmail: string;
  stageRank: number;
  defaultTab: string;
  documentsCount: number;
  openTasksCount: number;
  canAccessConversas: boolean;
  sla: { urgent: boolean; label: string };
  slots: {
    /** Ações do topo, na ordem de hoje (qualificar, excluir, marcar atendimento, status). */
    actions: ReactNode;
    nextBestAction: ReactNode;
    supervision: ReactNode;
    insight: ReactNode;
    startQualification: ReactNode;
    person: ReactNode;
    beneficiaries: ReactNode;
    chat: ReactNode;
    documents: ReactNode;
    timeline: ReactNode;
    tasks: ReactNode;
  };
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Section({ title, description, children, tone }: { title: string; description?: string; children: ReactNode; tone?: "danger" }) {
  return (
    <section className={styles.card} data-tone={tone}>
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {description ? <p className={styles.cardDescription}>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function DirectorLiteLeadDetail(props: DirectorLiteLeadDetailProps) {
  const { lead, meta, qualification, formData, canSeePersonalData, shouldMask, maskedPhone, maskedEmail, stageRank, slots } = props;
  const origin = lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook");
  const phone = canSeePersonalData
    ? <a className={styles.link} href={`tel:${lead.telefone.replace(/\D/g, "")}`}>{lead.telefone}</a>
    : maskedPhone;
  const email = canSeePersonalData && lead.email
    ? <a className={styles.link} href={`mailto:${lead.email}`}>{lead.email}</a>
    : canSeePersonalData ? "Não informado" : maskedEmail;
  const lossTitle = lead.lossCategory === "unattended_sla"
    ? "Perda por falta de atendimento (SLA expirado)"
    : lead.lossCategory === "response_delay"
      ? "Perda por demora de resposta"
      : "Lead encerrado sem venda";
  const lossBadge = lead.lossCategory === "unattended_sla" ? "Estouro de SLA" : lead.lossCategory === "response_delay" ? "Atraso no atendimento" : "Lead perdido";
  const showMeta = lead.origem === "webhook" || Boolean(lead.sourceCampaign) || Boolean(lead.metaCampaignId);
  const beneficiaryNames: Record<string, string> = { titular: "você", conjuge: "cônjuge", filho: "filho", pai_mae: "pai/mãe", neto: "neto", outro: "outra pessoa" };
  const beneficiaryEntries = qualification.beneficiaries ?? [];
  const beneficiaryAges = beneficiaryEntries.map((beneficiary) => beneficiary.age).filter((age): age is number => age !== null);
  const agesText = qualification.individualAges ?? beneficiaryAges.join(" e ");
  const ageList = agesText.match(/\b\d{1,3}\b/g) ?? [];
  const fullyMappedGroup = ageList.length > 1 && beneficiaryEntries.length === ageList.length
    && beneficiaryEntries.every((beneficiary, index) => beneficiary.age === Number(ageList[index]) && beneficiary.relation !== null);
  const peopleOnPlan = fullyMappedGroup
    ? beneficiaryEntries.map((beneficiary) => {
      const age = beneficiary.age === null ? "" : ` (${beneficiary.age})`;
      const relation = beneficiary.relation === "outro" ? beneficiary.text || beneficiaryNames.outro : beneficiaryNames[beneficiary.relation!];
      return `${relation}${age}`;
    }).join(", ")
    : ageList.length > 1 ? `${ageList.join(" e ")} (parentesco não informado)` : null;

  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      {/* Identidade e ações: nome e etapa, contato numa linha, ações de 44px à direita (embaixo no celular). */}
      <section className={styles.identity} aria-labelledby="lead-nome" data-onboarding="lead-profile">
        <div className={styles.identityMain}>
          <div className={styles.nameRow}>
            <h2 id="lead-nome" className={styles.name} data-masked={shouldMask ? "true" : undefined}>{lead.nome}</h2>
            <span className={styles.badge} data-tone={lead.status === "lost" ? "danger" : lead.status === "converted" ? "success" : "neutral"}>{liteStageLabel(lead.status)}</span>
          </div>
          <p className={styles.metaLine}>
            <span>Criado em {longDate.format(lead.createdAt)}</span>
            <span>Unidade {lead.branchNome ?? "Geral / Matriz"}</span>
          </p>
          <ul className={styles.contact} aria-label="Contato e origem">
            <li><Phone aria-hidden="true" size={16} /><span className={shouldMask ? styles.masked : undefined}>{phone}</span></li>
            <li><Mail aria-hidden="true" size={16} /><span className={shouldMask ? styles.masked : undefined}>{email}</span></li>
            <li><Building2 aria-hidden="true" size={16} /><span>{origin}</span></li>
            <li><UserPlus aria-hidden="true" size={16} /><span>{lead.corretorNome ?? "Aguardando distribuição"}</span></li>
          </ul>
        </div>
        <div id="lead-actions" className={styles.actions}>
          <span className={styles.badge} data-tone={props.sla.urgent ? "warning" : "neutral"}>{props.sla.label}</span>
          {props.canAccessConversas ? (
            <Link className={styles.actionLink} href={`/conversas?leadId=${lead.id}&draft=broker_intro`}>
              <MessageCircle aria-hidden="true" size={16} />
              Conversas
            </Link>
          ) : null}
          {slots.actions}
        </div>
      </section>

      {lead.status === "lost" || lead.lossCategory ? (
        <section className={styles.card} data-tone="danger" aria-labelledby="lead-perda">
          <div className={styles.lossHead}>
            <span className={styles.badge} data-tone="danger">{lossBadge}</span>
            <h3 id="lead-perda" className={styles.cardTitle}>{lossTitle}</h3>
          </div>
          <p className={styles.cardDescription}>{lead.motivoPerda ? `Motivo: ${lead.motivoPerda}` : "Atendimento não iniciado a tempo ou sem resposta oportuna ao cliente."}</p>
        </section>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {slots.nextBestAction}
          <Tabs defaultValue={props.defaultTab} className={styles.tabs}>
            <TabsList aria-label="Etapas do atendimento" id="tabs-lead-page" className={styles.tabList}>
              <TabsTrigger value="service">Atendimento</TabsTrigger>
              <TabsTrigger value="documents" disabled={stageRank < 5} title={stageRank < 5 ? "Libera quando o lead chega em documentação pendente" : undefined}>
                {stageRank < 5 ? <Lock aria-hidden="true" size={14} /> : null}
                Documentos{props.documentsCount > 0 ? ` (${props.documentsCount})` : ""}
              </TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="tasks">Tarefas ({props.openTasksCount})</TabsTrigger>
            </TabsList>

            <TabsContent value="service" className={styles.tabPanel}>
              {slots.supervision}
              {slots.insight}
              <Section title="Qualificação por agente de IA" description="Ideal para leads antigos ou importados. Dispara o template oficial de qualificação no WhatsApp.">
                <div className={styles.cardAction}>{slots.startQualification}</div>
              </Section>

              {qualification.numberOfLives || qualification.averageAge || qualification.individualAges ? (
                <Section title="Dados da qualificação" description="Coletados pelo agente, separados entre atendimento individual e empresarial.">
                  <dl className={styles.fields}>
                    <Field label="Vidas">{qualification.numberOfLives ?? "Não informado"}</Field>
                    {lead.tipo === "PME"
                      ? <Field label="Média de idade do grupo">{qualification.averageAge ? `${qualification.averageAge} anos` : "Não informada"}</Field>
                      : <Field label={fullyMappedGroup ? "Pessoas no plano" : "Idades informadas"}>{peopleOnPlan ?? (agesText || "Não informadas")}</Field>}
                    {qualification.beneficiaryRaw ? <Field label="Resposta sobre parentesco">{qualification.beneficiaryRaw}</Field> : null}
                    <Field label="Tipo de atendimento">{meta.tipoPlanoStatus === "not_provided" ? "Não informado" : lead.tipo === "PME" ? "Empresa / PME" : lead.tipo === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</Field>
                    {qualification.neighborhood ? <Field label="Bairro">{qualification.neighborhood}</Field> : null}
                    {qualification.currentPlan ? <Field label="Plano atual">{qualification.currentPlan}</Field> : null}
                  </dl>
                </Section>
              ) : null}

              {lead.tipo === "PF" && (formData.dependentes || formData.mediaIdades) ? (
                <Section title="Dados informados no cadastro" description="Informações adicionais coletadas na criação do lead.">
                  <dl className={styles.fields}>
                    {formData.dependentes ? <Field label="Dependentes">{formData.dependentes}</Field> : null}
                    {formData.mediaIdades ? <Field label="Média de idades">{formData.mediaIdades} anos</Field> : null}
                  </dl>
                </Section>
              ) : null}

              {lead.tipo === "PME" && (formData.razaoSocial || formData.cnpj || formData.funcionarios) ? (
                <Section title="Dados da empresa (PME)" description="Informações da pessoa jurídica contratante.">
                  <dl className={styles.fields}>
                    {formData.razaoSocial ? <Field label="Razão social">{formData.razaoSocial}</Field> : null}
                    {formData.cnpj ? <Field label="CNPJ">{formData.cnpj}</Field> : null}
                    {formData.funcionarios ? <Field label="Funcionários">{formData.funcionarios}</Field> : null}
                  </dl>
                </Section>
              ) : null}

              {showMeta ? (
                <Section title="Origem Meta Ads" description="Do anúncio até este lead.">
                  <dl className={styles.fields}>
                    <Field label="Origem">Meta Ads (Lead Ads / Click to WhatsApp)</Field>
                    <Field label="Campanha">{meta.campaignName || lead.sourceCampaign || lead.metaCampaignId || "Campanha Meta"}{lead.metaCampaignId && meta.campaignName ? <span className={styles.idLine}>ID {lead.metaCampaignId}</span> : null}</Field>
                    <Field label="Anúncio">{meta.adName || lead.sourceAd || lead.metaAdId || "Anúncio padrão"}{lead.metaAdId && meta.adName ? <span className={styles.idLine}>ID {lead.metaAdId}</span> : null}</Field>
                    {meta.entry === "whatsapp"
                      ? <Field label="Entrada">WhatsApp (anúncio){meta.adsLabel ? `: ${meta.adsLabel}` : ""}</Field>
                      : <Field label="Formulário">{meta.formName || lead.sourceForm || lead.metaFormId || "Formulário direto"}{lead.metaFormId && meta.formName ? <span className={styles.idLine}>ID {lead.metaFormId}</span> : null}</Field>}
                    {meta.tipoCnpj ? <Field label="Tipo de CNPJ">{meta.tipoCnpj}</Field> : null}
                    {meta.tipoPlano ? <Field label="Plano / produto">{meta.tipoPlano}</Field> : meta.tipoPlanoStatus === "not_provided" ? <Field label="Plano / produto">{meta.productLabel}</Field> : null}
                    {meta.operadora ? <Field label="Operadora">{meta.operadora}</Field> : null}
                    <Field label="Data de captura"><span className={styles.numeric}>{shortDateTime.format(lead.capturedAt ?? lead.createdAt)}</span></Field>
                  </dl>
                </Section>
              ) : null}

              <div className={styles.pair}>
                {slots.person}
                {slots.beneficiaries}
              </div>

              {slots.chat}
            </TabsContent>

            <TabsContent value="documents" className={styles.tabPanel}>
              <Section title="Documentação do atendimento" description="Anexe documentos opcionais por titular ou beneficiário. A aprovação segue na fila central de Documentos.">
                <div id="documentos">{slots.documents}</div>
              </Section>
            </TabsContent>

            <TabsContent value="history" className={styles.tabPanel} data-onboarding="lead-timeline">
              {slots.timeline}
            </TabsContent>

            <TabsContent value="tasks" className={styles.tabPanel} id="tarefas" data-onboarding="create-follow-up">
              {slots.tasks}
            </TabsContent>
          </Tabs>
        </div>

        {/* Dados do lead: sempre à vista ao lado no desktop; no celular, logo abaixo das abas. */}
        <aside className={styles.aside} aria-labelledby="lead-dados">
          <section className={styles.card}>
            <header className={styles.cardHead}>
              <h3 id="lead-dados" className={styles.cardTitle}>Dados do lead</h3>
              <p className={styles.cardDescription}>Sempre à vista durante o atendimento.</p>
            </header>
            <dl className={styles.asideFields}>
              <Field label="Telefone"><span className={shouldMask ? styles.masked : undefined}>{phone}</span></Field>
              <Field label="E-mail"><span className={shouldMask ? styles.masked : undefined}>{email}</span></Field>
              <Field label="Origem"><span className={styles.withIcon}><Share2 aria-hidden="true" size={14} />{origin}</span></Field>
              <Field label="Unidade">{lead.branchNome ?? "Geral / Matriz"}</Field>
              <Field label="Responsável">{lead.corretorNome ?? "Aguardando distribuição"}</Field>
            </dl>
            {lead.motivoPerda ? (
              <div className={styles.note} data-tone="danger">
                <p className={styles.noteTitle}>Motivo da perda</p>
                <p>{lead.motivoPerda}</p>
              </div>
            ) : null}
            {!canSeePersonalData ? (
              <p className={styles.note} data-tone="warning">O telefone e o e-mail serão liberados quando você iniciar o atendimento.</p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
