import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { LightAuthShell, LightAuthTitle } from "@/components/light/light-auth-shell";
import { SELF_CONFIRM_LATE_MESSAGE, SELF_CONFIRM_OPENS_MINUTES } from "@/features/lead-distribution/duty-presence-domain";
import { ConfirmDutyPresenceButton } from "./confirm-duty-presence-button";

export type ConfirmPresenceRecord = {
  id: string;
  assignmentId: string;
  brokerName: string;
  scheduleName: string;
  branchName: string | null;
  timezone: string;
  shiftStartsAt: Date;
};

/** Tela pública de confirmação de plantão (sem login). Separada da consulta para a moldura de desenvolvimento. */
export function ConfirmPresenceView({ valid, record, confirmed, late, active, presencial, notOpen }: {
  valid: boolean;
  record: ConfirmPresenceRecord | null;
  confirmed: boolean;
  late: boolean;
  active: boolean;
  presencial: boolean;
  notOpen: boolean;
}) {
  const muted = { margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.5 } as const;
  const strong = { color: "var(--foreground)", fontWeight: 500 } as const;
  // Visual Lite para todo mundo (Onda 8): a mesma moldura das telas de acesso, os mesmos estados e textos.
  return <LightAuthShell>
    <LightAuthTitle
      title={record ? `Plantão ${record.scheduleName}` : "Confirmação de plantão"}
      description={record ? `${record.branchName ? `${record.branchName} · ` : ""}${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: record.timezone }).format(record.shiftStartsAt)}` : "Confirme sua presença na escala informada pela equipe."}
    />
    <div style={{ display: "grid", gap: 16 }}>
      {!valid || !record ? <p role="alert" style={muted}>Este link não é válido ou não está mais disponível. Peça um novo lembrete à gestão.</p> : confirmed ? <div style={{ display: "grid", gap: 8 }}><CheckCircle2 size={24} strokeWidth={1.75} style={{ color: "var(--success)" }} aria-hidden="true" /><p style={{ ...strong, margin: 0 }}>Presença confirmada</p><p style={muted}>Obrigado, {record.brokerName}. Você está elegível para receber leads deste plantão enquanto ele estiver ativo.</p></div> : late ? <p role="alert" style={muted}>{SELF_CONFIRM_LATE_MESSAGE}</p> : active && presencial ? <><p style={muted}>Olá, <span style={strong}>{record.brokerName}</span>. Este plantão é <span style={strong}>presencial</span>: você precisa estar na unidade durante todo o plantão. Já na unidade, abra o app e tire uma foto do local; o diretor valida a foto e libera você.</p><Link href={`/plantoes/agora?assignment=${encodeURIComponent(record.assignmentId)}`} style={{ display: "inline-flex", minHeight: 44, width: "100%", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "var(--primary)", color: "var(--primary-foreground)", fontSize: "var(--text-sm)", fontWeight: 500, textDecoration: "none" }}>Abrir o app e tirar a foto</Link></> : active ? <><p style={muted}>Olá, <span style={strong}>{record.brokerName}</span>. Toque abaixo para confirmar que está disponível para este plantão.</p><ConfirmDutyPresenceButton confirmationId={record.id} /></> : notOpen ? <p role="status" style={muted}>A confirmação abre {SELF_CONFIRM_OPENS_MINUTES} minutos antes do início do plantão. Volte então para confirmar.</p> : <p role="alert" style={muted}>O prazo deste plantão terminou. Entre em contato com a gestão se precisar de ajuda.</p>}
    </div>
  </LightAuthShell>;
}
