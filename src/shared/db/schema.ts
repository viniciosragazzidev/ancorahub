import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

export const tenantStatusValues = ["active", "inactive", "delinquent"] as const;
export const branchStatusValues = ["active", "inactive"] as const;
export const membershipStatusValues = ["active", "inactive"] as const;
export const availabilityStatusValues = ["available", "paused", "offline"] as const;
export const tenantRoleValues = ["director", "manager", "supervisor", "broker"] as const;
export const customRoleStatusValues = ["draft", "active", "archived"] as const;
export const customRoleScopeValues = ["none", "own", "branch", "tenant"] as const;
export const teamJobTitleValues = ["director", "manager", "supervisor", "broker", "marketing", "finance", "operations", "support"] as const;
export const userStatusValues = ["pending", "active", "disabled"] as const;
export const leadStatusValues = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "converted", "lost"] as const;
export const leadOriginValues = ["manual", "webhook"] as const;
export const leadDistributionStatusValues = ["unassigned", "awaiting_unit", "queued", "assigning", "assigned", "distribution_failed", "returned_to_queue"] as const;
export const leadDistributionOriginValues = ["parent", "unit"] as const;
export const assignmentSourceValues = ["manual_director", "manual_manager", "automatic", "duty_schedule", "redistribution", "system_recovery"] as const;
export const leadInteractionTypeValues = [
  "status_change",
  "note",
  "system_alert",
  "document_upload",
  "document_review",
  "quote_generated",
  "whatsapp_msg",
  "service_started",
] as const;
export const webhookCredentialStatusValues = ["active", "revoked"] as const;
export const webhookDeliveryStatusValues = ["received", "processed", "rejected", "failed"] as const;

export const tenantStatus = pgEnum("tenant_status", tenantStatusValues);
export const branchStatus = pgEnum("branch_status", branchStatusValues);
export const membershipStatus = pgEnum(
  "membership_status",
  membershipStatusValues,
);
export const availabilityStatus = pgEnum("availability_status", availabilityStatusValues);
export const tenantRole = pgEnum("tenant_role", tenantRoleValues);
export const customRoleStatus = pgEnum("custom_role_status", customRoleStatusValues);
export const customRoleScope = pgEnum("custom_role_scope", customRoleScopeValues);
export const userStatus = pgEnum("user_status", userStatusValues);
export const leadStatus = pgEnum("lead_status", leadStatusValues);
export const leadOrigin = pgEnum("lead_origin", leadOriginValues);
export const leadInteractionType = pgEnum("lead_interaction_type", leadInteractionTypeValues);
export const webhookCredentialStatus = pgEnum("webhook_credential_status", webhookCredentialStatusValues);
export const webhookDeliveryStatus = pgEnum("webhook_delivery_status", webhookDeliveryStatusValues);
export const marketingImportStatusValues = ["uploading", "processing", "completed", "failed"] as const;
export const marketingImportStatus = pgEnum("marketing_import_status", marketingImportStatusValues);
export const marketingImportResultStatusValues = ["created", "duplicate", "invalid"] as const;
export const marketingImportResultStatus = pgEnum("marketing_import_result_status", marketingImportResultStatusValues);

export const quoteStatusValues = ["draft", "shared", "sent", "accepted", "expired"] as const;
export const quoteStatus = pgEnum("quote_status", quoteStatusValues);
export const catalogStatusValues = ["draft", "published", "archived"] as const;
export const catalogStatus = pgEnum("catalog_status", catalogStatusValues);
export const catalogImportStatusValues = ["draft", "validating", "ready_for_review", "published", "rejected", "failed"] as const;
export const catalogImportStatus = pgEnum("catalog_import_status", catalogImportStatusValues);
export const catalogSourceValues = ["global", "tenant_private"] as const;
export const catalogSource = pgEnum("catalog_source", catalogSourceValues);
export const beneficiaryRelationshipValues = ["titular", "conjuge", "filho", "outro"] as const;
export const beneficiaryRelationship = pgEnum("beneficiary_relationship", beneficiaryRelationshipValues);
export const taskPriorityValues = ["low", "normal", "urgent"] as const;
export const taskPriority = pgEnum("task_priority", taskPriorityValues);
export const onboardingStatus = pgEnum("onboarding_status", ["PENDING", "COMPLETED"]);

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

// BetterAuth canonical identity tables. Tenant authorization intentionally lives
// in tenantMemberships rather than in this global identity record.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  active: boolean("active").notNull().default(true),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  status: userStatus("status").notNull().default("active"),
  createdAt,
  updatedAt,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt,
    updatedAt,
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const twoFactor = pgTable(
  "twoFactor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => [index("two_factor_user_id_idx").on(table.userId)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull().unique(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull().default(false),
    transports: text("transports"),
    aaguid: text("aaguid"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    uniqueIndex("passkey_credential_id_unique").on(table.credentialID),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  legalName: text("legal_name"),
  cnpj: text("cnpj").unique(),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color"),
  initialSetupCompletedAt: timestamp("initial_setup_completed_at", { withTimezone: true }),
  subscriptionPlan: text("subscription_plan").notNull().default("Essencial"),
  slaFirstContactMinutes: text("sla_first_contact_minutes").notNull().default("15"),
  slaStagnantDays: text("sla_stagnant_days").notNull().default("3"),
  feedbackRequiredEnabled: boolean("feedback_required_enabled").notNull().default(true),
  feedbackGraceMinutes: text("feedback_grace_minutes").notNull().default("5"),
  autoRedistributeOnFeedbackTimeout: boolean("auto_redistribute_on_feedback_timeout").notNull().default(true),
  feedbackReminderIntervalMinutes: text("feedback_reminder_interval_minutes").notNull().default("30"),
  feedbackReminderMaxAttempts: integer("feedback_reminder_max_attempts").notNull().default(5),
  feedbackPushEnabled: boolean("feedback_push_enabled").notNull().default(true),
  feedbackToastEnabled: boolean("feedback_toast_enabled").notNull().default(true),
  maxActiveLeadsLimit: integer("max_active_leads_limit").notNull().default(10),
  status: tenantStatus("status").notNull().default("active"),
  createdAt,
  updatedAt,
});

export const branches = pgTable(
  "branches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    externalId: text("external_id"),
    sourceChannel: text("source_channel").notNull().default("landing_page"),
    sourceCampaign: text("source_campaign"),
    sourceAd: text("source_ad"),
    sourceForm: text("source_form"),
    sourceMetadata: jsonb("source_metadata"),
    status: branchStatus("status").notNull().default("active"),
    acceptingLeads: boolean("accepting_leads").notNull().default(true),
    autoDistribute: boolean("auto_distribute").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("branches_tenant_id_idx").on(table.tenantId),
    unique("branches_id_tenant_id_unique").on(table.id, table.tenantId),
    uniqueIndex("branches_tenant_external_id_unique").on(table.tenantId, table.externalId).where(sql`${table.externalId} IS NOT NULL`),
  ],
);

export const planType = pgEnum("plan_type", ["individual", "empresarial", "familiar", "pme"]);

export const carriers = pgTable(
  "carriers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    ansCode: text("ans_code"),
    contact: text("contact"),
    phone: text("phone"),
    email: text("email"),
    status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
    notes: text("notes"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("carriers_tenant_id_idx").on(table.tenantId),
    uniqueIndex("carriers_tenant_name_unique").on(table.tenantId, table.name),
  ],
);

export const carrierPlans = pgTable(
  "carrier_plans",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    carrierId: text("carrier_id")
      .notNull()
      .references(() => carriers.id),
    name: text("name").notNull(),
    type: planType("type").notNull().default("individual"),
      description: text("description"),
    coverage: text("coverage"),
    ansRegistration: text("ans_registration"),
    maxEntryAge: integer("max_entry_age"),
    details: jsonb("details"),
    active: boolean("active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("carrier_plans_tenant_id_idx").on(table.tenantId),
    index("carrier_plans_carrier_id_idx").on(table.carrierId),
  ],
);

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt,
});

export const leadWebhookCredentials = pgTable(
  "lead_webhook_credentials",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id").references(() => branches.id),
    name: text("name").notNull(),
    source: text("source").notNull().default("webhook"),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    status: webhookCredentialStatus("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_webhook_credentials_tenant_id_idx").on(table.tenantId),
    index("lead_webhook_credentials_branch_id_idx").on(table.branchId),
    index("lead_webhook_credentials_created_by_idx").on(table.createdBy),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    branchId: text("branch_id").references(() => branches.id),
    companyId: text("company_id"),
    corretorId: text("corretor_id").references(() => user.id),
    planId: text("plan_id"),
    nome: text("nome").notNull(),
    telefone: text("telefone").notNull(),
    email: text("email"),
    origem: leadOrigin("origem").notNull().default("manual"),
    tipo: text("tipo").notNull().default("PF"),
    status: leadStatus("status").notNull().default("new"),
    qualificationStatus: text("qualification_status").notNull().default("pending"),
    qualificationState: text("qualification_state").notNull().default("NOT_STARTED"),
    qualificationScore: integer("qualification_score").notNull().default(0),
    qualificationDetails: jsonb("qualification_details").notNull().default({}),
    qualificationProfileKey: text("qualification_profile_key"),
    qualificationCompletedAt: timestamp("qualification_completed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    distributionStatus: text("distribution_status").notNull().default("unassigned"),
    distributionOrigin: text("distribution_origin"),
    queueId: text("queue_id"),
    unitAssignedAt: timestamp("unit_assigned_at", { withTimezone: true }),
    assignmentSource: text("assignment_source"),
    assignmentStrategy: text("assignment_strategy"),
    distributionUpdatedAt: timestamp("distribution_updated_at", { withTimezone: true }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    firstContactAt: timestamp("first_contact_at", { withTimezone: true }),
    serviceStartedAt: timestamp("service_started_at", { withTimezone: true }),
    serviceStartedBy: text("service_started_by").references(() => user.id),
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }).notNull().defaultNow(),
    consentimentoLgpd: boolean("consentimento_lgpd").notNull().default(false),
    formData: jsonb("form_data").notNull().default({}),
    motivoPerda: text("motivo_perda"),
    lossCategory: text("loss_category"),
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
    firstContactLatencySeconds: integer("first_contact_latency_seconds"),
    externalId: text("external_id"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    sourceChannel: text("source_channel").notNull().default("landing_page"),
    sourceCampaign: text("source_campaign"),
    sourceAd: text("source_ad"),
    sourceForm: text("source_form"),
    sourceMetadata: jsonb("source_metadata"),
    webhookCredentialId: text("webhook_credential_id").references(() => leadWebhookCredentials.id, { onDelete: "set null" }),
    metaCampaignId: text("meta_campaign_id"),
    metaAdSetId: text("meta_ad_set_id"),
    metaAdId: text("meta_ad_id"),
    metaFormId: text("meta_form_id"),
    metaPageId: text("meta_page_id"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("leads_tenant_branch_status_idx").on(table.tenantId, table.branchId, table.status),
    index("leads_tenant_distribution_status_idx").on(table.tenantId, table.distributionStatus),
    index("leads_tenant_qualification_state_idx").on(table.tenantId, table.qualificationState),
    index("leads_branch_queue_distribution_idx").on(table.branchId, table.queueId, table.distributionStatus),
    index("leads_corretor_status_idx").on(table.corretorId, table.status),
    index("leads_tenant_company_idx").on(table.tenantId, table.companyId),
    index("leads_webhook_credential_idx").on(table.webhookCredentialId),
    uniqueIndex("leads_credential_external_id_unique").on(table.webhookCredentialId, table.externalId).where(sql`${table.externalId} IS NOT NULL`),
    uniqueIndex("leads_tenant_source_external_id_unique").on(table.tenantId, table.sourceChannel, table.externalId).where(sql`${table.externalId} IS NOT NULL AND ${table.sourceChannel} <> 'landing_page'`),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    cnpj: text("cnpj"),
    employeeCount: integer("employee_count"),
    createdBy: text("created_by").notNull().references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("companies_tenant_branch_idx").on(table.tenantId, table.branchId),
    uniqueIndex("companies_tenant_cnpj_unique").on(table.tenantId, table.cnpj).where(sql`${table.cnpj} IS NOT NULL`),
  ],
);

/** Tenant-scoped switch and policy for the WhatsApp qualification assistant. */
export const aiQualificationConfigs = pgTable(
  "ai_qualification_configs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    assistantName: text("assistant_name").notNull().default("Assistente Âncora Corretora"),
    initialMessage: text("initial_message").notNull(),
    finalMessage: text("final_message").notNull().default("Obrigado! Um corretor continuará seu atendimento em seguida."),
    handoffMessage: text("handoff_message").notNull().default("Vou encaminhar você para um corretor da equipe agora."),
    outOfHoursMessage: text("out_of_hours_message").notNull().default("Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento."),
    absenceMessage: text("absence_message").notNull().default("No momento não há um corretor disponível. Deixaremos seu atendimento na fila."),
    language: text("language").notNull().default("pt-BR"),
    tone: text("tone").notNull().default("friendly"),
    useEmojis: boolean("use_emojis").notNull().default(false),
    formOfAddress: text("form_of_address").notNull().default("voce"),
    maxConversationMinutes: integer("max_conversation_minutes").notNull().default(30),
    maxQuestions: integer("max_questions").notNull().default(6),
    objectives: jsonb("objectives").notNull().default(["understand_need", "route_to_broker"]),
    businessContext: text("business_context"),
    businessHoursStart: text("business_hours_start"),
    businessHoursEnd: text("business_hours_end"),
    businessDays: text("business_days"),
    requiredFields: jsonb("required_fields"),
    customInstructions: text("custom_instructions"),
    pauseMode: text("pause_mode").notNull().default("handoff_active"),
    version: integer("version").notNull().default(1),
    timeoutMinutes: integer("timeout_minutes").notNull().default(30),
    maxRetries: integer("max_retries").notNull().default(2),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("ai_qualification_configs_tenant_unique").on(table.tenantId)],
);

