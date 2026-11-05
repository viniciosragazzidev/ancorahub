"use client";

import { useState } from "react";
import { notFound } from "next/navigation";

import { Dialog, DialogPopup } from "@/components/ui/dialog";
import { PresenceWhatsAppCode, PresenceWhatsAppConnected, PresenceWhatsAppIntro } from "@/components/whatsapp/presence-whatsapp-screens";

/**
 * Revisão visual da conexão pedida ao confirmar presença (05/11) — só em desenvolvimento.
 * As mesmas telas do diálogo real, com dados simulados: nenhuma chamada ao WhatsApp.
 */
type Screen = "intro" | "phone" | "generating" | "code" | "connected";
const SCREENS: { id: Screen; label: string }[] = [
  { id: "intro", label: "1. Vantagens" },
  { id: "phone", label: "2a. Número" },
  { id: "generating", label: "2b. Gerando" },
  { id: "code", label: "2c. Código" },
  { id: "connected", label: "3. Conectado" },
];

export default function PresenceWhatsAppPreviewPage() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [phone, setPhone] = useState(screen === "phone" ? "" : "21987654321");
  if (process.env.NODE_ENV !== "development") notFound();

  const panel = {
    phase: (screen === "code" ? "qr" : "starting") as "qr" | "starting",
    phone: screen === "phone" ? "" : phone,
    onPhoneChange: setPhone,
    code: screen === "code" ? "K7QM-2XPD" : null,
    generating: screen === "generating",
    cooldownSeconds: 0,
    expired: false,
    onGenerate: () => setScreen("code"),
    onOpenWhatsApp: () => undefined,
  };

  return (
    <main className="min-h-dvh bg-ds-canvas-white p-ds-16">
      <Dialog open>
        <DialogPopup className="max-w-md">
          {screen === "intro" ? <PresenceWhatsAppIntro onStart={() => setScreen("generating")} />
            : screen === "connected" ? <PresenceWhatsAppConnected />
              : <PresenceWhatsAppCode panel={panel} onOpenWhatsApp={() => undefined} />}
          <nav aria-label="Telas (preview)" className="mt-ds-16 flex flex-wrap gap-ds-4 border-t border-ds-ash pt-ds-8">
            {SCREENS.map((item) => (
              <button key={item.id} type="button" onClick={() => setScreen(item.id)} className="rounded-full border border-ds-ash px-ds-8 py-0.5 text-ds-caption" aria-pressed={screen === item.id}>
                {item.label}
              </button>
            ))}
          </nav>
        </DialogPopup>
      </Dialog>
    </main>
  );
}
