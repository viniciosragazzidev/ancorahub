"use client";

import { useState } from "react";
import { Clock3 } from "lucide-react";

import chatStyles from "@/components/chat/chat.module.css";
import { PresenceCallout } from "@/components/chat/presence-callout";
import { BrokerLiveStatus } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/broker-live-status";
import { WhatsAppHandoff } from "@/features/broker-workspace/whatsapp-handoff/whatsapp-handoff";

const lead = {
  name: "Maria Aparecida Souza",
  wants: "Quer um plano para ela, o marido e a filha; hoje paga caro num plano individual.",
  plan: "Amil · Pessoa física",
  lives: "3 vidas · idades 41, 44 e 12",
  city: "Niterói",
};

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export function AceiteContadorPreview({ tela, estado }: { tela: string; estado: string }) {
  const [open, setOpen] = useState(true);

  if (tela === "presenca") {
    return (
      <div className={`arc-venancor ${chatStyles.root}`} style={{ minHeight: "100vh", background: "var(--background)", padding: 20 }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <PresenceCallout
            ask={{ assignmentId: "a1", scheduleName: "Online manhã", branchName: "Centro", mode: "online", startsAt: inMinutes(-12), endsAt: inMinutes(228), status: "confirmed", photoId: null, startInterval: true }}
          />
        </div>
      </div>
    );
  }

  if (tela === "diretor") {
    const rows = [
      { name: "Ana Beatriz Nascimento", status: "start_interval" as const, next: inMinutes(5.2) },
      { name: "Roberto Fernandes", status: "ready" as const, next: null },
      { name: "Camila Rocha", status: "blocked" as const, next: null },
    ];
    return (
      <div className="arc-venancor" style={{ minHeight: "100vh", background: "var(--background)", padding: 20 }}>
        <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-border p-4">
          <h2 className="text-sm font-medium">Confirmação da escala · 2/5 confirmados</h2>
          <p role="status" className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Clock3 className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
            <span>Começo do plantão: 1 lead a cada 8 min por corretor até todos confirmarem (2 de 5 confirmados · até 10:00).</span>
          </p>
          <ul className="mt-4 grid gap-3">
            {rows.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border px-3 py-2.5 text-sm">
                <span>{row.name}</span>
                <span className="shrink-0"><BrokerLiveStatus status={row.status} nextEventAt={row.next} /></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={`arc-venancor ${chatStyles.root}`} style={{ minHeight: "100vh", background: "var(--background)", padding: 20 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 12 }}>
        <p className="text-xs text-muted-foreground">Tela do lead (fundo de exemplo)</p>
        <div className="rounded-[var(--radius-card)] border border-border p-4 text-sm">Maria Aparecida Souza · Em atendimento</div>
        <div className="rounded-[var(--radius-card)] border border-border p-4 text-sm text-muted-foreground">Conversa com o cliente…</div>
        {!open ? <button type="button" className="text-sm underline" onClick={() => setOpen(true)}>Mostrar de novo</button> : null}
      </div>
      {open ? (
        <WhatsAppHandoff
          lead={lead}
          // Link que não é do WhatsApp: na prévia, ao zerar, nada abre (vira "Toque para abrir").
          whatsappUrl="https://exemplo.invalid/"
          onClose={() => setOpen(false)}
          initialPhase={estado === "falhou" ? "failed" : "counting"}
        />
      ) : null}
    </div>
  );
}