/** Developer and QA authorized test numbers for isolated testing without affecting real metrics. */
export const aiQualificationTestNumbers = pgTable(
  "ai_qualification_test_numbers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    label: text("label").notNull(),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    autoResetMode: text("auto_reset_mode").notNull().default("before_each_session"),
    isolatedFromMetrics: boolean("isolated_from_metrics").notNull().default(true),
    isolatedFromQueues: boolean("isolated_from_queues").notNull().default(true),
    allowTestCommands: boolean("allow_test_commands").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("ai_qualification_test_numbers_tenant_phone_unique").on(table.tenantId, table.phoneNumber),
  ],
);

/** One active qualification state per lead; the JSON payload contains only answers, never secrets. */
export const aiQualificationSessions = pgTable(
  "ai_qualification_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("waiting_customer"),
    currentQuestionKey: text("current_question_key").notNull().default("city"),
    collectedData: jsonb("collected_data").notNull().default({}),
    missingFields: jsonb("missing_fields").notNull().default([]),
    score: integer("score"),
    summary: text("summary"),
    retryCount: integer("retry_count").notNull().default(0),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    failureReason: text("failure_reason"),
    version: integer("version").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("ai_qualification_sessions_tenant_lead_unique").on(table.tenantId, table.leadId),
    index("ai_qualification_sessions_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const agentBehaviorVersions = pgTable(
  "agent_behavior_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: text("status").notNull().default("DRAFT"),
    policy: jsonb("policy").notNull(),
    validation: jsonb("validation").notNull().default({}),
    summary: text("summary"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("agent_behavior_versions_tenant_version_unique").on(table.tenantId, table.versionNumber),
    index("agent_behavior_versions_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const agentTrainingSimulations = pgTable(
  "agent_training_simulations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    behaviorVersionId: text("behavior_version_id").notNull().references(() => agentBehaviorVersions.id, { onDelete: "cascade" }),
    scenarioKey: text("scenario_key").notNull(),
    status: text("status").notNull(),
    result: jsonb("result").notNull().default({}),
    review: text("review"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
  },
  (table) => [index("agent_training_simulations_version_idx").on(table.tenantId, table.behaviorVersionId, table.scenarioKey)],
);

export const leadBeneficiaries = pgTable(
  "lead_beneficiaries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    relationship: beneficiaryRelationship("relationship").notNull().default("outro"),
    isHolder: boolean("is_holder").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_beneficiaries_tenant_lead_idx").on(table.tenantId, table.leadId),
    index("lead_beneficiaries_lead_holder_idx").on(table.leadId, table.isHolder),
  ],
);

export const leadQueues = pgTable(
  "lead_queues",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    assignmentMode: text("assignment_mode").notNull().default("automatic"),
    assignmentStrategy: text("assignment_strategy").notNull().default("capacity"),
    capacityEnabled: boolean("capacity_enabled").notNull().default(false),
    capacityPerBroker: integer("capacity_per_broker"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt,
    updatedAt,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("lead_queues_tenant_branch_idx").on(table.tenantId, table.branchId),
    uniqueIndex("lead_queues_tenant_branch_slug_unique").on(table.tenantId, table.branchId, table.slug),
  ],
);

export const leadDistributionEvents = pgTable(
  "lead_distribution_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    fromBranchId: text("from_branch_id"),
    toBranchId: text("to_branch_id"),
    fromQueueId: text("from_queue_id"),
    toQueueId: text("to_queue_id"),
    previousOwnerId: text("previous_owner_id"),
    newOwnerId: text("new_owner_id"),
    action: text("action").notNull(),
    source: text("source").notNull(),
    strategy: text("strategy"),
    reason: text("reason"),
    actorId: text("actor_id").notNull().references(() => user.id),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt,
  },
  (table) => [index("lead_distribution_events_tenant_lead_idx").on(table.tenantId, table.leadId, table.createdAt)],
);

export const leadDistributionJobs = pgTable(
  "lead_distribution_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("process_queued_lead"),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    idempotencyKey: text("idempotency_key").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_distribution_jobs_due_idx").on(table.status, table.runAfter),
    index("lead_distribution_jobs_tenant_created_idx").on(table.tenantId, table.createdAt),
    uniqueIndex("lead_distribution_jobs_active_unique").on(table.tenantId, table.leadId, table.type).where(sql`${table.status} in ('pending', 'retrying', 'processing')`),
  ],
);

export const leadDistributionSettings = pgTable(
  "lead_distribution_settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    queueId: text("queue_id").references(() => leadQueues.id, { onDelete: "cascade" }),
    automaticRoutingEnabled: boolean("automatic_routing_enabled").notNull().default(true),
    automaticAssignmentEnabled: boolean("automatic_assignment_enabled").notNull().default(true),
    defaultQueueId: text("default_queue_id"),
    fallbackQueueId: text("fallback_queue_id"),
    allowManagerManualAssignment: boolean("allow_manager_manual_assignment").notNull().default(true),
    allowDirectorManualAssignment: boolean("allow_director_manual_assignment").notNull().default(true),
    dutyScheduleEnabled: boolean("duty_schedule_enabled").notNull().default(false),
    active: boolean("active").notNull().default(true),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [index("lead_distribution_settings_tenant_idx").on(table.tenantId, table.branchId, table.queueId)],
);

export const unitDutySchedules = pgTable(
  "unit_duty_schedules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
    queueId: text("queue_id").notNull().references(() => leadQueues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    priority: integer("priority").notNull().default(100),
    minimumBrokers: integer("minimum_brokers").notNull().default(1),
    status: text("status").notNull().default("active"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    webhookCredentialId: text("webhook_credential_id").references(() => leadWebhookCredentials.id, { onDelete: "set null" }),
    createdBy: text("created_by").notNull().references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [index("unit_duty_schedules_tenant_status_idx").on(table.tenantId, table.status, table.dayOfWeek, table.startsAt)],
);

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    branchId: text("branch_id").references(() => branches.id),
    corretorId: text("corretor_id").references(() => user.id),
    nome: text("nome").notNull(),
    telefone: text("telefone").notNull(),
    email: text("email"),
    convertedAt: timestamp("converted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt,
  },
  (table) => [
    uniqueIndex("clients_lead_unique").on(table.leadId),
    index("clients_tenant_idx").on(table.tenantId),
    index("clients_corretor_idx").on(table.corretorId),
  ],
);

export const leadInteractions = pgTable(
  "lead_interactions",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id),
    tipo: leadInteractionType("tipo").notNull(),
    conteudo: text("conteudo").notNull(),
    metadata: jsonb("metadata"),
    createdAt,
  },
  (table) => [index("lead_interactions_lead_created_idx").on(table.leadId, table.createdAt)],
);

export const leadTaskAssignees = pgTable(
  "lead_task_assignees",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => leadTasks.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt,
  },
  (table) => [
    unique("lead_task_assignees_task_user_unique").on(table.taskId, table.userId),
    index("lead_task_assignees_tenant_user_idx").on(table.tenantId, table.userId),
  ],
);

export const leadTasks = pgTable(
  "lead_tasks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    assignedTo: text("assigned_to").references(() => user.id, { onDelete: "set null" }),
    createdBy: text("created_by").notNull().references(() => user.id),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriority("priority").notNull().default("normal"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_tasks_tenant_lead_idx").on(table.tenantId, table.leadId),
    index("lead_tasks_assigned_due_idx").on(table.assignedTo, table.dueAt),
  ],
);

export const quotes = pgTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull().references(() => user.id),
    status: quoteStatus("status").notNull().default("draft"),
    lives: jsonb("lives").notNull().default([]),
    notes: text("notes"),
    publicToken: text("public_token").notNull().unique(),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    leadName: text("lead_name"),
    leadPhone: text("lead_phone"),
    totalMonthly: numeric("total_monthly", { precision: 12, scale: 2 }),
    beneficiaryCount: integer("beneficiary_count"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("quotes_tenant_lead_idx").on(table.tenantId, table.leadId),
    index("quotes_public_token_idx").on(table.publicToken),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
    // Quote snapshots may reference legacy, global, or tenant-private plans.
    planId: text("plan_id").notNull(),
    monthlyPrice: numeric("monthly_price", { precision: 12, scale: 2 }).notNull(),
    recommended: boolean("recommended").notNull().default(false),
    snapshot: jsonb("snapshot").notNull().default({}),
    createdAt,
  },
  (table) => [index("quote_items_quote_idx").on(table.quoteId)],
);

export const quoteLineItems = pgTable(
  "quote_line_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
    beneficiaryId: text("beneficiary_id").notNull().references(() => leadBeneficiaries.id, { onDelete: "restrict" }),
    // Quote snapshots may reference legacy, global, or tenant-private plans.
    planId: text("plan_id").notNull(),
    calculatedValue: numeric("calculated_value", { precision: 12, scale: 2 }).notNull(),
    ageAtQuote: integer("age_at_quote").notNull(),
    snapshot: jsonb("snapshot").notNull().default({}),
    createdAt,
  },
  (table) => [
    index("quote_line_items_tenant_quote_idx").on(table.tenantId, table.quoteId),
    uniqueIndex("quote_line_items_quote_beneficiary_plan_unique").on(table.quoteId, table.beneficiaryId, table.planId),
  ],
);

export const carrierPlanPrices = pgTable(
  "carrier_plan_prices",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => carrierPlans.id, { onDelete: "cascade" }),
    ageBand: text("age_band").notNull(),
    monthlyPrice: numeric("monthly_price", { precision: 12, scale: 2 }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("carrier_plan_prices_plan_age_unique").on(table.planId, table.ageBand)],
);

export const carrierPlanNetworks = pgTable(
  "carrier_plan_networks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => carrierPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    city: text("city").notNull(),
    specialty: text("specialty"),
    createdAt,
  },
  (table) => [index("carrier_plan_networks_plan_city_idx").on(table.planId, table.city)],
);

// Global catalog: only platform administrators may publish these records. Tenant
// visibility is expressed by the settings tables below instead of duplicating plans.
export const globalCarriers = pgTable(
  "global_carriers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    description: text("description"),
    logoUrl: text("logo_url"),
    ansCode: text("ans_code"),
    status: catalogStatus("status").notNull().default("draft"),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: text("created_by").references(() => user.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("global_carriers_name_unique").on(table.name),
    uniqueIndex("global_carriers_ans_code_unique").on(table.ansCode).where(sql`${table.ansCode} IS NOT NULL`),
    index("global_carriers_status_idx").on(table.status),
  ],
);

