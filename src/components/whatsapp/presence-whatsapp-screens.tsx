"use client";

import * as React from "react";

import { CheckCircle, LockKey, WhatsappLogo } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PRESENCE_WHATSAPP_COPY } from "@/features/waha-cadence/pairing-copy";

import { PairingCodeDemo } from "./pairing-code-demo";
import { PairingCodePanel, PairingCodeTutorial, type PairingCodePanelProps } from "./whatsapp-pairing-panel";

/**
 * Telas da conexão pedida ao confirmar presença (05/11): pouca informação por vez.
 * 1) vantagens + privacidade + um botão; 2) código + abrir o WhatsApp + animação; 3) conectado.
 */
export function PresenceWhatsAppIntro({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-ds-16">
      <div className="space-y-ds-8">
        <span className="grid size-10 place-items-center rounded-full bg-success/15 text-success"><WhatsappLogo className="size-5" /></span>
        <DialogTitle>{PRESENCE_WHATSAPP_COPY.title}</DialogTitle>
      </div>
      <ul className="space-y-ds-8">
        {PRESENCE_WHATSAPP_COPY.benefits.map((benefit) => (
          <li key={benefit} className="flex gap-ds-8 text-ds-body text-ds-charcoal">
            <CheckCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-ds-cards border border-ds-ash bg-ds-canvas-white p-ds-12">
        <div className="flex items-center gap-ds-8 text-ds-body font-semibold text-ds-charcoal"><LockKey aria-hidden="true" className="size-4" /><span>{PRESENCE_WHATSAPP_COPY.privacyTitle}</span></div>
        <DialogDescription className="mt-ds-4 text-ds-caption">{PRESENCE_WHATSAPP_COPY.privacy}</DialogDescription>
      </div>
      <Button className="w-full" size="lg" onClick={onStart}>{PRESENCE_WHATSAPP_COPY.start}</Button>
    </div>
  );
}

export function PresenceWhatsAppCode({ panel, onOpenWhatsApp }: { panel: PairingCodePanelProps; onOpenWhatsApp: () => void }) {
  const [showSteps, setShowSteps] = React.useState(false);
  return (
    <div className="space-y-ds-16">
      <DialogTitle className="text-center">{panel.code ? "Digite este código no WhatsApp" : "Seu código de conexão"}</DialogTitle>
      <PairingCodePanel {...panel} onOpenWhatsApp={onOpenWhatsApp} hideActions />
      {panel.code ? (
        <Button className="w-full" size="lg" onClick={onOpenWhatsApp}>
          <WhatsappLogo className="size-4" /> {PRESENCE_WHATSAPP_COPY.openWhatsApp}
        </Button>
      ) : null}
      <PairingCodeDemo code={panel.code} />
      <p className="text-center text-ds-caption text-ds-fog">{PRESENCE_WHATSAPP_COPY.autoConfirm}</p>
      <button type="button" onClick={() => setShowSteps((current) => !current)} className="mx-auto block text-ds-caption font-medium text-ds-electric-blue underline-offset-4 hover:underline">
        {showSteps ? PRESENCE_WHATSAPP_COPY.hideSteps : PRESENCE_WHATSAPP_COPY.showSteps}
      </button>
      {showSteps ? <PairingCodeTutorial /> : null}
    </div>
  );
}

export function PresenceWhatsAppConnected() {
  return (
    <div className="grid place-items-center gap-ds-12 py-ds-24 text-center" role="status">
      <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success"><WhatsappLogo className="size-6" /></span>
      <DialogTitle>{PRESENCE_WHATSAPP_COPY.connected}</DialogTitle>
    </div>
  );
}
