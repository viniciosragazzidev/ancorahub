"use client";

/**
 * Visão oficial (Meta) do WhatsApp no visual Lite. Mesmas regras de "pronto", de quem conecta número e de quais números
 * de coexistência aparecem; os cartões de configuração são os mesmos componentes, numa moldura Lite.
 */
import Link from "next/link";

import compat from "@/components/lite/page/lite-compat.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import type { ChannelLeadIntake } from "@/features/communication-channels/channel-lead-intake";
import { CoexistenceNumbersCard } from "@/features/communication-channels/components/coexistence-numbers-card";
import { MetaCloudSetupCard } from "@/features/communication-channels/components/meta-cloud-setup-card";
import { MetaEmbeddedSignupCard } from "@/features/communication-channels/components/meta-embedded-signup-card";
import { WhatsAppTestMessageCard } from "@/features/communication-channels/components/whatsapp-test-message-card";

import { WhatsAppHeadingLite } from "../integrations/whatsapp/whatsapp-heading-lite";
import liteStyles from "../integrations/whatsapp/whatsapp-lite.module.css";

export type WhatsAppChannel = {
  id: string;
  branchId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  branchName: string | null;
  status: string;
  qualityRating: string | null;
  messagingLimit: string | null;
  registrationStatus: string;
  registrationErrorCode: string | null;
  registeredAt: Date | null;
  businessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  lastWebhookAt: Date | null;
  activatedAt: Date | null;
  tokenExpiresAt: Date | null;
  isDefault: boolean;
  onboardingMode: string;
  syncStatus: string | null;
  syncRequestedAt: Date | null;
  syncError: string | null;
  hasCredentials: boolean;
  leadIntake?: ChannelLeadIntake;
};

export type WhatsAppOfficialSetup = {
  enabled: boolean;
  configured: boolean;
  missing: string[];
  appId: string | null;
  embeddedSignupConfigId: string | null;
  canConfigure: boolean;
  branches: { id: string; name: string }[];
  channels: WhatsAppChannel[];
  companyAccount: WhatsAppChannel | null;
  queues?: { id: string; name: string }[];
  adAccountNames?: string[];
};

const CONTROLS = [
  { title: "Conectar", text: "Vincula a conta WhatsApp Business e um único número corporativo ao tenant atual." },
  { title: "Pausar ou reativar", text: "Interrompe ou retoma novos envios e recebimentos oficiais sem remover a configuração." },
  { title: "Desconectar", text: "Remove as credenciais do CRM, preserva histórico e auditoria, e libera a conexão de um novo número." },
];

export function WhatsAppPageLite({ official }: { official: WhatsAppOfficialSetup }) {
  const officialReady = official.enabled && official.configured && official.companyAccount?.status === "active" && official.companyAccount.registrationStatus === "registered" && official.companyAccount.hasCredentials;
  const canConnectNumber = official.canConfigure && official.enabled && official.configured && official.appId && official.embeddedSignupConfigId && (!official.companyAccount?.hasCredentials || official.companyAccount.status !== "active");
  const coexistenceChannels = official.channels.filter((channel) => channel.onboardingMode === "coexistence" && channel.id !== official.companyAccount?.id);
  const canConnectCoexistence = Boolean(official.canConfigure && official.enabled && official.configured && official.appId && official.embeddedSignupConfigId);

  return (
    <main className={page.stack}>
      <WhatsAppHeadingLite active="oficial" canViewDirector={official.canConfigure} />
      <div className={liteStyles.split}>
        <div className={page.group}>
          <section className={sections.group} aria-labelledby="official-number-title">
            <div className={sections.row}>
              <div className={sections.rowText}>
                <h2 id="official-number-title" className={sections.rowTitle}>Número oficial</h2>
                <p className={sections.rowDescription}>Canal corporativo da Meta para atendimento comercial e mensagens oficiais.</p>
              </div>
              <span className={page.badge} data-tone={officialReady ? "success" : "warning"}>{officialReady ? "Pronto" : "Configuração pendente"}</span>
            </div>
            <div className={sections.formBody}>
              <dl className={liteStyles.facts}>
                <div><dt>Número</dt><dd>Um canal corporativo oficial por corretora.</dd></div>
                <div><dt>Atendimento</dt><dd>Conversas vinculadas ao lead e histórico no CRM.</dd></div>
                <div><dt>Governança</dt><dd>Pausar, reativar ou desconectar sem apagar histórico.</dd></div>
              </dl>
              <div className={compat.compat}>
                <MetaCloudSetupCard companyAccount={official.companyAccount} configured={official.configured} enabled={official.enabled} missing={official.missing} canManage={official.canConfigure} />
                {canConnectNumber ? <MetaEmbeddedSignupCard appId={official.appId!} configId={official.embeddedSignupConfigId!} /> : null}
              </div>
            </div>
          </section>
          {official.canConfigure || coexistenceChannels.length ? (
            <div className={compat.compat}>
              <CoexistenceNumbersCard channels={coexistenceChannels} appId={official.appId} configId={official.embeddedSignupConfigId} canConnect={canConnectCoexistence} queues={official.queues ?? []} adAccountNames={official.adAccountNames ?? []} />
            </div>
          ) : null}
          <div className={compat.compat}>
            <WhatsAppTestMessageCard />
          </div>
        </div>
        <section className={sections.group} aria-labelledby="official-controls-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="official-controls-title" className={sections.rowTitle}>O que esta conexão controla</h2>
              <p className={sections.rowDescription}>O número oficial é uma integração separada e não muda sua configuração de Marketing Meta.</p>
            </div>
          </div>
          {CONTROLS.map((item) => (
            <div key={item.title} className={sections.row}>
              <div className={sections.rowText}>
                <p className={sections.rowTitle}>{item.title}</p>
                <p className={sections.rowDescription}>{item.text}</p>
              </div>
            </div>
          ))}
          <div className={sections.row}>
            <p className={sections.note}>Páginas, campanhas, pixels, formulários e filas são configurados em Marketing Meta. Esta tela não altera nenhum desses ativos.</p>
          </div>
        </section>
      </div>
      <section className={sections.group} aria-labelledby="auto-messages-title">
        <div className={sections.row}>
          <div className={sections.rowText}>
            <h2 id="auto-messages-title" className={sections.rowTitle}>Mensagens automáticas</h2>
            <p className={sections.rowDescription}>Templates Meta, mensagens livres e situações do fluxo ficam em Atendimento, na aba Mensagens.</p>
          </div>
          <Link href="/atendimento/mensagens" className={page.button}>Configurar mensagens</Link>
        </div>
      </section>
    </main>
  );
}