export const globalPlans = pgTable(
  "global_plans",
  {
    id: text("id").primaryKey(),
    carrierId: text("carrier_id").notNull().references(() => globalCarriers.id),
    name: text("name").notNull(),
    code: text("code"),
    type: planType("type").notNull().default("individual"),
    description: text("description"),
    coverage: text("coverage"),
    ansRegistration: text("ans_registration"),
    maxEntryAge: integer("max_entry_age"),
    metadata: jsonb("metadata").notNull().default({}),
    status: catalogStatus("status").notNull().default("draft"),
    createdBy: text("created_by").references(() => user.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("global_plans_carrier_status_idx").on(table.carrierId, table.status),
    uniqueIndex("global_plans_carrier_code_unique").on(table.carrierId, table.code).where(sql`${table.code} IS NOT NULL`),
  ],
);

export const catalogPriceTables = pgTable(
  "catalog_price_tables",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull().references(() => globalPlans.id),
    name: text("name").notNull(),
    code: text("code"),
    status: catalogStatus("status").notNull().default("draft"),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: text("created_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("catalog_price_tables_plan_status_idx").on(table.planId, table.status),
    uniqueIndex("catalog_price_tables_plan_code_unique").on(table.planId, table.code).where(sql`${table.code} IS NOT NULL`),
  ],
);

export const catalogTableVersions = pgTable(
  "catalog_table_versions",
  {
    id: text("id").primaryKey(),
    priceTableId: text("price_table_id").notNull().references(() => catalogPriceTables.id),
    versionNumber: integer("version_number").notNull(),
    status: catalogStatus("status").notNull().default("draft"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    sourceLabel: text("source_label"),
    contentHash: text("content_hash"),
    snapshot: jsonb("snapshot").notNull().default({}),
    publishedBy: text("published_by").references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("catalog_table_versions_table_number_unique").on(table.priceTableId, table.versionNumber),
    index("catalog_table_versions_lookup_idx").on(table.priceTableId, table.status, table.effectiveFrom),
  ],
);

export const catalogPriceRows = pgTable(
  "catalog_price_rows",
  {
    id: text("id").primaryKey(),
    tableVersionId: text("table_version_id").notNull().references(() => catalogTableVersions.id, { onDelete: "cascade" }),
    ageBand: text("age_band").notNull(),
    minAge: integer("min_age"),
    maxAge: integer("max_age"),
    monthlyPrice: numeric("monthly_price", { precision: 12, scale: 2 }).notNull(),
    criteria: jsonb("criteria").notNull().default({}),
    createdAt,
  },
  (table) => [
    unique("catalog_price_rows_version_age_band_unique").on(table.tableVersionId, table.ageBand),
    index("catalog_price_rows_version_idx").on(table.tableVersionId),
  ],
);

export const tenantCatalogPlanSettings = pgTable(
  "tenant_catalog_plan_settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    globalPlanId: text("global_plan_id").notNull().references(() => globalPlans.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("tenant_catalog_plan_settings_tenant_plan_unique").on(table.tenantId, table.globalPlanId),
    index("tenant_catalog_plan_settings_tenant_enabled_idx").on(table.tenantId, table.enabled),
  ],
);

export const branchCatalogPlanRestrictions = pgTable(
  "branch_catalog_plan_restrictions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
    globalPlanId: text("global_plan_id").notNull().references(() => globalPlans.id, { onDelete: "cascade" }),
    restricted: boolean("restricted").notNull().default(true),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("branch_catalog_plan_restrictions_branch_plan_unique").on(table.branchId, table.globalPlanId),
    index("branch_catalog_plan_restrictions_tenant_branch_idx").on(table.tenantId, table.branchId),
  ],
);

// Private catalog extensions are deliberately separate from global entities. They
// can reuse legacy ids during backfill without becoming globally addressable.
export const tenantPrivateCarriers = pgTable(
  "tenant_private_carriers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ansCode: text("ans_code"),
    contact: text("contact"),
    phone: text("phone"),
    email: text("email"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: text("created_by").references(() => user.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("tenant_private_carriers_tenant_name_unique").on(table.tenantId, table.name),
    index("tenant_private_carriers_tenant_active_idx").on(table.tenantId, table.active),
  ],
);

export const tenantPrivatePlans = pgTable(
  "tenant_private_plans",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    carrierId: text("carrier_id").notNull().references(() => tenantPrivateCarriers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    type: planType("type").notNull().default("individual"),
    description: text("description"),
    coverage: text("coverage"),
    ansRegistration: text("ans_registration"),
    maxEntryAge: integer("max_entry_age"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: text("created_by").references(() => user.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("tenant_private_plans_tenant_carrier_active_idx").on(table.tenantId, table.carrierId, table.active),
    uniqueIndex("tenant_private_plans_carrier_code_unique").on(table.carrierId, table.code).where(sql`${table.code} IS NOT NULL`),
  ],
);

export const tenantPrivatePriceTables = pgTable(
  "tenant_private_price_tables",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => tenantPrivatePlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: text("created_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("tenant_private_price_tables_tenant_plan_idx").on(table.tenantId, table.planId, table.active),
    uniqueIndex("tenant_private_price_tables_plan_code_unique").on(table.planId, table.code).where(sql`${table.code} IS NOT NULL`),
  ],
);

export const tenantPrivateTableVersions = pgTable(
  "tenant_private_table_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    priceTableId: text("price_table_id").notNull().references(() => tenantPrivatePriceTables.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: catalogStatus("status").notNull().default("draft"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    sourceLabel: text("source_label"),
    snapshot: jsonb("snapshot").notNull().default({}),
    publishedBy: text("published_by").references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("tenant_private_table_versions_table_number_unique").on(table.priceTableId, table.versionNumber),
    index("tenant_private_table_versions_lookup_idx").on(table.tenantId, table.priceTableId, table.status, table.effectiveFrom),
  ],
);

export const tenantPrivatePriceRows = pgTable(
  "tenant_private_price_rows",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    tableVersionId: text("table_version_id").notNull().references(() => tenantPrivateTableVersions.id, { onDelete: "cascade" }),
    ageBand: text("age_band").notNull(),
    minAge: integer("min_age"),
    maxAge: integer("max_age"),
    monthlyPrice: numeric("monthly_price", { precision: 12, scale: 2 }).notNull(),
    criteria: jsonb("criteria").notNull().default({}),
    createdAt,
  },
  (table) => [
    unique("tenant_private_price_rows_version_age_band_unique").on(table.tableVersionId, table.ageBand),
    index("tenant_private_price_rows_tenant_version_idx").on(table.tenantId, table.tableVersionId),
  ],
);

export const catalogImportBatches = pgTable(
  "catalog_import_batches",
  {
    id: text("id").primaryKey(),
    source: catalogSource("source").notNull(),
    targetTenantId: text("target_tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    status: catalogImportStatus("status").notNull().default("draft"),
    fileName: text("file_name"),
    contentHash: text("content_hash"),
    summary: jsonb("summary").notNull().default({}),
    createdBy: text("created_by").notNull().references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("catalog_import_batches_source_status_idx").on(table.source, table.status),
    index("catalog_import_batches_tenant_idx").on(table.targetTenantId),
  ],
);

export const catalogChangeSets = pgTable(
  "catalog_change_sets",
  {
    id: text("id").primaryKey(),
    importBatchId: text("import_batch_id").references(() => catalogImportBatches.id, { onDelete: "set null" }),
    source: catalogSource("source").notNull(),
    targetTenantId: text("target_tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    status: catalogImportStatus("status").notNull().default("draft"),
    baseVersionId: text("base_version_id"),
    proposedData: jsonb("proposed_data").notNull().default({}),
    createdBy: text("created_by").notNull().references(() => user.id),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("catalog_change_sets_source_status_idx").on(table.source, table.status),
    index("catalog_change_sets_tenant_idx").on(table.targetTenantId),
  ],
);

export const catalogAuditEvents = pgTable(
  "catalog_audit_events",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull().references(() => user.id),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    source: catalogSource("source").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt,
  },
  (table) => [
    index("catalog_audit_events_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("catalog_audit_events_actor_created_idx").on(table.actorUserId, table.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id").notNull(),
    acao: text("acao").notNull(),
    createdAt,
  },
  (table) => [index("audit_logs_user_created_idx").on(table.userId, table.createdAt)],
);

export const systemSettings = pgTable(
  "system_settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    idempotencyKey: text("idempotency_key"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("notifications_recipient_created_idx").on(table.recipientUserId, table.createdAt),
    index("notifications_tenant_idx").on(table.tenantId),
    uniqueIndex("notifications_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
  ],
);

export const routeOnboardingProgress = pgTable(
  "route_onboarding_progress",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    routeKey: text("route_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("route_onboarding_progress_user_route_unique").on(table.tenantId, table.userId, table.routeKey),
    index("route_onboarding_progress_user_idx").on(table.tenantId, table.userId),
  ],
);

export const userOnboardingProgress = pgTable(
  "user_onboarding_progress",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    tourKey: text("tour_key").notNull(),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("not_started"),
    currentStep: integer("current_step").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("user_onboarding_progress_user_tour_version_unique").on(table.tenantId, table.userId, table.tourKey, table.version),
    index("user_onboarding_progress_user_idx").on(table.tenantId, table.userId),
  ],
);

export const dutyRosterAssignments = pgTable(
  "duty_roster_assignments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
    scheduleId: text("schedule_id").notNull().references(() => unitDutySchedules.id, { onDelete: "cascade" }),
    brokerId: text("broker_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by").notNull().references(() => user.id),
    updatedBy: text("updated_by").notNull().references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("duty_roster_assignments_tenant_branch_idx").on(table.tenantId, table.branchId, table.dayOfWeek, table.startsAt),
    index("duty_roster_assignments_broker_idx").on(table.tenantId, table.brokerId, table.dayOfWeek),
    index("duty_roster_assignments_schedule_idx").on(table.scheduleId, table.status),
  ],
);

export const feedbackChecklistTemplates = pgTable(
  "feedback_checklist_templates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").notNull().references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [index("feedback_checklist_templates_tenant_idx").on(table.tenantId)],
);

export const feedbackChecklistItems = pgTable(
  "feedback_checklist_items",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull().references(() => feedbackChecklistTemplates.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    question: text("question").notNull(),
    answerType: text("answer_type").notNull().default("boolean"),
    options: jsonb("options"),
    required: boolean("required").notNull().default(true),
    createdAt,
  },
  (table) => [index("feedback_checklist_items_template_idx").on(table.templateId, table.sortOrder)],
);

export const leadFeedbacks = pgTable(
  "lead_feedbacks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    brokerId: text("broker_id").notNull().references(() => user.id),
    type: text("type").notNull(),
    content: text("content"),
    nextAction: text("next_action"),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    checklistId: text("checklist_id").references(() => feedbackChecklistTemplates.id),
    answers: jsonb("answers"),
    createdAt,
  },
  (table) => [index("lead_feedbacks_lead_created_idx").on(table.leadId, table.createdAt)],
);

export const leadAssignmentAttempts = pgTable(
  "lead_assignment_attempts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    brokerId: text("broker_id").notNull().references(() => user.id),
    sequence: integer("sequence").notNull().default(1),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    firstContactAt: timestamp("first_contact_at", { withTimezone: true }),
    feedbackDueAt: timestamp("feedback_due_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("open"),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releaseReason: text("release_reason"),
    createdAt,
  },
  (table) => [index("lead_assignment_attempts_open_idx").on(table.tenantId, table.status, table.feedbackDueAt), index("lead_assignment_attempts_lead_idx").on(table.leadId, table.sequence)],
);

export const whatsappConnections = pgTable(
  "whatsapp_connections",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    sessionId: text("session_id"),
    sessionName: text("session_name"),
    status: text("status").notNull().default("disconnected"),
    qrCode: text("qr_code"),
    webhookSecret: text("webhook_secret"),
    chatInternoAtivo: boolean("chat_interno_ativo").notNull().default(true),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("whatsapp_connections_user_idx").on(table.tenantId, table.userId), index("whatsapp_connections_session_idx").on(table.sessionId), uniqueIndex("whatsapp_connections_tenant_user_unique").on(table.tenantId, table.userId).where(sql`${table.userId} IS NOT NULL`)],
);

/**
 * Canal de comunicação persistido e resolvido pelo provedor. A identidade de
 * tenant nunca vem do webhook: para a Meta ela é derivada exclusivamente do
 * phoneNumberId previamente associado a este registro.
 */
export const communicationChannels = pgTable(
  "communication_channels",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    channelType: text("channel_type").notNull().default("shared"),
    status: text("status").notNull().default("pending"),
    businessId: text("business_id"),
    wabaId: text("waba_id"),
    phoneNumberId: text("phone_number_id"),
    displayPhoneNumber: text("display_phone_number"),
    verifiedName: text("verified_name"),
    qualityRating: text("quality_rating"),
    messagingLimit: text("messaging_limit"),
    accessTokenCiphertext: text("access_token_ciphertext"),
    tokenKeyVersion: text("token_key_version"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    isDefault: boolean("is_default").notNull().default(false),
    lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("communication_channels_tenant_status_idx").on(table.tenantId, table.status),
    index("communication_channels_tenant_branch_idx").on(table.tenantId, table.branchId),
    uniqueIndex("communication_channels_provider_phone_unique").on(table.provider, table.phoneNumberId).where(sql`${table.phoneNumberId} IS NOT NULL`),
  ],
);

/**
 * Identificadores não sensíveis da conta Meta de cada corretora. O token de
 * acesso permanece cifrado exclusivamente em communication_channels.
 */
