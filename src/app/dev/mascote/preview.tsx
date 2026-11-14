"use client";

import { useState } from "react";

import { LiteActionButton } from "@/components/lite/controls";
import { Mascot, MASCOT_STATES, type MascotState } from "@/components/mascot";
import { SPLASH_KEY } from "@/components/splash-screen";
import { A11yPrefsProvider } from "@/features/assist/a11y-prefs";
import { AccessibilityPreferences } from "@/features/assist/components/accessibility-preferences";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Prévia do mascote (só em desenvolvimento): cada estado, a demonstração do lead aceito com o botão
 * de ação e a splash. Dados falsos; nenhuma chamada ao servidor.
 */
export function MascotePreview() {
  const [state, setState] = useState<MascotState>("idle");
  const [play, setPlay] = useState(0);
  const [fail, setFail] = useState(false);

  function show(next: MascotState) {
    setState(next);
    setPlay((n) => n + 1);
  }

  async function accept() {
    show("loading");
    await wait(900);
    if (fail) {
      show("error");
      return { ok: false as const, reason: "O aceite não foi registrado" };
    }
    return { ok: true as const };
  }

  function replaySplash() {
    try { sessionStorage.removeItem(SPLASH_KEY); } catch { /* sem storage */ }
    delete document.documentElement.dataset.splash;
    window.location.reload();
  }

  return (
    <A11yPrefsProvider>
      <main className="arc-venancor min-h-dvh bg-white px-4 py-8 text-[var(--foreground)]">
        <div className="mx-auto flex max-w-[720px] flex-col gap-8">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl font-medium">Mascote da Âncora Saúde</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Arte de reserva com movimento provisório. O personagem articulado entra quando o arquivo .riv existir (MASCOTE.md).
            </p>
          </header>

          <section className="flex flex-col items-center gap-4" aria-label="Estados do mascote">
            <Mascot state={state} playKey={play} size={220} priority />
            <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">Estado: {state}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {MASCOT_STATES.map((name) => (
                <button key={name} type="button" onClick={() => show(name)} aria-pressed={state === name} className="min-h-11 rounded-full border border-[var(--border)] px-4 text-sm aria-pressed:bg-[var(--surface-muted)]">
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-label="Demonstração do lead aceito">
            <h2 className="text-base font-medium">Lead aceito</h2>
            <p className="text-sm text-[var(--text-secondary)]">O mascote espera (loading) e só comemora depois da confirmação (lead_accepted). Com falha, fica atento (error).</p>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />
              Simular falha ao aceitar
            </label>
            <LiteActionButton
              key={`${fail}-${play === 0 ? 0 : 1}`}
              busyLabel="Aceitando…"
              doneLabel="Lead é seu"
              keeps="O lead continua esperando você"
              onAction={accept}
              onDone={() => show("lead_accepted")}
            >
              Aceitar e chamar no WhatsApp
            </LiteActionButton>
            <button type="button" className="min-h-11 self-start text-sm underline" onClick={() => { show("idle"); setPlay(0); }}>
              Recomeçar a demonstração
            </button>
          </section>

          <section className="flex flex-col gap-3" aria-label="Splash">
            <h2 className="text-base font-medium">Splash</h2>
            <p className="text-sm text-[var(--text-secondary)]">Aparece uma vez por sessão. Este botão limpa a marca e recarrega a página para ver de novo.</p>
            <button type="button" className="min-h-11 self-start rounded-full border border-[var(--border)] px-4 text-sm" onClick={replaySplash}>Ver a splash de novo</button>
          </section>

          <section className="flex flex-col gap-3" aria-label="Preferências">
            <h2 className="text-base font-medium">Preferências deste aparelho</h2>
            <AccessibilityPreferences />
          </section>
        </div>
      </main>
    </A11yPrefsProvider>
  );
}
