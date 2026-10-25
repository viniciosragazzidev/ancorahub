import Link from "next/link";

import { LightAuthTitle } from "@/components/light/light-auth-shell";

import styles from "../auth-lite.module.css";

export default function AccessDeniedPage() {
  return (
    <div className={styles.stack}>
      <LightAuthTitle title="Acesso negado" description="Sua conta, associação ou tenant não está ativo para esta área." />
      <Link className={styles.linkButton} href="/login">Voltar ao login</Link>
    </div>
  );
}