export const metaIntegrationSettings = pgTable(
  "meta_integration_settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    communicationChannelId: text("communication_channel_id").references(() => communicationChannels.id, { onDelete: "set null" }),
    facebookPageId: text("facebook_page_id"),
    adAccountId: text("ad_account_id"),
    pixelId: text("pixel_id"),
    datasetId: text("dataset_id"),
    tutorialCompletedAt: timestamp("tutorial_completed_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_integration_settings_tenant_unique").on(table.tenantId),
    index("meta_integration_settings_channel_idx").on(table.communicationChannelId),
  ],
);

/** Minimal, PII-free webhook ledger for replay protection and operational audit. */
export const communicationChannelWebhookEvents = pgTable(
  "communication_channel_webhook_events",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id").references(() => communicationChannels.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id"),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull().default("received"),
    errorCode: text("error_code"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("communication_channel_webhook_events_channel_idx").on(table.channelId, table.receivedAt),
    uniqueIndex("communication_channel_webhook_events_provider_external_unique").on(table.provider, table.externalEventId).where(sql`${table.externalEventId} IS NOT NULL`),
  ],
);

/**
 * Conexões Meta por tenant obtidas via Facebook Login for Business + Embedded Signup v4.
 */
export const metaConnections = pgTable(
  "meta_connections",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    businessId: text("business_id").notNull(),
    businessName: text("business_name"),
    accessTokenCiphertext: text("access_token_ciphertext").notNull(),
    tokenKeyVersion: text("token_key_version").notNull().default("v1"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: text("status").notNull().default("connected"), // connected, disconnected, expired, error
    permissions: jsonb("permissions").notNull().default([]),
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_connections_tenant_business_unique").on(table.tenantId, table.businessId),
    index("meta_connections_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

/** Páginas do Facebook vinculadas ao tenant/conexão Meta */
export const metaPages = pgTable(
  "meta_pages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    connectionId: text("connection_id").notNull().references(() => metaConnections.id, { onDelete: "cascade" }),
    pageId: text("page_id").notNull(),
    name: text("name").notNull(),
    accessTokenCiphertext: text("access_token_ciphertext"),
    status: text("status").notNull().default("active"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_pages_tenant_page_unique").on(table.tenantId, table.pageId),
    index("meta_pages_tenant_idx").on(table.tenantId),
  ],
);

/** Contas de anúncios Meta associadas */
export const metaAdAccounts = pgTable(
  "meta_ad_accounts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    connectionId: text("connection_id").notNull().references(() => metaConnections.id, { onDelete: "cascade" }),
    adAccountId: text("ad_account_id").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("BRL"),
    accountStatus: integer("account_status").notNull().default(1),
    status: text("status").notNull().default("active"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_ad_accounts_tenant_account_unique").on(table.tenantId, table.adAccountId),
    index("meta_ad_accounts_tenant_idx").on(table.tenantId),
  ],
);

/** Campanhas de anúncios Meta */
export const metaCampaigns = pgTable(
  "meta_campaigns",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    adAccountId: text("ad_account_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    name: text("name").notNull(),
    objective: text("objective"),
    status: text("status").notNull().default("PAUSED"),
    dailyBudget: integer("daily_budget"),
    lifetimeBudget: integer("lifetime_budget"),
    startTime: timestamp("start_time", { withTimezone: true }),
    stopTime: timestamp("stop_time", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_campaigns_tenant_campaign_unique").on(table.tenantId, table.campaignId),
    index("meta_campaigns_tenant_status_idx").on(table.tenantId, table.status),
    index("meta_campaigns_ad_account_idx").on(table.tenantId, table.adAccountId),
  ],
);

/** Conjuntos de anúncios (Ad Sets) */
/** Tenant-owned entry rule that sends Lead Ads from one Meta campaign into a CRM queue. */
export const metaCampaignQueueRoutes = pgTable(
  "meta_campaign_queue_routes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").notNull(),
    queueId: text("queue_id").notNull().references(() => leadQueues.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_campaign_queue_routes_tenant_campaign_unique").on(table.tenantId, table.campaignId),
    index("meta_campaign_queue_routes_queue_idx").on(table.tenantId, table.queueId),
  ],
);

/**
 * One-time, server-owned authorization handoff for a Meta product. Browser
 * values are never credentials; the callback validates the state then stores
 * the encrypted credential and the Graph-confirmed asset snapshot here until
 * the authenticated Director confirms the selection.
 */
export const metaConnectionAttempts = pgTable(
  "meta_connection_attempts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    product: text("product").notNull(),
    stateHash: text("state_hash").notNull(),
    status: text("status").notNull().default("pending"),
    accessTokenCiphertext: text("access_token_ciphertext"),
    assetSnapshot: jsonb("asset_snapshot"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_connection_attempts_state_unique").on(table.stateHash),
    index("meta_connection_attempts_tenant_status_idx").on(table.tenantId, table.product, table.status),
  ],
);

export const metaAdSets = pgTable(
  "meta_ad_sets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").notNull(),
    adSetId: text("ad_set_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("PAUSED"),
    targeting: jsonb("targeting"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_ad_sets_tenant_adset_unique").on(table.tenantId, table.adSetId),
    index("meta_ad_sets_campaign_idx").on(table.tenantId, table.campaignId),
  ],
);

/** Anúncios (Ads) */
export const metaAds = pgTable(
  "meta_ads",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    adSetId: text("ad_set_id").notNull(),
    adId: text("ad_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("PAUSED"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_ads_tenant_ad_unique").on(table.tenantId, table.adId),
    index("meta_ads_ad_set_idx").on(table.tenantId, table.adSetId),
  ],
);

/** Formulários Lead Ads */
export const metaLeadForms = pgTable(
  "meta_lead_forms",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    pageId: text("page_id").notNull(),
    formId: text("form_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    locale: text("locale"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_lead_forms_tenant_form_unique").on(table.tenantId, table.formId),
    index("meta_lead_forms_page_idx").on(table.tenantId, table.pageId),
  ],
);

/** Pixels da Meta */
export const metaPixels = pgTable(
  "meta_pixels",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    pixelId: text("pixel_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_pixels_tenant_pixel_unique").on(table.tenantId, table.pixelId),
  ],
);

/** Datasets da Meta */
export const metaDatasets = pgTable(
  "meta_datasets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    datasetId: text("dataset_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_datasets_tenant_dataset_unique").on(table.tenantId, table.datasetId),
  ],
);

/** Logs operacionais de sincronização da Meta */
export const metaSyncLogs = pgTable(
  "meta_sync_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    syncType: text("sync_type").notNull(), // campaigns, lead_forms, full, token_refresh
    status: text("status").notNull(), // success, error, in_progress
    itemsSynced: integer("items_synced").notNull().default(0),
    errorDetails: text("error_details"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("meta_sync_logs_tenant_started_idx").on(table.tenantId, table.startedAt),
  ],
);

/** Ledger de eventos de Webhook da Meta */
export const metaWebhookEvents = pgTable(
  "meta_webhook_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("meta_ads"),
    externalEventId: text("external_event_id"),
    eventType: text("event_type").notNull(), // leadgen, messaging, ad_account
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull().default("received"), // received, processed, failed, ignored
    errorCode: text("error_code"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("meta_webhook_events_tenant_idx").on(table.tenantId, table.receivedAt),
    uniqueIndex("meta_webhook_events_external_unique").on(table.externalEventId).where(sql`${table.externalEventId} IS NOT NULL`),
  ],
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    communicationChannelId: text("communication_channel_id").references(() => communicationChannels.id, { onDelete: "set null" }),
    conversationId: text("conversation_id"),
    senderRole: text("sender_role").default("user"),
    provider: text("provider").notNull().default("openwa_legacy"),
    messageId: text("message_id"),
    providerStatus: text("provider_status"),
    phone: text("phone").notNull(),
    direction: text("direction").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt,
  },
  (table) => [index("whatsapp_messages_tenant_lead_idx").on(table.tenantId, table.leadId, table.createdAt), uniqueIndex("whatsapp_messages_message_unique").on(table.tenantId, table.messageId)],
);

/** Private documents uploaded for internal reporting, never exposed through a public URL. */
export const internalReportDocuments = pgTable(
  "internal_report_documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    uploadedBy: text("uploaded_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt,
  },
  (table) => [index("internal_report_documents_tenant_created_idx").on(table.tenantId, table.createdAt)],
);

/** Platform-owned WAHA sessions. They never contain tenant credentials. */
export const wahaNumbers = pgTable(
  "waha_numbers",
  {
    id: text("id").primaryKey(),
    relaySessionId: text("relay_session_id").notNull(),
    displayPhoneNumber: text("display_phone_number").notNull(),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "restrict" }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    scope: text("scope").notNull().default("platform"),
    label: text("label"),
    capabilities: jsonb("capabilities").$type<{ inbound: boolean; cadence: boolean; ai: boolean }>().notNull().default({ inbound: true, cadence: false, ai: false }),
    status: text("status").notNull().default("pending"),
    maxMessagesPerHour: integer("max_messages_per_hour").notNull().default(60),
    minIntervalSeconds: integer("min_interval_seconds").notNull().default(45),
    lastHealthAt: timestamp("last_health_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("waha_numbers_relay_session_unique").on(table.relaySessionId),
    uniqueIndex("waha_numbers_display_phone_unique").on(table.displayPhoneNumber),
    index("waha_numbers_status_idx").on(table.status),
    index("waha_numbers_tenant_scope_idx").on(table.tenantId, table.branchId, table.status),
  ],
);

/** Tenant-owned cadence aggregate. Published versions are immutable. */
export const wahaCadences = pgTable(
  "waha_cadences",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    activeVersionId: text("active_version_id"),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("waha_cadences_tenant_status_idx").on(table.tenantId, table.status),
    index("waha_cadences_branch_idx").on(table.tenantId, table.branchId),
  ],
);

