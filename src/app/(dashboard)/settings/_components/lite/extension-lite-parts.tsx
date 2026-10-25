"use client";

/** Peças de cliente da extensão no visual Lite: gerar o código de ativação e a ajuda "Como funciona" no painel lateral. */
import { useState, useTransition } from "react";
import { CircleHelp } from "lucide-react";

import { LiteSidePanel } from "@/components/lite/data/side-panel";
import page from "@/components/lite/page/lite-page.module.css";
import { createExtensionCodeAction } from "@/features/browser-extension/actions";

import styles from "./sections-lite.module.css";

export function ExtensionConnectLite() {
  const [code, setCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className={styles.formBody}>
      <div>
        <button
          type="button"
          className={page.button}
          disabled={isPending}
          onClick={() => startTransition(async () => {
            const result = await createExtensionCodeAction();
            setCode(result.code);
          })}
        >
          {isPending ? "Gerando…" : "Gerar código de ativação"}
        </button>
      </div>
      {code ? (
        <div className={styles.notice} role="status">
          <code className={styles.code}>{code}</code>
          <p className={styles.note}>Informe este código no popup da extensão. Ele expira em 5 minutos.</p>
        </div>
      ) : null}
    </div>
  );
}

export function ExtensionHelpLite() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={page.button} onClick={() => setOpen(true)}>
        <CircleHelp aria-hidden="true" size={16} />
        Como funciona
      </button>
      <LiteSidePanel open={open} onOpenChange={setOpen} title="AncoraHub Assistant no WhatsApp Web" description="Um apoio contextual para o seu atendimento, nunca um disparador automático.">
        <ol className={styles.steps}>
          <li><strong>Instale.</strong> Baixe o arquivo e adicione a extensão no Chrome. Não há comando para executar.</li>
          <li><strong>Ative neste navegador.</strong> Gere o código temporário nesta tela e informe no popup da extensão.</li>
          <li><strong>Abra o WhatsApp Web.</strong> O painel só aparece quando a conversa pertence a um lead atribuído a você e à sua unidade.</li>
          <li><strong>Trabalhe com segurança.</strong> Você decide cada ação; a extensão não envia mensagens, não abre conversas e não lê listas de contatos.</li>
        </ol>
      </LiteSidePanel>
    </>
  );
}
