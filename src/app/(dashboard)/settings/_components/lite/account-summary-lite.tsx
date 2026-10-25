/** Resumo de "Minha conta" no visual Lite (sem perfil completo): nome, e-mail e perfil de acesso. */
import styles from "./sections-lite.module.css";

export function AccountSummaryLite({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <dl className={styles.group}>
      <div className={styles.row}>
        <dt className={styles.rowDescription}>Nome</dt>
        <dd className={styles.value}>{name}</dd>
      </div>
      <div className={styles.row}>
        <dt className={styles.rowDescription}>E-mail</dt>
        <dd className={styles.value}>{email}</dd>
      </div>
      <div className={styles.row}>
        <dt className={styles.rowDescription}>Perfil de acesso</dt>
        <dd className={styles.rowText}>
          <span className={styles.value}>{role}</span>
          <span className={styles.rowDescription}>O perfil é administrado pela corretora e não pode ser alterado nesta tela.</span>
        </dd>
      </div>
    </dl>
  );
}