export const wahaCadenceVersions = pgTable(
  "waha_cadence_versions",
  {
    id: text("id").primaryKey(),
    cadenceId: text("cadence_id").notNull().references(() => wahaCadences.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull().default("draft"),
    wahaNumberId: text("waha_number_id").references(() => wahaNumbers.id, { onDelete: "restrict" }),
    definition: jsonb("definition").notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt,
  },
  (table) => [
    uniqueIndex("waha_cadence_versions_unique").on(table.cadenceId, table.version),
    index("waha_cadence_versions_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

/** A recipient is referenced by CRM record, so the cadence store never needs a raw phone copy. */
export const wahaCadenceRuns = pgTable(
  "waha_cadence_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    cadenceId: text("cadence_id").notNull().references(() => wahaCadences.id, { onDelete: "cascade" }),
    versionId: text("version_id").notNull().references(() => wahaCadenceVersions.id, { onDelete: "restrict" }),
    wahaNumberId: text("waha_number_id").notNull().references(() => wahaNumbers.id, { onDelete: "restrict" }),
    recipientType: text("recipient_type").notNull(),
    recipientId: text("recipient_id").notNull(),
    contactPhoneHash: text("contact_phone_hash").notNull(),
    status: text("status").notNull().default("queued"),
    currentStep: integer("current_step").notNull().default(0),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    inboundAt: timestamp("inbound_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("waha_cadence_runs_version_recipient_unique").on(table.versionId, table.recipientType, table.recipientId),
    index("waha_cadence_runs_tenant_status_due_idx").on(table.tenantId, table.status, table.nextActionAt),
    index("waha_cadence_runs_phone_hash_idx").on(table.contactPhoneHash, table.status),
  ],
);

/** Durable outbound work for the WAHA relay. Message bodies remain in the immutable version definition. */
export const wahaDeliveryOutbox = pgTable(
  "waha_delivery_outbox",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull().references(() => wahaCadenceRuns.id, { onDelete: "cascade" }),
    wahaNumberId: text("waha_number_id").notNull().references(() => wahaNumbers.id, { onDelete: "restrict" }),
    stepIndex: integer("step_index").notNull(),
    kind: text("kind").notNull().default("cadence"),
    messageBody: text("message_body"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    providerMessageId: text("provider_message_id"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("waha_delivery_outbox_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    index("waha_delivery_outbox_due_idx").on(table.status, table.runAfter),
    index("waha_delivery_outbox_run_idx").on(table.runId, table.createdAt),
  ],
);

/** Global suppression is a one-way normalized-phone hash, never an address book. */
export const wahaSuppressions = pgTable(
  "waha_suppressions",
  {
    id: text("id").primaryKey(),
    phoneHash: text("phone_hash").notNull(),
    reason: text("reason").notNull(),
    source: text("source").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
  },
  (table) => [uniqueIndex("waha_suppressions_phone_unique").on(table.phoneHash)],
);

export const wahaWebhookEvents = pgTable(
  "waha_webhook_events",
  {
    id: text("id").primaryKey(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull().default("received"),
    errorCode: text("error_code"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("waha_webhook_events_external_unique").on(table.externalEventId)],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    communicationChannelId: text("communication_channel_id").references(() => communicationChannels.id, { onDelete: "set null" }),
    assignedUserId: text("assigned_user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status").notNull().default("NEW"),
    aiModel: text("ai_model").default("openrouter/auto"),
    qualificationSummary: text("qualification_summary"),
    transferReason: text("transfer_reason"),
    pausedByUserId: text("paused_by_user_id").references(() => user.id, { onDelete: "set null" }),
    lockVersion: integer("lock_version").notNull().default(1),
    language: text("language").notNull().default("pt-BR"),
    lastProcessedMessageId: text("last_processed_message_id"),
    memory: jsonb("memory"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    transferredAt: timestamp("transferred_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    automationState: text("automation_state").notNull().default("AI_ACTIVE"),
    quickReplyLastTemplate: text("quick_reply_last_template"),
    quickReplyLastSentAt: timestamp("quick_reply_last_sent_at", { withTimezone: true }),
    quickReplyWaitWindowStartedAt: timestamp("quick_reply_wait_window_started_at", { withTimezone: true }),
    quickReplyWaitResponseCount: integer("quick_reply_wait_response_count").notNull().default(0),
    optOutAt: timestamp("opt_out_at", { withTimezone: true }),
    wrongNumberAt: timestamp("wrong_number_at", { withTimezone: true }),
    behaviorVersionId: text("behavior_version_id").references(() => agentBehaviorVersions.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("ai_conversations_tenant_status_idx").on(table.tenantId, table.status),
    index("ai_conversations_tenant_lead_idx").on(table.tenantId, table.leadId),
    index("ai_conversations_assigned_user_idx").on(table.assignedUserId),
    index("ai_conversations_behavior_version_idx").on(table.tenantId, table.behaviorVersionId),
  ],
);

/**
 * Durable side effects emitted by lead intake and distribution. The aggregate
 * state and this record are committed together; workers may then retry without
 * replaying the webhook or changing lead ownership twice.
 */
export const leadEffectOutbox = pgTable(
  "lead_effect_outbox",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    // Declared without a Drizzle relation because webhook_deliveries is defined
    // later in this schema; the database migration still enforces the FK.
    webhookDeliveryId: text("webhook_delivery_id"),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    payload: jsonb("payload").notNull().default({}),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("lead_effect_outbox_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    index("lead_effect_outbox_due_idx").on(table.status, table.runAfter),
    index("lead_effect_outbox_tenant_lead_idx").on(table.tenantId, table.leadId, table.createdAt),
  ],
);

/** Versioned, tenant-owned policy used only by the automatic assignment engine. */
export const leadDistributionPolicies = pgTable(
  "lead_distribution_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    queueId: text("queue_id").references(() => leadQueues.id, { onDelete: "cascade" }),
    profileKey: text("profile_key"),
    enabled: boolean("enabled").notNull().default(true),
    version: integer("version").notNull().default(1),
    policy: jsonb("policy").notNull().default({}),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_distribution_policies_tenant_idx").on(table.tenantId, table.queueId),
    uniqueIndex("lead_distribution_policies_scope_unique").on(table.tenantId, table.queueId, table.profileKey),
  ],
);

/** Short-lived authorization grants created by an authenticated CRM session. */
export const extensionAuthCodes = pgTable(
  "extension_auth_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull().unique(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [index("extension_auth_codes_expiry_idx").on(table.expiresAt)],
);

/** Hashed, revocable browser-extension sessions. The raw token never leaves the exchange response. */
export const extensionSessions = pgTable(
  "extension_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    extensionVersion: text("extension_version").notNull(),
    permissions: jsonb("permissions").notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("extension_sessions_user_idx").on(table.userId, table.revokedAt),
    index("extension_sessions_tenant_idx").on(table.tenantId, table.revokedAt),
  ],
);

export const extensionSettings = pgTable(
  "extension_settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    minimumVersion: text("minimum_version").notNull().default("0.1.0"),
    allowInsert: boolean("allow_insert").notNull().default(true),
    maxSuggestions: integer("max_suggestions").notNull().default(3),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("extension_settings_tenant_unique").on(table.tenantId)],
);

export const aiQuickReplyTemplates = pgTable(
  "ai_quick_reply_templates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    ruleKey: text("rule_key").notNull(),
    templateKey: text("template_key").notNull(),
    body: text("body").notNull(),
    active: boolean("active").notNull().default(true),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("ai_quick_reply_templates_tenant_rule_unique").on(table.tenantId, table.ruleKey),
    index("ai_quick_reply_templates_tenant_active_idx").on(table.tenantId, table.active),
  ],
);

export const aiQuickReplyEvents = pgTable(
  "ai_quick_reply_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    sourceMessageId: text("source_message_id"),
    intent: text("intent").notNull(),
    ruleKey: text("rule_key").notNull(),
    templateKey: text("template_key"),
    outcome: text("outcome").notNull(),
    estimatedTokensSaved: integer("estimated_tokens_saved").notNull().default(0),
    notifiedUserId: text("notified_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt,
  },
  (table) => [
    index("ai_quick_reply_events_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("ai_quick_reply_events_conversation_idx").on(table.conversationId, table.createdAt),
  ],
);

export const aiAttendanceLogs = pgTable(
  "ai_attendance_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("openrouter"),
    modelUsed: text("model_used").notNull(),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    totalTokens: integer("total_tokens").default(0),
    estimatedCost: text("estimated_cost").default("0"),
    latencyMs: integer("latency_ms").default(0),
    status: text("status").notNull().default("success"),
    errorMessage: text("error_message"),
    sourceMessageId: text("source_message_id"),
    createdAt,
  },
  (table) => [
    index("ai_attendance_logs_tenant_conv_idx").on(table.tenantId, table.conversationId),
    index("ai_attendance_logs_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    credentialId: text("credential_id")
      .notNull()
      .references(() => leadWebhookCredentials.id),
    requestId: text("request_id").notNull(),
    idempotencyKey: text("idempotency_key"),
    externalId: text("external_id"),
    payloadHash: text("payload_hash").notNull(),
    status: webhookDeliveryStatus("status").notNull().default("received"),
    leadId: text("lead_id").references(() => leads.id),
    errorCode: text("error_code"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("webhook_deliveries_tenant_id_idx").on(table.tenantId),
    index("webhook_deliveries_credential_id_idx").on(table.credentialId),
    uniqueIndex("webhook_deliveries_credential_idempotency_unique").on(table.credentialId, table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
  ],
);

export const platformAuditLogs = pgTable(
  "platform_audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt,
  },
  (table) => [index("platform_audit_logs_actor_idx").on(table.actorUserId)],
);

/** Tenant-owned role profiles. System roles remain immutable in tenant_memberships.role. */
export const customRoles = pgTable(
  "custom_roles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("primary"),
    icon: text("icon").notNull().default("shield"),
    scope: customRoleScope("scope").notNull().default("none"),
    status: customRoleStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("custom_roles_tenant_name_unique").on(table.tenantId, table.name),
    index("custom_roles_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const customRolePermissions = pgTable(
  "custom_role_permissions",
  {
    id: text("id").primaryKey(),
    customRoleId: text("custom_role_id").notNull().references(() => customRoles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("custom_role_permission_unique").on(table.customRoleId, table.permissionKey),
    index("custom_role_permissions_key_idx").on(table.permissionKey),
  ],
);

export const customRoleEvents = pgTable(
  "custom_role_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customRoleId: text("custom_role_id").notNull().references(() => customRoles.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull().references(() => user.id),
    action: text("action").notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull().default({}),
    createdAt,
  },
  (table) => [index("custom_role_events_role_created_idx").on(table.customRoleId, table.createdAt)],
);

export const tenantCustomRoleSettings = pgTable(
  "tenant_custom_role_settings",
  {
    tenantId: text("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    branchId: text("branch_id"),
    supervisorId: text("supervisor_id").references(() => user.id, { onDelete: "set null" }),
    role: tenantRole("role").notNull(),
    jobTitle: text("job_title").notNull().default("broker"),
    customRoleId: text("custom_role_id").references(() => customRoles.id, { onDelete: "set null" }),
    status: membershipStatus("status").notNull().default("active"),
    availabilityStatus: availabilityStatus("availability_status").notNull().default("available"),
    onboardingDismissedAt: timestamp("onboarding_dismissed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("tenant_memberships_tenant_id_idx").on(table.tenantId),
    index("tenant_memberships_user_id_idx").on(table.userId),
    index("tenant_memberships_branch_id_idx").on(table.branchId),
    index("tenant_memberships_supervisor_id_idx").on(table.supervisorId),
    index("tenant_memberships_custom_role_idx").on(table.customRoleId),
    unique("tenant_memberships_tenant_user_unique").on(
      table.tenantId,
      table.userId,
    ),
    foreignKey({
      columns: [table.branchId, table.tenantId],
      foreignColumns: [branches.id, branches.tenantId],
      name: "tenant_memberships_branch_tenant_fk",
    }),
  ],
);

export const tenantManagerBranches = pgTable(
  "tenant_manager_branches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    createdAt,
  },
  (table) => [
    index("tenant_manager_branches_tenant_idx").on(table.tenantId),
    index("tenant_manager_branches_user_idx").on(table.userId),
    index("tenant_manager_branches_branch_idx").on(table.branchId),
    unique("tenant_manager_branches_user_branch_unique").on(
      table.tenantId,
      table.userId,
      table.branchId,
    ),
  ],
);

export const marketingImports = pgTable(
  "marketing_imports",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    fileName: text("file_name").notNull(),
    fileHash: text("file_hash").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    importType: text("import_type").notNull().default("pf"),
    status: text("status").notNull().default("uploading"),
    totalRows: integer("total_rows").notNull().default(0),
    importedCount: integer("imported_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    invalidCount: integer("invalid_count").notNull().default(0),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("marketing_imports_tenant_idx").on(table.tenantId, table.createdAt),
    uniqueIndex("marketing_imports_tenant_hash_unique").on(table.tenantId, table.fileHash),
  ],
);

export const marketingImportResults = pgTable(
  "marketing_import_results",
  {
    id: text("id").primaryKey(),
    importId: text("import_id").notNull().references(() => marketingImports.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    rowIndex: integer("row_index").notNull(),
    status: text("status").notNull().default("created"),
    message: text("message"),
    externalLeadId: text("external_lead_id"),
    nome: text("nome").notNull(),
    telefone: text("telefone").notNull(),
    email: text("email"),
    createdAt,
  },
  (table) => [index("marketing_import_results_import_idx").on(table.importId)],
);

export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    invitedBy: text("invited_by").notNull().references(() => user.id),
    createdAt,
  },
  (table) => [
    index("invites_user_id_idx").on(table.userId),
    index("invites_token_hash_idx").on(table.tokenHash),
  ],
);

export const leadWebhookCredentialRelations = relations(leadWebhookCredentials, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leadWebhookCredentials.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(user, {
    fields: [leadWebhookCredentials.createdBy],
    references: [user.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveryRelations = relations(webhookDeliveries, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookDeliveries.tenantId],
    references: [tenants.id],
  }),
  credential: one(leadWebhookCredentials, {
    fields: [webhookDeliveries.credentialId],
    references: [leadWebhookCredentials.id],
  }),
  lead: one(leads, {
    fields: [webhookDeliveries.leadId],
    references: [leads.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  tenantMemberships: many(tenantMemberships),
  platformAuditLogs: many(platformAuditLogs),
  sentInvites: many(invites, { relationName: "invitedBy" }),
  receivedInvites: many(invites, { relationName: "invitee" }),
}));

export const platformAuditLogRelations = relations(platformAuditLogs, ({ one }) => ({
  actor: one(user, {
    fields: [platformAuditLogs.actorUserId],
    references: [user.id],
  }),
}));

export const inviteRelations = relations(invites, ({ one }) => ({
  invitee: one(user, { fields: [invites.userId], references: [user.id], relationName: "invitee" }),
  invitedBy: one(user, { fields: [invites.invitedBy], references: [user.id], relationName: "invitedBy" }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const tenantRelations = relations(tenants, ({ many }) => ({
  branches: many(branches),
  memberships: many(tenantMemberships),
}));

export const branchRelations = relations(branches, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [branches.tenantId],
    references: [tenants.id],
  }),
  memberships: many(tenantMemberships),
}));

export const tenantMembershipRelations = relations(
  tenantMemberships,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantMemberships.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [tenantMemberships.userId],
      references: [user.id],
    }),
    branch: one(branches, {
      fields: [tenantMemberships.branchId],
      references: [branches.id],
    }),
  }),
);

export const commissionRuleTypeValues = ["unica", "escalonada"] as const;
export const commissionScheduleStatusValues = ["pending", "paid", "cancelled", "chargeback_pending"] as const;
export const goalScopeValues = ["broker", "team", "branch", "tenant"] as const;
export const goalTargetTypeValues = ["sales_count", "revenue", "conversion_rate", "leads_contacted"] as const;
export const performanceSeasonStatusValues = ["draft", "active", "closed", "archived"] as const;
export const performanceAwardTypeValues = ["recognition", "bonus", "gift", "other"] as const;
export const saleStatusValues = ["active", "cancelled"] as const;
export const activeCustomerStatusValues = ["active", "cancelled"] as const;

export const commissionRuleType = pgEnum("commission_rule_type", commissionRuleTypeValues);
export const commissionScheduleStatus = pgEnum("commission_schedule_status", commissionScheduleStatusValues);
export const goalScope = pgEnum("goal_scope", goalScopeValues);
export const goalTargetType = pgEnum("goal_target_type", goalTargetTypeValues);
export const performanceSeasonStatus = pgEnum("performance_season_status", performanceSeasonStatusValues);
export const performanceAwardType = pgEnum("performance_award_type", performanceAwardTypeValues);
export const saleStatus = pgEnum("sale_status", saleStatusValues);
export const activeCustomerStatus = pgEnum("active_customer_status", activeCustomerStatusValues);

export const paymentMethodValues = ["boleto", "debito_automatico", "cartao_credito", "desconto_folha", "outro"] as const;
export const renewalTypeValues = ["reajuste_operadora", "portabilidade", "manutencao", "nova_contratacao"] as const;
export const customerRenewalStatusValues = ["pending_window", "in_renewal", "renewed", "churned"] as const;

export const paymentMethodEnum = pgEnum("payment_method", paymentMethodValues);
export const renewalTypeEnum = pgEnum("renewal_type", renewalTypeValues);
export const customerRenewalStatus = pgEnum("customer_renewal_status", customerRenewalStatusValues);


export const documentStatusValues = ["pending", "approved", "rejected"] as const;
export const documentStatus = pgEnum("document_status", documentStatusValues);

export const documentRequirements = pgTable(
  "document_requirements",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    carrierId: text("carrier_id").references(() => carriers.id, { onDelete: "set null" }),
    planId: text("plan_id").references(() => carrierPlans.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(true),
    appliesPerBeneficiary: boolean("applies_per_beneficiary").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("document_requirements_tenant_idx").on(table.tenantId),
  ]
);

export const leadDocuments = pgTable(
  "lead_documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    requirementId: text("requirement_id").references(() => documentRequirements.id, { onDelete: "set null" }),
    beneficiaryId: text("beneficiary_id").references(() => leadBeneficiaries.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    fileUrl: text("file_url").notNull(),
    storageKey: text("storage_key"),
    category: text("category").notNull().default("outros"),
    description: text("description"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    checksumSha256: text("checksum_sha256"),
    scanStatus: text("scan_status").notNull().default("clean"),
    visibility: text("visibility").notNull().default("internal"),
    version: integer("version").notNull().default(1),
    previousDocumentId: text("previous_document_id"),
    status: documentStatus("status").notNull().default("pending"),
    uploadedBy: text("uploaded_by").notNull().references(() => user.id),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_documents_tenant_lead_idx").on(table.tenantId, table.leadId),
    index("lead_documents_tenant_client_idx").on(table.tenantId, table.clientId),
    index("lead_documents_tenant_beneficiary_idx").on(table.tenantId, table.beneficiaryId),
    index("lead_documents_checksum_idx").on(table.tenantId, table.checksumSha256),
  ]
);

/* ─── Sales / Commission ─── */

export const leadDocumentChecklist = pgTable(
  "lead_document_checklist",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    requirementId: text("requirement_id").notNull().references(() => documentRequirements.id, { onDelete: "cascade" }),
    beneficiaryId: text("beneficiary_id").references(() => leadBeneficiaries.id, { onDelete: "cascade" }),
    documentId: text("document_id").references(() => leadDocuments.id, { onDelete: "set null" }),
    scopeKey: text("scope_key").notNull(),
    status: documentStatus("status").notNull().default("pending"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("lead_document_checklist_scope_unique").on(table.scopeKey),
    index("lead_document_checklist_tenant_lead_idx").on(table.tenantId, table.leadId),
    index("lead_document_checklist_beneficiary_idx").on(table.tenantId, table.beneficiaryId),
  ],
);

/**
 * Outbound WhatsApp delivery ledger. Provider credentials are intentionally
 * absent here; only the channel id is stored and the encrypted secret remains
 * in communication_channels.
 */
export const whatsappOutboundMessages = pgTable(
  "whatsapp_outbound_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull().references(() => communicationChannels.id, { onDelete: "restrict" }),
    recipientType: text("recipient_type").notNull(),
    recipientId: text("recipient_id"),
    destinationPhone: text("destination_phone").notNull(),
    purpose: text("purpose").notNull(),
    messageType: text("message_type", { enum: ["template", "text"] }).notNull().default("template"),
    templateName: text("template_name").notNull(),
    templateLanguage: text("template_language").notNull().default("pt_BR"),
    variables: jsonb("variables").notNull().default([]),
    status: text("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    providerErrorCode: text("provider_error_code"),
    providerErrorMessage: text("provider_error_message"),
    idempotencyKey: text("idempotency_key").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("whatsapp_outbound_messages_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    index("whatsapp_outbound_messages_queue_idx").on(table.status, table.nextAttemptAt, table.createdAt),
    index("whatsapp_outbound_messages_tenant_idx").on(table.tenantId, table.createdAt),
    index("whatsapp_outbound_messages_provider_idx").on(table.providerMessageId),
  ],
);

export const leadOffers = pgTable(
  "lead_offers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    brokerId: text("broker_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    offeredAt: timestamp("offered_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    whatsappMessageId: text("whatsapp_message_id"),
    outboundMessageId: text("outbound_message_id").references(() => whatsappOutboundMessages.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_offers_tenant_lead_status_idx").on(table.tenantId, table.leadId, table.status),
    index("lead_offers_broker_status_expires_idx").on(table.brokerId, table.status, table.expiresAt),
    index("lead_offers_whatsapp_msg_idx").on(table.whatsappMessageId),
  ],
);

export const commissionRules = pgTable(
  "commission_rules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    carrierId: text("carrier_id").references(() => carriers.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => carrierPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: commissionRuleType("type").notNull().default("escalonada"),
    percentages: jsonb("percentages").notNull().default([100]),
    appliesToAll: boolean("applies_to_all").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("commission_rules_tenant_idx").on(table.tenantId),
    index("commission_rules_carrier_idx").on(table.carrierId),
    index("commission_rules_plan_idx").on(table.planId),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    brokerId: text("broker_id")
      .notNull()
      .references(() => user.id),
    carrierPlanId: text("carrier_plan_id").references(() => carrierPlans.id),
    commissionRuleId: text("commission_rule_id").references(() => commissionRules.id),
    saleDate: timestamp("sale_date", { withTimezone: true }).notNull(),
    saleValue: numeric("sale_value", { precision: 12, scale: 2 }).notNull(),
    policyNumber: text("policy_number"),
    coverageStartDate: date("coverage_start_date", { mode: "string" }),
    contractTermMonths: integer("contract_term_months").notNull().default(12),
    expirationDate: date("expiration_date", { mode: "string" }),
    renewalWindowStartDate: date("renewal_window_start_date", { mode: "string" }),
    paymentMethod: paymentMethodEnum("payment_method").default("boleto"),
    renewalType: renewalTypeEnum("renewal_type").default("reajuste_operadora"),
    renewalContactPreference: text("renewal_contact_preference").default("whatsapp"),
    postSaleNotes: text("post_sale_notes"),
    approvedValue: numeric("approved_value", { precision: 12, scale: 2 }),
    confirmationDocumentId: text("confirmation_document_id").references(() => leadDocuments.id, { onDelete: "set null" }),
    status: saleStatus("status").notNull().default("active"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("sales_tenant_idx").on(table.tenantId),
    index("sales_lead_idx").on(table.leadId),
    index("sales_broker_idx").on(table.brokerId),
    index("sales_expiration_idx").on(table.expirationDate),
  ],
);

export const commissionSchedule = pgTable(
  "commission_schedule",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    monthNumber: integer("month_number").notNull(),
    referenceMonth: text("reference_month").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: commissionScheduleStatus("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidBy: text("paid_by").references(() => user.id),
    notes: text("notes"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("commission_schedule_tenant_idx").on(table.tenantId),
    index("commission_schedule_sale_idx").on(table.saleId),
    index("commission_schedule_ref_month_idx").on(table.referenceMonth),
    index("commission_schedule_status_idx").on(table.status),
  ],
);

export const activeCustomers = pgTable(
  "active_customers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    brokerId: text("broker_id").notNull().references(() => user.id),
    branchId: text("branch_id").references(() => branches.id),
    status: activeCustomerStatus("status").notNull().default("active"),
    coverageStartDate: date("coverage_start_date", { mode: "string" }).notNull(),
    contractAnniversary: date("contract_anniversary", { mode: "string" }).notNull(),
    contractTermMonths: integer("contract_term_months").notNull().default(12),
    expirationDate: date("expiration_date", { mode: "string" }),
    renewalWindowStartDate: date("renewal_window_start_date", { mode: "string" }),
    renewalStatus: customerRenewalStatus("renewal_status").notNull().default("pending_window"),
    lastRenewalAttemptAt: timestamp("last_renewal_attempt_at", { withTimezone: true }),
    renewalNotes: text("renewal_notes"),
    cancellationDate: date("cancellation_date", { mode: "string" }),
    cancellationReason: text("cancellation_reason"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("active_customers_sale_unique").on(table.saleId),
    index("active_customers_tenant_status_idx").on(table.tenantId, table.status),
    index("active_customers_branch_idx").on(table.branchId),
    index("active_customers_expiration_idx").on(table.expirationDate),
    index("active_customers_renewal_window_idx").on(table.renewalWindowStartDate),
  ],
);

export const customerRenewalReminders = pgTable(
  "customer_renewal_reminders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    activeCustomerId: text("active_customer_id").notNull().references(() => activeCustomers.id, { onDelete: "cascade" }),
    saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    brokerId: text("broker_id").notNull().references(() => user.id),
    triggerType: text("trigger_type").notNull(), // t_90 | t_60 | t_30 | t_15
    scheduledFor: date("scheduled_for", { mode: "string" }).notNull(),
    status: text("status").notNull().default("pending"), // pending | processed | dismissed
    processedAt: timestamp("processed_at", { withTimezone: true }),
    taskCreatedId: text("task_created_id").references(() => leadTasks.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("customer_renewal_reminders_tenant_idx").on(table.tenantId),
    index("customer_renewal_reminders_scheduled_idx").on(table.scheduledFor),
    index("customer_renewal_reminders_status_idx").on(table.status),
  ],
);

export const postSaleSettings = pgTable(
  "post_sale_settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    chargebackWindowDays: integer("chargeback_window_days").notNull().default(90),
    active: boolean("active").notNull().default(true),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("post_sale_settings_tenant_unique").on(table.tenantId)],
);

/* ─── Goals ─── */

export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    scope: goalScope("scope").notNull(),
    scopeId: text("scope_id"),
    name: text("name").notNull(),
    targetType: goalTargetType("target_type").notNull().default("sales_count"),
    targetValue: numeric("target_value", { precision: 12, scale: 2 }).notNull(),
    period: text("period").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("goals_tenant_scope_idx").on(table.tenantId, table.scope),
    index("goals_period_idx").on(table.tenantId, table.period),
  ],
);

export const goalProgress = pgTable(
  "goal_progress",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    currentValue: numeric("current_value", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    percentage: numeric("percentage", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("goal_progress_goal_unique").on(table.goalId),
  ],
);

/**
 * A Page shared manually with the AncoraHub platform for Lead Ads. The platform
 * credential remains server-only; this record is solely the auditable routing
 * map from a Meta Page to a tenant and its intake credential.
 */
export const metaLeadAdSources = pgTable(
  "meta_lead_ad_sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    pageId: text("page_id").notNull(),
    adAccountId: text("ad_account_id"),
    leadWebhookCredentialId: text("lead_webhook_credential_id").notNull().references(() => leadWebhookCredentials.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    distributionMode: text("distribution_mode").notNull().default("direct_leads"),
    lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
    lastLeadAt: timestamp("last_lead_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("meta_lead_ad_sources_page_unique").on(table.pageId),
    uniqueIndex("meta_lead_ad_sources_credential_unique").on(table.leadWebhookCredentialId),
    index("meta_lead_ad_sources_tenant_status_idx").on(table.tenantId, table.status),
    index("meta_lead_ad_sources_branch_idx").on(table.branchId),
  ],
);

/**
 * A season is the immutable time boundary used by the broker leaderboard. A
 * reset closes the current season and starts another; it never removes points
 * or historical results.
 */
export const performanceSeasons = pgTable(
  "performance_seasons",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: performanceSeasonStatus("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    resetReason: text("reset_reason"),
    createdBy: text("created_by").notNull().references(() => user.id),
    closedBy: text("closed_by").references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("performance_seasons_tenant_status_idx").on(table.tenantId, table.status),
    index("performance_seasons_tenant_starts_idx").on(table.tenantId, table.startsAt),
  ],
);

export const performanceAwards = pgTable(
  "performance_awards",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    seasonId: text("season_id").notNull().references(() => performanceSeasons.id, { onDelete: "cascade" }),
    rankPosition: integer("rank_position").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    rewardType: performanceAwardType("reward_type").notNull().default("recognition"),
    rewardValue: text("reward_value"),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").notNull().references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("performance_awards_season_rank_title_unique").on(table.seasonId, table.rankPosition, table.title),
    index("performance_awards_tenant_season_idx").on(table.tenantId, table.seasonId),
  ],
);

/* ─── Relations ─── */

export const commissionRuleRelations = relations(commissionRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [commissionRules.tenantId],
    references: [tenants.id],
  }),
  carrier: one(carriers, {
    fields: [commissionRules.carrierId],
    references: [carriers.id],
  }),
  plan: one(carrierPlans, {
    fields: [commissionRules.planId],
    references: [carrierPlans.id],
  }),
  createdByUser: one(user, {
    fields: [commissionRules.createdBy],
    references: [user.id],
  }),
}));

export const saleRelations = relations(sales, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [sales.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [sales.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [sales.clientId],
    references: [clients.id],
  }),
  broker: one(user, {
    fields: [sales.brokerId],
    references: [user.id],
  }),
  carrierPlan: one(carrierPlans, {
    fields: [sales.carrierPlanId],
    references: [carrierPlans.id],
  }),
  commissionRule: one(commissionRules, {
    fields: [sales.commissionRuleId],
    references: [commissionRules.id],
  }),
  createdByUser: one(user, {
    fields: [sales.createdBy],
    references: [user.id],
  }),
  scheduleItems: many(commissionSchedule),
}));

export const commissionScheduleRelations = relations(commissionSchedule, ({ one }) => ({
  tenant: one(tenants, {
    fields: [commissionSchedule.tenantId],
    references: [tenants.id],
  }),
  sale: one(sales, {
    fields: [commissionSchedule.saleId],
    references: [sales.id],
  }),
  paidByUser: one(user, {
    fields: [commissionSchedule.paidBy],
    references: [user.id],
  }),
}));

export const goalRelations = relations(goals, ({ one }) => ({
  tenant: one(tenants, {
    fields: [goals.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(user, {
    fields: [goals.createdBy],
    references: [user.id],
  }),
  progress: one(goalProgress, {
    fields: [goals.id],
    references: [goalProgress.goalId],
  }),
}));

export const goalProgressRelations = relations(goalProgress, ({ one }) => ({
  goal: one(goals, {
    fields: [goalProgress.goalId],
    references: [goals.id],
  }),
}));

/* ─── Push Subscriptions ─── */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("push_subscriptions_user_idx").on(table.userId),
    index("push_subscriptions_tenant_idx").on(table.tenantId),
  ]
);

export const pushSubscriptionRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(user, {
    fields: [pushSubscriptions.userId],
    references: [user.id],
  }),
  tenant: one(tenants, {
    fields: [pushSubscriptions.tenantId],
    references: [tenants.id],
  }),
}));

/* ─── Promotional Materials (Materiais de Divulgação) ─── */

export const promotionalMaterialCategoryValues = [
  "todos",
  "avisos",
  "eventos",
  "informativos",
  "premiacoes",
  "promocoes",
  "treinamentos",
  "materiais_divulgacao",
] as const;

export const promotionalMaterialCategory = pgEnum(
  "promotional_material_category",
  promotionalMaterialCategoryValues,
);

export const promotionalMaterials = pgTable(
  "promotional_materials",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: promotionalMaterialCategory("category")
      .notNull()
      .default("materiais_divulgacao"),
    imageUrl: text("image_url"),
    fileUrl: text("file_url"),
    targetBranch: text("target_branch"),
    targetCarrier: text("target_carrier"),
    targetState: text("target_state"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("promo_materials_tenant_idx").on(table.tenantId),
    index("promo_materials_category_idx").on(table.category),
    index("promo_materials_active_idx").on(table.active),
  ],
);

export const promotionalMaterialRelations = relations(
  promotionalMaterials,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [promotionalMaterials.tenantId],
      references: [tenants.id],
    }),
    createdByUser: one(user, {
      fields: [promotionalMaterials.createdBy],
      references: [user.id],
    }),
  }),
);

