import { LightAuthTitle } from "@/components/light/light-auth-shell";

import styles from "../auth-lite.module.css";

/** Aviso de confirmação de e-mail no visual Lite: o texto passa a usar os tokens da moldura clara (antes era cinza claro sobre fundo claro). */
export default function VerifyPage() {
  return (
    <>
      <LightAuthTitle
        title="Verifique seu e-mail"
        description="Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta."
      />
      <p className={styles.note}>
        Não recebeu? Verifique a pasta de spam ou entre em contato com o administrador.
      </p>
    </>
  );
}
