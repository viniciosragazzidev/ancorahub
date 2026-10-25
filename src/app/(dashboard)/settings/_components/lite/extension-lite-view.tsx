/** Corpo da seção "Extensão" no visual Lite, a partir dos dados já carregados (sem acesso ao banco aqui). */
import page from "@/components/lite/page/lite-page.module.css";
import { updateExtensionSettingsAction } from "@/features/browser-extension/actions";

import { ExtensionConnectLite, ExtensionHelpLite } from "./extension-lite-parts";
import styles from "./sections-lite.module.css";

export type ExtensionLiteData = { enabled: boolean; minimumVersion: string; canConfigure: boolean };

export function ExtensionLiteView({ data }: { data: ExtensionLiteData }) {
  return (
    <div className={styles.group}>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <p className={styles.rowTitle}>Atendimento contextual no WhatsApp Web</p>
          <p className={styles.rowDescription}>Conecte o seu navegador ao CRM para abrir rapidamente o lead certo durante o atendimento. A extensão nunca envia mensagens automaticamente.</p>
        </div>
      </div>
      <div className={styles.formBody}>
        <div className={styles.badges}>
          <a href="/downloads/ancorahub-assistant.zip" download className={page.primaryButton}>Baixar extensão</a>
          <ExtensionHelpLite />
        </div>
        <p className={styles.note}>Depois de baixar, extraia o arquivo e adicione a pasta em chrome://extensions. Quando a publicação na Chrome Web Store estiver disponível, a instalação poderá ser feita em um clique.</p>
        <p className={styles.note}>Versão mínima: {data.minimumVersion}</p>
      </div>
      <div className={styles.row}>
        {data.canConfigure ? (
          <form action={updateExtensionSettingsAction} className={styles.badges} style={{ alignItems: "center" }}>
            <input type="hidden" name="enabled" value={data.enabled ? "false" : "true"} />
            <button type="submit" className={page.button}>{data.enabled ? "Desativar para a empresa" : "Habilitar para a empresa"}</button>
            <span className={page.badge} data-tone={data.enabled ? "success" : undefined}>{data.enabled ? "Ativa para a empresa" : "Desativada pela empresa"}</span>
          </form>
        ) : (
          <p className={styles.note}>A disponibilidade é definida pelo Diretor. Quando habilitada, você pode instalar e conectar o seu navegador nesta tela.</p>
        )}
      </div>
      <ExtensionConnectLite />
      <div className={styles.row}>
        <p className={styles.note}>O painel só aparece no WhatsApp Web para leads atribuídos ao seu usuário e à sua unidade. A sessão é revogável por aparelho.</p>
      </div>
    </div>
  );
}