/* ─── Message Templates ─── */

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("geral"),
    content: text("content").notNull(),
    variables: jsonb("variables").notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("message_templates_tenant_idx").on(table.tenantId, table.active),
  ],
);

export const messageTemplateRelations = relations(
  messageTemplates,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [messageTemplates.tenantId],
      references: [tenants.id],
    }),
    createdByUser: one(user, {
      fields: [messageTemplates.createdBy],
      references: [user.id],
    }),
  }),
);

export const importedSpreadsheets = pgTable(
  "imported_spreadsheets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    description: text("description"),
    columns: jsonb("columns").notNull().default([]),
    data: jsonb("data").notNull().default([]),
    rowCount: integer("row_count").notNull().default(0),
    publicToken: text("public_token").unique(),
    publicPasswordHash: text("public_password_hash"),
    publicCreatedAt: timestamp("public_created_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("imported_spreadsheets_tenant_idx").on(table.tenantId),
    index("imported_spreadsheets_created_by_idx").on(table.createdBy),
    uniqueIndex("imported_spreadsheets_public_token_unique").on(table.publicToken).where(sql`${table.publicToken} IS NOT NULL`),
  ],
);

export const brokerLifecycleStatusValues = [
  "DRAFT",
  "INVITED",
  "INVITATION_EXPIRED",
  "ONBOARDING",
  "ACTIVE",
  "SUSPENDED",
  "INACTIVE",
  "ARCHIVED",
] as const;

