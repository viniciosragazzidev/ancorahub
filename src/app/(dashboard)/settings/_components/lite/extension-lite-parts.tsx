"use client";

/** Peças de cliente da extensão no visual Lite: gerar o código de ativação e a ajuda "Como funciona" no painel lateral. */
import { useState, useTransition } from "react";
import { CircleHelp } from "lucide-react";

import { LiteSidePanel } from "@/components/lite/data/side-panel";
import page from "@/components/lite/page/lite-page.module.css";
import { createExtensionCodeAction } from "@/features/browser-extension/actions";

import styles from "@/components/lite/page/lite-sections.module.css";

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

export function ExtensionHelpLite({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={page.button} onClick={() => setOpen(true)}>
        <CircleHelp aria-hidden="true" size={16} />
        Como funciona
      </button>
      <LiteSidePanel open={open} onOpenChange={setOpen} title="AncoraHub Assistant no WhatsApp Web" description="Um apoio contextual para o seu atendimento, nunca um disparador automático.">
        <ol className={styles.steps}>
          <li><strong>Baixe e extraia.</strong> Use o pacote v{version} disponível nesta tela.</li>
          <li><strong>Instale no Chrome.</strong> Em chrome://extensions, ative o modo desenvolvedor, clique em “Carregar sem compactação” e escolha a pasta extraída.</li>
          <li><strong>Conecte em um clique.</strong> No popup da extensão, clique em “Conectar ao CRM”. Se necessário, o código temporário desta tela continua como alternativa.</li>
          <li><strong>Abra o WhatsApp Web.</strong> O painel só aparece quando a conversa pertence a um lead atribuído a você e à sua unidade.</li>
          <li><strong>Atualize cada versão.</strong> Baixe e extraia o pacote novo pelo CRM e clique em “Atualizar” em chrome://extensions.</li>
          <li><strong>Atenda com segurança.</strong> Você decide cada ação; a extensão nunca envia mensagens automaticamente nem lê listas de contatos.</li>
        </ol>
      </LiteSidePanel>
    </>
  );
}
