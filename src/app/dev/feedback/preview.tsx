"use client";

import { useState } from "react";

import { AssistantAvatar, type MascotMood } from "@/components/chat/assistant-avatar";
import { DynamicNotice, type DynamicNoticeItem } from "@/components/chat/dynamic-notice";
import { leadNoticeTitle } from "@/components/chat/notice-titles";
import { LiteActionButton } from "@/components/lite/controls";
import { A11yPrefsProvider } from "@/features/assist/a11y-prefs";
import { AccessibilityPreferences } from "@/features/assist/components/accessibility-preferences";
import type { JourneyCelebration } from "@/features/engagement/journey-types";
import { CelebrationLayer } from "@/features/journey/components/celebration-layer";
import { fireFeedback } from "@/lib/feedback/use-feedback";
import type { FeedbackKind } from "@/lib/feedback/tokens";

const MOODS: { mood: MascotMood; label: string }[] = [
  { mood: "idle", label: "Repouso" },
  { mood: "alert", label: "Atento" },
  { mood: "thinking", label: "Pensando" },
  { mood: "cheer", label: "Comemorando" },
];

const SOUNDS: { kind: FeedbackKind; label: string }[] = [
  { kind: "tap", label: "Toque" },
  { kind: "confirm", label: "Confirmação" },
  { kind: "milestone", label: "Marco" },
  { kind: "notify", label: "Lead novo" },
  { kind: "error", label: "Erro" },
  { kind: "warning", label: "Alerta" },
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 shadow-[var(--shadow-resting)]">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Chip({ onClick, children, pressed }: { onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="min-h-11 rounded-full bg-[var(--surface-muted)] px-4 text-sm aria-pressed:bg-[var(--chat-action-soft)] aria-pressed:text-[var(--chat-action-text)]">
      {children}
    </button>
  );
}

function celebration(kind: "points" | "mission" | "level"): JourneyCelebration {
  const id = `demo-${kind}-${Date.now()}`;
  const base = { id, userId: "demo", priority: 50, createdAt: new Date().toISOString(), seenAt: null };
  if (kind === "points") return { ...base, kind, payload: { kind, points: 15, ruleKey: "mission.completed", label: "Contato dentro do prazo" } };
  if (kind === "mission") return { ...base, kind, payload: { kind, missionId: "m1", title: "5 contatos no prazo hoje", bonusPoints: 30, periodKey: "2026-11-14" } };
  return { ...base, kind, payload: { kind, level: { index: 2, name: "Especialista", threshold: 2000 }, totalPoints: 2010 } };
}

/** Vitrine do feedback padrão (docs/design-system/FEEDBACK.md). Só em desenvolvimento, dados falsos. */
export function FeedbackPreview() {
  const [fail, setFail] = useState(false);
  const [delay, setDelay] = useState(800);
  const [buttonKey, setButtonKey] = useState(0);
  const [mood, setMood] = useState<MascotMood>("idle");
  const [moodKey, setMoodKey] = useState(0);
  const [notice, setNotice] = useState<DynamicNoticeItem | null>(null);
  const [moments, setMoments] = useState<JourneyCelebration[]>([]);

  function showNotice() {
    const id = `demo-${Date.now()}`;
    fireFeedback("notify");
    setNotice({ id, app: "Leads", title: leadNoticeTitle(id, "Novo lead recebido"), message: "Maria Souza, plano familiar, 3 vidas. Chegou pelo Meta Ads.", actionLabel: "Atender", shape: "mochi", hue: 212, pillLabel: "Lead novo" });
  }

  return (
    <A11yPrefsProvider>
      <main className="arc-venancor min-h-dvh bg-[var(--background)] px-4 pb-24 pt-6">
        <div className="mx-auto flex max-w-[720px] flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h1 className="text-[22px] font-medium">Feedback padrão</h1>
            <p className="text-sm text-[var(--text-secondary)]">Teste o botão de ação, o mascote, o aviso de lead novo, as celebrações e os sons. Dados de exemplo; nada chega ao servidor.</p>
          </header>

          <Card title="Botão de ação" hint="Toque, espera, check em verde ou X em vermelho com a causa, e volta como Tentar de novo depois de 1,4 s.">
            <div className="flex flex-wrap gap-2">
              <Chip pressed={!fail} onClick={() => { setFail(false); setButtonKey((k) => k + 1); }}>Simular sucesso</Chip>
              <Chip pressed={fail} onClick={() => { setFail(true); setButtonKey((k) => k + 1); }}>Simular falha</Chip>
              <Chip pressed={delay === 2500} onClick={() => { setDelay((d) => (d === 800 ? 2500 : 800)); setButtonKey((k) => k + 1); }}>Servidor lento</Chip>
            </div>
            <LiteActionButton
              key={buttonKey}
              busyLabel="Aceitando…"
              doneLabel="Lead é seu"
              keeps="O lead continua esperando você"
              onAction={async () => {
                await wait(delay);
                return fail ? { ok: false, reason: "O aceite não foi registrado" } : { ok: true };
              }}
            >
              Aceitar e chamar no WhatsApp
            </LiteActionButton>
            <Chip onClick={() => setButtonKey((k) => k + 1)}>Recomeçar o botão</Chip>
          </Card>

          <Card title="Mascote" hint="Cada humor roda uma passada. Toque de novo para repetir.">
            <div className="flex items-center gap-5">
              <AssistantAvatar key={moodKey} shape="mochi" hue={212} size={88} mood={mood} />
              <div className="flex flex-wrap gap-2">
                {MOODS.map((item) => (
                  <Chip key={item.mood} pressed={mood === item.mood} onClick={() => { setMood(item.mood); setMoodKey((k) => k + 1); }}>{item.label}</Chip>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Lead novo" hint="O aviso desce com o mascote atento, som e vibração. O título varia sem repetir o último.">
            <div className="flex flex-wrap gap-2">
              <Chip onClick={showNotice}>Simular lead novo</Chip>
              <Chip onClick={() => setNotice(null)}>Fechar aviso</Chip>
            </div>
          </Card>

          <Card title="Celebrações" hint="Pontos e missão são nível 2 (uma vez por dia com som). Nível é nível 3, com confete. Desligue Comemorações abaixo para ver só a confirmação.">
            <div className="flex flex-wrap gap-2">
              <Chip onClick={() => setMoments((list) => [...list, celebration("points")])}>Pontos</Chip>
              <Chip onClick={() => setMoments((list) => [...list, celebration("mission")])}>Missão</Chip>
              <Chip onClick={() => setMoments((list) => [...list, celebration("level")])}>Novo nível</Chip>
              <Chip onClick={() => { try { window.localStorage.removeItem("ancora:feedback-budget"); } catch { /* sem storage */ } }}>Zerar limite do dia</Chip>
            </div>
          </Card>

          <Card title="Sons e vibração" hint="Cada camada sozinha. Respeitam os interruptores abaixo.">
            <div className="flex flex-wrap gap-2">
              {SOUNDS.map((item) => <Chip key={item.kind} onClick={() => fireFeedback(item.kind, { sound: true })}>{item.label}</Chip>)}
            </div>
          </Card>

          <Card title="Preferências deste aparelho" hint="As mesmas de Configurações > Acessibilidade.">
            <AccessibilityPreferences />
          </Card>
        </div>
        <DynamicNotice item={notice} onOpen={() => setNotice(null)} onDismiss={() => setNotice(null)} />
        <CelebrationLayer items={moments} onSeen={(ids) => setMoments((list) => list.filter((item) => !ids.includes(item.id)))} />
      </main>
    </A11yPrefsProvider>
  );
}