export const brokerLifecycleStatus = pgEnum("broker_lifecycle_status", brokerLifecycleStatusValues);

export const brokerProfiles = pgTable(
  "broker_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    userId: text("user_id")
      .references(() => user.id),
    internalCode: text("internal_code").notNull(),
    professionalName: text("professional_name").notNull(),
    phone: text("phone").notNull(),
    invitedEmail: text("invited_email").notNull(),
    cpf: text("cpf"),
    lifecycleStatus: brokerLifecycleStatus("lifecycle_status").notNull().default("DRAFT"),
    managerId: text("manager_id")
      .references(() => user.id),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("broker_profiles_tenant_id_idx").on(table.tenantId),
    index("broker_profiles_user_id_idx").on(table.userId),
    index("broker_profiles_branch_id_idx").on(table.branchId),
    uniqueIndex("broker_profiles_tenant_internal_code_unique").on(table.tenantId, table.internalCode),
    uniqueIndex("broker_profiles_tenant_email_unique").on(table.tenantId, table.invitedEmail),
    uniqueIndex("broker_profiles_tenant_cpf_unique").on(table.tenantId, table.cpf),
  ],
);

export const brokerInvitations = pgTable(
  "broker_invitations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    brokerProfileId: text("broker_profile_id")
      .notNull()
      .references(() => brokerProfiles.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: tenantRole("role").notNull().default("broker"),
    jobTitle: text("job_title").notNull().default("broker"),
    tokenHash: text("token_hash").notNull().unique(),
    tokenCiphertext: text("token_ciphertext"),
    status: text("status", { enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED", "REPLACED"] })
      .notNull()
      .default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    deliveryStatus: text("delivery_status", { enum: ["pending", "queued", "sent", "failed", "not_available"] }).notNull().default("pending"),
    deliveryMessageId: text("delivery_message_id"),
    deliveryAttempts: integer("delivery_attempts").notNull().default(0),
    deliveryError: text("delivery_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("broker_invitations_tenant_idx").on(table.tenantId),
    index("broker_invitations_profile_idx").on(table.brokerProfileId),
  ],
);

export const userOnboarding = pgTable(
  "user_onboarding",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: onboardingStatus("status")
      .notNull()
      .default("PENDING"),
    currentStep: text("current_step"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    passwordCreatedAt: timestamp("password_created_at", { withTimezone: true }),
    personalDataCompletedAt: timestamp("personal_data_completed_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt,
  },
  (table) => [
    uniqueIndex("user_onboarding_user_tenant_unique").on(table.userId, table.tenantId),
  ],
);

export const termsAcceptances = pgTable(
  "terms_acceptances",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    termsVersion: text("terms_version").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("terms_acceptances_user_idx").on(table.userId),
  ],
);

export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    userPhone: text("user_phone"),
    status: text("status").notNull().default("requested"),
    token: text("token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    directorNotes: text("director_notes"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("password_reset_requests_tenant_idx").on(table.tenantId, table.status),
    index("password_reset_requests_user_idx").on(table.userId),
  ],
);

export const proposalStatusValues = [
  "rascunho",
  "em_revisao",
  "enviada",
  "visualizada",
  "negociacao",
  "aprovada",
  "perdida",
  "expirada",
] as const;

export const proposalStatus = pgEnum("proposal_status", proposalStatusValues);

export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    quoteId: text("quote_id")
      .references(() => quotes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    status: proposalStatus("status").notNull().default("rascunho"),
    version: integer("version").notNull().default(1),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    notes: text("notes"),
    documentIds: jsonb("document_ids").notNull().default([]),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedSaleId: text("converted_sale_id").references(() => sales.id, { onDelete: "set null" }),
    totalMonthly: numeric("total_monthly", { precision: 12, scale: 2 }).notNull().default("0"),
    beneficiaryCount: integer("beneficiary_count").notNull().default(0),
    leadName: text("lead_name").notNull(),
    leadPhone: text("lead_phone"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("proposals_tenant_lead_idx").on(table.tenantId, table.leadId),
    index("proposals_status_idx").on(table.status),
  ],
);

export const automationStatusValues = ["rascunho", "teste", "publicado", "pausado", "encerrado"] as const;
export const automationStatus = pgEnum("automation_status", automationStatusValues);

export const automationLogStatusValues = ["pending", "processing", "completed", "failed", "dead_letter"] as const;
export const automationLogStatus = pgEnum("automation_log_status", automationLogStatusValues);

export const crmAutomations = pgTable(
  "crm_automations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    triggerType: text("trigger_type").notNull(),
    status: automationStatus("status").notNull().default("rascunho"),
    version: integer("version").notNull().default(1),
    description: text("description"),
    configuration: jsonb("configuration").notNull().default({}),
    templateBody: text("template_body").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("crm_automations_tenant_idx").on(table.tenantId, table.status),
  ],
);

export const crmAutomationLogs = pgTable(
  "crm_automation_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    automationId: text("automation_id")
      .notNull()
      .references(() => crmAutomations.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .references(() => leads.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .references(() => clients.id, { onDelete: "cascade" }),
    status: automationLogStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("crm_automation_logs_run_idx").on(table.status, table.runAfter),
  ],
);

/**
 * Versioned definitions for the modular Automation Builder. This is intentionally
 * separate from crmAutomations while the legacy outbound engine is still active.
 */
export const workflowAutomations = pgTable(
  "workflow_automations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: automationStatus("status").notNull().default("rascunho"),
    draftDefinition: jsonb("draft_definition").notNull().default({ schemaVersion: 1, nodes: [], edges: [] }),
    publishedVersionId: text("published_version_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("workflow_automations_tenant_status_idx").on(table.tenantId, table.status),
    index("workflow_automations_tenant_updated_idx").on(table.tenantId, table.updatedAt),
  ],
);

/** Immutable snapshots created only on publication. */
export const workflowAutomationVersions = pgTable(
  "workflow_automation_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflowAutomations.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").notNull(),
    publishedBy: text("published_by")
      .notNull()
      .references(() => user.id),
    createdAt,
  },
  (table) => [
    uniqueIndex("workflow_automation_versions_workflow_version_unique").on(table.workflowId, table.version),
    index("workflow_automation_versions_tenant_workflow_idx").on(table.tenantId, table.workflowId),
  ],
);

