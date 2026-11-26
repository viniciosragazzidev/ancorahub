"use client";

/**
 * "Notificações" em Minha conta (Lite): por tipo de aviso, liga ou desliga o push e, onde já existe, o WhatsApp
 * interno. O aviso no app continua sempre. "Privacidade do push" troca o texto do celular por um genérico, sem
 * nome nem telefone do lead.
 *
 * Feedback (FEEDBACK.md, nível 1): cada interruptor salva na hora; o estado novo só fica depois que o servidor
 * confirma, e a confirmação aparece na própria seção. Na falha o interruptor volta, com a causa e "Tentar de novo".
 */
import { useState } from "react";

import { Switch } from "@/components/arc/switch/switch";
import styles from "@/components/lite/page/lite-sections.module.css";
import { saveNotificationPreferencesAction } from "@/features/notifications/preferences-actions";
import {
  notificationPreferenceGroups,
  privatePushText,
  type NotificationChannel,
  type NotificationPreferences,
} from "@/features/notifications/preferences-core";

import { ActionNote, useActionStatus } from "./action-status-lite";

const CHANNEL_LABELS: Record<NotificationChannel, string> = { push: "Push", whatsapp: "WhatsApp" };

export function NotificationPreferencesLite({ initial }: { initial: NotificationPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const { status, run } = useActionStatus();
  const busy = status.prefs?.state === "busy";

  function save(next: NotificationPreferences, done: string) {
    void run("prefs", async () => {
      const result = await saveNotificationPreferencesAction(next);
      if (result.success) setPrefs(result.preferences);
      return result;
    }, { done, fallback: "Não foi possível salvar as notificações.", keeps: "As preferências anteriores continuam valendo." });
  }

  function toggleChannel(groupId: (typeof notificationPreferenceGroups)[number]["id"], channel: NotificationChannel, checked: boolean) {
    const next: NotificationPreferences = {
      ...prefs,
      channels: { ...prefs.channels, [groupId]: { ...prefs.channels[groupId], [channel]: checked } },
    };
    save(next, checked ? `${CHANNEL_LABELS[channel]} ligado.` : `${CHANNEL_LABELS[channel]} desligado.`);
  }

  return (
    <>
      <section className={styles.group} aria-labelledby="notification-prefs-title">
        <div className={styles.row}>
          <div className={styles.rowText}>
            <h3 id="notification-prefs-title" className={styles.rowTitle}>Notificações</h3>
            <p className={styles.rowDescription}>Escolha por onde cada aviso chega. No app eles continuam aparecendo.</p>
          </div>
        </div>
        {notificationPreferenceGroups.map((group) => (
          <div key={group.id} className={styles.row}>
            <div className={styles.rowText}>
              <span id={`notification-group-${group.id}`} className={styles.rowTitle}>{group.label}</span>
              <span className={styles.rowDescription}>{group.description}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {group.channels.map((channel) => (
                <label key={channel} className="flex min-h-11 items-center gap-2 text-sm">
                  <span>{CHANNEL_LABELS[channel]}</span>
                  <Switch
                    aria-label={`${group.label}: ${CHANNEL_LABELS[channel]}`}
                    checked={prefs.channels[group.id][channel]}
                    disabled={busy}
                    aria-busy={busy || undefined}
                    onCheckedChange={(checked) => toggleChannel(group.id, channel, checked)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        {status.prefs ? <div className={styles.row}><ActionNote status={status.prefs} /></div> : null}
      </section>

      <section className={styles.group} aria-labelledby="push-privacy-title">
        <div className={styles.row}>
          <div className={styles.rowText}>
            <h3 id="push-privacy-title" className={styles.rowTitle}>Privacidade do push</h3>
            <p className={styles.rowDescription}>
              Ligado, o celular não mostra nome nem telefone do lead. Aparece só “{privatePushText("lead_assignment")}”.
            </p>
          </div>
          <Switch
            aria-labelledby="push-privacy-title"
            checked={prefs.pushPrivacy}
            disabled={busy}
            aria-busy={busy || undefined}
            onCheckedChange={(checked) => save({ ...prefs, pushPrivacy: checked }, checked ? "Privacidade do push ligada." : "Privacidade do push desligada.")}
          />
        </div>
      </section>
    </>
  );
}
