/**
 * Visão de materiais do WhatsApp no visual Lite: o aviso da captura, o canal, os grupos e o resumo de 7 dias. Recebe os
 * dados já carregados pela visão (mesmas consultas); aqui só a apresentação.
 */
import type { ComponentProps } from "react";

import compat from "@/components/lite/page/lite-compat.module.css";
import litePage from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import {
  disconnectMaterialsChannelAction,
  pollMaterialsChannelAction,
  refreshMaterialGroupsAction,
  setMaterialGroupActiveAction,
  startMaterialsChannelAction,
} from "@/features/waha-group-capture/channel-actions";

import { MaterialGroupsCard } from "../whats_alt/_components/material-groups-card";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { CAPTURE_STATUS_LABELS, formatDateTime, MATERIALS_CARD_TEXTS } from "./materials-whatsapp-texts";
import { WhatsAppHeadingLite } from "./whatsapp-heading-lite";
import liteStyles from "./whatsapp-lite.module.css";

type Channel = ComponentProps<typeof TenantChannelCard>["initialChannel"];
type Groups = ComponentProps<typeof MaterialGroupsCard>["groups"];
type Stats = { total: number; lastMessageAt: Date | null; byStatus: Record<string, number> } | null;

export function MaterialsWhatsAppLite({ channel, captureOn, loadFailed, missingTables, groups, stats }: { channel: Channel; captureOn: boolean; loadFailed: boolean; missingTables: boolean; groups: Groups | null; stats: Stats }) {
  const statusRows = Object.entries(stats?.byStatus ?? {}).sort((a, b) => b[1] - a[1]);
  return (
      <main className={litePage.stack}>
        <WhatsAppHeadingLite active="materiais" canViewDirector />
        <div className={sections.notice} data-tone={captureOn ? undefined : "warning"} role="status">
          <p className={sections.noticeTitle} data-tone={captureOn ? undefined : "warning"}>{captureOn ? "Captura ligada" : "Captura desligada"}</p>
          <p className={sections.note}>
            {captureOn
              ? "A captura está ligada pela plataforma. Só os grupos ativos abaixo são lidos."
              : "A captura está desligada pela plataforma. Você já pode conectar o número e escolher os grupos, mas nada é lido até ela ser ligada. Peça ao administrador da plataforma."}
          </p>
        </div>
        <div className={compat.compat}>
          <TenantChannelCard initialChannel={channel} texts={MATERIALS_CARD_TEXTS} actions={{ start: startMaterialsChannelAction, poll: pollMaterialsChannelAction, disconnect: disconnectMaterialsChannelAction }} />
        </div>
        {loadFailed ? (
          <div className={sections.notice} data-tone="warning" role="alert">
            <p className={sections.note}>
              {missingTables
                ? "O banco ainda não tem as tabelas desta função (migrações 0203 e 0204). Peça ao administrador da plataforma para aplicar as migrações e recarregue a página. Você já pode conectar o número acima."
                : "Não foi possível carregar os grupos e o resumo agora. Tente recarregar a página."}
            </p>
          </div>
        ) : null}
        {groups ? (
          <div className={compat.compat}>
            <MaterialGroupsCard groups={groups} channelReady={channel?.status === "ready"} actions={{ refresh: refreshMaterialGroupsAction, toggle: setMaterialGroupActiveAction }} />
          </div>
        ) : null}
        {stats ? (
          <section className={sections.group} aria-labelledby="materials-stats-title">
            <div className={sections.row}>
              <div className={sections.rowText}>
                <h2 id="materials-stats-title" className={sections.rowTitle}>Últimos 7 dias</h2>
                <p className={sections.rowDescription}>
                  O que a captura fez com as mensagens dos grupos ativos.
                  {stats.lastMessageAt ? ` Última mensagem em ${formatDateTime(stats.lastMessageAt)}.` : ""}
                </p>
              </div>
            </div>
            <div className={sections.formBody}>
              {stats.total === 0 ? (
                <p className={sections.note}>Nenhuma mensagem de grupo capturada ainda.</p>
              ) : (
                <dl className={liteStyles.stats}>
                  {statusRows.map(([status, count]) => (
                    <div key={status} className={liteStyles.stat}>
                      <dt>{CAPTURE_STATUS_LABELS[status] ?? status}</dt>
                      <dd>{count}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>
        ) : null}
      </main>
  );
}