export const whatsappFlows = pgTable(
  "whatsapp_flows",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    triggerType: text("trigger_type").notNull(),
    status: text("status").notNull().default("active"),
    configuration: jsonb("configuration").notNull().default({}),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("whatsapp_flows_tenant_idx").on(table.tenantId),
  ],
);

/** Qualification AI follow-up rules per tenant. */
export const aiQualificationFollowUpRules = pgTable(
  "ai_qualification_followup_rules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    trigger: text("trigger").notNull(),
    delayMinutes: integer("delay_minutes").notNull().default(120),
    maxAttempts: integer("max_attempts").notNull().default(3),
    minimumIntervalMinutes: integer("minimum_interval_minutes").notNull().default(60),
    allowedDays: jsonb("allowed_days").notNull().default([1, 2, 3, 4, 5]),
    allowedStartTime: text("allowed_start_time").notNull().default("08:00"),
    allowedEndTime: text("allowed_end_time").notNull().default("18:00"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    messageMode: text("message_mode").notNull().default("fixed"),
    fixedMessage: text("fixed_message"),
    templateId: text("template_id"),
    stopConditions: jsonb("stop_conditions").notNull().default(["client_responded", "human_taken", "lead_closed", "sale_completed", "opt_out"]),
    destinationStatus: text("destination_status"),
    createdAt,
    updatedAt,
  },
  (table) => [index("ai_qualification_followup_tenant_idx").on(table.tenantId, table.enabled)],
);

/** MCP Tools permission and governance matrix. */
export const aiQualificationToolPermissions = pgTable(
  "ai_qualification_tool_permissions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    category: text("category").notNull(),
    permission: text("permission").notNull().default("allowed"),
    allowedStageTransitions: jsonb("allowed_stage_transitions"),
    maxCallsPerSession: integer("max_calls_per_session").notNull().default(10),
    requiresHumanConfirmation: boolean("requires_human_confirmation").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("ai_qualification_tool_perm_unique").on(table.tenantId, table.toolName)],
);

/** Destination and routing rules for qualified leads based on temperature. */
export const aiQualificationDestinationRules = pgTable(
  "ai_qualification_destination_rules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    temperatureClass: text("temperature_class").notNull(),
    destinationType: text("destination_type").notNull(),
    destinationTargetId: text("destination_target_id"),
    priority: text("priority").notNull().default("normal"),
    slaMinutes: integer("sla_minutes").notNull().default(15),
    fallbackDestinationType: text("fallback_destination_type").notNull().default("manager"),
    criteriaConditions: jsonb("criteria_conditions"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [index("ai_qualification_dest_tenant_idx").on(table.tenantId, table.temperatureClass)],
);

/** Broker eligibility profile and distribution limits. */
export const brokerEligibilityProfiles = pgTable(
  "broker_eligibility_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    allowedLeadTypes: jsonb("allowed_lead_types").notNull().default(["hot", "warm", "cold"]),
    specialties: jsonb("specialties").notNull().default(["individual", "familiar", "empresarial", "pme"]),
    operators: jsonb("operators").notNull().default(["unimed", "hapvida"]),
    maxSimultaneousCapacity: integer("max_simultaneous_capacity").notNull().default(15),
    dailyLimit: integer("daily_limit").notNull().default(40),
    participatesInDuty: boolean("participates_in_duty").notNull().default(true),
    receivesOffHours: boolean("receives_off_hours").notNull().default(false),
    active: boolean("active").notNull().default(true),
    paused: boolean("paused").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("broker_eligibility_tenant_user_unique").on(table.tenantId, table.userId)],
);

/** Deterministic closing state tracker per qualification session. */
export const aiQualificationClosingStates = pgTable(
  "ai_qualification_closing_states",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    leadId: text("lead_id"),
    qualificationCompletedAt: timestamp("qualification_completed_at", { withTimezone: true }),
    closingMessageQueuedAt: timestamp("closing_message_queued_at", { withTimezone: true }),
    closingMessageSentAt: timestamp("closing_message_sent_at", { withTimezone: true }),
    closingMessageId: text("closing_message_id"),
    closingMessageStatus: text("closing_message_status").notNull().default("pending"),
    distributionExecutedAt: timestamp("distribution_executed_at", { withTimezone: true }),
    handoffCreatedAt: timestamp("handoff_created_at", { withTimezone: true }),
    postClosingNoticeSentAt: timestamp("post_closing_notice_sent_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("ai_qualification_closing_session_unique").on(table.tenantId, table.sessionId)],
);

/** Non-AI static system messages configured per tenant. */
export const aiQualificationSystemMessages = pgTable(
  "ai_qualification_system_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    messageText: text("message_text").notNull(),
    templateId: text("template_id"),
    variables: jsonb("variables"),
    active: boolean("active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("ai_qualification_sysmsg_tenant_cat_unique").on(table.tenantId, table.category)],
);

/** Operational alerts for integration, queues, errors and costs. */
export const aiQualificationAlerts = pgTable(
  "ai_qualification_alerts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    alertType: text("alert_type").notNull(),
    level: text("level").notNull().default("warning"),
    status: text("status").notNull().default("active"),
    message: text("message").notNull(),
    suggestedAction: text("suggested_action"),
    createdAt,
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
  },
  (table) => [index("ai_qualification_alerts_tenant_idx").on(table.tenantId, table.status)],
);

/** ─── Tenant Intelligence Layer Tables ────────────────────────────────────── **/

/** Company profile & intelligence settings per tenant. */
export const tenantIntelligenceProfiles = pgTable(
  "tenant_intelligence_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
    tradeName: text("trade_name"),
    companyName: text("company_name"),
    cnpj: text("cnpj"),
    description: text("description"),
    segment: text("segment").default("Planos de Saúde e Odontológicos"),
    website: text("website"),
    phone: text("phone"),
    email: text("email"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    addressZip: text("address_zip"),
    positioning: jsonb("positioning").notNull().default({
      aboutUs: "",
      differentials: [],
      targetAudience: "",
      regionsServed: [],
      productsOffered: [],
      toneOfVoice: "professional",
    }),
    serviceConfig: jsonb("service_config").notNull().default({
      businessHours: "08:00 às 18:00",
      businessDays: "Segunda a Sexta",
      channels: ["WhatsApp", "Site", "Telefone"],
      slaMinutes: 15,
      supportEmail: "",
      supportPhone: "",
    }),
    commercialRules: jsonb("commercial_rules").notNull().default({
      operators: [],
      products: [],
      rulesSummary: "",
    }),
    createdAt,
    updatedAt,
  }
);

/** Structured intelligence profile per branch/unit. */
export const unitIntelligenceProfiles = pgTable(
  "unit_intelligence_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
    unitName: text("unit_name").notNull(),
    managerName: text("manager_name"),
    managerEmail: text("manager_email"),
    phone: text("phone"),
    addressStreet: text("address_street"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    businessHours: text("business_hours"),
    serviceRegions: jsonb("service_regions").notNull().default([]),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("unit_intel_tenant_branch_unique").on(table.tenantId, table.branchId)]
);

/** Knowledge collections for grouping documents & sources. */
export const knowledgeCollections = pgTable(
  "knowledge_collections",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    color: text("color").default("#3b82f6"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("knowledge_coll_tenant_slug_unique").on(table.tenantId, table.slug)]
);

/** Original uploaded files / raw materials. */
export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size").notNull(),
    fileUrl: text("file_url").notNull(),
    hashMd5: text("hash_md5"),
    category: text("category").notNull().default("general"),
    status: text("status").notNull().default("uploaded"), // uploaded | parsing | parsed | error
    errorMessage: text("error_message"),
    uploadedBy: text("uploaded_by"),
    createdAt,
    updatedAt,
  },
  (table) => [index("knowledge_sources_tenant_idx").on(table.tenantId, table.status)]
);

/** Canonical knowledge documents generated after ingestion. */
export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => knowledgeSources.id, { onDelete: "set null" }),
    collectionId: text("collection_id").references(() => knowledgeCollections.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    canonicalContent: text("canonical_content").notNull(),
    category: text("category").notNull().default("general"),
    authorityLevel: integer("authority_level").notNull().default(3), // 1 to 5
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("published"), // draft | review | published | archived
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [index("knowledge_docs_tenant_status_idx").on(table.tenantId, table.status)]
);

/** Chunks generated for RAG vector & full-text search. */
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    authorityLevel: integer("authority_level").notNull().default(3),
    metadata: jsonb("metadata").notNull().default({}),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt,
  },
  (table) => [index("knowledge_chunks_tenant_doc_idx").on(table.tenantId, table.documentId)]
);

/** Suggestions for updating structured CRM data from uploaded materials. */
export const knowledgeSuggestions = pgTable(
  "knowledge_suggestions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => knowledgeSources.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(), // company | unit | product | operator
    entityId: text("entity_id"),
    title: text("title").notNull(),
    currentData: jsonb("current_data").notNull().default({}),
    detectedData: jsonb("detected_data").notNull().default({}),
    diff: jsonb("diff").notNull().default([]),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | ignored
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [index("knowledge_sugg_tenant_status_idx").on(table.tenantId, table.status)]
);

/** Conflicting facts between official documents. */
export const knowledgeConflicts = pgTable(
  "knowledge_conflicts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    docIdA: text("doc_id_a").notNull(),
    docIdB: text("doc_id_b").notNull(),
    topic: text("topic").notNull(),
    factA: text("fact_a").notNull(),
    factB: text("fact_b").notNull(),
    status: text("status").notNull().default("open"), // open | resolved | ignored
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [index("knowledge_conflicts_tenant_idx").on(table.tenantId, table.status)]
);

/** Agent definitions created in Agent Builder. */
export const agentDefinitions = pgTable(
  "agent_definitions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    objective: text("objective").notNull(),
    category: text("category").notNull().default("general"), // qualification | sales | documentation | quote | support
    modelProvider: text("model_provider").notNull().default("groq"),
    modelName: text("model_name").notNull().default("llama-3.3-70b-versatile"),
    temperature: numeric("temperature").notNull().default("0.7"),
    maxTokens: integer("max_tokens").notNull().default(1024),
    systemPrompt: text("system_prompt").notNull(),
    allowedTools: jsonb("allowed_tools").notNull().default([]),
    allowedCollectionIds: jsonb("allowed_collection_ids").notNull().default([]),
    memoryScope: text("memory_scope").notNull().default("conversation"), // none | conversation | session | lead
    outputFormat: text("output_format").notNull().default("markdown"), // markdown | json_schema | classification
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("agent_def_tenant_slug_unique").on(table.tenantId, table.slug)]
);

/** Evaluation test cases for evaluating agent accuracy & hallucination. */
export const evaluationTestCases = pgTable(
  "evaluation_test_cases",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    agentId: text("agent_id").references(() => agentDefinitions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    inputPrompt: text("input_prompt").notNull(),
    expectedOutput: text("expected_output").notNull(),
    forbiddenOutput: text("forbidden_output"),
    expectedTools: jsonb("expected_tools").notNull().default([]),
    createdAt,
    updatedAt,
  }
);

/** Evaluation runs comparing agent versions against test cases. */
export const agentEvaluationRuns = pgTable(
  "agent_evaluation_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull().references(() => agentDefinitions.id, { onDelete: "cascade" }),
    agentVersion: integer("agent_version").notNull(),
    totalCases: integer("total_cases").notNull(),
    passedCases: integer("passed_cases").notNull(),
    accuracyRate: numeric("accuracy_rate").notNull(), // e.g. 94.0
    hallucinationRate: numeric("hallucination_rate").notNull(), // e.g. 1.2
    avgLatencyMs: integer("avg_latency_ms").notNull(),
    totalCostEst: numeric("total_cost_est").notNull().default("0.00"),
    runDetails: jsonb("run_details").notNull().default([]),
    createdAt,
  }
);

/** Anonymized conversation examples for few-shot & playbook extraction. */
export const conversationExamples = pgTable(
  "conversation_examples",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    channel: text("channel").default("whatsapp"),
    outcome: text("outcome").notNull().default("converted"), // converted | lost
    qualityRating: integer("quality_rating").notNull().default(5), // 1-5
    tags: jsonb("tags").notNull().default([]),
    anonymizedMessages: jsonb("anonymized_messages").notNull().default([]),
    extractedPlaybook: jsonb("extracted_playbook").notNull().default({}),
    createdAt,
    updatedAt,
  }
);

export type TenantRole = (typeof tenantRoleValues)[number];
export type TenantStatus = (typeof tenantStatusValues)[number];
export type PasswordResetRequestStatus = "requested" | "approved" | "rejected" | "completed";
export type ProposalStatus = (typeof proposalStatusValues)[number];
export type AutomationStatus = (typeof automationStatusValues)[number];
export type AutomationLogStatus = (typeof automationLogStatusValues)[number];
