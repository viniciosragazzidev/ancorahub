/**
 * Aviso da exigência de 2FA (26/11/2026). Na carência aparece em todas as telas; depois dela só se vê nas
 * configurações, porque o layout leva para lá quem ainda não ativou. Sem som e sem toast: é estado, não evento.
 */
import Link from "next/link";

import { TWO_FACTOR_SETUP_HREF, twoFactorGraceLabel, type TwoFactorRequirement } from "../two-factor-policy";
import styles from "./two-factor-required-notice.module.css";

const deadlineFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export function TwoFactorRequiredNotice({ requirement }: { requirement: TwoFactorRequirement }) {
  if (requirement.state === "free") return null;
  const lastDay = new Date(requirement.deadline.getTime() - 1);
  return (
    <div className={`arc-venancor ${styles.notice}`} role="status" aria-live="polite">
      {requirement.state === "grace" ? (
        <p className={styles.text}>
          A corretora pede verificação em duas etapas. <span>{twoFactorGraceLabel(requirement.daysLeft)} Prazo até {deadlineFormat.format(lastDay)}.</span>
        </p>
      ) : (
        <p className={styles.text}>
          Ative a verificação em duas etapas ou uma chave de acesso para continuar. <span>O resto do sistema volta assim que ativar.</span>
        </p>
      )}
      <Link className={styles.action} href={TWO_FACTOR_SETUP_HREF}>Ativar agora</Link>
    </div>
  );
}
