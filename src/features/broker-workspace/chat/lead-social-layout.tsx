import type { ReactNode } from "react";

import styles from "./lead-social.module.css";

/**
 * The lead as a social-network screen (Vinicios, 17/10): the client's profile and the conversation together.
 * Computer: profile on the left, conversation on the right, each scrolls on its own.
 * Phone: the profile is a compact block on top, the conversation fills the rest of the screen.
 */
export function LeadSocialLayout({ profile, children }: { profile: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.profile} aria-label="Perfil do cliente">{profile}</aside>
      <div className={styles.conversation}>{children}</div>
    </div>
  );
}
